\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'manager@example.com', '{"name":"Manager One"}', '{"provider":"email"}'),
  ('99999999-9999-4999-8999-999999999999', 'join-old@members.babytunasystems.com', '{"name":"Legacy"}', '{"provider":"email"}');

insert into public.users (id, email, name, role)
values
  ('11111111-1111-4111-8111-111111111111', 'manager@example.com', 'Manager One', 'manager'),
  ('99999999-9999-4999-8999-999999999999', 'join-old@members.babytunasystems.com', 'Legacy', 'employee');

insert into public.profiles (id, email, full_name, role, provider, profile_completed)
values
  ('11111111-1111-4111-8111-111111111111', 'manager@example.com', 'Manager One', 'manager', 'email', true),
  ('99999999-9999-4999-8999-999999999999', 'join-old@members.babytunasystems.com', 'Legacy', 'employee', 'email', true);

\i /workspace/supabase/migrations/20260913213012_auth_invite_link_claim.sql

do $$
declare
  v_role text;
  v_name text;
  v_user_name text;
  v_legacy boolean;
  v_result jsonb;
  v_location uuid;
  v_enabled boolean;
  v_used_by uuid;
begin
  select legacy_name_login
  into v_legacy
  from public.profiles
  where id = '99999999-9999-4999-8999-999999999999';
  if v_legacy is distinct from true then
    raise exception 'legacy members-domain profile was not backfilled';
  end if;

  if has_function_privilege('anon', 'public.claim_invite_for_user(text,uuid,boolean,boolean)', 'execute')
    or has_function_privilege('authenticated', 'public.claim_invite_for_user(text,uuid,boolean,boolean)', 'execute') then
    raise exception 'claim RPC is executable by a public client role';
  end if;
  if not has_function_privilege('service_role', 'public.claim_invite_for_user(text,uuid,boolean,boolean)', 'execute') then
    raise exception 'claim RPC is not executable by service_role';
  end if;
  if to_regprocedure('public.set_onboarding_login_credential(uuid,text,text)') is not null then
    raise exception 'obsolete onboarding credential RPC still exists';
  end if;

  begin
    insert into public.invites (
      token, invited_name, invited_email, role, expires_at, created_by
    ) values (
      repeat('U', 32), 'Upper', 'Upper@Example.com', 'employee', now() + interval '1 day',
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'uppercase invite email unexpectedly passed';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.invites (
      token, invited_name, invited_email, role, expires_at, created_by
    ) values (
      repeat('B', 32), 'Broken', 'broken@example', 'employee', now() + interval '1 day',
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'malformed invite email unexpectedly passed';
  exception when check_violation then
    null;
  end;

  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
  values (
    '22222222-2222-4222-8222-222222222222',
    'relay@privaterelay.appleid.com',
    '{"full_name":"Provider Name"}',
    '{"provider":"apple"}'
  );
  perform public.upsert_identity_from_auth_user('22222222-2222-4222-8222-222222222222');

  select role into v_role
  from public.profiles
  where id = '22222222-2222-4222-8222-222222222222';
  if v_role is not null then
    raise exception 'unaffiliated provider profile received role %', v_role;
  end if;

  update public.profiles
  set full_name = 'Apple Supplied Name'
  where id = '22222222-2222-4222-8222-222222222222';
  update auth.users
  set raw_user_meta_data = '{}'::jsonb
  where id = '22222222-2222-4222-8222-222222222222';
  perform public.upsert_identity_from_auth_user('22222222-2222-4222-8222-222222222222');
  select full_name into v_name
  from public.profiles
  where id = '22222222-2222-4222-8222-222222222222';
  if v_name <> 'Apple Supplied Name' then
    raise exception 'role-null Apple profile name was replaced during repair';
  end if;

  insert into public.locations (id, name, short_code, active)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sushi Fixture', 'S1', true);

  insert into public.invites (
    token, invited_name, invited_email, role, module_preset, location_group,
    expires_at, created_by
  ) values (
    repeat('L', 32),
    'Invite Name Wins',
    'different@example.com',
    'employee',
    '{"ordering_simple":true,"tips":false,"junk":true}',
    'sushi',
    now() + interval '1 day',
    '11111111-1111-4111-8111-111111111111'
  );

  v_result := public.claim_invite_for_user(
    repeat('L', 32),
    '22222222-2222-4222-8222-222222222222',
    true,
    false
  );
  if v_result is distinct from '{"ok":true,"role":"employee","locationGroup":"sushi"}'::jsonb then
    raise exception 'link claim returned %', v_result;
  end if;

  select p.role, p.full_name, u.name, u.default_location_id
  into v_role, v_name, v_user_name, v_location
  from public.profiles p
  join public.users u on u.id = p.id
  where p.id = '22222222-2222-4222-8222-222222222222';
  if v_role <> 'employee' or v_name <> 'Invite Name Wins' or v_user_name <> 'Invite Name Wins'
    or v_location <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'link claim membership state was incomplete';
  end if;

  select enabled into v_enabled
  from public.user_modules
  where user_id = '22222222-2222-4222-8222-222222222222'
    and module_key = 'ordering_simple';
  if v_enabled is distinct from true then
    raise exception 'module preset was not applied';
  end if;
  if exists (
    select 1 from public.user_modules
    where user_id = '22222222-2222-4222-8222-222222222222'
      and module_key = 'junk'
  ) then
    raise exception 'unknown module key was applied';
  end if;

  select used_by into v_used_by
  from public.invites
  where token = repeat('L', 32);
  if v_used_by <> '22222222-2222-4222-8222-222222222222' then
    raise exception 'invite was not consumed by link claimant';
  end if;

  v_result := public.claim_invite_for_user(
    repeat('L', 32),
    '22222222-2222-4222-8222-222222222222',
    true,
    false
  );
  if v_result is distinct from '{"ok":true,"role":"employee","locationGroup":"sushi"}'::jsonb then
    raise exception 'same-user idempotent retry returned %', v_result;
  end if;

  update auth.users
  set raw_user_meta_data = '{"full_name":"Changed Provider Name"}'
  where id = '22222222-2222-4222-8222-222222222222';
  perform public.upsert_identity_from_auth_user('22222222-2222-4222-8222-222222222222');
  select p.full_name, u.name
  into v_name, v_user_name
  from public.profiles p
  join public.users u on u.id = p.id
  where p.id = '22222222-2222-4222-8222-222222222222';
  if v_name <> 'Invite Name Wins' or v_user_name <> 'Invite Name Wins' then
    raise exception 'auth sync replaced invite-owned name';
  end if;

  insert into public.invites (
    token, invited_name, role, expires_at, created_by
  ) values (
    repeat('M', 32), 'Second Team', 'manager', now() + interval '1 day',
    '11111111-1111-4111-8111-111111111111'
  );
  v_result := public.claim_invite_for_user(
    repeat('M', 32),
    '22222222-2222-4222-8222-222222222222',
    true,
    false
  );
  if v_result->>'reason' <> 'already_on_team' then
    raise exception 'second link claim returned %', v_result;
  end if;
  if exists (
    select 1 from public.invites
    where token = repeat('M', 32) and used_at is not null
  ) then
    raise exception 'already-on-team rejection consumed the invite';
  end if;

  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
  values (
    '33333333-3333-4333-8333-333333333333',
    'wrong@example.com',
    '{"full_name":"Wrong Email"}',
    '{"provider":"email"}'
  );
  insert into public.invites (
    token, invited_name, invited_email, role, expires_at, created_by
  ) values (
    repeat('E', 32), 'Bound Email', 'right@example.com', 'employee',
    now() + interval '1 day', '11111111-1111-4111-8111-111111111111'
  );
  v_result := public.claim_invite_for_user(
    repeat('E', 32),
    '33333333-3333-4333-8333-333333333333',
    false,
    true
  );
  if v_result->>'reason' <> 'email_mismatch' then
    raise exception 'email mismatch returned %', v_result;
  end if;
  if exists (
    select 1 from public.invites
    where token = repeat('E', 32) and used_at is not null
  ) or exists (
    select 1 from public.profiles
    where id = '33333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'email mismatch left partial membership state';
  end if;

  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
  values (
    '44444444-4444-4444-8444-444444444444',
    'location@example.com',
    '{"full_name":"No Location"}',
    '{"provider":"email"}'
  );
  insert into public.invites (
    token, invited_name, role, location_group, expires_at, created_by
  ) values (
    repeat('P', 32), 'No Poki Location', 'employee', 'poki',
    now() + interval '1 day', '11111111-1111-4111-8111-111111111111'
  );
  v_result := public.claim_invite_for_user(
    repeat('P', 32),
    '44444444-4444-4444-8444-444444444444',
    false,
    false
  );
  if v_result->>'reason' <> 'location_missing' then
    raise exception 'missing location returned %', v_result;
  end if;
  if exists (
    select 1 from public.invites
    where token = repeat('P', 32) and used_at is not null
  ) or exists (
    select 1 from public.profiles
    where id = '44444444-4444-4444-8444-444444444444'
  ) then
    raise exception 'missing location left partial membership state';
  end if;

  raise notice 'PASS: auth invite backend fixture assertions all held';
end;
$$;
