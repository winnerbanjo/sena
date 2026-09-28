# Paystack BYOP

Each property connects its own Paystack account from **Connected Apps → Paystack**. Sena verifies the Secret Key with Paystack before saving it, encrypts it with AES-256-GCM, and never returns the plaintext key to the browser. Set `SENA_INTEGRATION_ENCRYPTION_KEY` to a dedicated 32-byte base64 value or 64-character hexadecimal value in every runtime that initializes or verifies property payments.

The property owner copies the generated webhook URL into **Paystack Dashboard → Settings → API Keys & Webhooks**. Every property receives a random webhook token. Sena also checks Paystack's HMAC signature using that property's decrypted Secret Key and verifies the transaction directly with Paystack before changing any invoice, reservation, or payment ledger state.

Property payment initialization derives the amount, currency, guest email, and property identity from Sena records. Browser-supplied amounts and tenant identifiers are not trusted. Payment attempts use random `SENA_…` references and idempotency keys prevent repeated clicks from creating extra transactions.

Webhook settlement checks the integration, tenant, payment attempt, purpose, amount, currency, reference, and metadata. Settlement uses a database transaction and advisory lock so duplicate or concurrent delivery records one receipt and one balance update. A Paystack redirect only shows a confirming state; it never proves payment.

Disconnecting removes the active credential and stops new online payments. It preserves payment attempts, receipts, invoices, reservation balances, and audit history. Reconnecting or replacing a key verifies the new key before replacing the existing credential.

The global `PAYSTACK_SECRET_KEY` remains reserved for Sena subscription billing. It must not initialize or verify guest, invoice, direct-booking, or API-booking payments.

## Safe validation

Run destructive tests only against a local database named `sena_test` or `sena_qa`. The shared guard requires `SENA_TEST_DATABASE_URL`, requires a distinct `SENA_PRODUCTION_DATABASE_URL`, rejects `sena_prod`, rejects non-local hosts, and rejects live Paystack or email credentials. The BYOP suite mocks Paystack and uses synthetic fixtures:

```bash
SENA_TEST_DATABASE_URL=postgresql://127.0.0.1:55432/sena_test \
SENA_PRODUCTION_DATABASE_URL=postgresql://production.invalid/sena_prod \
DATABASE_URL=postgresql://127.0.0.1:55432/sena_test \
SENA_INTEGRATION_ENCRYPTION_KEY=<test-only-32-byte-key> \
pnpm tsx scripts/test-paystack-byop.ts
```
