-- Workspace requests: capture incoming sign-up requests from smelterpos.com/signup
-- for review and manual invite provisioning by David / managers.

create table if not exists public.workspace_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null check (email = lower(email) and email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  phone text,
  restaurant_name text not null,
  city text,
  primary_category text check (primary_category is null or primary_category in ('fish', 'produce', 'dry_goods', 'packaging')),
  locations_count smallint not null default 1 check (locations_count between 1 and 20),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  invite_id uuid references public.invites(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists workspace_requests_status_created_at_idx
  on public.workspace_requests (status, created_at desc);

create index if not exists workspace_requests_email_idx
  on public.workspace_requests (lower(email));

-- Rate limit ledger for workspace request submissions
create table if not exists public.workspace_request_rate_limits (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists workspace_request_rate_limits_ip_idx
  on public.workspace_request_rate_limits (ip_hash, created_at desc);

create index if not exists workspace_request_rate_limits_email_idx
  on public.workspace_request_rate_limits (email, created_at desc);

-- RLS: managers only can view and update requests.
-- Rate limit ledger is service-role only.
alter table public.workspace_requests enable row level security;
alter table public.workspace_request_rate_limits enable row level security;

revoke all on table public.workspace_requests from anon, authenticated;
revoke all on table public.workspace_request_rate_limits from anon, authenticated;

grant select, update on table public.workspace_requests to authenticated;

drop policy if exists workspace_requests_manager_select on public.workspace_requests;
create policy workspace_requests_manager_select on public.workspace_requests
  for select to authenticated
  using (public.current_user_is_manager());

drop policy if exists workspace_requests_manager_update on public.workspace_requests;
create policy workspace_requests_manager_update on public.workspace_requests
  for update to authenticated
  using (public.current_user_is_manager())
  with check (public.current_user_is_manager());
