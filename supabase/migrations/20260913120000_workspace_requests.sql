-- Workspace requests: capture incoming sign-up requests from smelterpos.com/signup
-- for review and manual invite provisioning by David / managers.

create table if not exists public.workspace_requests (\n  id uuid primary key default gen_random_uuid(),\n  full_name text not null,\n  email text not null check (email = lower(email) and email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),\n  phone text,\n  restaurant_name text not null,\n  city text,\n  website text,\n  primary_category text check (primary_category is null or primary_category in ('fish', 'produce', 'dry_goods', 'packaging')),\n  locations_count smallint not null default 1 check (locations_count between 1 and 20),\n  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),\n  invite_id uuid references public.invites(id) on delete set null,\n  reviewed_by uuid references auth.users(id) on delete set null,\n  reviewed_at timestamptz,\n  ip_hash text,\n  user_agent text,\n  created_at timestamptz not null default now()\n);

create index if not exists workspace_requests_status_created_at_idx\n  on public.workspace_requests (status, created_at desc);

create index if not exists workspace_requests_email_idx\n  on public.workspace_requests (lower(email));

-- Rate limit ledger for workspace request submissions\ncreate table if not exists public.workspace_request_rate_limits (\n  id bigint generated always as identity primary key,\n  ip_hash text not null,\n  email text not null,\n  created_at timestamptz not null default now()\n);

create index if not exists workspace_request_rate_limits_ip_idx\n  on public.workspace_request_rate_limits (ip_hash, created_at desc);

create index if not exists workspace_request_rate_limits_email_idx\n  on public.workspace_request_rate_limits (email, created_at desc);

-- RLS: managers only can view and update requests.\n-- Rate limit ledger is service-role only.\nalter table public.workspace_requests enable row level security;\nalter table public.workspace_request_rate_limits enable row level security;\n\nrevoke all on table public.workspace_requests from anon, authenticated;\nrevoke all on table public.workspace_request_rate_limits from anon, authenticated;\n\ngrant select, update on table public.workspace_requests to authenticated;\n