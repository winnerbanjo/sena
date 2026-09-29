# Google Calendar Connected App

## Authority
Sena is the source of truth for reservations. Google Calendar is an outbound operational view only.

Editing or deleting a Google Calendar event must never mutate Sena reservation dates, rooms, guests, payments, inventory, or check-in/out.

V1 is **Sena → Google Calendar** only. Inbound Google push notifications (optional watch) enqueue a bounded re-sync of known/recent reservations — they never invent Sena reservations.

## Connected vs Enabled
- **Connected**: Google OAuth tokens are valid for the property.
- **Enabled** (`metadata.syncEnabled`): Sena may create/update/delete Google events.

Requirements to enable sync:
1. OAuth connected
2. An explicit calendar selected (`metadata.calendarId`) — primary is never assumed

When sync is **disabled**:
- New outbound mutations stop
- Existing Google events are **left untouched**
- Sena reservations and mappings remain intact

## OAuth
- Scopes: `openid` `email` `profile` `https://www.googleapis.com/auth/calendar.readonly` `https://www.googleapis.com/auth/calendar.events`
- Env: `SENA_GOOGLE_CALENDAR_CLIENT_ID`, `SENA_GOOGLE_CALENDAR_CLIENT_SECRET`
- Redirect: `{SENA_PUBLIC_APP_ORIGIN}/api/apps/oauth/callback` (production: `https://app.sena.ng/api/apps/oauth/callback`)
- Property-bound OAuth state + PKCE; tokens encrypted at rest; refresh on expiry

## Operator flow
1. Connect from Connected Apps → Google Calendar
2. Select a calendar (`GET/POST /api/apps/google_calendar/manage`)
3. Enable reservation sync
4. New/updated reservations queue background jobs; Sync Now re-syncs mapped + recently changed stays since enablement (no historical dump)

## Event model
- Title: `Reservation · {Guest Name}`
- Timed event using **property** `checkInTime` / `checkOutTime` and **property timezone**
- Description includes reference, guest, room/type, status, payment status, source, guest count, and a safe Sena reservations URL
- One reservation → one Google event (create/update/status); cancel deletes the event (404/410 treated as success)

## Calendar change / reconnect
- Selecting a **different** calendar disables sync until re-enabled (no silent historical backfill)
- Existing mappings retain their original calendar ID; updates continue against the mapped calendar
- New reservations sync to the newly selected calendar after re-enable
- Reconnect reuses mappings — no duplicate events

## Privacy
No card data, payment credentials, emails, phones, or internal tokens in event payloads.

## Webhook (optional)
`POST /api/webhooks/google-calendar/[integrationId]` validates channel token hash from encrypted metadata and enqueues bounded reconcile.
