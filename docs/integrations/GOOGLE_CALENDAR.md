# Google Calendar Connected App

## Authority
Sena is authoritative for reservations. Sync is outbound-first.
Inbound Google push notifications only enqueue reconciliation — they never invent Sena reservations.

## OAuth
- Least-privilege scope: `https://www.googleapis.com/auth/calendar.events`
- Env: `SENA_GOOGLE_CALENDAR_CLIENT_ID`, `SENA_GOOGLE_CALENDAR_CLIENT_SECRET`
- Redirect: `{SENA_PUBLIC_APP_ORIGIN}/api/apps/oauth/callback`

## Operator flow
1. Connect from Connected Apps → Google Calendar
2. Select calendar (`GET/POST /api/apps/google_calendar`)
3. Optional: enable push watch (requires public HTTPS origin)
4. Sync Now / reservation events create, update, or delete calendar events

## Privacy
Event payloads include guest display name, reservation reference, dates, room type, and status — never email, phone, or payment details.

## Webhook
`POST /api/webhooks/google-calendar/[integrationId]` validates channel token hash from encrypted metadata.
