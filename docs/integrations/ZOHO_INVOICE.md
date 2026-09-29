# Zoho Invoice Connected App

## Authority
Sena remains the operational source of truth for guests, invoices, and payment settlement.
Zoho Invoice is an outbound sync destination. Zoho never settles or authorizes Sena payments.
Zoho responses must not mutate reservation paid amounts, folio balances, or the Sena payment ledger.

## OAuth
- Official Zoho OAuth 2.0 (`/oauth/v2/auth` + `/oauth/v2/token`)
- Multi-DC: token `api_domain` + `location` + persisted `accountsDomain` for refresh
- Regional API bases: `zohoapis.com|.eu|.in|.com.au|.jp|.ca|.com.cn|.sa`
- Env: `SENA_ZOHO_INVOICE_CLIENT_ID`, `SENA_ZOHO_INVOICE_CLIENT_SECRET`
- Optional DC override: `SENA_ZOHO_ACCOUNTS_BASE` (default `https://accounts.zoho.com`)
- Redirect: `{SENA_PUBLIC_APP_ORIGIN}/api/apps/oauth/callback`
- Tokens encrypted at rest; never returned to the client
- OAuth state is one-time, property+actor bound (replay rejected)

## Connection model (property-scoped)
1. Connect Zoho Invoice (OAuth) → **Connected**
2. Select organization (never auto-pick first) → stores org id/name
3. Sync invoices toggle → **Enabled** for NEW outbound sync
4. Disconnect clears tokens; mappings + audit + Sena financial history preserved

CONNECTED ≠ ENABLED. Disabling sync stops new outbound jobs without deleting mappings or Sena data.

## Sync objects
| Sena | Zoho |
|------|------|
| Guest | Contact (email match before create; mapping authoritative) |
| Invoice | Invoice (Sena invoice number kept as reference) |
| Verified payment | Customer payment (bookkeeping only; idempotent) |

Historical invoices are **not** exported on connect. New invoices enqueue after enablement.
Optional “Sync existing invoices” is a future explicit operator action.

## Background jobs
`POST /api/cron/connected-apps-sync` with `SENA_SYNC_CRON_SECRET` / `CRON_SECRET`.

Hotel workflows (reservations, check-in/out, invoice create, payment settle) never wait on Zoho.
Retries use exponential backoff; exhaustion marks Connected Apps health as needs attention.

## Stay Connect
Do not auto-connect Stay Connect’s Zoho account or export its history for QA.
Synthetic properties only until an explicit operator action.
