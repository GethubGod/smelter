-- Supabase's hosted platform applies default privileges on the public
-- schema that this local stack does not get for free: privileges are role
-- state (pg_default_acl / per-object ACLs), not schema DDL, so neither
-- baseline_public_schema.sql (a pg_catalog/information_schema DDL dump) nor
-- a migration file carries them. Without these, service_role reads/writes
-- fail with "permission denied for table ..." (42501) even where RLS would
-- otherwise allow the request, because ordinary grants are a first gate and
-- RLS is a second gate on top of them, not a replacement for them. Every
-- edge function runs as service_role, so this blocks every local edge
-- function invocation on a fresh stack (see issue #63).
--
-- full-stack.sh applies this after the baseline snapshot AND after every
-- migration in the same load_schema run, every time load_schema runs (both
-- a fresh `up` and a `load` against an already-running stack). That order
-- matters: some tables (e.g. public.invites) are created by a migration
-- newer than the baseline cutoff, not by the baseline snapshot itself, so a
-- grant step that only ran right after the baseline load would miss them.
--
-- Kept as its own file rather than folded into baseline_public_schema.sql
-- so the baseline stays a faithful, mechanically-generated schema snapshot
-- (see its header) and the grants stay easy to find, diff, and reason about
-- on their own.
--
-- Idempotent: safe to re-run against a stack that already has these grants.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Default privileges cover objects created by migrations that have not run
-- yet at the moment this file is applied within a given load_schema call
-- (none, today, since this runs last) and, more importantly, persist in the
-- database so any migration added later and picked up by a future
-- `full-stack.sh load` also grants correctly even before this file's next
-- explicit run.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
