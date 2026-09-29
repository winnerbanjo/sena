# Zoho Books Connected App

## Authority
Sena remains the operational source of truth for guests, invoices, and payment settlement.
Zoho Books is an outbound accounting destination. Zoho never settles or authorizes Sena payments.
Zoho responses must not mutate reservation paid amounts, folio balances, or the Sena payment ledger.

## Relationship to Zoho Invoice
Zoho Books reuses Connected Apps platform primitives (OAuth state, encrypted tokens, sync queue, mappings, audit)
and Zoho multi-DC exchange helpers. It is a **separate provider** (`zoho_books`) with separate tokens, mappings, and jobs.
Zoho Invoice paths are unchanged.

## OAuth
- Official Zoho OAuth 2.0 (`/oauth/v2/auth` + `/oauth/v2/token`)
- Scopes: `ZohoBooks.contacts.*`, `ZohoBooks.invoices.*`, `ZohoBooks.customerpayments.*`, `ZohoBooks.settings.READ`
- Multi-DC: token `api_domain` + `location` + persisted `accountsDomain` for refresh
- API base: `{apiDomain}/books/v3`
- Org header: `X-com-zoho-books-organizationid`
- Env (preferred): `SENA_ZOHO_BOOKS_CLIENT_ID`, `SENA_ZOHO_BOOKS_CLIENT_SECRET`
- Fallback: Invoice client env vars when the same Zoho API Console app holds both products
- Redirect: `{SENA_PUBLIC_APP_ORIGIN}/api/apps/oauth/callback`
- Tokens encrypted at rest; never returned to the client
- OAuth state is one-time, property+actor bound

## Connection model (property-scoped)
1. Connect Zoho Books (OAuth) → **Connected**
2. Select organization (never auto-pick first) → stores org id/name; **sync stays off**
3. Optionally choose a Zoho Books cash/bank deposit account for payments
4. Turn invoice sync on → **Enabled** for NEW outbound sync only
5. Disconnect clears tokens; mappings + audit + Sena financial history preserved

CONNECTED ≠ ENABLED. Org selection does **not** auto-enable Books sync.

## Payment account mapping
`account_id` on Zoho Books customer payments is optional per Zoho API.
Sena never invents a deposit account. Operators may set one explicitly; otherwise Zoho Books uses the organization default.

## Sync objects
| Sena | Zoho Books |
|------|------------|
| Guest | Contact (email match before create; mapping authoritative) |
| Invoice | Invoice (Sena invoice number kept as reference) |
| Verified payment | Customer payment (bookkeeping only; idempotent) |

Historical invoices are **not** exported on connect. New invoices enqueue after enablement.

## Background jobs
`POST /api/cron/connected-apps-sync` with `SENA_SYNC_CRON_SECRET` / `CRON_SECRET`.
Handlers registered as `zoho_books:*` alongside Invoice handlers.
