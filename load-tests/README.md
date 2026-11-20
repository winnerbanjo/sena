# Load tests

k6 scenarios for the reservation, dashboard, guest, and invoice paths. These are not a capacity target; thresholds are placeholders until a target is agreed.

## Safety guard

Every script requires `LOAD_TEST_FORBIDDEN_HOST_PATTERN`, a regular expression for hosts that must never be load-tested. If the variable is missing, invalid, or matches `BASE_URL`, the script refuses to start. Nothing defaults to a real host or credential.

Use a disposable environment (local, a dedicated preview, or a staging project) and a dedicated test property/guest/invoice. Do not run these against production.

## Environment

| Variable | Required | Meaning |
| --- | --- | --- |
| `BASE_URL` | yes | Target origin, e.g. `http://localhost:3000`. |
| `LOAD_TEST_FORBIDDEN_HOST_PATTERN` | yes | Regex of production hosts, e.g. `(^|\.)sena\.ng$|prod`. |
| `LOAD_TEST_API_KEY` | availability/create | Secret API key for `/api/v1`. |
| `LOAD_TEST_PROPERTY_ID` | all | Target property UUID. |
| `LOAD_TEST_ROOM_TYPE_ID` | availability/create | Room type with deliberately small inventory for contention. |
| `LOAD_TEST_CHECK_IN`, `LOAD_TEST_CHECK_OUT` | no | Stay dates; defaults `2035-06-01`/`2035-06-03`. |
| `LOAD_TEST_SESSION_COOKIE` | dashboard/guest/invoice | Full Cookie header from a signed-in disposable session. |
| `LOAD_TEST_GUEST_ID` | guest edits | Disposable guest UUID. |
| `LOAD_TEST_INVOICE_ID` | invoice flow | Disposable invoice UUID with a large balance. |
| `LOAD_TEST_PAYMENT_AMOUNT_MINOR_UNITS` | no | Payment per iteration; default `100` (1 unit of currency). |
| `LOAD_TEST_VUS` | no | Virtual users; default `10`. |
| `LOAD_TEST_DURATION` | no | Scenario duration; default `1m`. |
| `LOAD_TEST_P95_MS` | no | Placeholder p95 threshold; default `1000`. |
| `LOAD_TEST_P99_MS` | no | Placeholder p99 threshold; default `2500`. |
| `LOAD_TEST_ERROR_RATE` | no | Placeholder HTTP error-rate threshold; default `0.01`. |

The session cookie is a credential. Pass it inline or via a local env file that is never committed.

## Scenarios

| Script | Traffic |
| --- | --- |
| `availability-and-create.js` | Public availability reads plus reservation creates racing for a small room-type inventory. Sold-out (`409`) responses are expected and counted separately. |
| `dashboard-lists.js` | Reservations, invoices, payments, guests, and front-desk board reads. |
| `guest-edits.js` | Guest detail read and a real PATCH with a unique note each iteration. |
| `invoice-flow.js` | Invoice read, note edit, and an idempotent payment. Use an invoice with a large balance; it will be settled by repeated runs. |

## Running

```bash
k6 run load-tests/dashboard-lists.js \
  -e BASE_URL=http://localhost:3000 \
  -e LOAD_TEST_FORBIDDEN_HOST_PATTERN='(^|\.)sena\.ng$|prod' \
  -e LOAD_TEST_SESSION_COOKIE='next-auth.session-token=...; sena_property_id=...' \
  -e LOAD_TEST_PROPERTY_ID=...
```

Use `k6 run --summary-export=results.json ...` to keep a machine-readable summary. Reset disposable data between runs; guest edits and invoice payments are real writes.

## Metrics to record

Record these for every run, alongside the git SHA, `BASE_URL` host, scenario, VUs, duration, and data volume:

- Requests per second (overall and per endpoint).
- Latency p50 / p95 / p99 (overall and per endpoint).
- HTTP error rate and any non-2xx breakdown (`409` sold-out is expected in create contention).
- Database error rate and connection errors.
- Database connection utilisation: active / idle / total against the pool and provider limits.
- Connection queue/wait time (pool wait, and database `pg_stat_activity` wait events).
- Lock waits and deadlocks (`pg_stat_activity` wait events, `pg_stat_database.deadlocks`, `pg_locks`).
- Response size (bytes) for list and detail endpoints.
- Test duration and total iterations.

Database signals are not emitted by k6. Capture them separately from the disposable database, for example:

```sql
select state, wait_event_type, wait_event, count(*)
from pg_stat_activity
where datname = current_database()
group by 1, 2, 3;

select deadlocks, xact_commit, xact_rollback from pg_stat_database
where datname = current_database();
```

Record the connection budget from `docs/ops/db-connections.md` for the same run so latency can be read against pool saturation.
