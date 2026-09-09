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
-- full-stack.sh applies this file exactly once per fresh load, immediately
-- after the baseline snapshot and BEFORE the migration loop runs. That order
-- matters and must not change: on hosted Supabase, the platform's default
-- privileges land on a table/function/sequence at the moment it is created,
-- before any migration that touches it can run, so a migration's own
-- `revoke` (47 migrations in this repo revoke something -- e.g. kitchen
-- requests locking public.kitchen_items/public.kitchen_requests down from
-- anon/authenticated, several revoking execute on security-definer
-- functions) executes after the grant and sticks. The `alter default
-- privileges` statements below reproduce that: they don't grant anything on
-- existing objects by themselves, they make every object CREATEd afterwards
-- (by the baseline load already done, and by every migration the loop is
-- about to run, since both run as this same `postgres` role) inherit the
-- grant automatically, in schema-DDL order, so each migration's revoke still
-- runs last and wins. Applying this file after the migration loop instead
-- would re-grant everything those revokes just removed, diverging from
-- production on exactly the grants the RLS fixtures and E2E suites rely on.
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

-- Default privileges for the postgres role in schema public: every table,
-- sequence, and function that role creates from here on (the migration loop
-- that runs immediately after this file, on every future `full-stack.sh
-- load` too) is granted automatically at creation time, before that
-- migration's own revoke statements (if any) run.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
