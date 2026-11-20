# Advisory lock audit

Audit scope: repository-wide source search for `pg_advisory_lock`, `pg_try_advisory_lock`, session-level variants and the transaction-level `pg_advisory_xact_lock` form.

## Findings

No session-scoped lock or try-lock calls (`pg_advisory_lock`, `pg_try_advisory_lock`, `pg_advisory_unlock`, or `pg_advisory_unlock_all`) were found in application source. Runtime advisory lock calls found all use `pg_advisory_xact_lock`:

- `packages/reservations/src/index.ts` — room-type reservation creation and apartment idempotency serialization.
- `packages/reservations/src/booking-group.ts` — booking-group idempotency.
- `packages/payments/src/index.ts` — per-reservation payment serialization and transfer-proof actions.
- `apps/dashboard/src/app/api/invoices/[id]/payments/route.ts` — invoice-payment idempotency.
- `apps/dashboard/src/lib/paystack-payments.ts`, `flutterwave-payments.ts`, `settle-paystack.ts` — provider payment/settlement idempotency.
- `apps/dashboard/src/lib/gallery-upload-store.ts` — gallery ownership mutation serialization.
- `apps/dashboard/src/app/api/auth/register/route.ts`, `auth/otp/send/route.ts`, `auth/otp/verify/route.ts` — OTP serialization.
- `apps/dashboard/src/app/api/onboarding/route.ts` — onboarding serialization.
- `packages/email/src/sender.ts` — email idempotency.

Search also found documentation and a static test assertion mentioning the lock function; neither acquires a lock.

## Why the current calls are pooler-safe

Every runtime call is issued through `tx.execute(...)` inside the corresponding postgres.js/Drizzle transaction. A transaction-scoped advisory lock is held through that transaction and released automatically at commit or rollback. It does not rely on a client retaining the same PostgreSQL session after the transaction, unlike `pg_advisory_lock` / `pg_try_advisory_lock`; transaction-mode poolers can therefore safely assign another backend after the transaction ends. Prepared statement behavior is separately controlled by `DB_PREPARE` (default `false`).

Do not move these calls outside their transaction callbacks or convert them to session-level locks.
