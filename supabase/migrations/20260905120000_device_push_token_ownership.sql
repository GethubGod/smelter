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
--
-- Ownership comparisons are only sound on a single canonical spelling of a
-- token, and only if the clock that orders claims is server controlled. Both
-- are enforced here, on every write, for every caller.

-- The table is small (at most one row per user per device) and every statement
-- below is bounded, so a lock wait is a bug rather than something to sit out.
set lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Canonical token form.
-- ---------------------------------------------------------------------------

-- Mirrors sanitizeExpoPushToken in supabase/functions/_shared/reminders.ts:
-- trim, then require an Expo token prefix. Kept immutable so the check
-- constraint below can use it. Postgres \s and JavaScript String.trim() differ
-- on exotic Unicode spaces; neither appears in an Expo token, and anything that
-- still disagrees is rejected outright by the prefix test.
create or replace function public.canonical_expo_push_token(p_token text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(regexp_replace(coalesce(p_token, ''), '^\s+|\s+$', '', 'g'), '')
$$;

comment on function public.canonical_expo_push_token(text) is
  'The single spelling of an Expo push token that ownership is compared on.';

create or replace function public.is_expo_push_token(p_token text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_token is not null
     and (p_token like 'ExponentPushToken[%' or p_token like 'ExpoPushToken[%')
$$;

comment on function public.is_expo_push_token(text) is
  'True when the value is a canonical Expo push token the sender would accept.';

-- ---------------------------------------------------------------------------
-- Data repair, ahead of the constraints that will forbid the old shapes.
--
-- The updated_at trigger stays off for the whole repair: these statements
-- rewrite history rather than record activity, and the claim order below is
-- read from updated_at.
-- ---------------------------------------------------------------------------
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

  -- 1. Rows the sender could never have delivered to. sanitizeExpoPushToken
  --    drops them, so they hold no reachable device, but they would block the
  --    canonical-form constraint.
  delete from public.device_push_tokens
  where not public.is_expo_push_token(public.canonical_expo_push_token(expo_push_token));

  -- 2. Two spellings of one token by one user are one registration. Keep the
  --    active row, then the most recently written, and drop the aliases so the
  --    (user_id, expo_push_token) unique constraint survives canonicalization.
  delete from public.device_push_tokens as t
  using (
    select
      id,
      row_number() over (
        partition by user_id, public.canonical_expo_push_token(expo_push_token)
        order by active desc, updated_at desc, created_at desc, id desc
      ) as alias_rank
    from public.device_push_tokens
  ) as ranked
  where ranked.id = t.id
    and ranked.alias_rank > 1;

  update public.device_push_tokens
  set expo_push_token = public.canonical_expo_push_token(expo_push_token)
  where expo_push_token is distinct from public.canonical_expo_push_token(expo_push_token);

  -- 3. claimed_at: when this user last registered this token.
  alter table public.device_push_tokens
    add column if not exists claimed_at timestamptz;

  alter table public.device_push_tokens
    alter column claimed_at set default now();

  -- An active row's updated_at is its last registration write, so it is the
  -- best available claim. An inactive row's updated_at may instead be a late
  -- sign-out landing after the current owner registered, which must never be
  -- read as the newer claim. Inactive rows fall back to their own creation
  -- time, clamped below the active owner's claim on the same token.
  update public.device_push_tokens as t
  set claimed_at = case
    when t.active then t.updated_at
    else least(
      t.created_at,
      t.updated_at,
      coalesce(owner.owner_claim - interval '1 microsecond', 'infinity'::timestamptz)
    )
  end
  from (
    select expo_push_token, max(updated_at) as owner_claim
    from public.device_push_tokens
    where active
    group by expo_push_token
  ) as owner
  where owner.expo_push_token = t.expo_push_token
    and t.claimed_at is null;

  -- Tokens with no active row at all have no owner to stay under.
  update public.device_push_tokens
  set claimed_at = case when active then updated_at else least(created_at, updated_at) end
  where claimed_at is null;

  -- 4. One active owner per token. Existing data predates the rule, so keep
  --    the newest claim and retire the rest before the index lands.
  update public.device_push_tokens as t
  set active = false
  from (
    select
      id,
      row_number() over (
        partition by expo_push_token
        order by claimed_at desc, updated_at desc, created_at desc, id desc
      ) as claim_rank
    from public.device_push_tokens
    where active
  ) as ranked
  where ranked.id = t.id
    and ranked.claim_rank > 1;

  if has_updated_at_trigger then
    alter table public.device_push_tokens enable trigger set_device_push_tokens_updated_at;
  end if;
end;
$$;

comment on column public.device_push_tokens.claimed_at is
  'Server-stamped time of this user''s last registration of this token. Among rows sharing a token, the newest claimed_at is the current owner.';

-- NOT NULL through a validated check: VALIDATE takes only SHARE UPDATE
-- EXCLUSIVE, so registrations keep running, and SET NOT NULL then skips its
-- own table scan because the proven constraint already implies it.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.device_push_tokens'::regclass
      and conname = 'device_push_tokens_claimed_at_present'
  ) then
    alter table public.device_push_tokens
      add constraint device_push_tokens_claimed_at_present
      check (claimed_at is not null) not valid;
  end if;
end;
$$;

alter table public.device_push_tokens
  validate constraint device_push_tokens_claimed_at_present;

alter table public.device_push_tokens
  alter column claimed_at set not null;

-- The column constraint now carries the rule; the check has done its job.
alter table public.device_push_tokens
  drop constraint device_push_tokens_claimed_at_present;

-- Canonical form, declared rather than only enforced by the trigger, so a
-- future trigger change cannot quietly reintroduce alias rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.device_push_tokens'::regclass
      and conname = 'device_push_tokens_expo_push_token_canonical'
  ) then
    alter table public.device_push_tokens
      add constraint device_push_tokens_expo_push_token_canonical
      check (
        expo_push_token = public.canonical_expo_push_token(expo_push_token)
        and public.is_expo_push_token(expo_push_token)
      ) not valid;
  end if;
end;
$$;

alter table public.device_push_tokens
  validate constraint device_push_tokens_expo_push_token_canonical;

-- ---------------------------------------------------------------------------
-- Indexes.
--
-- Not CREATE INDEX CONCURRENTLY: it cannot run inside a transaction block, and
-- both of this repo's runners wrap a migration in one (scripts/local-db/
-- full-stack.sh applies with --single-transaction, and the Supabase CLI does
-- the same on push). The production row count is unknown from this worktree,
-- which has no read access to the production database, but the table holds at
-- most one row per user per device for a single-restaurant tenant, so both
-- builds are expected to be sub-second. lock_timeout above bounds the damage
-- if that assumption is wrong.
-- ---------------------------------------------------------------------------
create unique index if not exists device_push_tokens_one_active_owner_idx
  on public.device_push_tokens (expo_push_token)
  where active;

-- Supports the ownership lookup below, which has to consider inactive rows of
-- other users, so the partial index above cannot serve it.
create index if not exists device_push_tokens_token_claimed_idx
  on public.device_push_tokens (expo_push_token, claimed_at desc);

-- ---------------------------------------------------------------------------
-- The claim itself.
--
-- One trigger, not two, and no WHEN clause: canonicalization has to run on
-- every write, and splitting it into a second trigger would make correctness
-- depend on trigger name ordering.
--
-- security definer: the row-level policies deliberately confine a user to
-- their own rows, so the departing user's row can only be retired by the
-- database on the claimant's behalf.
-- ---------------------------------------------------------------------------
create or replace function public.claim_device_push_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  -- A non-activating update is a deactivation, not a registration. The
  -- ownership clock and the token identity are server owned, so pin them back
  -- rather than raising: sign-out must never fail because the client sent a
  -- stale or invented value alongside active = false. Checked before
  -- canonicalization for the same reason.
  if tg_op = 'UPDATE' and new.active is not true then
    new.expo_push_token := old.expo_push_token;
    new.claimed_at := old.claimed_at;
    return new;
  end if;

  v_token := public.canonical_expo_push_token(new.expo_push_token);

  if not public.is_expo_push_token(v_token) then
    raise exception 'expo_push_token is not an Expo push token'
      using errcode = '22023';
  end if;

  new.expo_push_token := v_token;

  if new.active is not true then
    -- An inactive insert claims nothing, but its clock is still server owned.
    new.claimed_at := clock_timestamp();
    return new;
  end if;

  -- Serialize claims on one token. Without this, two first-time registrations
  -- of the same token race: both see no active row, and the unique index below
  -- rejects the second with a unique violation instead of letting the later
  -- registration win.
  perform pg_advisory_xact_lock(hashtext(v_token));

  -- clock_timestamp(), not now(): two claims inside one transaction must still
  -- order, otherwise the later claimant cannot be told from the earlier one.
  -- Assigned here, so a client-supplied claimed_at is always discarded.
  new.claimed_at := clock_timestamp();

  -- The recursive fire on these rows exits at the guard above, because they
  -- are being deactivated.
  update public.device_push_tokens as prior
  set active = false
  where prior.expo_push_token = v_token
    and prior.user_id <> new.user_id
    and prior.active;

  return new;
end;
$$;

comment on function public.claim_device_push_token() is
  'Canonicalizes a device token, stamps the claim server side, and deactivates every other user''s row for the same token.';

drop trigger if exists device_push_tokens_claim_device on public.device_push_tokens;
create trigger device_push_tokens_claim_device
before insert or update on public.device_push_tokens
for each row
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
