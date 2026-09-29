# Guest communications + WhatsApp

## Core
`sendGuestMessage({ propertyId, guestId, channel, template, variables, idempotencyKey })`
- Channels: email | whatsapp | sms
- Templates are property-scoped with system defaults (`guest_message_templates`)
- Automation never auto-sends unless `automation_enabled` is explicitly true on a template
- Message log: `guest_messages` with idempotency, status, and failure reason

## API
- `GET/POST /api/apps/messages` — list templates/messages; send (owner-only)

## WhatsApp
Official Meta WhatsApp Business Platform only.
Until Meta approval + phone number ID are configured:
- OAuth start returns `ACTION_REQUIRED` / `WHATSAPP_META_APPROVAL_REQUIRED`
- Sends fail with ACTION_REQUIRED (never fake Connected)
- Env: `SENA_WHATSAPP_CLIENT_ID`, `SENA_WHATSAPP_CLIENT_SECRET`, `SENA_WHATSAPP_META_APPROVED=true` after approval
