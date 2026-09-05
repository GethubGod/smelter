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

## 01-manager-sign-in

Run at 2026-09-05T19:08:27Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select scope, success, count(*) from public.login_auth_attempts group by 1,2 order by 1,2;
select login_name, credential_kind, display_name from public.login_identities order by login_name;
```

```
 scope  | success | count 
--------+---------+-------
 client | t       |     1
 name   | t       |     1
(2 rows)

    login_name    | credential_kind |   display_name   
------------------+-----------------+------------------
 e2e employee     | pin             | E2E Employee
 e2e employee two | pin             | E2E Employee Two
 e2e manager      | pin             | E2E Manager
(3 rows)
```

## 02-quick-order-send

Run at 2026-09-05T23:28:38Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select id, order_number, status, order_type, entry_method, location_id, created_at
from public.orders order by created_at desc limit 2;
select oi.id, ii.name, oi.quantity, oi.unit_type, oi.input_mode, oi.status
from public.order_items oi join public.inventory_items ii on ii.id = oi.inventory_item_id
where oi.order_id = (select id from public.orders order by created_at desc limit 1)
order by ii.name;
select id, status, created_at from public.quick_order_sessions order by created_at desc limit 1;
```

```
                  id                  | order_number |  status   | order_type |   entry_method   |             location_id              |          created_at           
--------------------------------------+--------------+-----------+------------+------------------+--------------------------------------+-------------------------------
 8db17aa4-b393-4f6f-bbb6-ad14f8bb84ac |            3 | submitted | manual     | quick_order      | 45000000-0000-4000-8000-000000000001 | 2026-09-05 23:28:27.66035+00
 4b000000-0000-4000-8000-000000000001 |            1 | submitted | manual     | simple_checklist | 45000000-0000-4000-8000-000000000001 | 2026-09-05 19:01:47.386252+00
(2 rows)

                  id                  |      name      | quantity | unit_type | input_mode | status  
--------------------------------------+----------------+----------+-----------+------------+---------
 c0e6b80c-7562-4e2e-b0e8-0c08f316e525 | Fixture Rice   |     2.00 | base      | quantity   | pending
 ec9374f6-9917-4d43-86f7-e01fa76791e8 | Fixture Salmon |     3.00 | base      | quantity   | pending
(2 rows)

                  id                  |  status   |          created_at           
--------------------------------------+-----------+-------------------------------
 c10ab7b9-192c-4724-9f26-cb416037f08e | submitted | 2026-09-05 19:10:03.577336+00
(1 row)
```

## 03-fulfillment-send-all

Run at 2026-09-05T23:30:15Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select id, supplier_name, share_method, created_by, created_at from public.past_orders order by created_at desc limit 2;
select item_name, unit, quantity, location_group from public.past_order_items
where past_order_id = (select id from public.past_orders order by created_at desc limit 1) order by item_name;
select oi.id, ii.name, oi.status from public.order_items oi
join public.inventory_items ii on ii.id = oi.inventory_item_id order by oi.status, ii.name;
```

```
                  id                  |   supplier_name   | share_method |              created_by              |          created_at           
--------------------------------------+-------------------+--------------+--------------------------------------+-------------------------------
 e2feddc6-2f42-410f-a98f-ffdde1c4e6c0 | Local QA Supplier | copy         | 2d3d669b-8a9d-4536-8601-f8d42b4ac2c3 | 2026-09-05 23:30:04.462547+00
(1 row)

   item_name    |  unit  | quantity | location_group 
----------------+--------+----------+----------------
 Fixture Rice   | bag    |        2 | sushi
 Fixture Rice   | pallet |        1 | sushi
 Fixture Salmon | fillet |        6 | sushi
(3 rows)

                  id                  |      name      | status 
--------------------------------------+----------------+--------
 4c000000-0000-4000-8000-000000000003 | Fixture Nori   | sent
 4c000000-0000-4000-8000-000000000002 | Fixture Rice   | sent
 c0e6b80c-7562-4e2e-b0e8-0c08f316e525 | Fixture Rice   | sent
 4c000000-0000-4000-8000-000000000001 | Fixture Salmon | sent
 ec9374f6-9917-4d43-86f7-e01fa76791e8 | Fixture Salmon | sent
(5 rows)
```

## 04-receive-delivery

Run at 2026-09-05T23:31:46Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select id, past_order_id, received_by, status, created_at from public.order_receipts order by created_at desc limit 1;
select poi.item_name, ori.received, ori.received_qty, ori.note
from public.order_receipt_items ori
join public.past_order_items poi on poi.id = ori.past_order_item_id
where ori.receipt_id = (select id from public.order_receipts order by created_at desc limit 1)
order by poi.item_name, ori.received desc;
```

```
                  id                  |            past_order_id             |             received_by              | status  |          created_at           
--------------------------------------+--------------------------------------+--------------------------------------+---------+-------------------------------
 caefa09c-03b5-4781-957c-c8cbce087639 | e2feddc6-2f42-410f-a98f-ffdde1c4e6c0 | 2d3d669b-8a9d-4536-8601-f8d42b4ac2c3 | partial | 2026-09-05 23:31:07.274827+00
(1 row)

   item_name    | received | received_qty |             note              
----------------+----------+--------------+-------------------------------
 Fixture Rice   | t        |              | 
 Fixture Rice   | t        |              | 
 Fixture Salmon | t        |            2 | Two fillets short on delivery
(3 rows)
```

## 05-order-status-changes

Run at 2026-09-05T23:33:35Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select id, order_number, status, fulfilled_at, fulfilled_by from public.orders
where id = '8db17aa4-b393-4f6f-bbb6-ad14f8bb84ac';
```

```
                  id                  | order_number |  status   |        fulfilled_at        |             fulfilled_by             
--------------------------------------+--------------+-----------+----------------------------+--------------------------------------
 8db17aa4-b393-4f6f-bbb6-ad14f8bb84ac |            3 | fulfilled | 2026-09-05 23:33:29.145+00 | 2d3d669b-8a9d-4536-8601-f8d42b4ac2c3
(1 row)
```

## 06-reminder-send

Run at 2026-09-05T23:34:13Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select id, employee_id, manager_id, location_id, scope, status, reminder_count, last_reminded_at from public.reminders order by created_at desc limit 1;
select event_type, sent_at, channels_attempted, delivery_result from public.reminder_events
where reminder_id = (select id from public.reminders order by created_at desc limit 1);
select user_id, notification_type, title, body from public.notifications order by created_at desc limit 1;
```

```
                  id                  |             employee_id              |              manager_id              |             location_id              |  scope   | status | reminder_count |      last_reminded_at      
--------------------------------------+--------------------------------------+--------------------------------------+--------------------------------------+----------+--------+----------------+----------------------------
 12c05095-de50-413e-a04f-b56c08bd1d3c | 92bbe53d-2842-4e57-b912-a00e2c3eaf36 | 2d3d669b-8a9d-4536-8601-f8d42b4ac2c3 | 45000000-0000-4000-8000-000000000001 | employee | active |              1 | 2026-09-05 23:34:05.719+00
(1 row)

 event_type |          sent_at           | channels_attempted |                                                                                                                                         delivery_result                                                                                                                                          
------------+----------------------------+--------------------+--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 sent       | 2026-09-05 23:34:05.719+00 | ["in_app", "push"] | {"push": {"status": "no_tokens", "attempted": true, "receiptIds": [], "tokenCount": 0, "errorDetail": null, "failureCount": 0, "successCount": 0, "deliveryOutcome": null}, "source": "manual", "notifications_enabled": true, "in_app_notification_id": "4a3b2b98-48e4-4171-9eae-b0d83b8bc759"}
(1 row)

               user_id                | notification_type |     title      |                       body                       
--------------------------------------+-------------------+----------------+--------------------------------------------------
 92bbe53d-2842-4e57-b912-a00e2c3eaf36 | employee_reminder | Order reminder | Please submit your order when you have a moment.
(1 row)
```

## 07-reminder-scheduling

Run at 2026-09-05T23:35:24Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select id, scope, employee_id, rule_kind, days_of_week, time_of_day, timezone,
       condition_type, channels, enabled, created_by, created_at
from public.recurring_reminder_rules order by created_at desc limit 1;
```

```
                  id                  |  scope   |             employee_id              | rule_kind | days_of_week | time_of_day |      timezone       | condition_type |            channels            | enabled |              created_by              |          created_at           
--------------------------------------+----------+--------------------------------------+-----------+--------------+-------------+---------------------+----------------+--------------------------------+---------+--------------------------------------+-------------------------------
 e8d82633-5436-4fc9-a740-49a988f72b60 | employee | 92bbe53d-2842-4e57-b912-a00e2c3eaf36 | standard  | {2,4}        | 15:00:00    | America/Los_Angeles | no_order_today | {"push": true, "in_app": true} | t       | 2d3d669b-8a9d-4536-8601-f8d42b4ac2c3 | 2026-09-05 23:35:16.726362+00
(1 row)
```

## 08-invite-create

Run at 2026-09-05T23:36:07Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select id, invited_name, role, location_group, module_preset, expires_at, created_by, used_at, revoked_at
from public.invites order by created_at desc limit 1;
```

```
                  id                  | invited_name |   role   | location_group |                                       module_preset                                       |         expires_at         |              created_by              | used_at | revoked_at 
--------------------------------------+--------------+----------+----------------+-------------------------------------------------------------------------------------------+----------------------------+--------------------------------------+---------+------------
 1888bff2-d174-4995-ab20-fb177cf250da | E2E Invitee  | employee | sushi          | {"tips": false, "stock_check": true, "ordering_simple": true, "ordering_advanced": false} | 2026-09-12 23:35:58.984+00 | 2d3d669b-8a9d-4536-8601-f8d42b4ac2c3 |         | 
(1 row)
```

## 09-credential-change

Run at 2026-09-05T23:36:56Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select login_name, credential_kind, md5(secret_hash) as secret_hash_md5, updated_at, updated_by
from public.login_identities where login_name = 'e2e manager';
```

```
 login_name  | credential_kind |         secret_hash_md5          |          updated_at           |              updated_by              
-------------+-----------------+----------------------------------+-------------------------------+--------------------------------------
 e2e manager | pin             | b3cc992658e341b8ebd70da32188324f | 2026-09-05 23:36:49.716508+00 | 2d3d669b-8a9d-4536-8601-f8d42b4ac2c3
(1 row)
```

## 10-login-after-credential-change

Run at 2026-09-05T23:38:56Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select scope, success, count(*), max(created_at) as latest
from public.login_auth_attempts group by 1,2 order by 1,2;
select email, last_sign_in_at from auth.users where email = 'e2e.manager@smelter.test';
```

```
ERROR:  column "created_at" does not exist
LINE 1: select scope, success, count(*), max(created_at) as latest
                                             ^
          email           |        last_sign_in_at        
--------------------------+-------------------------------
 e2e.manager@smelter.test | 2026-09-05 23:38:43.841169+00
(1 row)
```

## 10-login-after-credential-change

Run at 2026-09-05T23:39:03Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select scope, success, count(*), max(attempted_at) as latest
from public.login_auth_attempts group by 1,2 order by 1,2;
select email, last_sign_in_at from auth.users where email = 'e2e.manager@smelter.test';
```

```
 scope  | success | count |            latest             
--------+---------+-------+-------------------------------
 client | t       |     2 | 2026-09-05 23:38:43.765161+00
 name   | t       |     2 | 2026-09-05 23:38:43.765161+00
(2 rows)

          email           |        last_sign_in_at        
--------------------------+-------------------------------
 e2e.manager@smelter.test | 2026-09-05 23:38:43.841169+00
(1 row)
```
