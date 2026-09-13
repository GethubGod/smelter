-- Smelter 2.4 hides Advanced ordering and Stock check from daily navigation
-- and manager controls. Keep both module keys for compatibility with existing
-- user_modules rows and guarded routes, but default them off for every role.

create or replace function public.get_effective_modules(p_user_id uuid)
returns table(module_key text, enabled boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_is_manager boolean;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22004';
  end if;

  if auth.uid() is distinct from p_user_id
    and not public.current_user_is_manager() then
    raise exception 'not authorized to read these modules' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and role = 'manager'
  )
  into target_is_manager;

  return query
  select defaults.module_key, coalesce(overrides.enabled, defaults.enabled)
  from (
    values
      ('ordering_simple'::text, true),
      ('ordering_advanced'::text, false),
      ('stock_check'::text, false),
      ('tips'::text, target_is_manager),
      ('fulfillment'::text, target_is_manager),
      ('kitchen_requests'::text, target_is_manager),
      ('kitchen_display'::text, target_is_manager)
  ) as defaults(module_key, enabled)
  left join public.user_modules as overrides
    on overrides.user_id = p_user_id
   and overrides.module_key = defaults.module_key
  order by case defaults.module_key
    when 'ordering_simple' then 1
    when 'ordering_advanced' then 2
    when 'stock_check' then 3
    when 'tips' then 4
    when 'fulfillment' then 5
    when 'kitchen_requests' then 6
    when 'kitchen_display' then 7
  end;
end;
$$;

revoke all on function public.get_effective_modules(uuid) from public, anon;
grant execute on function public.get_effective_modules(uuid) to authenticated;

-- Preserve the still-editable org defaults and any forward-compatible keys,
-- while forcing the two hidden defaults off for new employee invites.
insert into public.app_config as config (key, value, description)
values (
  'employee_invite_module_defaults',
  '{"ordering_simple": true, "ordering_advanced": false, "stock_check": false, "tips": false}'::jsonb,
  'Module preset seeded into new employee invites when the manager does not override it. Managed from the New employee defaults screen.'
)
on conflict (key) do update
set value = (
      case
        when jsonb_typeof(config.value) = 'object' then config.value
        else '{}'::jsonb
      end
    ) || '{"ordering_advanced": false, "stock_check": false}'::jsonb,
    description = excluded.description,
    updated_at = now();

-- Managers may edit the remaining employee defaults. Keep accepting the two
-- hidden keys from installed 2.3 clients, then normalize them to false.
create or replace function public.set_employee_invite_defaults(p_defaults jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry record;
  normalized_defaults jsonb;
begin
  if not public.current_user_is_manager() then
    raise exception 'Only managers can change employee invite defaults'
      using errcode = '42501';
  end if;

  if p_defaults is null or jsonb_typeof(p_defaults) is distinct from 'object' then
    raise exception 'Defaults must be a JSON object' using errcode = '22023';
  end if;

  for entry in select key, value from jsonb_each(p_defaults) loop
    if entry.key not in ('ordering_simple', 'ordering_advanced', 'stock_check', 'tips') then
      raise exception 'Unknown module key: %', entry.key using errcode = '22023';
    end if;
    if jsonb_typeof(entry.value) is distinct from 'boolean' then
      raise exception 'Module % must be true or false', entry.key using errcode = '22023';
    end if;
  end loop;

  normalized_defaults :=
    '{"ordering_simple": true, "tips": false}'::jsonb
    || p_defaults
    || '{"ordering_advanced": false, "stock_check": false}'::jsonb;

  insert into public.app_config (key, value, description, updated_at, updated_by)
  values (
    'employee_invite_module_defaults',
    normalized_defaults,
    'Module preset seeded into new employee invites when the manager does not override it. Managed from the New employee defaults screen.',
    now(),
    auth.uid()
  )
  on conflict (key) do update
  set value = excluded.value,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.set_employee_invite_defaults(jsonb) from public, anon;
grant execute on function public.set_employee_invite_defaults(jsonb) to authenticated, service_role;
