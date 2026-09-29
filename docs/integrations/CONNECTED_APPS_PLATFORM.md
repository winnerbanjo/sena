# Connected Apps platform — architecture map (PR1)

## Scope
Extensible Connected Apps foundation for non-payment and payment-adjacent marketplace UX.
Paystack and Flutterwave stay on dedicated BYOP modules; this platform must not rewrite settlement.

## Reused primitives
- `integration_catalog`, `integrations`, `integration_credentials`, `integration_audit_logs`, `integration_webhook_events`
- AES-256-GCM helpers in `apps/dashboard/src/lib/integrations/crypto.ts`
- Property tenant resolution via `resolveTenantForRequest` + owner-only Connected Apps gates
- Existing Paystack / Flutterwave panels and webhook verification routes (untouched)

## New primitives (migration `0006_connected_apps_platform`)
- Catalog metadata: `logo_url`, `docs_url`, `capabilities`, `sort_order`
- Integration health: `health_status`, `environment`, `last_sync_at`, `last_sync_attempt_at`
- `integration_oauth_states` — CSRF state bound to property + provider + user + expiry
- `integration_oauth_tokens` — encrypted access/refresh tokens
- `integration_external_objects` — authoritative Sena ↔ external ID mappings
- `integration_sync_jobs` — queued sync with exponential backoff + dead-letter
- `guest_messages` / `guest_message_templates` — communications foundation (no auto-send)

## Status model
Connection: disconnected | connecting | connected | needs_attention | paused | error
Health: configured | awaiting_authorization | authorized | syncing | healthy | degraded | reauthorization_required | webhook_unverified | webhook_verified
A catalog/integration row alone is never shown as Connected.

## Isolation rules
- OAuth consume rejects property/provider/actor mismatches
- Sync jobs and mappings are property-scoped
- Admin health API returns no credentials
- Payment providers keep dedicated connect/webhook routes

## Sync
Jobs are processed by `/api/cron/connected-apps-sync` (secret-gated). Ordinary SSR/pages must not call providers.
