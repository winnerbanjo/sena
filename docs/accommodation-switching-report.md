# Accommodation switching and reservation removal — verification report

Status: **ready for local review. Not deployed. Stay Connect was never written to.**

Date: 2026-10-02
Branch: `main` @ `5f7e8a4 feat(reservations): add multi-room operations and authoritative room inventory`

---

## 1. What operators can do

A reservation can be moved between rooms, room categories and apartments
without being cancelled and recreated. Identity, guest, reference and status are
preserved across every switch.

The reservation actions menu (`reservation-drawer.tsx`) exposes: edit, change
dates, change guest, change room, change category, room ↔ apartment, extend,
shorten, assign/reassign accommodation, check in, check out, cancel, mark
no-show, and **delete / void**.

## 2. Delete vs void — two safe semantics behind one action

The operator sees one action, **More → Delete reservation**. Sena decides what
that actually means. No database vocabulary reaches the operator.

| Reservation state | Semantics | Confirmation |
|---|---|---|
| No history at all | **Hard delete** — the row is physically removed | Dialog only |
| Payment, invoice, stay history, note, message, review, transfer proof, or payment attempt | **Void** — `status = 'voided'`, removed from operations, all dependent financial rows untouched | Reference must be typed |
| Currently checked in | **Blocked** — "Check the guest out before deleting this reservation." | Not offered |

The dialog reads:

- Clean: *"Delete reservation? This reservation will be permanently deleted."*
  → `[Cancel] [Delete reservation]`
- With history: *"This reservation has payment, invoice, or stay history. Sena
  will remove it from active operations while preserving its financial
  history."* → `[Cancel] [Remove reservation]`

A reason is optional and offered as Duplicate reservation / Created by mistake /
Guest cancelled / Test or erroneous entry / Management decision / Other.

### Why `paymentAttempts` matters

`payment_attempts.reservation_id` is `onDelete: 'restrict'`. A reservation that
touched a payment attempt cannot be physically deleted at all — the foreign key
vetoes it. It is therefore counted as history, so such reservations take the
void path instead of failing with a database error.

### Audit

Every destructive action writes an `activity_logs` row carrying reservation
reference, action (`reservation_deleted` / `reservation_voided`), actor, timestamp
and reason. A hard delete survives its own record: `activity_logs.resource_id` is
a `varchar` with **no** foreign key to `reservations`, so the evidence outlives
the row without a broken reference.

## 3. Payments and invoices

Never destroyed as a side effect. Because void sets `status = 'voided'` and
leaves the row in place, `payments.reservation_id` and
`property_invoices.reservation_id` keep pointing at their reservation. Money is
never auto-refunded and no reversal is fabricated; a refund stays an explicit
financial operation.

## 4. Booking groups

`reservations.booking_group_id` is `onDelete: 'set null'`, so removing one child
can never cascade into the group. When the last child is removed or voided, the
now-empty group row is deleted rather than orphaned.

## 5. Inventory release

Capacity is returned through the authoritative engine
(`releaseInventoryInTransaction` → `categoryAvailability`), never by adjusting
counters. A released occupied room/apartment returns to `available` and an open
housekeeping task is raised.

## 6. Permissions

One new permission, `reservation.delete`, granted to **owner** and **manager**
only. Front desk keeps `reservation.edit` / `reservation.cancel` and therefore
full normal operational control, but cannot permanently remove a reservation.

Enforced **server-side** by `withMerchant(handler, 'reservation-removal')` in
[apps/dashboard/src/app/api/reservations/[id]/remove/route.ts](apps/dashboard/src/app/api/reservations/%5Bid%5D/remove/route.ts),
which maps the scope to `reservation.delete` and also validates that the
reservation belongs to the caller's property. The same boundary answers TEST 10
and TEST 11.

## 7. Voided reservations in the normal list

Voided rows are filtered out of the default operational list and available under
a **Voided** tab on the reservations screen. No archive product was built.

---

## Test results

All suites run against the local disposable `sena_test` database, with payment,
email, Redis and S3 credentials removed and `SENA_PRODUCTION_DATABASE_URL` set
to a placeholder so the runner can prove test and production differ.

### Reservation removal — 12/12 passed

`scripts/test-reservation-removal.ts`

| # | Scenario | Result |
|---|---|---|
| 1 | Brand-new reservation, no history | Hard delete; availability returns to baseline; audit row survives |
| 2 | Reservation with payment | Void; payment amount, status and link all unchanged |
| 3 | Reservation with invoice | Void; invoice number, total and link preserved |
| 4 | Checked in | Blocked (`in_house`); stay history intact |
| 5 | Checked out | Void; check-in and check-out events still on the timeline |
| 6 | Group of 3, delete one child | Other two untouched, group intact |
| 7 | Delete last child of group | No orphan group |
| 8 | Delete reservation holding Room 3022 | Night available again immediately |
| 9 | Delete apartment reservation | Apartment available again immediately |
| 10 | Cross-property request | Blocked (`not_found`); foreign reservation untouched |
| 11 | Insufficient staff permission | Front desk, housekeeping, accountant all denied |
| 12 | Repeated request | Hard delete → `not_found`; void → `already_removed`; money never touched |

### Regression — all green

| Suite | Result |
|---|---|
| `test-accommodation-switching` | 15 passed |
| `test-reservation-operations` | 24 passed |
| `test-inventory-authority` | 14 passed |
| `test-apartment-archive` | 19 passed (includes "Stay Connect apartments and staff were not modified") |
| `test-room-assignment` | 16 passed |

`check-types`: 27/27 tasks successful.
`build`: 16/16 tasks successful.

### Two notes on the run

- `test-room-assignment` and `test-apartment-archive` default to
  `localhost:55432`, which is not listening in this environment. Both pass when
  pointed at the running `sena_test` on 5432. Pre-existing, unrelated to this
  work.
- `scripts/test-negotiated-pricing.ts` does not exist in this repository. It was
  present only in the empty workspace this session started in, and imports
  paths that are not part of the repo. Not a regression.

---

## Fix made during verification

The first build failed:

```
Module not found: Can't resolve 'fs'
Import trace: reservation-drawer.tsx -> @sena/reservations -> packages/database
```

`reservation-drawer.tsx` imported `roleMayDeleteReservations` from
`@sena/reservations`, whose entry point pulls in the database layer and the
`postgres` driver — which uses `fs` — straight into the browser bundle.

Fixed by moving the pure permission helpers (`ROLE_ALIASES`, `permissionsForRole`,
`roleMayDeleteReservations`) into `@sena/config`, which is the established
database-free module already used by client components. `removal.ts` imports
from there and re-exports `roleMayDeleteReservations`, so the server API surface
is unchanged. The browser now asks exactly the same permission question the
server enforces, without importing the server.

---

## Awaiting review

Nothing has been committed, deployed, or applied to Stay Connect. All changes
are uncommitted in the working tree for your local review.