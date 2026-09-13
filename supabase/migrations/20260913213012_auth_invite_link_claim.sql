-- Auth redesign: optional email-bound invites, legacy-login badges, and one
-- transactional invite claim for both new email accounts and OAuth accounts.

alter table public.invites
  add column if not exists invited_email text;

alter table public.invites
  drop constraint if exists invites_invited_email_check;

alter table public.invites
  add constraint invites_invited_email_check check (
    invited_email is null
    or (
      invited_email = lower(btrim(invited_email))
      and invited_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

comment on column public.invites.invited_email is
  'Optional normalized email required when accepting with a new email/password account. OAuth invite claims may use provider relay addresses.';

alter table public.profiles
  add column if not exists legacy_name_login boolean not null default false;

update public.profiles as p
set legacy_name_login = true
from auth.users as au
where au.id = p.id
  and lower(coalesce(au.email, '')) like '%@members.babytunasystems.com';

comment on column public.profiles.legacy_name_login is
  'True for accounts created under the retired synthetic members-domain name/PIN sign-in flow.';

-- Keep trusted access-code grants working for legacy clients, but do not make
-- an unaffiliated auth identity an employee in the canonical profiles table.
-- Existing profile roles remain unchanged when no new trusted grant exists.
create or replace function public.upsert_identity_from_auth_user(p_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user auth.users%rowtype;
  v_email text;
  v_full_name text;
  v_granted_role public.user_role;
  v_provider text;
  v_default_location_id uuid;
  v_profile_completed boolean;
begin
  if p_auth_user_id is null then
    raise exception 'Auth user id is required';
  end if;

  select *
  into v_auth_user
  from auth.users
  where id = p_auth_user_id;

  if not found then
    raise exception 'Auth user not found';
  end if;

  v_email := v_auth_user.email;
  v_full_name := nullif(
    btrim(
      coalesce(
        v_auth_user.raw_user_meta_data->>'full_name',
        v_auth_user.raw_user_meta_data->>'name'
      )
    ),
    ''
  );
  v_granted_role := public.consume_access_code_role_grant(v_email);
  v_provider := case
    when coalesce(v_auth_user.raw_app_meta_data->>'provider', v_auth_user.raw_user_meta_data->>'provider')
      in ('google', 'apple', 'email')
      then coalesce(v_auth_user.raw_app_meta_data->>'provider', v_auth_user.raw_user_meta_data->>'provider')
    else 'email'
  end;
  v_default_location_id := case
    when coalesce(v_auth_user.raw_user_meta_data->>'default_location_id', '') ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_auth_user.raw_user_meta_data->>'default_location_id')::uuid
    else null
  end;
  v_profile_completed := v_full_name is not null and v_granted_role is not null;

  -- public.users remains a compatibility table whose role is non-null.
  insert into public.users (
    id, email, name, role, default_location_id
  )
  values (
    v_auth_user.id,
    coalesce(v_email, ''),
    coalesce(
      v_full_name,
      nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
      'User'
    ),
    coalesce(v_granted_role, 'employee'::public.user_role),
    v_default_location_id
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = coalesce(
      (
        select nullif(btrim(p.full_name), '')
        from public.profiles as p
        where p.id = v_auth_user.id
      ),
      v_full_name,
      public.users.name
    ),
    role = coalesce(v_granted_role, public.users.role),
    default_location_id = coalesce(excluded.default_location_id, public.users.default_location_id);

  insert into public.profiles (
    id, email, full_name, role, provider, profile_completed
  )
  values (
    v_auth_user.id,
    v_email,
    v_full_name,
    v_granted_role::text,
    v_provider,
    v_profile_completed
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    role = coalesce(v_granted_role::text, public.profiles.role),
    provider = coalesce(public.profiles.provider, excluded.provider),
    profile_completed = public.profiles.profile_completed
      or (v_full_name is not null and coalesce(v_granted_role::text, public.profiles.role) is not null),
    updated_at = now();
end;
$$;

revoke all on function public.upsert_identity_from_auth_user(uuid) from public, anon, authenticated;
grant execute on function public.upsert_identity_from_auth_user(uuid) to service_role;

-- The retired onboarding path was the only caller. New invite acceptance uses
-- the auth provider or email/password account itself and never stores a PIN or
-- secondary app password.
drop function if exists public.set_onboarding_login_credential(uuid, text, text);

-- The Edge Function calls this service-role-only RPC after authenticating the
-- caller or creating the email user. One transaction applies all membership
-- state and consumes the invite. Advisory locking serializes concurrent claims
-- for the same user even if their profile trigger has not inserted a row yet.
create or replace function public.claim_invite_for_user(
  p_token text,
  p_user_id uuid,
  p_reject_existing_membership boolean default true,
  p_require_invited_email_match boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user auth.users%rowtype;
  v_invite public.invites%rowtype;
  v_existing_role text;
  v_email text;
  v_provider text;
  v_location_id uuid;
begin
  if p_user_id is null or p_token is null or btrim(p_token) = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into v_auth_user
  from auth.users
  where id = p_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'auth_user_missing');
  end if;

  select *
  into v_invite
  from public.invites
  where token = btrim(p_token)
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_invite.revoked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'revoked');
  end if;
  if v_invite.used_at is not null then
    if v_invite.used_by = p_user_id
      and exists (
        select 1
        from public.profiles as p
        where p.id = p_user_id
          and p.role = v_invite.role
      ) then
      return jsonb_build_object(
        'ok', true,
        'role', v_invite.role,
        'locationGroup', v_invite.location_group
      );
    end if;
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;
  if v_invite.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  select role
  into v_existing_role
  from public.profiles
  where id = p_user_id
  for update;

  if p_reject_existing_membership and v_existing_role in ('employee', 'manager') then
    return jsonb_build_object('ok', false, 'reason', 'already_on_team');
  end if;

  v_email := lower(btrim(coalesce(v_auth_user.email, '')));
  if p_require_invited_email_match
    and v_invite.invited_email is not null
    and v_email is distinct from v_invite.invited_email then
    return jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  end if;

  v_provider := case
    when coalesce(v_auth_user.raw_app_meta_data->>'provider', v_auth_user.raw_user_meta_data->>'provider')
      in ('google', 'apple', 'email')
      then coalesce(v_auth_user.raw_app_meta_data->>'provider', v_auth_user.raw_user_meta_data->>'provider')
    else 'email'
  end;

  if v_invite.location_group = 'both' then
    v_location_id := null;
  else
    select l.id
    into v_location_id
    from public.locations as l
    where l.active
      and lower(btrim(l.short_code)) like case v_invite.location_group
        when 'sushi' then 's%'
        when 'poki' then 'p%'
      end
    order by l.created_at, l.id
    limit 1;

    if v_location_id is null then
      return jsonb_build_object('ok', false, 'reason', 'location_missing');
    end if;
  end if;

  insert into public.users (id, email, name, role, default_location_id)
  values (
    p_user_id,
    v_email,
    v_invite.invited_name,
    v_invite.role::public.user_role,
    v_location_id
  )
  on conflict (id) do update
  set email = excluded.email,
      name = excluded.name,
      role = excluded.role,
      default_location_id = excluded.default_location_id;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    provider,
    profile_completed,
    legacy_name_login
  )
  values (
    p_user_id,
    nullif(v_email, ''),
    v_invite.invited_name,
    v_invite.role,
    v_provider,
    true,
    false
  )
  on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email),
      full_name = excluded.full_name,
      role = excluded.role,
      provider = coalesce(public.profiles.provider, excluded.provider),
      profile_completed = true,
      legacy_name_login = false,
      updated_at = now();

  insert into public.user_modules (user_id, module_key, enabled, updated_by)
  select
    p_user_id,
    preset.key,
    (preset.value #>> '{}')::boolean,
    v_invite.created_by
  from jsonb_each(
    case
      when jsonb_typeof(v_invite.module_preset) = 'object'
        then v_invite.module_preset
      else '{}'::jsonb
    end
  ) as preset
  where jsonb_typeof(preset.value) = 'boolean'
    and preset.key in (
      'ordering_simple',
      'ordering_advanced',
      'stock_check',
      'tips',
      'fulfillment',
      'kitchen_requests',
      'kitchen_display'
    )
  on conflict (user_id, module_key) do update
  set enabled = excluded.enabled,
      updated_by = excluded.updated_by;

  update public.invites
  set used_at = now(),
      used_by = p_user_id
  where id = v_invite.id;

  return jsonb_build_object(
    'ok', true,
    'role', v_invite.role,
    'locationGroup', v_invite.location_group
  );
end;
$$;

revoke all on function public.claim_invite_for_user(text, uuid, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_invite_for_user(text, uuid, boolean, boolean)
  to service_role;
