-- Support requests table for public support page submissions (Apple App Store Guideline 1.5 & 5.1.1 compliant)

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_requests_created_at
  on public.support_requests (created_at desc);

create index if not exists idx_support_requests_status
  on public.support_requests (status);

alter table public.support_requests enable row level security;

-- Authenticated managers can view support requests
create policy "Managers can view support requests"
  on public.support_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('manager', 'admin')
    )
  );

-- Authenticated managers can update support requests (e.g. resolve them)
create policy "Managers can update support requests"
  on public.support_requests
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('manager', 'admin')
    )
  );

-- Anonymous callers and users can insert support requests
create policy "Anyone can submit support requests"
  on public.support_requests
  for insert
  to anon, authenticated
  with check (
    length(trim(name)) > 0 and
    (length(trim(coalesce(email, ''))) > 0 or length(trim(coalesce(phone, ''))) > 0) and
    length(trim(message)) > 0
  );
