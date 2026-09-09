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
-- plus the canonical token form and the server-owned ownership clock that the
-- three clauses rest on.
--
-- Concurrent claims are covered separately, by
-- scripts/local-db/push_token_concurrency_check.sh, which needs two sessions.

\set ON_ERROR_STOP on

\set user_a '''aaaaaaaa-2000-4000-8000-000000000001'''
\set user_b '''aaaaaaaa-2000-4000-8000-000000000002'''
\set shared_token '''ExponentPushToken[fixture-shared-device]'''
\set spaced_token '''  ExponentPushToken[fixture-shared-device] '''
\set other_token '''ExponentPushToken[fixture-user-a-tablet]'''
\set late_signout_token '''ExponentPushToken[fixture-late-signout]'''

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
-- Migration repair. Rewind only the objects added by the ownership migration,
-- seed legacy rows, and apply the checked-in migration again inside this
-- fixture transaction. verify-migrations.sh mounts the worktree read-only at
-- /workspace for this include.
-- ---------------------------------------------------------------------------
drop function public.active_device_push_tokens(uuid);
drop trigger device_push_tokens_claim_device on public.device_push_tokens;
drop function public.claim_device_push_token();
drop index public.device_push_tokens_one_active_owner_idx;
drop index public.device_push_tokens_token_claimed_idx;
alter table public.device_push_tokens
  drop constraint device_push_tokens_expo_push_token_canonical;
alter table public.device_push_tokens drop column claimed_at;
drop function public.is_expo_push_token(text);
drop function public.canonical_expo_push_token(text);

insert into public.device_push_tokens
  (user_id, expo_push_token, platform, active, created_at, updated_at)
values
  (
    :user_a,
    '  ExponentPushToken[fixture-alias-newer-deactivation]  ',
    'ios',
    true,
    '2026-01-01 00:00:00+00',
    '2026-01-01 00:00:00+00'
  ),
  (
    :user_a,
    'ExponentPushToken[fixture-alias-newer-deactivation]',
    'ios',
    false,
    '2026-01-01 00:00:00+00',
    '2026-02-01 00:00:00+00'
  ),
  (
    :user_a,
    U&'\FEFFExponentPushToken[fixture-backfill-leading-feff]',
    'ios',
    true,
    '2026-03-01 00:00:00+00',
    '2026-03-01 00:00:00+00'
  ),
  (
    :user_a,
    U&'ExponentPushToken[fixture-backfill-trailing-feff]\FEFF',
    'ios',
    true,
    '2026-03-02 00:00:00+00',
    '2026-03-02 00:00:00+00'
  ),
  (
    :user_a,
    U&'\00A0ExpoPushToken[fixture-backfill-nbsp]\00A0',
    'ios',
    true,
    '2026-03-03 00:00:00+00',
    '2026-03-03 00:00:00+00'
  ),
  (
    :user_a,
    U&'\FEFF\00A0ExponentPushToken[fixture-backfill-wrapped]\00A0\FEFF',
    'ios',
    true,
    '2026-03-04 00:00:00+00',
    '2026-03-04 00:00:00+00'
  ),
  (
    :user_a,
    U&'\FEFFnot-an-expo-token\FEFF',
    'ios',
    true,
    '2026-03-05 00:00:00+00',
    '2026-03-05 00:00:00+00'
  );

\i /workspace/supabase/migrations/20260905120000_device_push_token_ownership.sql

do $$
declare
  v_alias_count integer;
  v_alias_active boolean;
  v_alias_updated timestamptz;
  v_unicode_tokens text[];
  v_invalid_count integer;
begin
  select count(*), bool_or(active), max(updated_at)
  into v_alias_count, v_alias_active, v_alias_updated
  from public.device_push_tokens
  where expo_push_token = 'ExponentPushToken[fixture-alias-newer-deactivation]';

  if v_alias_count <> 1 or v_alias_active is not false then
    raise exception 'FAIL: alias cleanup kept the stale active spelling';
  end if;
  if v_alias_updated <> '2026-02-01 00:00:00+00'::timestamptz then
    raise exception 'FAIL: alias cleanup did not keep the newest write: %', v_alias_updated;
  end if;

  select coalesce(array_agg(expo_push_token order by expo_push_token collate "C"), '{}')
  into v_unicode_tokens
  from public.device_push_tokens
  where expo_push_token like '%fixture-backfill-%';

  if v_unicode_tokens <> array[
    'ExpoPushToken[fixture-backfill-nbsp]',
    'ExponentPushToken[fixture-backfill-leading-feff]',
    'ExponentPushToken[fixture-backfill-trailing-feff]',
    'ExponentPushToken[fixture-backfill-wrapped]'
  ] then
    raise exception 'FAIL: backfill did not canonicalize ECMAScript padding: %', v_unicode_tokens;
  end if;

  select count(*) into v_invalid_count
  from public.device_push_tokens
  where position('not-an-expo-token' in expo_push_token) > 0;
  if v_invalid_count <> 0 then
    raise exception 'FAIL: backfill kept a value outside the canonical grammar';
  end if;

  raise notice 'ok: backfill canonicalizes ECMAScript padding and deletes only invalid values';
  raise notice 'ok: alias cleanup keeps a newer inactive row over a stale active spelling';
end;
$$;

delete from public.device_push_tokens
where user_id in (
  'aaaaaaaa-2000-4000-8000-000000000001',
  'aaaaaaaa-2000-4000-8000-000000000002'
);

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

-- An inactive insert is not a registration and must not create a claim that
-- suppresses the active owner. Client deactivation uses UPDATE only.
select set_config('request.jwt.claim.sub', :user_b, false);
set role authenticated;

do $$
declare
  v_error text;
begin
  begin
    insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
    values (
      'aaaaaaaa-2000-4000-8000-000000000002',
      'ExponentPushToken[fixture-shared-device]',
      'ios',
      false
    );
    raise exception 'FAIL: an inactive insert was accepted';
  exception
    when invalid_parameter_value then
      get stacked diagnostics v_error = message_text;
      if position('inactive' in lower(v_error)) = 0 then
        raise exception 'FAIL: inactive insert error was unclear: %', v_error;
      end if;
  end;
end;
$$;

reset role;
set role service_role;

do $$
declare
  v_a_tokens text[];
begin
  select coalesce(array_agg(expo_push_token order by expo_push_token collate "C"), '{}')
  into v_a_tokens
  from public.active_device_push_tokens('aaaaaaaa-2000-4000-8000-000000000001');

  if not ('ExponentPushToken[fixture-shared-device]' = any (v_a_tokens)) then
    raise exception 'FAIL: an inactive insert suppressed the active owner: %', v_a_tokens;
  end if;
  raise notice 'ok: an inactive insert is rejected and cannot suppress the active owner';
end;
$$;

reset role;

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
  select coalesce(array_agg(expo_push_token order by expo_push_token collate "C"), '{}')
  into v_a_tokens
  from public.active_device_push_tokens('aaaaaaaa-2000-4000-8000-000000000001');

  select coalesce(array_agg(expo_push_token order by expo_push_token collate "C"), '{}')
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
-- Every ECMAScript trim spelling is the same device. The Data API is reachable
-- directly, so a client can send whitespace the app would have trimmed. Each
-- spelling must collapse onto its canonical token instead of opening a second,
-- unowned lane to the same phone. B currently owns the shared device; A
-- re-registers it with ASCII padding and registers four Unicode fixture tokens.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :user_a, false);
set role authenticated;

insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
values (:user_a, :spaced_token, 'ios', true)
on conflict (user_id, expo_push_token)
do update set platform = excluded.platform, active = true;

insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
values
  (:user_a, U&'\FEFFExponentPushToken[fixture-leading-feff]', 'ios', true),
  (:user_a, U&'ExponentPushToken[fixture-trailing-feff]\FEFF', 'ios', true),
  (:user_a, U&'\00A0ExpoPushToken[fixture-nbsp]\00A0', 'ios', true),
  (
    :user_a,
    U&'\FEFF\00A0ExponentPushToken[fixture-wrapped]\00A0\FEFF',
    'ios',
    true
  );

reset role;

do $$
declare
  v_rows_for_a integer;
  v_padded_rows integer;
  v_a_shared boolean;
  v_b_shared boolean;
  v_unicode_tokens text[];
begin
  select count(*) into v_rows_for_a
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000001';

  select count(*) into v_padded_rows
  from public.device_push_tokens
  where expo_push_token <> btrim(expo_push_token);

  select active into v_a_shared
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000001'
    and expo_push_token = 'ExponentPushToken[fixture-shared-device]';

  select active into v_b_shared
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000002'
    and expo_push_token = 'ExponentPushToken[fixture-shared-device]';

  select coalesce(array_agg(expo_push_token order by expo_push_token collate "C"), '{}')
  into v_unicode_tokens
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000001'
    and expo_push_token in (
      'ExpoPushToken[fixture-nbsp]',
      'ExponentPushToken[fixture-leading-feff]',
      'ExponentPushToken[fixture-trailing-feff]',
      'ExponentPushToken[fixture-wrapped]'
    );

  if v_padded_rows <> 0 then
    raise exception 'FAIL: a padded token spelling was stored verbatim';
  end if;
  if v_rows_for_a <> 6 then
    raise exception 'FAIL: token canonicalization left the wrong row count: %', v_rows_for_a;
  end if;
  if v_a_shared is not true or v_b_shared is not false then
    raise exception 'FAIL: the padded registration did not claim the device';
  end if;
  if v_unicode_tokens <> array[
    'ExpoPushToken[fixture-nbsp]',
    'ExponentPushToken[fixture-leading-feff]',
    'ExponentPushToken[fixture-trailing-feff]',
    'ExponentPushToken[fixture-wrapped]'
  ] then
    raise exception 'FAIL: ECMAScript whitespace was not canonicalized: %', v_unicode_tokens;
  end if;
  raise notice 'ok: ASCII, U+FEFF, and U+00A0 padding canonicalize to one grammar';
end;
$$;

-- A value that cannot be canonicalized into an Expo token is refused outright.
select set_config('request.jwt.claim.sub', :user_a, false);
set role authenticated;

do $$
begin
  begin
    insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
    values ('aaaaaaaa-2000-4000-8000-000000000001', '   ', 'ios', true);
    raise exception 'FAIL: a blank token was accepted';
  exception
    when invalid_parameter_value then
      raise notice 'ok: a value that is not an Expo token is refused';
  end;

  begin
    insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
    values ('aaaaaaaa-2000-4000-8000-000000000001', 'ExpoPushToken[bad token]', 'ios', true);
    raise exception 'FAIL: a token containing whitespace was accepted';
  exception
    when invalid_parameter_value then
      null;
  end;

  begin
    insert into public.device_push_tokens (user_id, expo_push_token, platform, active)
    values ('aaaaaaaa-2000-4000-8000-000000000001', 'ExpoPushToken[closed]junk', 'ios', true);
    raise exception 'FAIL: a token with trailing junk was accepted';
  exception
    when invalid_parameter_value then
      null;
  end;
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- The ownership clock is server owned. A former owner holds a row they may
-- update freely under RLS; neither claimed_at nor the token identity may move
-- on a write that does not activate the row.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :user_b, false);
set role authenticated;

update public.device_push_tokens
set claimed_at = 'infinity'::timestamptz,
    expo_push_token = 'ExponentPushToken[fixture-hijack]',
    platform = 'android'
where user_id = 'aaaaaaaa-2000-4000-8000-000000000002'
  and expo_push_token = 'ExponentPushToken[fixture-shared-device]';

reset role;

do $$
declare
  v_claimed timestamptz;
  v_platform text;
  v_hijack integer;
  v_a_tokens text[];
begin
  select claimed_at, platform into v_claimed, v_platform
  from public.device_push_tokens
  where user_id = 'aaaaaaaa-2000-4000-8000-000000000002'
    and expo_push_token = 'ExponentPushToken[fixture-shared-device]';

  select count(*) into v_hijack
  from public.device_push_tokens
  where expo_push_token = 'ExponentPushToken[fixture-hijack]';

  if v_claimed is null or v_claimed = 'infinity'::timestamptz then
    raise exception 'FAIL: a client rewrote the ownership clock';
  end if;
  if v_hijack <> 0 then
    raise exception 'FAIL: a client moved an inactive row onto another token';
  end if;
  if v_platform <> 'android' then
    raise exception 'FAIL: the pin-back blocked an ordinary column update';
  end if;

  -- Read as the owner of the resolver rather than switching role mid-block.
  select coalesce(array_agg(expo_push_token order by expo_push_token collate "C"), '{}')
  into v_a_tokens
  from public.active_device_push_tokens('aaaaaaaa-2000-4000-8000-000000000001');

  if not ('ExponentPushToken[fixture-shared-device]' = any (v_a_tokens)) then
    raise exception 'FAIL: a forged claim locked the real owner out: %', v_a_tokens;
  end if;
  raise notice 'ok: a non-activating write cannot move the clock or the token';
end;
$$;

-- ---------------------------------------------------------------------------
-- Handover is reversible: B reclaims the device on next login.
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

  if v_b_shared is not true or v_a_shared is not false then
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
      'aaaaaaaa-2000-4000-8000-000000000001',
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

-- A late sign-out writing after the current owner registered must not read as
-- a newer claim: the inactive row carries a newer updated_at but an older
-- claimed_at, and the active owner stays reachable. This is the shape the
-- migration's backfill has to produce for legacy rows.
insert into public.device_push_tokens
  (user_id, expo_push_token, platform, active, created_at, updated_at, claimed_at)
values
  (
    'aaaaaaaa-2000-4000-8000-000000000001', 'ExponentPushToken[fixture-late-signout]', 'ios',
    true, '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'
  ),
  (
    'aaaaaaaa-2000-4000-8000-000000000002', 'ExponentPushToken[fixture-late-signout]', 'ios',
    false, '2025-12-01 00:00:00+00', '2026-06-01 00:00:00+00', '2025-12-01 00:00:00+00'
  );

alter table public.device_push_tokens enable trigger device_push_tokens_claim_device;

set role service_role;

do $$
declare
  v_a_tokens text[];
begin
  select coalesce(array_agg(expo_push_token order by expo_push_token collate "C"), '{}')
  into v_a_tokens
  from public.active_device_push_tokens('aaaaaaaa-2000-4000-8000-000000000001');

  if not ('ExponentPushToken[fixture-late-signout]' = any (v_a_tokens)) then
    raise exception 'FAIL: a late sign-out outranked the active owner: %', v_a_tokens;
  end if;
  raise notice 'ok: a newer deactivation does not outrank the active owner';
end;
$$;

reset role;

-- The mirror case: a stale active row must lose to a later claim, even when
-- the later claimant has since signed out. Only B's claim moves; A's row stays
-- active, which is exactly the state the resolver has to see through.
alter table public.device_push_tokens disable trigger device_push_tokens_claim_device;
update public.device_push_tokens
set claimed_at = clock_timestamp()
where user_id = 'aaaaaaaa-2000-4000-8000-000000000002'
  and expo_push_token = 'ExponentPushToken[fixture-late-signout]';
alter table public.device_push_tokens enable trigger device_push_tokens_claim_device;

set role service_role;

do $$
declare
  v_a_tokens text[];
begin
  select coalesce(array_agg(expo_push_token order by expo_push_token collate "C"), '{}')
  into v_a_tokens
  from public.active_device_push_tokens('aaaaaaaa-2000-4000-8000-000000000001');

  if 'ExponentPushToken[fixture-late-signout]' = any (v_a_tokens) then
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
