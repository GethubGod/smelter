# Issue #40 psql assertions

Every mutation in this pass is asserted against the local full stack
(`FULL_STACK_PORT_BASE=54520 scripts/local-db/full-stack.sh up`, database on
127.0.0.1:54522). Each block below is the exact SQL run and the exact output,
appended by `scripts/release-readiness/assert-issue-40.sh`. Loopback only;
nothing here touches production.

## 00-fixture-baseline

Run at 2026-09-05T19:03:44Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select 'users' as t, count(*) from public.users
union all select 'orders', count(*) from public.orders
union all select 'invites', count(*) from public.invites
union all select 'login_identities', count(*) from public.login_identities
union all select 'reminders', count(*) from public.reminders
union all select 'stock_check_sessions', count(*) from public.stock_check_sessions
order by 1;
```

```
          t           | count 
----------------------+-------
 invites              |     0
 login_identities     |     3
 orders               |     2
 reminders            |     0
 stock_check_sessions |     0
 users                |     3
(6 rows)
```
