-- Device push token ownership checks.
-- Run only after scripts/local-db/verify-migrations.sh --keep:
--   docker exec -i <container> psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < scripts/local-db/push_token_ownership_fixture.sql
-- Expected output: "ok: ..." notices followed by
--   "PASS: push token ownership fixture assertions all held" and a ROLLBACK.
--
-- Proves the three clauses of the ownership rule:
--   1. A device token belongs to the last user who registers it.
--   2. A new registration deactivates prior owners' rows.
--   3. A send never targets a token whose current owner is not the recipient.

\set ON_ERROR_STOP on

\set user_a '''aaaaaaaa-2000-4000-8000-000000000001'''
\set user_b '''aaaaaaaa-2000-4000-8000-000000000002'''
\set shared_token '''ExponentPushToken[fixture-shared-device]'''
\set other_token '''ExponentPushToken[fixture-user-a-tablet]'''

begin;

-- The baseline snapshot is DDL-only and does not carry production's grant
-- matrix (scripts/local-db/README.md), so restate the grants this table
-- already has in production before simulating a client.
grant select, insert, update, delete on public.device_push_tokens to authenticated;
grant select on public.device_push_tokens to service_role;

insert into auth.users (id, email) values
  (:user_a, 'push-owner-a@example.test'),
  (:user_b, 'push-owner-b@example.test');

insert into public.users (id, email, name, role) values
  (:user_a, 'push-owner-a@example.test', 'Push Owner A', 'employee'),
  (:user_b, 'push-owner-b@example.test', 'Push Owner B', 'employee');

-- ---------------------------------------------------------------------------
-- Clause 1: registering a token claims it for the registering user.
-- The insert shape matches the client upsert in src/services/notificationService.ts.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :user_a, false);
set role authenticated;

insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
values (:user_a, :shared_token, 'ios', true)
on conflict (user_id, expo_push_token)
do update set platform = excluded.platform, active = true;

-- A second device of the same user, to prove a claim is token-scoped.
insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
values (:user_a, :other_token, 'ios', true)
on conflict (user_id, expo_push_token)
do update set platform = excluded.platform, active = true;

reset role;

do $$
declare
  v_active boolean;
  v_claimed_at timestamptz;
begin
  select active, claimed_at into v_active, v_claimed_at
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000001'
    and expo_push_token = 'ExponentPushToken[fixture-shared-device]';

  if v_active is not true then
    raise exception 'FAIL: the first registration did not leave the row active';
  end if;
  if v_claimed_at is null then
    raise exception 'FAIL: the first registration did not stamp claimed_at';
  end if;
  raise notice 'ok: registering a token claims it for the registering user';
end;
$$;

-- ---------------------------------------------------------------------------
-- Clause 2: the next user to register the same token takes it over, and the
-- prior owner's row is deactivated even though RLS forbids that user from
-- touching it.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :user_b, false);
set role authenticated;

insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
values (:user_b, :shared_token, 'ios', true)
on conflict (user_id, expo_push_token)
do update set platform = excluded.platform, active = true;

reset role;

do $$
declare
  v_a_shared boolean;
  v_a_other boolean;
  v_b_shared boolean;
  v_a_claimed timestamptz;
  v_b_claimed timestamptz;
begin
  select active, claimed_at into v_a_shared, v_a_claimed
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000001'
    and expo_push_token = 'ExponentPushToken[fixture-shared-device]';

  select active into v_a_other
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000001'
    and expo_push_token = 'ExponentPushToken[fixture-user-a-tablet]';

  select active, claimed_at into v_b_shared, v_b_claimed
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000002'
    and expo_push_token = 'ExponentPushToken[fixture-shared-device]';

  if v_a_shared is not false then
    raise exception 'FAIL: the prior owner kept an active row on the shared device';
  end if;
  if v_b_shared is not true then
    raise exception 'FAIL: the new registrant does not own the shared device';
  end if;
  if v_b_claimed <= v_a_claimed then
    raise exception 'FAIL: the new claim did not sort after the prior claim';
  end if;
  if v_a_other is not true then
    raise exception 'FAIL: the claim deactivated the prior owner''s other device';
  end if;
  raise notice 'ok: a new registration deactivates prior owners'' rows only for that token';
end;
$$;

-- ---------------------------------------------------------------------------
-- Clause 3: the send-side resolver never returns a token the recipient no
-- longer owns. The reminder sender calls this function as the service role.
-- ---------------------------------------------------------------------------
set role service_role;

do $$
declare
  v_a_tokens text[];
  v_b_tokens text[];
begin
  select coalesce(array_agg(expo_push_token order by expo_push_token), '{}')
  into v_a_tokens
  from public.active_device_push_tokens('aaaaaaaa-2000-4000-8000-000000000001');

  select coalesce(array_agg(expo_push_token order by expo_push_token), '{}')
  into v_b_tokens
  from public.active_device_push_tokens('aaaaaaaa-2000-4000-8000-000000000002');

  if v_a_tokens <> array['ExponentPushToken[fixture-user-a-tablet]'] then
    raise exception 'FAIL: the prior owner is still targetable on the shared device: %', v_a_tokens;
  end if;
  if v_b_tokens <> array['ExponentPushToken[fixture-shared-device]'] then
    raise exception 'FAIL: the current owner cannot be reached on the shared device: %', v_b_tokens;
  end if;
  raise notice 'ok: sends resolve only to tokens the recipient currently owns';
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- Handover is reversible: the original user reclaims the device on next login.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :user_a, false);
set role authenticated;

insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
values (:user_a, :shared_token, 'ios', true)
on conflict (user_id, expo_push_token)
do update set platform = excluded.platform, active = true;

reset role;

do $$
declare
  v_a_shared boolean;
  v_b_shared boolean;
begin
  select active into v_a_shared
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000001'
    and expo_push_token = 'ExponentPushToken[fixture-shared-device]';

  select active into v_b_shared
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000002'
    and expo_push_token = 'ExponentPushToken[fixture-shared-device]';

  if v_a_shared is not true or v_b_shared is not false then
    raise exception 'FAIL: re-registering did not hand the device back';
  end if;
  raise notice 'ok: ownership follows the most recent registration in both directions';
end;
$$;

-- ---------------------------------------------------------------------------
-- Backstops, with the claim trigger disabled so the checks below stand on
-- their own rather than on the trigger that normally prevents the state.
-- ---------------------------------------------------------------------------
alter table public.device_push_tokens disable trigger device_push_tokens_claim_device;

do $$
begin
  begin
    insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
    values (
      'aaaaaaaa-2000-4000-8000-000000000002',
      'ExponentPushToken[fixture-shared-device]',
      'ios',
      true
    )
    on conflict (user_id, expo_push_token)
    do update set active = true;
    raise exception 'FAIL: two users held the same device token active at once';
  exception
    when unique_violation then
      raise notice 'ok: the database refuses two active owners for one token';
  end;
end;
$$;

alter table public.device_push_tokens enable trigger device_push_tokens_claim_device;

-- A's row is active again after the reclaim above. Give B the newer claim
-- without reactivating B: the shape left behind when the current owner signs
-- out normally while an earlier owner's row was never retired. The stale
-- active row must still not be targetable. B's row stays inactive, so this
-- update does not fire the claim trigger.
update public.device_push_tokens
set claimed_at = clock_timestamp()
where user_id = 'aaaaaaaa-2000-4000-8000-000000000002'
  and expo_push_token = 'ExponentPushToken[fixture-shared-device]';

set role service_role;

do $$
declare
  v_a_tokens text[];
begin
  select coalesce(array_agg(expo_push_token order by expo_push_token), '{}')
  into v_a_tokens
  from public.active_device_push_tokens('aaaaaaaa-2000-4000-8000-000000000001');

  if 'ExponentPushToken[fixture-shared-device]' = any (v_a_tokens) then
    raise exception 'FAIL: a stale active row outranked a later claim: %', v_a_tokens;
  end if;
  raise notice 'ok: a later claim beats a stale active row on the same token';
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- RLS and grants around the rule.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :user_a, false);
set role authenticated;

do $$
declare
  v_visible integer;
  v_updated integer;
begin
  select count(*) into v_visible
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000002';
  if v_visible <> 0 then
    raise exception 'FAIL: an employee read another user''s device rows';
  end if;

  update public.device_push_tokens
  set active = true
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000002';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'FAIL: an employee wrote another user''s device rows';
  end if;
  raise notice 'ok: employees still cannot read or write another user''s device rows';
end;
$$;

do $$
begin
  begin
    perform * from public.active_device_push_tokens('aaaaaaaa-2000-4000-8000-000000000002');
    raise exception 'FAIL: an employee executed the send-side token resolver';
  exception
    when insufficient_privilege then
      raise notice 'ok: only the service role can resolve send-side tokens';
  end;
end;
$$;

reset role;

do $$ begin raise notice 'PASS: push token ownership fixture assertions all held'; end $$;

rollback;
