# List pagination indexes

The dashboard list endpoints (reservations, invoices, payments, guests,
receivables, transfer proofs, front desk, room assignment, POS in-house) use
keyset pagination. The indexes below exist so each page is an ordered index
scan instead of a sequential scan plus sort of the whole property history.

The SQL lives in
[`packages/database/drizzle/0017_list_pagination_indexes.sql`](../../packages/database/drizzle/0017_list_pagination_indexes.sql).
The same indexes are declared in `packages/database/src/schema.ts` so the
Drizzle schema stays descriptive, but the SQL file is the canonical apply path.

## Applying

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction, and Drizzle's
`db:migrate` wraps each migration in one. That is why 0017 is deliberately not
registered in `drizzle/meta/_journal.json`: `db:migrate` must never try to run
it. Apply it with psql in autocommit during a low-traffic window:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f packages/database/drizzle/0017_list_pagination_indexes.sql
```

Every statement uses `IF NOT EXISTS`, so a partially applied file can be rerun
safely. A concurrent build that fails leaves an invalid index behind; find and
rebuild those before retrying:

```sql
select c.relname as index_name, i.indisvalid, i.indisready
from pg_index i
join pg_class c on c.oid = i.indexrelid
where not i.indisvalid;
```

Then `drop index concurrently <name>;` and rerun the file.

If you must apply inside a transaction (for example a maintenance window with
no writes), remove the `CONCURRENTLY` keyword. The build then takes a write
lock on the table for its duration.

## Rollback

Each index is additive; dropping it only restores the previous plan, it does
not lose data. Drop concurrently so live traffic is not blocked:

```sql
drop index concurrently if exists res_prop_created_id_idx;
drop index concurrently if exists res_prop_status_created_id_idx;
drop index concurrently if exists guests_prop_created_id_idx;
drop index concurrently if exists res_prop_guest_idx;
drop index concurrently if exists prop_inv_prop_created_id_idx;
drop index concurrently if exists prop_inv_prop_unpaid_created_id_idx;
drop index concurrently if exists payments_prop_created_id_idx;
drop index concurrently if exists transfer_proofs_prop_submitted_id_idx;
drop index concurrently if exists res_prop_outstanding_idx;
```

## Measured plans

Measurements were taken with
`SENA_BENCH_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/sena_bench pnpm exec tsx scripts/explain-list-queries.ts`
against the seed from `scripts/seed-list-pagination-bench.ts` (4 properties:
50k reservations, 20k guests, 100k payments, 10k invoices, 2k transfer proofs),
on a local Docker Postgres. Before/after is the same query on the same data,
first with the index dropped, then created. Warm-cache numbers vary by a few
milliseconds; the order of magnitude is what matters.

| Query | Index used | Before (ms) | After (ms) |
| --- | --- | ---: | ---: |
| reservations:first | `res_prop_created_id_idx` | 44.30 | 1.49 |
| reservations:status | `res_prop_status_created_id_idx` | 23.83 | 1.76 |
| reservations:cursor | `res_prop_created_id_idx` | 54.90 | 3.43 |
| reservations:search | `res_prop_created_id_idx` (ordered scan, filter) | 103.53 | 26.86 |
| invoices:first | `prop_inv_prop_created_id_idx` | 11.48 | 0.94 |
| invoices:unpaid | `prop_inv_prop_unpaid_created_id_idx` | 6.29 | 0.17 |
| payments:first | `payments_prop_created_id_idx` | 65.51 | 2.29 |
| receivables:first | `res_prop_outstanding_idx` | 20.54 | 0.75 |
| transfer-proofs:first | `transfer_proofs_prop_submitted_id_idx` | 6.23 | 0.30 |
| guests:first | `guests_prop_created_id_idx` + `res_prop_guest_idx` | 89.44 | 1.00 |
| guests:search | `guests_prop_created_id_idx` (ordered scan, filter) | 31.57 | 8.33 |

Every index in 0017 appears in at least one of these plans. Two candidates were
measured and deliberately **not** shipped:

- `property_invoices (property_id, status, created_at desc, id desc)` for the
  status tab: 0.19 ms without it vs 0.24 ms with it. The created_at keyset
  index already returns 25 matching rows before the filter becomes expensive.
- `payments (property_id, reservation_id, created_at desc, id desc)` for the
  reservation drawer: 0.17 ms without it vs 0.12 ms with it. The existing
  `payments_res_idx` is sufficient at the measured cardinality (the seed has at
  most one payment per reservation).

Do not add an index here without a plan that shows it being used and a measured
improvement; an unused index only slows writes and autovacuum.

### Operational boards

`GET /api/front-desk`, `GET /api/rooms/assignable-reservations` and
`GET /api/restaurant/in-house` reuse existing indexes rather than adding new
ones. On the benchmark data the planner picks `res_prop_status_idx` or
`res_prop_dates_idx` and sorts the bounded status bucket:

| Query | Plan | Execution (ms) |
| --- | --- | ---: |
| front-desk:arrivals-today | `res_prop_dates_idx`, incremental sort | 18.9 |
| front-desk:arrivals-all | `res_prop_status_idx`, sort | 26.0 |
| front-desk:in-house | `res_prop_status_idx`, sort | 23.0 |
| front-desk:departures-today | `res_prop_status_idx`, sort | 17.9 |
| front-desk:counts | `res_prop_status_idx` | 4.6 |
| assignable:room-type | `res_prop_status_idx`, sort | 31.7 |

Candidate `(property_id, status, check_in_date, created_at desc, id desc)` and
partial unassigned-arrivals indexes were built and measured on a 12.5k-row
confirmed bucket: 13.8 ms with the index vs 10.6 ms without (the existing
`res_prop_dates_idx` already provides the order for the date-bounded query).
They were dropped. Each operational query is capped at 1000 rows and reports
`truncated` when the bucket is larger, so the sort is over the matching bucket,
not the property history.

## Known gap: leading-wildcard search

Reservation and guest search use `ilike '%term%'`. A B-tree cannot serve a
leading wildcard, so both plans scan the property's ordered index and filter.
That is why `reservations:search` is the slowest list query (26.9 ms at 50k
reservations) and `guests:search` is 8.3 ms at 20k guests. If search latency
becomes a problem, add a `pg_trgm` GIN index on the searched columns
(`reservations.reference`, `guests.full_name`, `guests.email`, `guests.phone`)
and measure the `%term%` plan again. No trigram index is included here because
it was not measured.
