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

## 11-invite-accept

Run at 2026-09-05T23:41:07Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select id, invited_name, role, location_group, used_at, used_by, revoked_at
from public.invites order by created_at desc limit 1;
select u.id, u.name, u.email, u.role, l.name as location
from public.users u left join public.locations l on l.id = u.default_location_id
where u.id = (select used_by from public.invites order by created_at desc limit 1);
select credential_kind, login_name, display_name from public.login_identities
where user_id = (select used_by from public.invites order by created_at desc limit 1);
select module_key, enabled from public.user_modules
where user_id = (select used_by from public.invites order by created_at desc limit 1) order by module_key;
```

```
                  id                  | invited_name |   role   | location_group |          used_at           |               used_by                | revoked_at 
--------------------------------------+--------------+----------+----------------+----------------------------+--------------------------------------+------------
 1888bff2-d174-4995-ab20-fb177cf250da | E2E Invitee  | employee | sushi          | 2026-09-05 23:40:50.827+00 | 23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9 | 
(1 row)

                  id                  |    name     |                                 email                                 |   role   | location 
--------------------------------------+-------------+-----------------------------------------------------------------------+----------+----------
 23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9 | E2E Invitee | join-1888bff2-d174-4995-ab20-fb177cf250da@members.babytunasystems.com | employee | 
(1 row)

 credential_kind | login_name  | display_name 
-----------------+-------------+--------------
 pin             | e2e invitee | E2E Invitee
(1 row)

    module_key     | enabled 
-------------------+---------
 ordering_advanced | f
 ordering_simple   | t
 stock_check       | t
 tips              | f
(4 rows)
```

## 12-stock-count-save

Run at 2026-09-05T23:42:37Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select count(*) as stock_check_sessions_rows from public.stock_check_sessions;
select ai.id, ii.name, ai.current_quantity, ai.last_updated_at, ai.last_updated_by
from public.area_items ai join public.inventory_items ii on ii.id = ai.inventory_item_id
where ai.area_id = '47000000-0000-4000-8000-000000000001' order by ii.name;
select sa.name, sa.last_checked_at, sa.last_checked_by from public.storage_areas sa
where sa.id = '47000000-0000-4000-8000-000000000001';
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

                  id                  |      name      | current_quantity | last_updated_at | last_updated_by 
--------------------------------------+----------------+------------------+-----------------+-----------------
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |               10 |                 | 
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |                3 |                 | 
(2 rows)

      name       | last_checked_at | last_checked_by 
-----------------+-----------------+-----------------
 Fixture Freezer |                 | 
(1 row)
```

## 13-stock-count-offline-sync

Run at 2026-09-05T23:43:59Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
-- After a full app relaunch with the backend reachable again.
select count(*) as stock_updates_rows from public.stock_updates;
select count(*) as stock_check_sessions_rows from public.stock_check_sessions;
select ai.id, ii.name, ai.current_quantity, ai.last_updated_at, ai.last_updated_by
from public.area_items ai join public.inventory_items ii on ii.id = ai.inventory_item_id
where ai.area_id = '47000000-0000-4000-8000-000000000001' order by ii.name;
select name, last_checked_at, last_checked_by from public.storage_areas
where id = '47000000-0000-4000-8000-000000000001';
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

                  id                  |      name      | current_quantity | last_updated_at | last_updated_by 
--------------------------------------+----------------+------------------+-----------------+-----------------
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |               10 |                 | 
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |                3 |                 | 
(2 rows)

      name       | last_checked_at | last_checked_by 
-----------------+-----------------+-----------------
 Fixture Freezer |                 | 
(1 row)
```

## 14-account-deletion-before

Run at 2026-09-05T23:45:01Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select id, name, email, role from public.users where id = '23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9';
select count(*) as profiles from public.profiles where id = '23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9';
select count(*) as auth_users from auth.users where id = '23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9';
select count(*) as login_identities from public.login_identities where user_id = '23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9';
select count(*) as user_modules from public.user_modules where user_id = '23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9';
select id, used_by from public.invites where used_by = '23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9';
```

```
                  id                  |    name     |                                 email                                 |   role   
--------------------------------------+-------------+-----------------------------------------------------------------------+----------
 23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9 | E2E Invitee | join-1888bff2-d174-4995-ab20-fb177cf250da@members.babytunasystems.com | employee
(1 row)

 profiles 
----------
        1
(1 row)

 auth_users 
------------
          1
(1 row)

 login_identities 
------------------
                1
(1 row)

 user_modules 
--------------
            4
(1 row)

                  id                  |               used_by                
--------------------------------------+--------------------------------------
 1888bff2-d174-4995-ab20-fb177cf250da | 23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9
(1 row)
```

## 15-account-deletion-after

Run at 2026-09-05T23:46:37Z against `supabase_db_agent-a435d3a57e1a702d9`.

```sql
select count(*) as auth_users from auth.users where id = '23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9';
select count(*) as users from public.users where id = '23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9';
select count(*) as profiles from public.profiles where id = '23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9';
select count(*) as login_identities from public.login_identities where user_id = '23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9';
select count(*) as user_modules from public.user_modules where user_id = '23a0d5fb-f4c3-4d2b-a6e5-0010dd139cb9';
select id, invited_name, used_at, used_by from public.invites where id = '1888bff2-d174-4995-ab20-fb177cf250da';
```

```
 auth_users 
------------
          0
(1 row)

 users 
-------
     0
(1 row)

 profiles 
----------
        0
(1 row)

 login_identities 
------------------
                0
(1 row)

 user_modules 
--------------
            0
(1 row)

                  id                  | invited_name |          used_at           | used_by 
--------------------------------------+--------------+----------------------------+---------
 1888bff2-d174-4995-ab20-fb177cf250da | E2E Invitee  | 2026-09-05 23:40:50.827+00 | 
(1 row)
```

## pr75-00-fixture-baseline

Run at 2026-09-09T05:39:14Z against `supabase_db_smelter-performance`.

```sql
select 'users' as t, count(*) from public.users
union all select 'orders', count(*) from public.orders
union all select 'order_items', count(*) from public.order_items
union all select 'past_orders', count(*) from public.past_orders
union all select 'order_receipts', count(*) from public.order_receipts
union all select 'invites', count(*) from public.invites
union all select 'login_identities', count(*) from public.login_identities
union all select 'reminders', count(*) from public.reminders
union all select 'stock_updates', count(*) from public.stock_updates
union all select 'stock_check_sessions', count(*) from public.stock_check_sessions
order by 1;
select id, name, short_code, active from public.locations order by name;
select id, name, unit_type from public.inventory_items order by name;
```

```
          t           | count 
----------------------+-------
 invites              |     0
 login_identities     |     3
 order_items          |     3
 order_receipts       |     0
 orders               |     2
 past_orders          |     0
 reminders            |     0
 stock_check_sessions |     0
 stock_updates        |     0
 users                |     3
(10 rows)

                  id                  |        name        | short_code | active 
--------------------------------------+--------------------+------------+--------
 45000000-0000-4000-8000-000000000002 | Fixture Poki & Pho | FP         | t
 45000000-0000-4000-8000-000000000001 | Fixture Sushi      | FS         | t
(2 rows)

ERROR:  column "unit_type" does not exist
LINE 1: select id, name, unit_type from public.inventory_items order...
                         ^
```

## pr75-00-fixture-catalog

Run at 2026-09-09T05:39:28Z against `supabase_db_smelter-performance`.

```sql
select id, name, base_unit, pack_unit, category, aliases, location_id, default_supplier
from public.inventory_items where active order by name;
select id, name, active from public.suppliers order by name;
select sa.id, sa.name, sa.location_id, count(ai.id) as items
from public.storage_areas sa left join public.area_items ai on ai.area_id = sa.id
group by sa.id, sa.name, sa.location_id order by sa.name;
select id, order_number, status, order_type, entry_method, location_id from public.orders order by order_number;
```

```
                  id                  |      name       | base_unit | pack_unit | category |  aliases  | location_id | default_supplier  
--------------------------------------+-----------------+-----------+-----------+----------+-----------+-------------+-------------------
 46000000-0000-4000-8000-000000000004 | Fixture Avocado | each      | case      | produce  | {avocado} |             | Local QA Supplier
 46000000-0000-4000-8000-000000000003 | Fixture Nori    | pack      | case      | dry      | {nori}    |             | Local QA Supplier
 46000000-0000-4000-8000-000000000002 | Fixture Rice    | bag       | pallet    | dry      | {rice}    |             | Local QA Supplier
 46000000-0000-4000-8000-000000000001 | Fixture Salmon  | fillet    | case      | fish     | {salmon}  |             | Local QA Supplier
(4 rows)

                  id                  |       name        | active 
--------------------------------------+-------------------+--------
 4c000000-0000-4000-8000-000000000001 | Local QA Supplier | t
(1 row)

                  id                  |         name         |             location_id              | items 
--------------------------------------+----------------------+--------------------------------------+-------
 47000000-0000-4000-8000-000000000002 | Fixture Dry Storage  | 45000000-0000-4000-8000-000000000001 |     1
 47000000-0000-4000-8000-000000000001 | Fixture Freezer      | 45000000-0000-4000-8000-000000000001 |     2
 47000000-0000-4000-8000-000000000003 | Fixture Poki Storage | 45000000-0000-4000-8000-000000000002 |     1
(3 rows)

                  id                  | order_number |  status   | order_type |   entry_method   |             location_id              
--------------------------------------+--------------+-----------+------------+------------------+--------------------------------------
 4b000000-0000-4000-8000-000000000001 |            1 | submitted | manual     | simple_checklist | 45000000-0000-4000-8000-000000000001
 4b000000-0000-4000-8000-000000000002 |            2 | fulfilled | manual     | manual           | 45000000-0000-4000-8000-000000000002
(2 rows)
```

## pr75-01-manager-sign-in

Run at 2026-09-09T05:53:42Z against `supabase_db_smelter-performance`.

```sql
select scope, success, count(*) from public.login_auth_attempts group by 1,2 order by 1,2;
select login_name, credential_kind, display_name from public.login_identities order by login_name;
select email, last_sign_in_at is not null as signed_in from auth.users order by email;
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

           email            | signed_in 
----------------------------+-----------
 e2e.employee@smelter.test  | f
 e2e.employee2@smelter.test | f
 e2e.manager@smelter.test   | t
(3 rows)
```

## pr75-02-quick-order-send

Run at 2026-09-09T05:57:19Z against `supabase_db_smelter-performance`.

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
 d903d75d-1a41-4e63-920f-0738db48e228 |            5 | submitted | manual     | quick_order      | 45000000-0000-4000-8000-000000000001 | 2026-09-09 05:57:02.339017+00
 4b000000-0000-4000-8000-000000000001 |            1 | submitted | manual     | simple_checklist | 45000000-0000-4000-8000-000000000001 | 2026-09-09 05:38:50.232181+00
(2 rows)

                  id                  |      name      | quantity | unit_type | input_mode | status  
--------------------------------------+----------------+----------+-----------+------------+---------
 9a25c2bd-fc8b-4669-8381-0ed61221deae | Fixture Rice   |     2.00 | base      | quantity   | pending
 b33b7b25-f891-4ed9-b846-dca4dee5abea | Fixture Salmon |     3.00 | base      | quantity   | pending
(2 rows)

                  id                  |  status   |          created_at           
--------------------------------------+-----------+-------------------------------
 51bdbdd3-6ae2-4b14-924a-4ea5a65177d9 | submitted | 2026-09-09 05:55:12.960509+00
(1 row)
```

## pr75-03-fulfillment-send-all

Run at 2026-09-09T05:58:32Z against `supabase_db_smelter-performance`.

```sql
select id, share_method, supplier_name, created_at from public.past_orders order by created_at desc limit 3;
select poi.item_name, poi.quantity, poi.unit
from public.past_order_items poi
where poi.past_order_id = (select id from public.past_orders order by created_at desc limit 1)
order by poi.item_name, poi.unit;
select status, count(*) from public.order_items group by 1 order by 1;
```

```
                  id                  | share_method |   supplier_name   |          created_at          
--------------------------------------+--------------+-------------------+------------------------------
 59dc0db9-8801-45cc-927b-eb3a7cd3af71 | copy         | Local QA Supplier | 2026-09-09 05:58:21.16469+00
(1 row)

   item_name    | quantity |  unit  
----------------+----------+--------
 Fixture Rice   |        2 | bag
 Fixture Rice   |        1 | pallet
 Fixture Salmon |        6 | fillet
(3 rows)

 status | count 
--------+-------
 sent   |     5
(1 row)
```

## pr75-04-receive-delivery

Run at 2026-09-09T06:01:23Z against `supabase_db_smelter-performance`.

```sql
select id, status, supplier_name, received_by, created_at from public.order_receipts order by created_at desc limit 2;
select ori.item_name, ori.ordered_qty, ori.received_qty, ori.status, ori.note
from public.order_receipt_items ori
where ori.receipt_id = (select id from public.order_receipts order by created_at desc limit 1)
order by ori.item_name, ori.ordered_qty;
```

```
ERROR:  column "supplier_name" does not exist
LINE 1: select id, status, supplier_name, received_by, created_at fr...
                           ^
ERROR:  column ori.item_name does not exist
LINE 1: select ori.item_name, ori.ordered_qty, ori.received_qty, ori...
               ^
```

## pr75-04-receive-delivery

Run at 2026-09-09T06:01:35Z against `supabase_db_smelter-performance`.

```sql
select r.id, r.status, r.received_by, r.received_at, po.supplier_name
from public.order_receipts r join public.past_orders po on po.id = r.past_order_id
order by r.created_at desc limit 2;
select poi.item_name, poi.quantity as ordered_qty, poi.unit, ori.received, ori.received_qty, ori.note
from public.order_receipt_items ori
join public.past_order_items poi on poi.id = ori.past_order_item_id
where ori.receipt_id = (select id from public.order_receipts order by created_at desc limit 1)
order by poi.item_name, poi.unit;
```

```
                  id                  | status  |             received_by              |          received_at          |   supplier_name   
--------------------------------------+---------+--------------------------------------+-------------------------------+-------------------
 71b48171-ff97-4024-abc7-fbc8f20b4539 | partial | 1c923ddb-3977-41a4-82b8-39cadef19690 | 2026-09-09 06:00:27.385342+00 | Local QA Supplier
(1 row)

   item_name    | ordered_qty |  unit  | received | received_qty |    note    
----------------+-------------+--------+----------+--------------+------------
 Fixture Rice   |           2 | bag    | t        |              | 
 Fixture Rice   |           1 | pallet | t        |              | 
 Fixture Salmon |           6 | fillet | t        |            2 | PR75 short
(3 rows)
```

## pr75-05-order-status-changes

Run at 2026-09-09T06:04:41Z against `supabase_db_smelter-performance`.

```sql
select id, order_number, status, fulfilled_at, fulfilled_by, updated_at
from public.orders where id = 'd903d75d-1a41-4e63-920f-0738db48e228';
select status, count(*) from public.orders group by 1 order by 1;
```

```
ERROR:  column "updated_at" does not exist
LINE 1: ...order_number, status, fulfilled_at, fulfilled_by, updated_at
                                                             ^
HINT:  Perhaps you meant to reference the column "orders.created_at".
  status   | count 
-----------+-------
 submitted |     1
 fulfilled |     2
(2 rows)
```

## pr75-05-order-status-changes

Run at 2026-09-09T06:04:46Z against `supabase_db_smelter-performance`.

```sql
select id, order_number, status, fulfilled_at, fulfilled_by
from public.orders where id = 'd903d75d-1a41-4e63-920f-0738db48e228';
select status, count(*) from public.orders group by 1 order by 1;
```

```
                  id                  | order_number |  status   |        fulfilled_at        |             fulfilled_by             
--------------------------------------+--------------+-----------+----------------------------+--------------------------------------
 d903d75d-1a41-4e63-920f-0738db48e228 |            5 | fulfilled | 2026-09-09 06:04:29.967+00 | 1c923ddb-3977-41a4-82b8-39cadef19690
(1 row)

  status   | count 
-----------+-------
 submitted |     1
 fulfilled |     2
(2 rows)
```

## pr75-70-fixture-baseline-rebuild

Run at 2026-09-10T02:15:33Z against `supabase_db_smelter-performance`.

```sql
select 'users' as t, count(*) from public.users
union all select 'orders', count(*) from public.orders
union all select 'order_items', count(*) from public.order_items
union all select 'past_orders', count(*) from public.past_orders
union all select 'order_receipts', count(*) from public.order_receipts
union all select 'stock_updates', count(*) from public.stock_updates
union all select 'stock_check_sessions', count(*) from public.stock_check_sessions
union all select 'quick_order_sessions', count(*) from public.quick_order_sessions
order by 1;
select id, order_number, status, entry_method from public.orders order by order_number;
select status, count(*) from public.order_items group by 1 order by 1;
select sa.name, ai.id, ii.name as item, ai.current_quantity, sa.last_checked_at
from public.storage_areas sa
join public.area_items ai on ai.area_id = sa.id
join public.inventory_items ii on ii.id = ai.inventory_item_id
order by sa.name, ii.name;
```

```
          t           | count 
----------------------+-------
 order_items          |     5
 order_receipts       |     1
 orders               |     3
 past_orders          |     1
 quick_order_sessions |     1
 stock_check_sessions |     1
 stock_updates        |     0
 users                |     3
(8 rows)

                  id                  | order_number |  status   |   entry_method   
--------------------------------------+--------------+-----------+------------------
 4b000000-0000-4000-8000-000000000001 |            1 | submitted | simple_checklist
 4b000000-0000-4000-8000-000000000002 |            2 | fulfilled | manual
 d903d75d-1a41-4e63-920f-0738db48e228 |            5 | fulfilled | quick_order
(3 rows)

 status  | count 
---------+-------
 pending |     2
 sent    |     3
(2 rows)

         name         |                  id                  |      item       | current_quantity | last_checked_at 
----------------------+--------------------------------------+-----------------+------------------+-----------------
 Fixture Dry Storage  | 48000000-0000-4000-8000-000000000003 | Fixture Nori    |               20 | 
 Fixture Freezer      | 48000000-0000-4000-8000-000000000002 | Fixture Rice    |               10 | 
 Fixture Freezer      | 48000000-0000-4000-8000-000000000001 | Fixture Salmon  |                3 | 
 Fixture Poki Storage | 48000000-0000-4000-8000-000000000004 | Fixture Avocado |                8 | 
(4 rows)
```

## pr75-71-manager-sign-in

Run at 2026-09-10T02:28:38Z against `supabase_db_smelter-performance`.

```sql
select scope, success, count(*) from public.login_auth_attempts group by 1,2 order by 1,2;
select email, last_sign_in_at from auth.users order by email;
select login_name, credential_kind, display_name from public.login_identities order by login_name;
```

```
 scope  | success | count 
--------+---------+-------
 client | t       |     2
 name   | t       |     2
(2 rows)

           email            |        last_sign_in_at        
----------------------------+-------------------------------
 e2e.employee@smelter.test  | 
 e2e.employee2@smelter.test | 
 e2e.manager@smelter.test   | 2026-09-10 02:28:25.529389+00
(3 rows)

    login_name    | credential_kind |   display_name   
------------------+-----------------+------------------
 e2e employee     | pin             | E2E Employee
 e2e employee two | pin             | E2E Employee Two
 e2e manager      | pin             | E2E Manager
(3 rows)
```

## pr75-72-quick-order-send

Run at 2026-09-10T02:31:49Z against `supabase_db_smelter-performance`.

```sql
select id, order_number, status, order_type, entry_method, location_id, created_by, created_at
from public.orders order by created_at desc limit 2;
select oi.id, ii.name, oi.quantity, oi.unit_type, oi.input_mode, oi.status
from public.order_items oi join public.inventory_items ii on ii.id = oi.inventory_item_id
where oi.order_id = (select id from public.orders order by created_at desc limit 1)
order by ii.name;
select id, status, created_at from public.quick_order_sessions order by created_at desc limit 2;
```

```
ERROR:  column "created_by" does not exist
LINE 1: ...r, status, order_type, entry_method, location_id, created_by...
                                                             ^
HINT:  Perhaps you meant to reference the column "orders.created_at".
                  id                  |      name      | quantity | unit_type | input_mode | status  
--------------------------------------+----------------+----------+-----------+------------+---------
 98ec91c2-45ed-4385-a90e-4128ff65492d | Fixture Rice   |     2.00 | base      | quantity   | pending
 476e6762-4222-4dba-956c-5a3420bfeeed | Fixture Salmon |     3.00 | base      | quantity   | pending
(2 rows)

                  id                  |  status   |          created_at           
--------------------------------------+-----------+-------------------------------
 ae21ca86-80a0-4c39-9a7f-bf4d52780ffd | submitted | 2026-09-10 02:30:07.537641+00
 51bdbdd3-6ae2-4b14-924a-4ea5a65177d9 | submitted | 2026-09-09 05:55:12.960509+00
(2 rows)
```

## pr75-72-quick-order-send

Run at 2026-09-10T02:31:54Z against `supabase_db_smelter-performance`.

```sql
select id, order_number, status, order_type, entry_method, location_id, user_id, created_at
from public.orders order by created_at desc limit 2;
select oi.id, ii.name, oi.quantity, oi.unit_type, oi.input_mode, oi.status
from public.order_items oi join public.inventory_items ii on ii.id = oi.inventory_item_id
where oi.order_id = (select id from public.orders order by created_at desc limit 1)
order by ii.name;
select id, status, created_at from public.quick_order_sessions order by created_at desc limit 2;
```

```
                  id                  | order_number |  status   | order_type | entry_method |             location_id              |               user_id                |          created_at           
--------------------------------------+--------------+-----------+------------+--------------+--------------------------------------+--------------------------------------+-------------------------------
 d1622417-d0e3-4115-9d4d-22ddfc107c7a |           10 | submitted | manual     | quick_order  | 45000000-0000-4000-8000-000000000001 | 1c923ddb-3977-41a4-82b8-39cadef19690 | 2026-09-10 02:31:32.97399+00
 d903d75d-1a41-4e63-920f-0738db48e228 |            5 | fulfilled | manual     | quick_order  | 45000000-0000-4000-8000-000000000001 | 1c923ddb-3977-41a4-82b8-39cadef19690 | 2026-09-09 05:57:02.339017+00
(2 rows)

                  id                  |      name      | quantity | unit_type | input_mode | status  
--------------------------------------+----------------+----------+-----------+------------+---------
 98ec91c2-45ed-4385-a90e-4128ff65492d | Fixture Rice   |     2.00 | base      | quantity   | pending
 476e6762-4222-4dba-956c-5a3420bfeeed | Fixture Salmon |     3.00 | base      | quantity   | pending
(2 rows)

                  id                  |  status   |          created_at           
--------------------------------------+-----------+-------------------------------
 ae21ca86-80a0-4c39-9a7f-bf4d52780ffd | submitted | 2026-09-10 02:30:07.537641+00
 51bdbdd3-6ae2-4b14-924a-4ea5a65177d9 | submitted | 2026-09-09 05:55:12.960509+00
(2 rows)
```

## pr75-73-fulfillment-send-all

Run at 2026-09-10T02:32:39Z against `supabase_db_smelter-performance`.

```sql
select id, share_method, supplier_name, created_at from public.past_orders order by created_at desc limit 2;
select poi.item_name, poi.quantity, poi.unit
from public.past_order_items poi
where poi.past_order_id = (select id from public.past_orders order by created_at desc limit 1)
order by poi.item_name, poi.unit;
select status, count(*) from public.order_items group by 1 order by 1;
select o.order_number, oi.status, count(*) from public.orders o join public.order_items oi on oi.order_id = o.id group by 1,2 order by 1,2;
```

```
                  id                  | share_method |   supplier_name   |          created_at           
--------------------------------------+--------------+-------------------+-------------------------------
 42bd8a4b-ec99-46e6-affb-5cff331ccc21 | copy         | Local QA Supplier | 2026-09-10 02:32:25.705526+00
 59dc0db9-8801-45cc-927b-eb3a7cd3af71 | copy         | Local QA Supplier | 2026-09-09 05:58:21.16469+00
(2 rows)

   item_name    | quantity |  unit  
----------------+----------+--------
 Fixture Rice   |        2 | bag
 Fixture Salmon |        3 | fillet
(2 rows)

 status  | count 
---------+-------
 pending |     2
 sent    |     5
(2 rows)

 order_number | status  | count 
--------------+---------+-------
            1 | pending |     2
            2 | sent    |     1
            5 | sent    |     2
           10 | sent    |     2
(4 rows)
```

## pr75-74-alias-fixture-adjustment

Run at 2026-09-10T02:33:28Z against `supabase_db_smelter-performance`.

```sql
-- Add alias tokens that are not substrings of the item names so the alias
-- search path can be distinguished from the name search path.
update public.inventory_items set aliases = array['salmon','sake'] where name = 'Fixture Salmon';
update public.inventory_items set aliases = array['rice','gohan'] where name = 'Fixture Rice';
select name, aliases from public.inventory_items order by name;
```

```
UPDATE 1
UPDATE 1
      name       |    aliases    
-----------------+---------------
 Fixture Avocado | {avocado}
 Fixture Nori    | {nori}
 Fixture Rice    | {rice,gohan}
 Fixture Salmon  | {salmon,sake}
(4 rows)
```

## pr75-75-order-status-changes

Run at 2026-09-10T02:38:11Z against `supabase_db_smelter-performance`.

```sql
select id, order_number, status, fulfilled_at, fulfilled_by
from public.orders where id = 'd1622417-d0e3-4115-9d4d-22ddfc107c7a';
select status, count(*) from public.orders group by 1 order by 1;
```

```
                  id                  | order_number |  status   |        fulfilled_at        |             fulfilled_by             
--------------------------------------+--------------+-----------+----------------------------+--------------------------------------
 d1622417-d0e3-4115-9d4d-22ddfc107c7a |           10 | fulfilled | 2026-09-10 02:38:04.873+00 | 1c923ddb-3977-41a4-82b8-39cadef19690
(1 row)

  status   | count 
-----------+-------
 submitted |     1
 fulfilled |     3
(2 rows)
```

## pr75-76-scroll-fixture-items

Run at 2026-09-10T02:41:09Z against `supabase_db_smelter-performance`.

```sql
-- Two extra disposable catalog items so the Quick Order list exceeds the
-- four visible row slots and the custom scrollbar renders.
insert into public.inventory_items
  (id, name, base_unit, pack_unit, pack_size, category, supplier_category, aliases, default_supplier, supplier_id, emoji)
select '46000000-0000-4000-8000-000000000005', 'Fixture Tofu', 'block', 'case', 12, 'protein', 'dry', array['tofu'], 'Local QA Supplier', s.id, '🍚'
from public.suppliers s where s.name = 'Local QA Supplier'
on conflict (id) do nothing;
insert into public.inventory_items
  (id, name, base_unit, pack_unit, pack_size, category, supplier_category, aliases, default_supplier, supplier_id, emoji)
select '46000000-0000-4000-8000-000000000006', 'Fixture Wasabi', 'tube', 'case', 24, 'sauces', 'dry', array['wasabi'], 'Local QA Supplier', s.id, '🍚'
from public.suppliers s where s.name = 'Local QA Supplier'
on conflict (id) do nothing;
select name, base_unit, pack_unit, aliases, active from public.inventory_items order by name;
```

```
INSERT 0 1
INSERT 0 1
      name       | base_unit | pack_unit |    aliases    | active 
-----------------+-----------+-----------+---------------+--------
 Fixture Avocado | each      | case      | {avocado}     | t
 Fixture Nori    | pack      | case      | {nori}        | t
 Fixture Rice    | bag       | pallet    | {rice,gohan}  | t
 Fixture Salmon  | fillet    | case      | {salmon,sake} | t
 Fixture Tofu    | block     | case      | {tofu}        | t
 Fixture Wasabi  | tube      | case      | {wasabi}      | t
(6 rows)
```

## pr75-77-quick-order-catalog-extension

Run at 2026-09-10T02:42:33Z against `supabase_db_smelter-performance`.

```sql
-- Mirror the two extra disposable items into the Quick Order parser catalog.
insert into public.qo_items (id, inventory_item_id, name, category, aliases, supplier,
  supplier_id, order_unit, target_stock, active)
values
  ('4d000000-0000-4000-8000-000000000005', '46000000-0000-4000-8000-000000000005', 'Fixture Tofu', 'protein', 'tofu', 'Local QA Supplier', '4c000000-0000-4000-8000-000000000001', 'block', 10, true),
  ('4d000000-0000-4000-8000-000000000006', '46000000-0000-4000-8000-000000000006', 'Fixture Wasabi', 'sauces', 'wasabi', 'Local QA Supplier', '4c000000-0000-4000-8000-000000000001', 'tube', 6, true)
on conflict (id) do update set name = excluded.name, aliases = excluded.aliases, active = excluded.active;
select name, aliases, order_unit, active from public.qo_items order by name;
```

```
INSERT 0 2
      name       | aliases | order_unit | active 
-----------------+---------+------------+--------
 Fixture Avocado | avocado | each       | t
 Fixture Nori    | nori    | pack       | t
 Fixture Rice    | rice    | bag        | t
 Fixture Salmon  | salmon  | fillet     | t
 Fixture Tofu    | tofu    | block      | t
 Fixture Wasabi  | wasabi  | tube       | t
(6 rows)
```

## pr75-80-stock-count-baseline

Run at 2026-09-10T13:45:03Z against `supabase_db_smelter-performance`.

```sql
-- Baseline before the PR #75 stock count save attempt.
select count(*) as stock_updates from public.stock_updates;
select count(*) as stock_check_sessions from public.stock_check_sessions;
select name, current_quantity from public.area_items ai
  join public.inventory_items ii on ii.id = ai.inventory_item_id order by name;
select name, last_checked_at from public.storage_areas order by name;
```

```
 stock_updates 
---------------
             0
(1 row)

 stock_check_sessions 
----------------------
                    1
(1 row)

      name       | current_quantity 
-----------------+------------------
 Fixture Avocado |                8
 Fixture Nori    |               20
 Fixture Rice    |               10
 Fixture Salmon  |                3
(4 rows)

         name         | last_checked_at 
----------------------+-----------------
 Fixture Dry Storage  | 
 Fixture Freezer      | 
 Fixture Poki Storage | 
(3 rows)
```

## pr75-81-stock-count-save

Run at 2026-09-10T13:49:59Z against `supabase_db_smelter-performance`.

```sql
-- PR #75 rerun: after saving a stock count for Fixture Salmon (Fixture Freezer,
-- Fixture Sushi) the UI reported "1 of 2 checked" and "current stock 0 case".
select count(*) as stock_updates from public.stock_updates;
select count(*) as stock_check_sessions from public.stock_check_sessions;
select ii.name, ai.current_quantity, ai.updated_at from public.area_items ai
  join public.inventory_items ii on ii.id = ai.inventory_item_id order by ii.name;
select name, last_checked_at from public.storage_areas order by name;
```

```
 stock_updates 
---------------
             1
(1 row)

 stock_check_sessions 
----------------------
                    1
(1 row)

      name       | current_quantity |          updated_at           
-----------------+------------------+-------------------------------
 Fixture Avocado |                8 | 2026-09-10 02:15:16.940831+00
 Fixture Nori    |               20 | 2026-09-10 02:15:16.940831+00
 Fixture Rice    |               10 | 2026-09-10 02:15:16.940831+00
 Fixture Salmon  |                0 | 2026-09-10 13:49:42.160303+00
(4 rows)

         name         |        last_checked_at        
----------------------+-------------------------------
 Fixture Dry Storage  | 
 Fixture Freezer      | 2026-09-10 13:49:42.160303+00
 Fixture Poki Storage | 
(3 rows)
```

## pr75-82-stock-count-offline-pending

Run at 2026-09-10T13:50:37Z against `supabase_db_smelter-performance`.

```sql
-- PR #75 rerun: Fixture Rice counted while supabase_kong_smelter-performance was
-- stopped. The UI accepted the count ("2 of 2 checked", "current stock 0 pallet").
-- The database must still show the pre-offline value until the gateway returns.
select count(*) as stock_updates from public.stock_updates;
select ii.name, ai.current_quantity from public.area_items ai
  join public.inventory_items ii on ii.id = ai.inventory_item_id order by ii.name;
```

```
 stock_updates 
---------------
             1
(1 row)

      name       | current_quantity 
-----------------+------------------
 Fixture Avocado |                8
 Fixture Nori    |               20
 Fixture Rice    |               10
 Fixture Salmon  |                0
(4 rows)
```

## pr75-83-stock-count-offline-sync

Run at 2026-09-10T13:52:27Z against `supabase_db_smelter-performance`.

```sql
-- PR #75 rerun: Fixture Rice was counted while the gateway was stopped, then the
-- gateway was restarted and the app was force quit and relaunched twice.
-- Stock check now reports "2 checked, 1 unchecked" for Fixture Sushi.
select count(*) as stock_updates from public.stock_updates;
select ii.name, ai.current_quantity, ai.updated_at from public.area_items ai
  join public.inventory_items ii on ii.id = ai.inventory_item_id order by ii.name;
select name, last_checked_at from public.storage_areas order by name;
```

```
 stock_updates 
---------------
             2
(1 row)

      name       | current_quantity |          updated_at           
-----------------+------------------+-------------------------------
 Fixture Avocado |                8 | 2026-09-10 02:15:16.940831+00
 Fixture Nori    |               20 | 2026-09-10 02:15:16.940831+00
 Fixture Rice    |                0 | 2026-09-10 13:52:13.959767+00
 Fixture Salmon  |                0 | 2026-09-10 13:49:42.160303+00
(4 rows)

         name         |        last_checked_at        
----------------------+-------------------------------
 Fixture Dry Storage  | 
 Fixture Freezer      | 2026-09-10 13:52:13.959767+00
 Fixture Poki Storage | 
(3 rows)
```

## pr75-84-cached-inventory-newest

Run at 2026-09-10T13:54:05Z against `supabase_db_smelter-performance`.

```sql
-- PR #75 manual check: cached inventory after going offline, force quitting and
-- relaunching. The app container's inventory-storage held all six catalog items
-- including Fixture Tofu and Fixture Wasabi, the two most recently added rows,
-- so the persisted cache is the newest state.
select name, active from public.inventory_items order by name;
```

```
      name       | active 
-----------------+--------
 Fixture Avocado | t
 Fixture Nori    | t
 Fixture Rice    | t
 Fixture Salmon  | t
 Fixture Tofu    | t
 Fixture Wasabi  | t
(6 rows)
```

## pr75-85-invite-create

Run at 2026-09-10T13:56:32Z against `supabase_db_smelter-performance`.

```sql
-- PR #75 rerun: manager created a single use invite for "PR75 Invitee",
-- location group Sushi, 7 day expiry, default module preset.
select name, location_group, modules, expires_at > now() as unexpired,
       used_at, used_by, created_by
  from public.invites order by created_at desc limit 2;
```

```
ERROR:  column "name" does not exist
LINE 1: select name, location_group, modules, expires_at > now() as ...
               ^
```

## pr75-85-invite-create

Run at 2026-09-10T13:56:45Z against `supabase_db_smelter-performance`.

```sql
-- PR #75 rerun: manager created a single use invite for "PR75 Invitee",
-- location group Sushi, 7 day expiry, default module preset.
select invited_name, role, location_group, module_preset,
       round(extract(epoch from (expires_at - created_at)) / 86400) as expiry_days,
       used_at, used_by, created_by
  from public.invites order by created_at desc limit 2;
```

```
 invited_name |   role   | location_group |                                       module_preset                                       | expiry_days | used_at | used_by |              created_by              
--------------+----------+----------------+-------------------------------------------------------------------------------------------+-------------+---------+---------+--------------------------------------
 PR75 Invitee | employee | sushi          | {"tips": false, "stock_check": true, "ordering_simple": true, "ordering_advanced": false} |           7 |         |         | 1c923ddb-3977-41a4-82b8-39cadef19690
(1 row)
```

## pr75-86-reminder-send-and-scheduling

Run at 2026-09-10T14:00:57Z against `supabase_db_smelter-performance`.

```sql
-- PR #75 rerun: manager sent a reminder to E2E Employee from
-- (manager)/employee-reminders, then saved a recurring rule from
-- (manager)/employee-reminders-recurring (employee scope, Mon/Wed/Fri 15:00,
-- condition "no order today", channels push + in-app).
select count(*) as reminders from public.reminders;
select status, channel, outcome from public.reminder_events order by created_at desc limit 3;
select type, title from public.notifications order by created_at desc limit 3;
select scope, days_of_week, time_of_day, timezone, condition_type, channels, enabled
  from public.recurring_reminder_rules order by created_at desc limit 2;
```

```
 reminders 
-----------
         1
(1 row)

ERROR:  column "status" does not exist
LINE 1: select status, channel, outcome from public.reminder_events ...
               ^
ERROR:  column "type" does not exist
LINE 1: select type, title from public.notifications order by create...
               ^
  scope   | days_of_week | time_of_day |      timezone       | condition_type |            channels            | enabled 
----------+--------------+-------------+---------------------+----------------+--------------------------------+---------
 employee | {1,3,5}      | 15:00:00    | America/Los_Angeles | no_order_today | {"push": true, "in_app": true} | t
(1 row)
```

## pr75-87-reminder-send-rows

Run at 2026-09-10T14:01:07Z against `supabase_db_smelter-performance`.

```sql
-- PR #75 rerun: rows written by the reminder send (see pr75-86 for the rule).
select event_type, channels_attempted, delivery_result, push_delivery_status
  from public.reminder_events order by sent_at desc limit 3;
select notification_type, title from public.notifications order by created_at desc limit 3;
```

```
 event_type | channels_attempted |                                                                                                                                                         delivery_result                                                                                                                                                          | push_delivery_status 
------------+--------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+----------------------
 sent       | ["in_app", "push"] | {"push": {"status": "no_tokens", "attempted": true, "receiptIds": [], "tokenCount": 0, "errorDetail": null, "failureCount": 0, "successCount": 0, "deliveryOutcome": null, "tokenResolutionFailed": false}, "source": "manual", "notifications_enabled": true, "in_app_notification_id": "fc6499e9-b1f5-4d93-b81b-441545d86848"} | 
(1 row)

 notification_type |     title      
-------------------+----------------
 employee_reminder | Order reminder
(1 row)
```
