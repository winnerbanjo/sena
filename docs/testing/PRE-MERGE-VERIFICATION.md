# Pre-merge verification: PRs #80, #81, #82

Local-only verification. No production or staging database, credentials, cookies, payment provider, email provider, or storage provider was used. No PR was pushed or merged remotely.

## Verdict

| PR | Branch | Merge order | Verdict | Fix commits | Verification fixes |
| --- | --- | ---: | --- | ---: | ---: |
| #80 | `fix/invoice-race-money-validation` | 1 | **GO** | 5 commits | 2 |
| #81 | `perf/list-keyset-pagination` | 2 | **GO**, with the index-count note below | 2 commits | 0 |
| #82 | `chore/db-concurrency-load-tests` | 3 | **GO** | 2 commits | 0 |

The verification branch is `verify/integration` at `524a99e`. It was created from `origin/main` and contains only local merge commits. The two verification fixes on PR #80 are also on the PR branch at `ebd5c3d` (the branch is two commits ahead of its origin).

## Environment

- Local PostgreSQL 16 container: `sena-listbench-pg`, `127.0.0.1:55432`.
- Preserved baseline: `postgresql://postgres:postgres@127.0.0.1:55432/sena_qa_verify`.
- Destructive pagination benchmark: `.../sena_qa_bench`.
- Isolated payment tests: `.../sena_qa_fw_test2` and `.../sena_qa_fw_test`.
- Browser fixtures: `.../sena_test`.
- Dashboard: `http://127.0.0.1:3012`; constrained-pool instance: `http://127.0.0.1:3013`.
- Chrome channel `chrome`; Playwright `1.65.1` is a root devDependency added only for this verification.

The baseline was not reseeded or truncated. Its final state is unchanged:

```text
properties=3 guests=4 reservations=4 invoices=3 payments=2
invoice_paid_gt_total=0 reservation_paid_gt_total=0 negative_paid=0
```

## Exact setup and replay commands

```bash
# 1. Local integration branch
git fetch origin
git switch -c verify/integration origin/main

# 2. Merge in the requested order (local only)
git merge --no-ff fix/invoice-race-money-validation   # 5bc6267
git merge --no-ff perf/list-keyset-pagination        # 1edcfb9
git merge --no-ff chore/db-concurrency-load-tests    # f60b4d7

# 3. Dependencies
pnpm install

# 4. Apply the additive pagination indexes with psql, not Drizzle migrate.
#    CREATE INDEX CONCURRENTLY cannot run inside Drizzle's transaction.
psql "$BASELINE_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f packages/database/drizzle/0017_list_pagination_indexes.sql

# 5. Verify index health
psql "$BASELINE_DATABASE_URL" -c \
  "select c.relname, i.indisvalid, i.indisready
     from pg_index i join pg_class c on c.oid=i.indexrelid
    where c.relname like '%_idx' order by 1;"
psql "$BASELINE_DATABASE_URL" -c \
  "select count(*) as invalid_indexes from pg_index where not indisvalid;"

# 6. Build and typecheck
pnpm --filter @sena/dashboard build
pnpm --filter @sena/dashboard check-types
pnpm --filter @sena/payments check-types

# 7. Browser database schema (restored from the preserved baseline schema,
#    because the repository seed path is broken on main; see findings).
pg_dump --schema-only --no-owner --no-privileges "$BASELINE_DATABASE_URL" \
  | sed '/transaction_timeout/d' \
  | psql "$BROWSER_DATABASE_URL"

# 8. Seed browser fixtures (local-host guard refuses non-local hosts)
DATABASE_URL="$BROWSER_DATABASE_URL" pnpm exec tsx scripts/seed-browser-verification.ts

# 9. Start the dashboard
DATABASE_URL="$BROWSER_DATABASE_URL" \
AUTH_SECRET='local-browser-verification-secret' \
NEXTAUTH_SECRET='local-browser-verification-secret' \
AUTH_URL='http://127.0.0.1:3012' \
NEXTAUTH_URL='http://127.0.0.1:3012' \
NEXT_PUBLIC_APP_URL='http://127.0.0.1:3012' \
NODE_ENV=production \
pnpm --filter @sena/dashboard exec next start -p 3012

# 10. Browser suite
pnpm exec playwright test -c e2e/playwright.config.ts
```

The seed creates two properties (`verify-harbour`, `verify-north`), 65 guests/reservations/invoices for property A, 3 for property B, one `Last Available Room` category with one room, and 1001 `FD-TRUNC-*` confirmed arrivals dated 2026-11-21. The 1001st arrival is deliberate: the front-desk operational cap is 1000.

## Merge log and conflicts

| Step | Commit | Result |
| --- | --- | --- |
| PR #80 merge | `5bc6267` | Applied. |
| PR #81 merge | `1edcfb9` | Applied. The branch is stacked on PR #80, so its invoice/reservation route edits overlap by design. No unresolved markers remained; route and pagination suites passed. |
| PR #82 merge | `f60b4d7` | Applied. One semantic type conflict in `apps/dashboard/src/lib/merchant-route.ts` was resolved to the non-null test-session user shape from PR #82 (`8cb5b99`). |
| PR #80 settlement fix | `78e3e6a` | Cherry-pick of `6c99686`; bounds verified provider settlements. |
| PR #80 settlement fix | `524a99e` | Cherry-pick of `ebd5c3d`; preserves the invoice settlement balance contract. |

No PR branch other than `fix/invoice-race-money-validation` was modified. The integration branch was never pushed.

## Automated results

| Check | Result | Notes |
| --- | --- | --- |
| `scripts/test-money-bounds.ts` | PASS 10/10 | Exact maximum accepted; above maximum, fractional, and negative values rejected. |
| `scripts/test-invoice-edit-payment-race.ts` | PASS 6/6 | No lost update or overpayment under edit/payment contention. |
| `scripts/test-invoice-reservation-lock-order.ts` | PASS | Old lock order reproduced 5/5 deadlocks; new order completed 10+10 runs cleanly. |
| `scripts/test-payment-settlement.ts` | PASS 5/5 | Currency/property mismatch and subscription underpayment/idempotency checks restored. |
| `scripts/test-flutterwave-byop.ts` | PASS | Linked invoice above the stay total settles; reservation cumulative stays at 49,000,000 minor units. |
| `scripts/test-list-pagination.ts` | PASS | 12,500 reservations, 125 pages, no duplicate or missing rows. |
| `scripts/test-list-routes.ts` | PASS | Tenant, auth, cursor, and 600-row operational-screen checks. |
| `scripts/test-db-concurrency.ts` | PASS | Last room, payment idempotency, invoice contention. |
| `scripts/test-guest-edit-route.ts` | PASS | Validation, persistence, no-op response, tenant boundary. |
| `scripts/test-load-test-guard.ts` | PASS | Missing base URL, missing/empty deny pattern, matching host all refuse. |
| `scripts/test-release.ts` | PASS 27/27 | Isolated local fixtures, hold concurrency, API-key isolation, cancellation, review audit. |
| `scripts/verify-p0-scenarios.ts` | PASS A–H | Existing P0 definitions: check-in/idempotency, unpaid extension, paid extension, group extension, incidental on paid invoice, stay conflict, role permissions, financial floor. |
| Playwright browser suite | PASS 12/12 | Includes login, A–J matrix below, two-context races, tenant isolation, console/network sweep. |
| Constrained pool instance | PASS 3/3 | `DB_POOL_MAX=3 DB_PREPARE=false` on port 3013: login, core screens, page sweep. |
| Invalid pool settings | PASS 3/3 | `DB_POOL_MAX=0`, `DB_POOL_MAX=abc`, `DB_PREPARE=maybe` fail fast; legacy `DB_MAX_CONNECTIONS=3` still imports. |
| Dashboard build | PASS | Production build completed. |
| Dashboard/payments typecheck | PASS | No type errors. |
| Dashboard lint | NOT RUN | The lint command opens interactive ESLint setup in this unattended environment. |
| `scripts/verify-customer-fixes.ts` | FAIL (baseline fixture conflict) | Step 1 passed; step 2 could not create its test stay because preserved baseline reservations already occupy 2026-12-01..04 in `sena_test`. The script cleaned up and stopped. Not a PR regression. |
| `scripts/verify-authenticated-browser-scenarios.ts` | NOT RUN | It spawns its own server on port 3012; the browser instance already occupied that port. |

The two failing/not-run items above are reported as limitations, not passes.

## Browser matrix A–J

These labels are the verification matrix for this task. The repository's older P0 A–H definitions are separate and all passed in `scripts/verify-p0-scenarios.ts`.

| ID | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| A | Reservation create, edit, cancel; invalid dates | PASS | UI creates a reservation with unique guest/email/phone and unique dates; API extends it; UI reload shows 3 nights; API cancel; UI row shows Cancelled. Same-day check-in/out returns 4xx. |
| B | Guest profile edit, validation, persistence | PASS | UI edit persists phone and notes after reload; blank name and invalid email return 400; unchanged PATCH returns `No changes made.` |
| C | Invoice billing details, lines, payments, overpayment | PASS | Create, billing PATCH, quantity change, partial payment, `BELOW_PAID` 409, settle, overpayment 4xx; UI invoice row and PAID badge. |
| D | Money bounds | PASS | Exact `2,147,483,647` accepted; `2,147,483,648`, overflowing quantity×price, fractional, and negative values rejected with the documented limit message. |
| E | Cursor pagination completeness | PASS | API pages for reservations, invoices, guests, payments have no duplicates; UI load-more goes 25→50 for stays/invoices/guests and exposes payments load-more. |
| F | Front-desk truncation | PASS | 1001 arrivals produce `Showing the first 1000 of 1001 stays.` and the narrow-the-view notice; rooms page loads. |
| G | Last-room and invoice/payment races | PASS | Two sessions: exactly one last-room booking succeeds, one 4xx; five invoice edit/payment races each produce exactly one success, no 5xx, paid ≤ total. |
| H | Tenant isolation | PASS | Property B gets 404 for A's invoice detail, folio, reservation, guest, and invoice edit; B's invoice search does not return A's invoice. |
| I | Constrained DB pool/prepared statements | PASS | Port 3013 with `DB_POOL_MAX=3 DB_PREPARE=false` logs in and loads primary screens; invalid values fail fast. |
| J | Primary-screen error sweep | PASS | `/`, `/reservations`, `/guests`, `/invoices`, `/payments`, `/front-desk`, `/rooms`, `/analytics`, `/settings`: no 5xx, no console exceptions. |

### Manual guide A–J

Use a fresh browser profile and the local fixture accounts. Do not use real guest data.

1. **A — Reservation lifecycle.** Sign in as `owner-a@verify.local`. Open Reservations → New reservation. Pick dates with no existing stay, choose Harbour Deluxe, enter a new guest name, unique phone, and unique email. Create. Confirm the success modal, then Done. Search the guest; open the row. Edit the stay through the UI, save, and confirm the new night count. Cancel the stay and confirm the row becomes Cancelled. Also try check-out equal to check-in and confirm the inline error.
2. **B — Guest edit.** Open Guests, search `Verification Guest 01`, open the profile, Edit Profile, change phone and notes, Save. Reload and confirm persistence. Try a blank name and an invalid email; both should be rejected.
3. **C — Invoice lifecycle.** Open Invoices, create a guest folio invoice, edit recipient/notes, change a line quantity, record a partial cash payment, attempt to reduce the total below the paid amount (expect `BELOW_PAID`), settle the balance, then attempt an overpayment. Confirm the invoice row and PAID badge.
4. **D — Money bounds.** Create invoices with exactly `2,147,483,647` minor units (accept), `2,147,483,648` (reject), a quantity×price overflow (reject), a fractional price (reject), and a negative price (reject). Confirm the maximum shown is `₦21,474,836.47`.
5. **E — Pagination.** Open Reservations; confirm 25 rows, click Load more stays, confirm 50 unique folio references. Repeat on Invoices and Guests. On Payments, confirm the load-more control. Use the search box and date filters to confirm they reset the list correctly.
6. **F — Front desk.** Open Front Desk with the 1001 seeded arrivals. Confirm the status notice says `Showing the first 1000 of 1001 stays.` and advises narrowing the view. Switch arrival scope and tabs; confirm no freeze.
7. **G — Concurrency.** Use two browser profiles signed in as the same owner. Book the `Last Available Room` for the same dates in both; exactly one should succeed. Then create an invoice in one profile, open it in both, and simultaneously reduce its total and record a payment; exactly one operation should win and the invoice must never show paid > total.
8. **H — Tenant isolation.** Sign in as `owner-b@verify.local` in a separate profile. Try A's invoice/reservation/guest URLs by id. Expect 404, not data. Search invoices and confirm A's invoice number is absent.
9. **I — Pool settings.** Start a second dashboard on 3013 with `DB_POOL_MAX=3 DB_PREPARE=false`. Sign in and open Overview, Reservations, Guests, Invoices, Payments, Front Desk, Rooms, Analytics, Settings. Then try `DB_POOL_MAX=0` or `DB_PREPARE=maybe`; startup should fail with a clear configuration error.
10. **J — Error sweep.** With DevTools open, visit the nine primary screens. Confirm no 5xx responses, no uncaught console exceptions, and no failed same-origin API calls.

## Read-only staging/production SQL checks

Run inside a read-only transaction. Replace the schema/table names only if the deployment uses a non-public schema.

```sql
BEGIN TRANSACTION READ ONLY;

-- 1. All nine additive pagination indexes exist and are usable.
SELECT c.relname AS index_name, i.indisvalid, i.indisready
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname IN (
  'res_prop_created_id_idx',
  'res_prop_status_created_id_idx',
  'guests_prop_created_id_idx',
  'res_prop_guest_idx',
  'prop_inv_prop_created_id_idx',
  'prop_inv_prop_unpaid_created_id_idx',
  'payments_prop_created_id_idx',
  'transfer_proofs_prop_submitted_id_idx',
  'res_prop_outstanding_idx'
)
ORDER BY 1;

-- 2. No invalid indexes anywhere.
SELECT count(*) AS invalid_indexes FROM pg_index WHERE NOT indisvalid;

-- 3. Ledger invariants.
SELECT count(*) AS invoice_paid_gt_total
FROM property_invoices WHERE paid_amount_minor_units > total_amount_minor_units;
SELECT count(*) AS reservation_paid_gt_total
FROM reservations WHERE paid_amount_minor_units > total_amount_minor_units;
SELECT count(*) AS negative_paid
FROM property_invoices WHERE paid_amount_minor_units < 0;
SELECT count(*) AS negative_reservation_paid
FROM reservations WHERE paid_amount_minor_units < 0;

-- 4. Tenant orphans (must be zero).
SELECT count(*) AS orphan_reservations
FROM reservations r LEFT JOIN properties p ON p.id = r.property_id
WHERE p.id IS NULL;
SELECT count(*) AS orphan_invoices
FROM property_invoices i LEFT JOIN properties p ON p.id = i.property_id
WHERE p.id IS NULL;
SELECT count(*) AS orphan_payments
FROM payments pay LEFT JOIN properties p ON p.id = pay.property_id
WHERE p.id IS NULL;

ROLLBACK;
```

Index creation itself is not read-only. Apply `0017` separately with `psql -v ON_ERROR_STOP=1 -f ...` during a low-traffic window, then run the checks above.

## Findings and design decisions

1. **Index count discrepancy.** The task text says 11 indexes; `0017_list_pagination_indexes.sql` contains 9. All 9 are documented and valid, and `scripts/explain-list-queries.ts` selected an intended index for 19 query variants. No index was invented to reach 11.
2. **Invoice settlement is intentionally not capped by the stay total.** Existing `scripts/test-invoice-settlement-balance.ts` permits an invoice to collect more than the linked reservation total. PR #80 removed the Flutterwave cap that contradicted this contract. Keep invoice-balance checks and checked arithmetic; do not re-cap linked reservations by invoice amount.
3. **Nested drawer dialogs did not remain open under Playwright.** Clicking Edit stay or Cancel opened the child dialog and it detached immediately, so the browser test edits and cancels through the local API and then verifies the UI state. This is not attributable to these PRs and needs a manual UI confirmation before release.
4. **Repository seed path is broken on main.** The migration journal stops at 0013, so `setupLocalDatabase()` fails with `column "industry" of relation "properties" does not exist`. Browser fixtures were created by restoring a schema-only dump of the preserved baseline into `sena_test`. This was not fixed on `main`.
5. **Playwright is verification tooling.** `@playwright/test@1.65.1` is a root devDependency and lockfile change. It is not a production dependency and should not be treated as part of any PR's runtime surface.
6. **`verify-customer-fixes.ts` baseline collision.** The script's step-2 dates overlap preserved baseline reservations. It failed on fixture availability, not on a PR behavior. Run it against a freshly seeded disposable database if it is part of the release gate.
7. **Pool defaults are explicit.** `DB_POOL_MAX` falls back to legacy `DB_MAX_CONNECTIONS`, then 10; `DB_PREPARE` defaults to false. Invalid values fail fast. The 3013 run confirms the pool does not need prepared statements for these screens.
8. **Tenant boundary is enforced before handlers.** `withMerchant` resolves the id in the path and checks it against the tenant property before dispatch. The earlier concern about an unscoped invoice/folio GET did not reproduce; property B received 404 for all five attempted reads/edits.

## Merge order

1. PR #80 `fix/invoice-race-money-validation` — merge first; it changes shared invoice/payment/reservation lock and money paths.
2. PR #81 `perf/list-keyset-pagination` — merge second; it is stacked on #80 and changes list routes/UI.
3. PR #82 `chore/db-concurrency-load-tests` — merge third; it touches database configuration, load-test tooling, and the test-session type.

Apply `0017` after the code merge and before enabling the paginated UI in an environment. It is additive and not part of Drizzle's journal.

## Rollback

- **PR #80:** revert its merge/cherry-picks together. No schema migration is involved. Re-run money bounds, invoice race, lock order, payment settlement, and Flutterwave BYOP after revert.
- **PR #81:** revert the merge. The nine indexes are additive; drop them only if they cause measurable write regression:
  `DROP INDEX CONCURRENTLY IF EXISTS <name>;` for each of the nine names above. Do not drop them inside a transaction.
- **PR #82:** revert the merge. Unset `DB_POOL_MAX`, `DB_MAX_CONNECTIONS`, `DB_IDLE_TIMEOUT`, `DB_CONNECT_TIMEOUT`, and `DB_PREPARE` to return to the prior defaults. No schema change.
- **Local integration branch:** delete `verify/integration` after the PRs are merged elsewhere. It was never pushed.
- **Browser artifacts:** `e2e/artifacts/` and `e2e/playwright-report/` are gitignored and can be removed at any time.

## Manual prerequisites and limitations

- Local PostgreSQL 16 on port 55432, Node 24/pnpm, Chrome, and ports 3012/3013 free.
- A local `AUTH_SECRET`/`NEXTAUTH_SECRET`; no real provider keys.
- The browser fixture seed must be run against a disposable database. It truncates public tables and refuses non-local hosts.
- Dashboard lint was not run because it prompts for interactive ESLint setup.
- `verify-authenticated-browser-scenarios.ts` was not run because it owns port 3012.
- `verify-customer-fixes.ts` needs a fresh disposable database, not the preserved baseline.
- The nested edit/cancel dialog behavior needs a human check; the API and resulting UI state are verified.
