
## 00-baseline-before-any-count

Run at 2026-09-06T00:05:04Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select count(*) as stock_check_sessions_rows from public.stock_check_sessions;
select id, inventory_item_id, current_quantity, unit_type, last_updated_at, last_updated_by
from public.area_items
where area_id = '47000000-0000-4000-8000-000000000001'
order by shelf_sort_order;
select name, last_checked_at, last_checked_by
from public.storage_areas
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

                  id                  |          inventory_item_id           | current_quantity | unit_type | last_updated_at | last_updated_by 
--------------------------------------+--------------------------------------+------------------+-----------+-----------------+-----------------
 48000000-0000-4000-8000-000000000001 | 46000000-0000-4000-8000-000000000001 |                3 | fillet    |                 | 
 48000000-0000-4000-8000-000000000002 | 46000000-0000-4000-8000-000000000002 |               10 | bag       |                 | 
(2 rows)

      name       | last_checked_at | last_checked_by 
-----------------+-----------------+-----------------
 Fixture Freezer |                 | 
(1 row)
```

## 01-session-opened-on-screen-open

Run at 2026-09-06T00:11:10Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select id, location_id, current_area_id, user_id, status, items_total, items_checked, started_at
from public.stock_check_sessions;
select count(*) as stock_updates_rows from public.stock_updates;
```

```
                  id                  |             location_id              |           current_area_id            |               user_id                |   status    | items_total | items_checked |          started_at           
--------------------------------------+--------------------------------------+--------------------------------------+--------------------------------------+-------------+-------------+---------------+-------------------------------
 68f20e7c-4af1-4866-8c4d-486c13b3ac95 | 45000000-0000-4000-8000-000000000001 | 47000000-0000-4000-8000-000000000001 | de716e9f-25f4-456a-9255-896625ec8fed | in_progress |           3 |             0 | 2026-09-06 00:10:58.878883+00
(1 row)

 stock_updates_rows 
--------------------
                  0
(1 row)
```

## 02-stock-count-save-online

Run at 2026-09-06T00:13:10Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select area_item_id, new_quantity, previous_quantity, update_method, entry_mode, status_value, stock_check_session_id is not null as has_session
from public.stock_updates order by created_at;
select count(*) as stock_check_sessions_rows from public.stock_check_sessions;
select id, name, current_quantity, unit_type, last_updated_at, last_updated_by
from public.area_items
where area_id = '47000000-0000-4000-8000-000000000001'
order by shelf_sort_order;
select name, last_checked_at, last_checked_by
from public.storage_areas where id = '47000000-0000-4000-8000-000000000001';
select id, status, items_checked, items_total, area_progress
from public.stock_check_sessions;
```

```
 stock_updates_rows 
--------------------
                  1
(1 row)

             area_item_id             | new_quantity | previous_quantity |    update_method    | entry_mode | status_value | has_session 
--------------------------------------+--------------+-------------------+---------------------+------------+--------------+-------------
 48000000-0000-4000-8000-000000000001 |           60 |                 3 | stock_check_numeric | numeric    |              | t
(1 row)

 stock_check_sessions_rows 
---------------------------
                         1
(1 row)

ERROR:  column "name" does not exist
LINE 1: select id, name, current_quantity, unit_type, last_updated_a...
                   ^
      name       |        last_checked_at        |           last_checked_by            
-----------------+-------------------------------+--------------------------------------
 Fixture Freezer | 2026-09-06 00:12:59.228125+00 | de716e9f-25f4-456a-9255-896625ec8fed
(1 row)

                  id                  |   status    | items_checked | items_total |                                                                                                                                                           area_progress                                                                                                                                                            
--------------------------------------+-------------+---------------+-------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 68f20e7c-4af1-4866-8c4d-486c13b3ac95 | in_progress |             1 |           3 | {"47000000-0000-4000-8000-000000000001": {"items_total": 2, "completed_at": null, "items_checked": 1, "items_skipped": 0, "last_entry_mode": "numeric", "skipped_item_ids": []}, "47000000-0000-4000-8000-000000000002": {"items_total": 1, "completed_at": null, "items_checked": 0, "items_skipped": 0, "skipped_item_ids": []}}
(1 row)
```

## 03-area-items-after-online-count

Run at 2026-09-06T00:13:17Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select area_item.id, inventory_item.name, area_item.current_quantity, area_item.unit_type,
       area_item.last_updated_at, area_item.last_updated_by
from public.area_items area_item
join public.inventory_items inventory_item on inventory_item.id = area_item.inventory_item_id
where area_item.area_id = '47000000-0000-4000-8000-000000000001'
order by area_item.shelf_sort_order;
```

```
                  id                  |      name      | current_quantity | unit_type |        last_updated_at        |           last_updated_by            
--------------------------------------+----------------+------------------+-----------+-------------------------------+--------------------------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |               60 | fillet    | 2026-09-06 00:12:59.228125+00 | de716e9f-25f4-456a-9255-896625ec8fed
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |               10 | bag       |                               | 
(2 rows)
```

## 04-offline-count-not-yet-written

Run at 2026-09-06T00:13:58Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select area_item_id, new_quantity from public.stock_updates order by created_at;
select area_item.id, inventory_item.name, area_item.current_quantity, area_item.last_updated_at
from public.area_items area_item
join public.inventory_items inventory_item on inventory_item.id = area_item.inventory_item_id
where area_item.area_id = '47000000-0000-4000-8000-000000000001'
order by area_item.shelf_sort_order;
```

```
 stock_updates_rows 
--------------------
                  1
(1 row)

             area_item_id             | new_quantity 
--------------------------------------+--------------
 48000000-0000-4000-8000-000000000001 |           60
(1 row)

                  id                  |      name      | current_quantity |        last_updated_at        
--------------------------------------+----------------+------------------+-------------------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |               60 | 2026-09-06 00:12:59.228125+00
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |               10 | 
(2 rows)
```

## 05-after-relaunch-queue-flush

Run at 2026-09-06T00:14:39Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select area_item_id, new_quantity, previous_quantity, update_method, entry_mode
from public.stock_updates order by created_at;
select area_item.id, inventory_item.name, area_item.current_quantity, area_item.unit_type,
       area_item.last_updated_at, area_item.last_updated_by
from public.area_items area_item
join public.inventory_items inventory_item on inventory_item.id = area_item.inventory_item_id
where area_item.area_id = '47000000-0000-4000-8000-000000000001'
order by area_item.shelf_sort_order;
select id, status, items_checked, items_total from public.stock_check_sessions;
```

```
 stock_updates_rows 
--------------------
                  1
(1 row)

             area_item_id             | new_quantity | previous_quantity |    update_method    | entry_mode 
--------------------------------------+--------------+-------------------+---------------------+------------
 48000000-0000-4000-8000-000000000001 |           60 |                 3 | stock_check_numeric | numeric
(1 row)

                  id                  |      name      | current_quantity | unit_type |        last_updated_at        |           last_updated_by            
--------------------------------------+----------------+------------------+-----------+-------------------------------+--------------------------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |               60 | fillet    | 2026-09-06 00:12:59.228125+00 | de716e9f-25f4-456a-9255-896625ec8fed
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |               10 | bag       |                               | 
(2 rows)

                  id                  |   status    | items_checked | items_total 
--------------------------------------+-------------+---------------+-------------
 68f20e7c-4af1-4866-8c4d-486c13b3ac95 | in_progress |             1 |           3
(1 row)
```

## 06-queue-flushed-on-reopen

Run at 2026-09-06T00:15:05Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select area_item_id, new_quantity, previous_quantity, update_method, entry_mode
from public.stock_updates order by created_at;
select area_item.id, inventory_item.name, area_item.current_quantity, area_item.unit_type,
       area_item.last_updated_at, area_item.last_updated_by
from public.area_items area_item
join public.inventory_items inventory_item on inventory_item.id = area_item.inventory_item_id
where area_item.area_id = '47000000-0000-4000-8000-000000000001'
order by area_item.shelf_sort_order;
select name, last_checked_at, last_checked_by
from public.storage_areas where id = '47000000-0000-4000-8000-000000000001';
select id, status, items_checked, items_total from public.stock_check_sessions;
```

```
 stock_updates_rows 
--------------------
                  2
(1 row)

             area_item_id             | new_quantity | previous_quantity |    update_method    | entry_mode 
--------------------------------------+--------------+-------------------+---------------------+------------
 48000000-0000-4000-8000-000000000001 |           60 |                 3 | stock_check_numeric | numeric
 48000000-0000-4000-8000-000000000002 |          100 |                10 | stock_check_numeric | numeric
(2 rows)

                  id                  |      name      | current_quantity | unit_type |        last_updated_at        |           last_updated_by            
--------------------------------------+----------------+------------------+-----------+-------------------------------+--------------------------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |               60 | fillet    | 2026-09-06 00:12:59.228125+00 | de716e9f-25f4-456a-9255-896625ec8fed
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |              100 | bag       | 2026-09-06 00:14:50.88908+00  | de716e9f-25f4-456a-9255-896625ec8fed
(2 rows)

      name       |       last_checked_at        |           last_checked_by            
-----------------+------------------------------+--------------------------------------
 Fixture Freezer | 2026-09-06 00:14:50.88908+00 | de716e9f-25f4-456a-9255-896625ec8fed
(1 row)

                  id                  |   status    | items_checked | items_total 
--------------------------------------+-------------+---------------+-------------
 68f20e7c-4af1-4866-8c4d-486c13b3ac95 | in_progress |             2 |           3
(1 row)
```

## 07-pass-completed

Run at 2026-09-06T00:16:00Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select area_item_id, new_quantity, previous_quantity, update_method, entry_mode
from public.stock_updates order by created_at;
select id, status, items_checked, items_total, completed_at
from public.stock_check_sessions;
select area.name, area.last_checked_at, area.last_checked_by
from public.storage_areas area
where area.location_id = '45000000-0000-4000-8000-000000000001'
order by area.sort_order;
```

```
 stock_updates_rows 
--------------------
                  3
(1 row)

             area_item_id             | new_quantity | previous_quantity |    update_method    | entry_mode 
--------------------------------------+--------------+-------------------+---------------------+------------
 48000000-0000-4000-8000-000000000001 |           60 |                 3 | stock_check_numeric | numeric
 48000000-0000-4000-8000-000000000002 |          100 |                10 | stock_check_numeric | numeric
 48000000-0000-4000-8000-000000000003 |            1 |                20 | stock_check_numeric | numeric
(3 rows)

                  id                  |  status   | items_checked | items_total |         completed_at          
--------------------------------------+-----------+---------------+-------------+-------------------------------
 68f20e7c-4af1-4866-8c4d-486c13b3ac95 | completed |             3 |           3 | 2026-09-06 00:15:48.444215+00
(1 row)

        name         |        last_checked_at        |           last_checked_by            
---------------------+-------------------------------+--------------------------------------
 Fixture Freezer     | 2026-09-06 00:14:50.88908+00  | de716e9f-25f4-456a-9255-896625ec8fed
 Fixture Dry Storage | 2026-09-06 00:15:48.415775+00 | de716e9f-25f4-456a-9255-896625ec8fed
(2 rows)
```

## 10-rerun-online-count

Run at 2026-09-06T00:20:12Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select area_item_id, new_quantity, previous_quantity, update_method, entry_mode
from public.stock_updates order by created_at;
select area_item.id, inventory_item.name, area_item.current_quantity, area_item.unit_type,
       area_item.last_updated_at, area_item.last_updated_by
from public.area_items area_item
join public.inventory_items inventory_item on inventory_item.id = area_item.inventory_item_id
where area_item.area_id = '47000000-0000-4000-8000-000000000001'
order by area_item.shelf_sort_order;
select area.name, area.last_checked_at, area.last_checked_by
from public.storage_areas area where area.id = '47000000-0000-4000-8000-000000000001';
select id, status, items_checked, items_total, completed_at from public.stock_check_sessions;
```

```
 stock_updates_rows 
--------------------
                  1
(1 row)

             area_item_id             | new_quantity | previous_quantity |    update_method    | entry_mode 
--------------------------------------+--------------+-------------------+---------------------+------------
 48000000-0000-4000-8000-000000000001 |           60 |                 3 | stock_check_numeric | numeric
(1 row)

                  id                  |      name      | current_quantity | unit_type |        last_updated_at        |           last_updated_by            
--------------------------------------+----------------+------------------+-----------+-------------------------------+--------------------------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |               60 | fillet    | 2026-09-06 00:20:00.587436+00 | de716e9f-25f4-456a-9255-896625ec8fed
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |               10 | bag       |                               | 
(2 rows)

      name       |        last_checked_at        |           last_checked_by            
-----------------+-------------------------------+--------------------------------------
 Fixture Freezer | 2026-09-06 00:20:00.587436+00 | de716e9f-25f4-456a-9255-896625ec8fed
(1 row)

                  id                  |   status    | items_checked | items_total | completed_at 
--------------------------------------+-------------+---------------+-------------+--------------
 3caaae6b-a737-420e-9779-ad4033184def | in_progress |             1 |           3 | 
(1 row)
```

## 11-rerun-offline-count-queued

Run at 2026-09-06T00:20:53Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select area_item_id, new_quantity from public.stock_updates order by created_at;
select area_item.id, inventory_item.name, area_item.current_quantity, area_item.last_updated_at
from public.area_items area_item
join public.inventory_items inventory_item on inventory_item.id = area_item.inventory_item_id
where area_item.area_id = '47000000-0000-4000-8000-000000000001'
order by area_item.shelf_sort_order;
```

```
 stock_updates_rows 
--------------------
                  1
(1 row)

             area_item_id             | new_quantity 
--------------------------------------+--------------
 48000000-0000-4000-8000-000000000001 |           60
(1 row)

                  id                  |      name      | current_quantity |        last_updated_at        
--------------------------------------+----------------+------------------+-------------------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |               60 | 2026-09-06 00:20:00.587436+00
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |               10 | 
(2 rows)
```

## 12-rerun-offline-queue-flushed

Run at 2026-09-06T00:21:42Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select area_item_id, new_quantity, previous_quantity, update_method, entry_mode
from public.stock_updates order by created_at;
select area_item.id, inventory_item.name, area_item.current_quantity, area_item.unit_type,
       area_item.last_updated_at, area_item.last_updated_by
from public.area_items area_item
join public.inventory_items inventory_item on inventory_item.id = area_item.inventory_item_id
where area_item.area_id = '47000000-0000-4000-8000-000000000001'
order by area_item.shelf_sort_order;
select area.name, area.last_checked_at, area.last_checked_by
from public.storage_areas area where area.id = '47000000-0000-4000-8000-000000000001';
select id, status, items_checked, items_total, completed_at from public.stock_check_sessions;
```

```
 stock_updates_rows 
--------------------
                  2
(1 row)

             area_item_id             | new_quantity | previous_quantity |    update_method    | entry_mode 
--------------------------------------+--------------+-------------------+---------------------+------------
 48000000-0000-4000-8000-000000000001 |           60 |                 3 | stock_check_numeric | numeric
 48000000-0000-4000-8000-000000000002 |           40 |                10 | stock_check_numeric | numeric
(2 rows)

                  id                  |      name      | current_quantity | unit_type |        last_updated_at        |           last_updated_by            
--------------------------------------+----------------+------------------+-----------+-------------------------------+--------------------------------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon |               60 | fillet    | 2026-09-06 00:20:00.587436+00 | de716e9f-25f4-456a-9255-896625ec8fed
 48000000-0000-4000-8000-000000000002 | Fixture Rice   |               40 | bag       | 2026-09-06 00:21:25.368781+00 | de716e9f-25f4-456a-9255-896625ec8fed
(2 rows)

      name       |        last_checked_at        |           last_checked_by            
-----------------+-------------------------------+--------------------------------------
 Fixture Freezer | 2026-09-06 00:21:25.368781+00 | de716e9f-25f4-456a-9255-896625ec8fed
(1 row)

                  id                  |   status    | items_checked | items_total | completed_at 
--------------------------------------+-------------+---------------+-------------+--------------
 3caaae6b-a737-420e-9779-ad4033184def | in_progress |             2 |           3 | 
(1 row)
```

## 13-rerun-pass-completed

Run at 2026-09-06T00:22:23Z against `supabase_db_agent-aaf060bbad27fa15a`.

```sql
select count(*) as stock_updates_rows from public.stock_updates;
select stock_update.area_item_id, inventory_item.name, area_item.unit_type as ledger_unit,
       stock_update.previous_quantity, stock_update.new_quantity,
       stock_update.update_method, stock_update.entry_mode
from public.stock_updates stock_update
join public.area_items area_item on area_item.id = stock_update.area_item_id
join public.inventory_items inventory_item on inventory_item.id = area_item.inventory_item_id
order by stock_update.created_at;
select id, status, items_checked, items_total, completed_at from public.stock_check_sessions;
select area.name, area.last_checked_at, area.last_checked_by
from public.storage_areas area
where area.location_id = '45000000-0000-4000-8000-000000000001'
order by area.sort_order;
```

```
 stock_updates_rows 
--------------------
                  3
(1 row)

             area_item_id             |      name      | ledger_unit | previous_quantity | new_quantity |    update_method    | entry_mode 
--------------------------------------+----------------+-------------+-------------------+--------------+---------------------+------------
 48000000-0000-4000-8000-000000000001 | Fixture Salmon | fillet      |                 3 |           60 | stock_check_numeric | numeric
 48000000-0000-4000-8000-000000000002 | Fixture Rice   | bag         |                10 |           40 | stock_check_numeric | numeric
 48000000-0000-4000-8000-000000000003 | Fixture Nori   | pack        |                20 |           50 | stock_check_numeric | numeric
(3 rows)

                  id                  |  status   | items_checked | items_total |         completed_at          
--------------------------------------+-----------+---------------+-------------+-------------------------------
 3caaae6b-a737-420e-9779-ad4033184def | completed |             3 |           3 | 2026-09-06 00:22:10.166233+00
(1 row)

        name         |        last_checked_at        |           last_checked_by            
---------------------+-------------------------------+--------------------------------------
 Fixture Freezer     | 2026-09-06 00:21:25.368781+00 | de716e9f-25f4-456a-9255-896625ec8fed
 Fixture Dry Storage | 2026-09-06 00:22:10.144464+00 | de716e9f-25f4-456a-9255-896625ec8fed
(2 rows)
```
