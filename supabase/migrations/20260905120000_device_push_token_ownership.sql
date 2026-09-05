-- Device push token ownership.
--
-- A device token belongs to the last user who registers it:
--   1. Registering a token claims it for the registering user.
--   2. A claim deactivates every other user's row for the same token.
--   3. A send never targets a token whose current owner is not the recipient.
--
-- Offline logout cannot deactivate the departing user's row from the client
-- (docs/release-readiness/code-audit.md), so the shared-device handover has to
-- be enforced in the database at the moment the next user registers the same
-- token, not at the moment the previous user signs out.

-- ---------------------------------------------------------------------------
-- claimed_at: when this user last registered this token.
-- ---------------------------------------------------------------------------
alter table public.device_push_tokens
  add column if not exists claimed_at timestamptz;

alter table public.device_push_tokens
  alter column claimed_at set default now();

-- Backfill from updated_at, the closest existing record of the last
-- registration write. The updated_at trigger is suspended for the backfill so
-- historic rows do not all look freshly written afterwards, which would defer
-- the client's staleness-based re-registration by a week.
do $$
declare
  has_updated_at_trigger boolean := exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.device_push_tokens'::regclass
      and tgname = 'set_device_push_tokens_updated_at'
      and not tgisinternal
  );
begin
  if has_updated_at_trigger then
    alter table public.device_push_tokens disable trigger set_device_push_tokens_updated_at;
  end if;

  update public.device_push_tokens
  set claimed_at = updated_at
  where claimed_at is null;

  if has_updated_at_trigger then
    alter table public.device_push_tokens enable trigger set_device_push_tokens_updated_at;
  end if;
end;
$$;

alter table public.device_push_tokens
  alter column claimed_at set not null;

comment on column public.device_push_tokens.claimed_at is
  'When this user last registered this device token. Among rows sharing a token, the newest claimed_at is the current owner.';

-- ---------------------------------------------------------------------------
-- One active owner per token.
-- ---------------------------------------------------------------------------

-- Existing data predates the rule, so a token may already have several active
-- rows. Keep the newest claim and retire the rest before the index lands.
with ranked as (
  select
    id,
    row_number() over (
      partition by expo_push_token
      order by claimed_at desc, updated_at desc, created_at desc, id desc
    ) as claim_rank
  from public.device_push_tokens
  where active
)
update public.device_push_tokens as t
set active = false
from ranked
where ranked.id = t.id
  and ranked.claim_rank > 1;

create unique index if not exists device_push_tokens_one_active_owner_idx
  on public.device_push_tokens (expo_push_token)
  where active;

-- Supports the ownership lookup below, which has to consider inactive rows of
-- other users, so the partial index above cannot serve it.
create index if not exists device_push_tokens_token_claimed_idx
  on public.device_push_tokens (expo_push_token, claimed_at desc);

-- ---------------------------------------------------------------------------
-- The claim itself.
-- ---------------------------------------------------------------------------

-- security definer: the row-level policies deliberately confine a user to
-- their own rows, so the departing user's row can only be retired by the
-- database on the claimant's behalf.
create or replace function public.claim_device_push_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active is not true then
    return new;
  end if;

  -- clock_timestamp(), not now(): two claims inside one transaction must still
  -- order, otherwise the later claimant cannot be told from the earlier one.
  new.claimed_at := clock_timestamp();

  -- The recursive fire on these rows exits at the guard above, because they
  -- are being deactivated.
  update public.device_push_tokens as prior
  set active = false
  where prior.expo_push_token = new.expo_push_token
    and prior.user_id <> new.user_id
    and prior.active;

  return new;
end;
$$;

comment on function public.claim_device_push_token() is
  'Claims a device token for the registering user and deactivates every other user''s row for the same token.';

drop trigger if exists device_push_tokens_claim_device on public.device_push_tokens;
create trigger device_push_tokens_claim_device
before insert or update on public.device_push_tokens
for each row
when (new.active)
execute function public.claim_device_push_token();

-- ---------------------------------------------------------------------------
-- The send-side filter.
-- ---------------------------------------------------------------------------

-- security invoker: the only caller is the service role, which already reads
-- this table, so there is nothing to elevate. Rows are returned only when the
-- recipient is still the token's current owner.
create or replace function public.active_device_push_tokens(p_user_id uuid)
returns table (expo_push_token text, platform text, updated_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select t.expo_push_token, t.platform, t.updated_at
  from public.device_push_tokens as t
  where t.user_id = p_user_id
    and t.active
    and not exists (
      select 1
      from public.device_push_tokens as other
      where other.expo_push_token = t.expo_push_token
        and other.user_id <> t.user_id
        and (other.active or other.claimed_at > t.claimed_at)
    )
  order by t.updated_at desc;
$$;

comment on function public.active_device_push_tokens(uuid) is
  'Push tokens that are safe to send to for this user: active, and not claimed by a later owner.';

revoke all on function public.active_device_push_tokens(uuid) from public, anon, authenticated;
grant execute on function public.active_device_push_tokens(uuid) to service_role;

notify pgrst, 'reload schema';
