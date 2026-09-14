-- Run only against a disposable local backend with manager and employee fixtures.
-- All fixture changes are rolled back.
begin;
do $$
declare
  manager_id uuid;
  employee_id uuid;
  actor_id uuid;
  modules jsonb;
  saved_defaults jsonb;
begin
  select id into manager_id from public.profiles where role = 'manager' limit 1;
  select id into employee_id from public.profiles where role = 'employee' limit 1;
  if manager_id is null or employee_id is null then
    raise exception 'Manager and employee fixtures are required';
  end if;

  foreach actor_id in array array[manager_id, employee_id] loop
    delete from public.user_modules where user_id = actor_id;
    perform set_config('request.jwt.claim.sub', actor_id::text, true);
    select jsonb_object_agg(module_key, enabled) into modules
      from public.get_effective_modules(actor_id);
    if modules->>'ordering_advanced' is distinct from 'false'
      or modules->>'stock_check' is distinct from 'false'
      or modules->>'ordering_simple' is distinct from 'true' then
      raise exception 'Unexpected fresh role defaults: %', modules;
    end if;
    if (modules->>'kitchen_requests')::boolean is distinct from (actor_id = manager_id)
      or (modules->>'kitchen_display')::boolean is distinct from (actor_id = manager_id) then
      raise exception 'Kitchen role defaults changed';
    end if;
  end loop;
  raise notice 'PASS: fresh employee and manager defaults, including kitchen parity';

  insert into public.user_modules (user_id, module_key, enabled)
    values (employee_id, 'ordering_advanced', true);
  select jsonb_object_agg(module_key, enabled) into modules
    from public.get_effective_modules(employee_id);
  if modules->>'ordering_advanced' is distinct from 'true' then
    raise exception 'Stored compatibility override was discarded';
  end if;

  begin
    perform public.get_effective_modules(manager_id);
    raise exception 'Employee could read another user modules';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_employee_invite_defaults('{"tips":true}'::jsonb);
    raise exception 'Employee could change invite defaults';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: stored overrides and employee authorization boundaries';

  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  perform public.set_employee_invite_defaults(
    '{"ordering_simple":false,"ordering_advanced":true,"stock_check":true,"tips":true}'::jsonb
  );
  select value into saved_defaults from public.app_config
    where key = 'employee_invite_module_defaults';
  if saved_defaults is distinct from
    '{"ordering_simple":false,"ordering_advanced":false,"stock_check":false,"tips":true}'::jsonb then
    raise exception 'Legacy defaults payload was not normalized correctly: %', saved_defaults;
  end if;
  raise notice 'PASS: legacy client payload accepted and hidden defaults normalized';
end;
$$;
rollback;
