# Zoho Invoice Connected App

## Authority
Sena remains the operational source of truth for guests, invoices, and payment settlement.
Zoho Invoice is an outbound sync destination. Zoho never settles or authorizes Sena payments.

## OAuth
- Official Zoho OAuth 2.0 (`/oauth/v2/auth` + `/oauth/v2/token`)
- Multi-DC via `SENA_ZOHO_ACCOUNTS_BASE` / token `api_domain`
- Env: `SENA_ZOHO_INVOICE_CLIENT_ID`, `SENA_ZOHO_INVOICE_CLIENT_SECRET`
- Redirect: `{SENA_PUBLIC_APP_ORIGIN}/api/apps/oauth/callback`
- Tokens encrypted at rest; never returned to the client

## Operator flow
1. Connect from Connected Apps → Zoho Invoice (OAuth)
2. Select organization (`GET/POST /api/apps/zoho_invoice`)
3. Sync Now queues outbound jobs via the Connected Apps sync cron
4. Disconnect clears tokens; mappings and audit history are preserved

## Sync objects
| Sena | Zoho |
|------|------|
| Guest | Contact |
| Invoice | Invoice |
| Verified payment | Customer payment (bookkeeping only) |

Failures retry into dead-letter without blocking front desk or payment settlement.

## Cron
`POST /api/cron/connected-apps-sync` with `SENA_SYNC_CRON_SECRET` / `CRON_SECRET`.
