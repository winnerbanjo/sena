import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

process.env.SENA_TEST_DATABASE_URL =
  process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@127.0.0.1:5432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL =
  process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://production.invalid/sena_prod';
requireIsolatedTestDatabase();
process.env.SENA_INTEGRATION_ENCRYPTION_KEY ||= '44'.repeat(32);
process.env.SENA_GOOGLE_CALENDAR_CLIENT_ID ||= 'google-test-client';
process.env.SENA_GOOGLE_CALENDAR_CLIENT_SECRET ||= 'google-test-secret';
process.env.SENA_PUBLIC_APP_ORIGIN ||= 'https://app.sena.invalid';

async function run() {
  const database = await import('../packages/database/src/index');
  const { db, organizations, properties, users, guests, reservations, roomTypes, integrations, eq, sql } = database;
  const platform = await import('../apps/dashboard/src/lib/integrations/platform/index');
  const gcal = await import('../apps/dashboard/src/lib/integrations/google/calendar');

  const ids = {
    organization: '32000000-0000-4000-8000-000000000001',
    user: '32000000-0000-4000-8000-000000000002',
    property: '32000000-0000-4000-8000-000000000003',
    guest: '32000000-0000-4000-8000-000000000004',
    roomType: '32000000-0000-4000-8000-000000000005',
    reservation: '32000000-0000-4000-8000-000000000006',
  };

  await platform.ensureConnectedAppsPlatformSchema();
  await db.execute(sql`delete from integration_sync_jobs where property_id = ${ids.property}`);
  await db.execute(sql`delete from integration_external_objects where property_id = ${ids.property}`);
  await db.execute(sql`delete from integration_oauth_tokens where integration_id in (select id from integrations where property_id = ${ids.property})`);
  await db.execute(sql`delete from integration_audit_logs where property_id = ${ids.property}`);
  await db.execute(sql`delete from reservations where property_id = ${ids.property}`);
  await db.execute(sql`delete from room_types where property_id = ${ids.property}`);
  await db.execute(sql`delete from guests where property_id = ${ids.property}`);
  await db.execute(sql`delete from integrations where property_id = ${ids.property}`);
  await db.delete(organizations).where(eq(organizations.id, ids.organization));
  await db.delete(users).where(eq(users.id, ids.user));

  await db.insert(users).values({ id: ids.user, email: 'gcal-owner@qa.invalid', fullName: 'GCal QA' });
  await db.insert(organizations).values({ id: ids.organization, name: 'GCal QA Org', slug: 'gcal-qa-org' });
  await db.insert(properties).values({
    id: ids.property,
    organizationId: ids.organization,
    name: 'GCal QA Hotel',
    slug: 'gcal-qa-hotel',
    code: 'GQH',
    address: 'QA',
    phone: '+2340000000301',
    email: 'hotel@gcal-qa.invalid',
    timezone: 'Africa/Lagos',
    checkInTime: '14:00',
    checkOutTime: '11:00',
  });
  await db.insert(guests).values({
    id: ids.guest,
    organizationId: ids.organization,
    propertyId: ids.property,
    fullName: 'Bola Guest',
    email: 'bola@gcal-qa.invalid',
    phone: '+2340000000302',
  });
  await db.insert(roomTypes).values({
    id: ids.roomType,
    propertyId: ids.property,
    name: 'Suite',
    bedType: 'King',
    basePriceMinorUnits: 80000,
  });
  await db.insert(reservations).values({
    id: ids.reservation,
    reference: 'GCAL-RES-1',
    propertyId: ids.property,
    guestId: ids.guest,
    roomTypeId: ids.roomType,
    checkInDate: '2032-02-01',
    checkOutDate: '2032-02-04',
    nights: 3,
    totalAmountMinorUnits: 240000,
    status: 'confirmed',
    paymentStatus: 'pay_later',
    source: 'direct',
    numGuests: 2,
  });

  const integration = await platform.markIntegrationAuthorized({
    propertyId: ids.property,
    provider: 'google_calendar',
    category: 'calendar',
    actorUserId: ids.user,
    accountLabel: 'gcal-owner@qa.invalid',
    accountMetadata: { accountEmail: 'gcal-owner@qa.invalid' },
  });
  await platform.upsertOAuthTokens({
    integrationId: integration.id,
    accessToken: 'google-access',
    refreshToken: 'google-refresh',
    expiresAt: new Date(Date.now() + 3600_000),
  });

  // Connected but not enabled / no calendar → queue must no-op
  const queuedDisabled = await gcal.maybeQueueGoogleReservationSync(ids.property, ids.reservation);
  assert.equal(queuedDisabled, null);
  console.log('PASS sync disabled until calendar selected + enabled');

  let lastEventBody: any = null;
  let eventCreates = 0;
  let eventPuts = 0;
  let eventDeletes = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    if (url.includes('oauth2.googleapis.com/token') && method === 'POST') {
      return new Response(
        JSON.stringify({ access_token: 'google-access-refreshed', expires_in: 3600 }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    if (url.includes('/users/me/calendarList')) {
      return new Response(
        JSON.stringify({
          items: [
            { id: 'cal-ops', summary: 'Hotel Ops', primary: false },
            { id: 'primary', summary: 'Primary', primary: true },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    if (url.includes('/events/watch') && method === 'POST') {
      return new Response(JSON.stringify({ resourceId: 'resource-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/calendars/') && url.includes('/events') && method === 'POST') {
      eventCreates += 1;
      lastEventBody = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify({ id: 'gcal-event-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/calendars/') && url.includes('/events/') && method === 'PUT') {
      eventPuts += 1;
      lastEventBody = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify({ id: 'gcal-event-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/calendars/') && url.includes('/events/') && method === 'DELETE') {
      eventDeletes += 1;
      return new Response(null, { status: 204 });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const calendars = await gcal.listGoogleCalendars(ids.property);
  assert.equal(calendars.length, 2);
  assert.equal(calendars[0]?.id, 'cal-ops');
  console.log('PASS calendar list');

  const selected = await gcal.selectGoogleCalendar(ids.property, ids.user, {
    calendarId: 'cal-ops',
    calendarName: 'Hotel Ops',
  });
  assert.equal(selected.calendarId, 'cal-ops');
  assert.equal(selected.syncEnabled, false);
  console.log('PASS calendar selection does not auto-enable sync');

  await assert.rejects(
    () => gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation),
    /GOOGLE_SYNC_DISABLED/
  );
  console.log('PASS sync blocked until enabled');

  await gcal.setGoogleCalendarSyncEnabled(ids.property, ids.user, true);
  assert.equal(gcal.isGoogleCalendarSyncEnabled(await platform.getPropertyIntegration(ids.property, 'google_calendar')), true);
  console.log('PASS sync enablement');

  const created = await gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation);
  assert.equal((created as any).eventId, 'gcal-event-1');
  assert.equal(eventCreates, 1);
  assert.equal(lastEventBody?.summary, 'Reservation · Bola Guest');
  assert.equal(lastEventBody?.start?.dateTime, '2032-02-01T14:00:00');
  assert.equal(lastEventBody?.end?.dateTime, '2032-02-04T11:00:00');
  assert.equal(lastEventBody?.start?.timeZone, 'Africa/Lagos');
  assert.ok(!String(lastEventBody?.description || '').includes('bola@gcal-qa.invalid'));
  console.log('PASS reservation create uses timed property timezone events');

  const updated = await gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation);
  assert.equal((updated as any).eventId, 'gcal-event-1');
  assert.equal((updated as any).updated, true);
  assert.equal(eventCreates, 1);
  assert.equal(eventPuts, 1);
  console.log('PASS reservation update reuses same event (idempotent)');

  await db.update(reservations).set({ status: 'checked_in', updatedAt: new Date() }).where(eq(reservations.id, ids.reservation));
  const checkedIn = await gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation);
  assert.equal((checkedIn as any).eventId, 'gcal-event-1');
  assert.match(String(lastEventBody?.description || ''), /checked_in/i);
  console.log('PASS check-in status updates same event');

  await db.update(reservations).set({ status: 'checked_out', updatedAt: new Date() }).where(eq(reservations.id, ids.reservation));
  const checkedOut = await gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation);
  assert.equal((checkedOut as any).eventId, 'gcal-event-1');
  console.log('PASS check-out status updates same event');

  await db.update(reservations).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(reservations.id, ids.reservation));
  const deleted = await gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation);
  assert.equal((deleted as any).deleted, true);
  assert.equal(eventDeletes, 1);
  // Retry cancel when already deleted
  const deletedAgain = await gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation);
  assert.equal((deletedAgain as any).deleted, true);
  console.log('PASS cancel deletes event + idempotent retry');

  await db.update(reservations).set({ status: 'confirmed', updatedAt: new Date() }).where(eq(reservations.id, ids.reservation));
  const restored = await gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation);
  assert.equal((restored as any).restored, true);
  assert.equal(eventCreates, 2);
  console.log('PASS restore after cancel creates one new event');

  const job1 = await gcal.maybeQueueGoogleReservationSync(ids.property, ids.reservation);
  const job2 = await gcal.maybeQueueGoogleReservationSync(ids.property, ids.reservation);
  assert.ok(job1?.id);
  assert.equal(job2?.id, job1?.id);
  console.log('PASS background enqueue idempotency');

  // Token refresh
  await platform.upsertOAuthTokens({
    integrationId: integration.id,
    accessToken: 'google-access-expired',
    refreshToken: 'google-refresh',
    expiresAt: new Date(Date.now() - 60_000),
  });
  const ctx = await gcal.getGoogleCalendarContext(ids.property);
  assert.equal(ctx.tokens.accessToken, 'google-access-refreshed');
  const stored = await platform.readOAuthTokens(integration.id);
  assert.ok(stored?.accessToken);
  console.log('PASS token refresh');

  // Calendar change disables sync (no silent historical dump)
  const changed = await gcal.selectGoogleCalendar(ids.property, ids.user, {
    calendarId: 'primary',
    calendarName: 'Primary',
  });
  assert.equal(changed.calendarChanged, true);
  assert.equal(changed.syncEnabled, false);
  console.log('PASS calendar change disables sync');

  // Disconnect preserves mappings
  await platform.disconnectOAuthIntegration({
    propertyId: ids.property,
    provider: 'google_calendar',
    actorUserId: ids.user,
  });
  const mappingStill = await platform.findMappingBySenaObject({
    integrationId: integration.id,
    senaObjectType: 'reservation',
    senaObjectId: ids.reservation,
  });
  assert.ok(mappingStill?.externalObjectId);
  const resStill = await db.query.reservations.findFirst({ where: eq(reservations.id, ids.reservation) });
  assert.equal(resStill?.status, 'confirmed');
  console.log('PASS disconnect preserves mappings and Sena reservations');

  // Reconnect + re-enable same calendar → no duplicate event
  await platform.markIntegrationAuthorized({
    propertyId: ids.property,
    provider: 'google_calendar',
    category: 'calendar',
    actorUserId: ids.user,
    accountLabel: 'gcal-owner@qa.invalid',
    accountMetadata: { accountEmail: 'gcal-owner@qa.invalid', calendarId: 'cal-ops', calendarName: 'Hotel Ops', syncEnabled: true, syncEnabledAt: new Date().toISOString() },
  });
  await platform.upsertOAuthTokens({
    integrationId: integration.id,
    accessToken: 'google-access',
    refreshToken: 'google-refresh',
    expiresAt: new Date(Date.now() + 3600_000),
  });
  const beforeCreates = eventCreates;
  const reconnectSync = await gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation);
  assert.equal((reconnectSync as any).eventId, mappingStill?.externalObjectId);
  assert.equal(eventCreates, beforeCreates);
  console.log('PASS reconnect without duplicates');

  gcal.registerGoogleCalendarSyncHandlers();
  const root = globalThis as typeof globalThis & { __senaSyncHandlers?: Record<string, unknown> };
  assert.ok(root.__senaSyncHandlers?.google_calendar);
  console.log('PASS Google Calendar sync handlers registered');

  const manage = await gcal.getGoogleCalendarManageState(ids.property);
  assert.equal(manage.connected, true);
  assert.ok(manage.calendars.length >= 1);
  console.log('PASS manage state');

  globalThis.fetch = originalFetch;
  console.log('GOOGLE CALENDAR TESTS: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
