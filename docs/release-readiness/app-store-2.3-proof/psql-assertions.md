
## 00-baseline-before-sim-run

Run at 2026-09-10T22:08:58Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select count(*) as stock_check_sessions_rows from public.stock_check_sessions;
select area_item.id, inventory_item.name, area_item.par_level, area_item.unit_type, area_item.order_unit, area_item.conversion_factor, area_item.current_quantity
from public.area_items area_item
join public.inventory_items inventory_item on inventory_item.id = area_item.inventory_item_id
order by area_item.area_id, area_item.shelf_sort_order;
select id, email, full_name, role, is_suspended from public.profiles where email like 'e2e.%' order by email;
select count(*) as orders_rows from public.orders;
```

```
 stock_updates_rows 
--------------------
                  0
(1 row)

 stock_check_sessions_rows 
---------------------------
                         0
(1 row)

                  id                  |      name       | par_level | unit_type | order_unit | conversion_factor | current_quantity 
--------------------------------------+-----------------+-----------+-----------+------------+-------------------+------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon  |         8 | fillet    | case       |                10 |                3
 48000000-0000-4000-8000-000000000002 | Fixture Rice    |        12 | bag       | pallet     |                20 |               10
 48000000-0000-4000-8000-000000000003 | Fixture Nori    |        25 | pack      | case       |                50 |               20
 48000000-0000-4000-8000-000000000004 | Fixture Avocado |        12 | each      | case       |                24 |                8
(4 rows)

                  id                  |           email            |    full_name     |   role   | is_suspended 
--------------------------------------+----------------------------+------------------+----------+--------------
 5c0f052e-3021-4560-aa89-b85b44f773f2 | e2e.employee@smelter.test  | E2E Employee     | employee | f
 634a23a3-2185-4b66-8fea-f5b6b5f21df7 | e2e.employee2@smelter.test | E2E Employee Two | employee | f
 c49977c9-1c1a-4ce7-af43-631697cd0492 | e2e.manager@smelter.test   | E2E Manager      | manager  | f
(3 rows)

 orders_rows 
-------------
           2
(1 row)
```

## 73-01-salmon-6-case-write

Run at 2026-09-10T22:49:14Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, previous_quantity, update_method, entry_mode, stock_check_session_id is not null as has_session, created_at
from public.stock_updates order by created_at;
select ai.id, ii.name, ai.current_quantity, ai.unit_type, ai.par_level from public.area_items ai join public.inventory_items ii on ii.id = ai.inventory_item_id where ai.id = '48000000-0000-4000-8000-000000000001';
select id, status, items_checked, items_total from public.stock_check_sessions;
```

```
             area_item_id             | new_quantity | previous_quantity |    update_method    | entry_mode | has_session |          created_at           
--------------------------------------+--------------+-------------------+---------------------+------------+-------------+-------------------------------
 48000000-0000-4000-8000-000000000001 |           60 |                 3 | stock_check_numeric | numeric    | t           | 2026-09-10 22:49:09.416566+00
(1 row)

                  id                  |      name      | current_quantity | unit_type | par_level 
--------------------------------------+----------------+------------------+-----------+-----------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |               60 | fillet    |         8
(1 row)

                  id                  |   status    | items_checked | items_total 
--------------------------------------+-------------+---------------+-------------
 0677ee87-be5c-4d33-a035-d3ff9b91db7b | in_progress |             1 |           3
(1 row)
```

## 74-01-offline-count-not-written

Run at 2026-09-10T22:51:43Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select ai.id, ii.name, ai.current_quantity from public.area_items ai join public.inventory_items ii on ii.id = ai.inventory_item_id where ai.area_id = '47000000-0000-4000-8000-000000000001' order by ai.shelf_sort_order;
```

```
 stock_updates_rows 
--------------------
                  1
(1 row)

                  id                  |      name      | current_quantity 
--------------------------------------+----------------+------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |               60
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |               10
(2 rows)
```

## 74-02-queue-drained-at-launch-before-any-stock-screen

Run at 2026-09-10T22:51:58Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, previous_quantity, update_method, created_at from public.stock_updates order by created_at;
select ai.id, ii.name, ai.current_quantity, ai.last_updated_at from public.area_items ai join public.inventory_items ii on ii.id = ai.inventory_item_id where ai.area_id = '47000000-0000-4000-8000-000000000001' order by ai.shelf_sort_order;
select id, status, items_checked, items_total from public.stock_check_sessions;
```

```
             area_item_id             | new_quantity | previous_quantity |    update_method    |          created_at           
--------------------------------------+--------------+-------------------+---------------------+-------------------------------
 48000000-0000-4000-8000-000000000001 |           60 |                 3 | stock_check_numeric | 2026-09-10 22:49:09.416566+00
(1 row)

                  id                  |      name      | current_quantity |        last_updated_at        
--------------------------------------+----------------+------------------+-------------------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |               60 | 2026-09-10 22:49:09.416566+00
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |               10 | 
(2 rows)

                  id                  |   status    | items_checked | items_total 
--------------------------------------+-------------+---------------+-------------
 0677ee87-be5c-4d33-a035-d3ff9b91db7b | in_progress |             1 |           3
(1 row)
```

## 74-03-recheck-30s-after-relaunch

Run at 2026-09-10T22:52:11Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, created_at from public.stock_updates order by created_at;
```

```
             area_item_id             | new_quantity |          created_at           
--------------------------------------+--------------+-------------------------------
 48000000-0000-4000-8000-000000000001 |           60 | 2026-09-10 22:49:09.416566+00
(1 row)
```

## 74-04-recheck-60s-after-relaunch

Run at 2026-09-10T22:52:44Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, created_at from public.stock_updates order by created_at;
```

```
             area_item_id             | new_quantity |          created_at           
--------------------------------------+--------------+-------------------------------
 48000000-0000-4000-8000-000000000001 |           60 | 2026-09-10 22:49:09.416566+00
(1 row)
```

## 74-05-after-opening-stock-screen

Run at 2026-09-10T22:53:10Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, previous_quantity, created_at from public.stock_updates order by created_at;
select ai.id, ii.name, ai.current_quantity from public.area_items ai join public.inventory_items ii on ii.id = ai.inventory_item_id where ai.area_id = '47000000-0000-4000-8000-000000000001' order by ai.shelf_sort_order;
```

```
             area_item_id             | new_quantity | previous_quantity |          created_at           
--------------------------------------+--------------+-------------------+-------------------------------
 48000000-0000-4000-8000-000000000001 |           60 |                 3 | 2026-09-10 22:49:09.416566+00
 48000000-0000-4000-8000-000000000002 |            4 |                10 | 2026-09-10 22:53:03.915502+00
(2 rows)

                  id                  |      name      | current_quantity 
--------------------------------------+----------------+------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |               60
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |                4
(2 rows)
```

## 74-06-second-run-90s-after-relaunch-no-stock-screen

Run at 2026-09-10T22:56:51Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, previous_quantity, created_at from public.stock_updates order by created_at;
```

```
             area_item_id             | new_quantity | previous_quantity |          created_at           
--------------------------------------+--------------+-------------------+-------------------------------
 48000000-0000-4000-8000-000000000001 |           60 |                 3 | 2026-09-10 22:49:09.416566+00
 48000000-0000-4000-8000-000000000002 |            4 |                10 | 2026-09-10 22:53:03.915502+00
(2 rows)
```

## 74-07-second-run-after-opening-stock-screen

Run at 2026-09-10T22:57:31Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, previous_quantity, created_at from public.stock_updates order by created_at;
```

```
             area_item_id             | new_quantity | previous_quantity |          created_at           
--------------------------------------+--------------+-------------------+-------------------------------
 48000000-0000-4000-8000-000000000001 |           60 |                 3 | 2026-09-10 22:49:09.416566+00
 48000000-0000-4000-8000-000000000002 |            4 |                10 | 2026-09-10 22:53:03.915502+00
 48000000-0000-4000-8000-000000000003 |           50 |                20 | 2026-09-10 22:57:24.397431+00
(3 rows)
```

## 62-01-suspend-employee

Run at 2026-09-10T22:57:34Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
update public.profiles set is_suspended = true, suspended_at = now() where id = '5c0f052e-3021-4560-aa89-b85b44f773f2';
select id, email, is_suspended, suspended_at from public.profiles where id = '5c0f052e-3021-4560-aa89-b85b44f773f2';
```

```
UPDATE 1
                  id                  |           email           | is_suspended |         suspended_at          
--------------------------------------+---------------------------+--------------+-------------------------------
 5c0f052e-3021-4560-aa89-b85b44f773f2 | e2e.employee@smelter.test | t            | 2026-09-10 22:57:34.373964+00
(1 row)
```

## 62-02-unsuspend-employee

Run at 2026-09-10T22:58:12Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
update public.profiles set is_suspended = false, suspended_at = null where id = '5c0f052e-3021-4560-aa89-b85b44f773f2';
select id, email, is_suspended from public.profiles where id = '5c0f052e-3021-4560-aa89-b85b44f773f2';
```

```
UPDATE 1
                  id                  |           email           | is_suspended 
--------------------------------------+---------------------------+--------------
 5c0f052e-3021-4560-aa89-b85b44f773f2 | e2e.employee@smelter.test | f
(1 row)
```

## inv-01-invite-row

Run at 2026-09-10T23:13:04Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select id, token is not null as has_token, name, location_group, expires_at > now() as valid, used_at, created_by from public.invites order by created_at desc limit 1;
```

```
ERROR:  column "name" does not exist
LINE 1: select id, token is not null as has_token, name, location_gr...
                                                   ^
```

## ful-01-send-all-copy

Run at 2026-09-10T23:16:30Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select id, supplier, share_method, status, created_at from public.past_orders order by created_at desc limit 2;
select status, count(*) from public.order_items group by status order by status;
```

```
ERROR:  column "supplier" does not exist
LINE 1: select id, supplier, share_method, status, created_at from p...
                   ^
HINT:  Perhaps you meant to reference the column "past_orders.supplier_id".
 status  | count 
---------+-------
 pending |     2
 sent    |     1
(2 rows)
```

## ful-02-seed-second-pending-order

Run at 2026-09-10T23:16:37Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
insert into public.orders (id, user_id, location_id, status, notes, order_type, entry_method, manager_review_status)
select '4b000000-0000-4000-8000-000000000009', user_id, location_id, 'submitted', 'Proof pass second pending order', order_type, entry_method, manager_review_status
from public.orders where id = '4b000000-0000-4000-8000-000000000001'
on conflict (id) do nothing;
insert into public.order_items (id, order_id, inventory_item_id, quantity, unit_type, input_mode, base_quantity, status, notes)
values ('4c000000-0000-4000-8000-000000000009', '4b000000-0000-4000-8000-000000000009', '46000000-0000-4000-8000-000000000001', 2, 'base'::unit_type, 'quantity', 2, 'pending', 'Proof pass pending line')
on conflict (id) do nothing;
select id, status from public.orders where id = '4b000000-0000-4000-8000-000000000009';
```

```
INSERT 0 1
ERROR:  column "base_quantity" of relation "order_items" does not exist
LINE 1: ...ventory_item_id, quantity, unit_type, input_mode, base_quant...
                                                             ^
                  id                  |  status   
--------------------------------------+-----------
 4b000000-0000-4000-8000-000000000009 | submitted
(1 row)
```

## ful-02b-seed-second-pending-order-items

Run at 2026-09-10T23:18:20Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
insert into public.order_items (id, order_id, inventory_item_id, quantity, unit_type, input_mode, status, notes)
values ('4c000000-0000-4000-8000-000000000009', '4b000000-0000-4000-8000-000000000009', '46000000-0000-4000-8000-000000000001', 2, 'base'::unit_type, 'quantity', 'pending', 'Proof pass pending line')
on conflict (id) do nothing;
select order_id, status, count(*) from public.order_items group by order_id, status order by order_id;
```

```
ERROR:  column "notes" of relation "order_items" does not exist
LINE 1: ...ory_item_id, quantity, unit_type, input_mode, status, notes)
                                                                 ^
               order_id               | status  | count 
--------------------------------------+---------+-------
 4b000000-0000-4000-8000-000000000001 | pending |     2
 4b000000-0000-4000-8000-000000000002 | sent    |     1
(2 rows)
```

## ful-03-finalize

Run at 2026-09-10T23:19:18Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select id, supplier_name, share_method, created_by, created_at from public.past_orders order by created_at desc limit 2;
select order_id, status, count(*) from public.order_items group by order_id, status order by order_id;
```

```
                  id                  |   supplier_name   | share_method |              created_by              |          created_at           
--------------------------------------+-------------------+--------------+--------------------------------------+-------------------------------
 8cfb818b-fde9-41ac-b789-bef03b679042 | Local QA Supplier | share        | c49977c9-1c1a-4ce7-af43-631697cd0492 | 2026-09-10 23:19:13.730291+00
(1 row)

               order_id               | status | count 
--------------------------------------+--------+-------
 4b000000-0000-4000-8000-000000000001 | sent   |     2
 4b000000-0000-4000-8000-000000000002 | sent   |     1
(2 rows)
```

## inv-02-invite-accepted

Run at 2026-09-10T23:23:14Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select id, invited_name, location_group, used_at is not null as used, used_by is not null as has_user from public.invites order by created_at desc limit 1;
select p.id, p.full_name, p.role, p.profile_completed, li.credential_kind from public.profiles p join public.login_identities li on li.user_id = p.id where p.full_name like 'Route Proof%';
```

```
                  id                  | invited_name | location_group | used | has_user 
--------------------------------------+--------------+----------------+------+----------
 43da3c6a-428b-45f0-9128-5c5158e3d784 | Route Proof  | sushi          | f    | f
(1 row)

 id | full_name | role | profile_completed | credential_kind 
----+-----------+------+-------------------+-----------------
(0 rows)
```

## inv-02-invite-accepted

Run at 2026-09-10T23:23:56Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select id, invited_name, location_group, used_at is not null as used, used_by is not null as has_user from public.invites order by created_at desc limit 1;
select p.id, p.full_name, p.role, p.profile_completed, li.credential_kind from public.profiles p join public.login_identities li on li.user_id = p.id where p.full_name like 'Route Proof%';
```

```
                  id                  | invited_name | location_group | used | has_user 
--------------------------------------+--------------+----------------+------+----------
 43da3c6a-428b-45f0-9128-5c5158e3d784 | Route Proof  | sushi          | f    | f
(1 row)

 id | full_name | role | profile_completed | credential_kind 
----+-----------+------+-------------------+-----------------
(0 rows)
```

## inv-02-invite-state-check

Run at 2026-09-10T23:25:24Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select id, invited_name, used_at is not null as used, used_by from public.invites order by created_at desc limit 1;
select p.id, p.full_name, p.role, p.profile_completed, p.created_at from public.profiles p order by created_at desc limit 2;
select user_id, display_name, credential_kind from public.login_identities order by created_at desc limit 2;
```

```
                  id                  | invited_name | used |               used_by                
--------------------------------------+--------------+------+--------------------------------------
 43da3c6a-428b-45f0-9128-5c5158e3d784 | Route Proof  | t    | 8f775bd1-63d2-4784-bd6b-92ca74029319
(1 row)

                  id                  |    full_name     |   role   | profile_completed |          created_at           
--------------------------------------+------------------+----------+-------------------+-------------------------------
 8f775bd1-63d2-4784-bd6b-92ca74029319 | Route Proof      | employee | t                 | 2026-09-10 23:24:44.590783+00
 634a23a3-2185-4b66-8fea-f5b6b5f21df7 | E2E Employee Two | employee | t                 | 2026-09-10 21:59:51.133178+00
(2 rows)

               user_id                | display_name | credential_kind 
--------------------------------------+--------------+-----------------
 8f775bd1-63d2-4784-bd6b-92ca74029319 | Route Proof  | pin
 c49977c9-1c1a-4ce7-af43-631697cd0492 | E2E Manager  | pin
(2 rows)
```

## 00b-fixture-reseed-before-resume

Run at 2026-09-11T02:59:42Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select id, email, full_name, role, is_suspended from public.profiles where email like 'e2e.%' order by email;
select ai.id, ii.name, ai.par_level, ai.unit_type, ai.order_unit, ai.conversion_factor, ai.current_quantity from public.area_items ai join public.inventory_items ii on ii.id = ai.inventory_item_id order by ai.area_id, ai.shelf_sort_order;
select count(*) as stock_updates_rows from public.stock_updates;
select count(*) as orders_rows from public.orders;
select id, name, is_active from public.locations order by name;
```

```
                  id                  |           email            |    full_name     |   role   | is_suspended 
--------------------------------------+----------------------------+------------------+----------+--------------
 5c0f052e-3021-4560-aa89-b85b44f773f2 | e2e.employee@smelter.test  | E2E Employee     | employee | f
 634a23a3-2185-4b66-8fea-f5b6b5f21df7 | e2e.employee2@smelter.test | E2E Employee Two | employee | f
 c49977c9-1c1a-4ce7-af43-631697cd0492 | e2e.manager@smelter.test   | E2E Manager      | manager  | f
(3 rows)

                  id                  |      name       | par_level | unit_type | order_unit | conversion_factor | current_quantity 
--------------------------------------+-----------------+-----------+-----------+------------+-------------------+------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon  |         8 | fillet    | case       |                10 |                3
 48000000-0000-4000-8000-000000000002 | Fixture Rice    |        12 | bag       | pallet     |                20 |               10
 48000000-0000-4000-8000-000000000003 | Fixture Nori    |        25 | pack      | case       |                50 |               20
 48000000-0000-4000-8000-000000000004 | Fixture Avocado |        12 | each      | case       |                24 |                8
(4 rows)

 stock_updates_rows 
--------------------
                  3
(1 row)

 orders_rows 
-------------
           2
(1 row)

ERROR:  column "is_active" does not exist
LINE 1: select id, name, is_active from public.locations order by na...
                         ^
HINT:  Perhaps you meant to reference the column "locations.active".
```

## 74-10-resume-baseline

Run at 2026-09-11T03:09:24Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select id, status, items_checked, items_total from public.stock_check_sessions order by created_at;
```

```
 stock_updates_rows 
--------------------
                  3
(1 row)

ERROR:  column "created_at" does not exist
LINE 1: ...s_total from public.stock_check_sessions order by created_at...
                                                             ^
```

## 74-10-resume-baseline-sessions

Run at 2026-09-11T03:09:44Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select id, status, items_checked, items_total, started_at from public.stock_check_sessions order by started_at;
```

```
                  id                  |   status    | items_checked | items_total |          started_at           
--------------------------------------+-------------+---------------+-------------+-------------------------------
 0677ee87-be5c-4d33-a035-d3ff9b91db7b | completed   |             3 |           3 | 2026-09-10 22:41:40.350714+00
 e815ee6b-2f0e-4ede-bde8-7c87495aef3a | in_progress |             0 |           3 | 2026-09-10 23:06:19.973863+00
 1bb17501-47c1-45d6-8f28-dc155445ecd8 | in_progress |             0 |           3 | 2026-09-11 03:09:24.725038+00
(3 rows)
```

## 74-11-resume-online-count-written

Run at 2026-09-11T03:12:09Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, previous_quantity, update_method, created_at from public.stock_updates order by created_at desc limit 2;
```

```
             area_item_id             | new_quantity | previous_quantity |    update_method    |          created_at           
--------------------------------------+--------------+-------------------+---------------------+-------------------------------
 48000000-0000-4000-8000-000000000003 |          100 |                20 | stock_check_numeric | 2026-09-11 03:12:04.052385+00
 48000000-0000-4000-8000-000000000003 |           50 |                20 | stock_check_numeric | 2026-09-10 22:57:24.397431+00
(2 rows)
```

## 74-12-resume-offline-count-not-written

Run at 2026-09-11T03:12:26Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, previous_quantity, created_at from public.stock_updates order by created_at desc limit 3;
```

```
             area_item_id             | new_quantity | previous_quantity |          created_at           
--------------------------------------+--------------+-------------------+-------------------------------
 48000000-0000-4000-8000-000000000003 |          100 |                20 | 2026-09-11 03:12:04.052385+00
 48000000-0000-4000-8000-000000000003 |           50 |                20 | 2026-09-10 22:57:24.397431+00
 48000000-0000-4000-8000-000000000002 |            4 |                10 | 2026-09-10 22:53:03.915502+00
(3 rows)
```

## 74-13-resume-10s-after-relaunch-no-stock-screen

Run at 2026-09-11T03:12:41Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, previous_quantity, created_at from public.stock_updates order by created_at desc limit 3;
```

```
             area_item_id             | new_quantity | previous_quantity |          created_at           
--------------------------------------+--------------+-------------------+-------------------------------
 48000000-0000-4000-8000-000000000003 |          100 |                20 | 2026-09-11 03:12:04.052385+00
 48000000-0000-4000-8000-000000000003 |           50 |                20 | 2026-09-10 22:57:24.397431+00
 48000000-0000-4000-8000-000000000002 |            4 |                10 | 2026-09-10 22:53:03.915502+00
(3 rows)
```

## 74-14-resume-30s-after-relaunch-no-stock-screen

Run at 2026-09-11T03:13:01Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, created_at from public.stock_updates order by created_at desc limit 3;
```

```
             area_item_id             | new_quantity |          created_at           
--------------------------------------+--------------+-------------------------------
 48000000-0000-4000-8000-000000000003 |          100 | 2026-09-11 03:12:04.052385+00
 48000000-0000-4000-8000-000000000003 |           50 | 2026-09-10 22:57:24.397431+00
 48000000-0000-4000-8000-000000000002 |            4 | 2026-09-10 22:53:03.915502+00
(3 rows)
```

## 74-15-resume-60s-after-relaunch-no-stock-screen

Run at 2026-09-11T03:13:32Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, created_at from public.stock_updates order by created_at desc limit 3;
```

```
             area_item_id             | new_quantity |          created_at           
--------------------------------------+--------------+-------------------------------
 48000000-0000-4000-8000-000000000003 |          100 | 2026-09-11 03:12:04.052385+00
 48000000-0000-4000-8000-000000000003 |           50 | 2026-09-10 22:57:24.397431+00
 48000000-0000-4000-8000-000000000002 |            4 | 2026-09-10 22:53:03.915502+00
(3 rows)
```

## 74-16-resume-after-opening-stock-screen

Run at 2026-09-11T03:13:41Z against `supabase_db_agent-a65bc65c005581c1d` (FULL_STACK_PORT_BASE=54620).

```sql
select area_item_id, new_quantity, previous_quantity, created_at from public.stock_updates order by created_at desc limit 3;
```

```
             area_item_id             | new_quantity | previous_quantity |          created_at           
--------------------------------------+--------------+-------------------+-------------------------------
 48000000-0000-4000-8000-000000000003 |          150 |               100 | 2026-09-11 03:13:32.988687+00
 48000000-0000-4000-8000-000000000003 |           50 |                20 | 2026-09-10 22:57:24.397431+00
 48000000-0000-4000-8000-000000000002 |            4 |                10 | 2026-09-10 22:53:03.915502+00
(3 rows)
```
