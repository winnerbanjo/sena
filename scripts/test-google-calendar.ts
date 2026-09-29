import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

process.env.SENA_TEST_DATABASE_URL =
  process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@127.0.0.1:5432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL =
  process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://production.invalid/sena_prod';
requireIsolatedTestDatabase();
process.env.SENA_INTEGRATION_ENCRYPTION_KEY ||= '44'.repeat(32);

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
  });
  await db.insert(guests).values({
    id: ids.guest,
    organizationId: ids.organization,
    propertyId: ids.property,
    fullName: 'Bola Guest',
    email: 'bola@gcal-qa.invalid',
    phone: '+2340000000302',
  });
  await db.insert(roomTypes).values({ id: ids.roomType, propertyId: ids.property, name: 'Suite', bedType: 'King', basePriceMinorUnits: 80000 });
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
  });

  const integration = await platform.markIntegrationAuthorized({
    propertyId: ids.property,
    provider: 'google_calendar',
    category: 'calendar',
    actorUserId: ids.user,
    accountLabel: 'Google QA',
    accountMetadata: { calendarId: 'primary' },
  });
  await platform.upsertOAuthTokens({
    integrationId: integration.id,
    accessToken: 'google-access',
    refreshToken: 'google-refresh',
    expiresAt: new Date(Date.now() + 3600_000),
  });
  await db
    .update(integrations)
    .set({ metadata: { calendarId: 'primary' }, updatedAt: new Date() })
    .where(eq(integrations.id, integration.id));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    if (url.includes('googleapis.com/calendar') && method === 'POST' && url.includes('/events/watch')) {
      return new Response(JSON.stringify({ resourceId: 'resource-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('googleapis.com/calendar') && method === 'POST') {
      return new Response(JSON.stringify({ id: 'gcal-event-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('googleapis.com/calendar') && method === 'PUT') {
      return new Response(JSON.stringify({ id: 'gcal-event-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('googleapis.com/calendar') && method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const created = await gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation);
  assert.equal((created as any).eventId, 'gcal-event-1');
  await db.update(reservations).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(reservations.id, ids.reservation));
  const deleted = await gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation);
  assert.equal((deleted as any).deleted, true);
  await db.update(reservations).set({ status: 'confirmed', updatedAt: new Date() }).where(eq(reservations.id, ids.reservation));
  const restored = await gcal.syncReservationToGoogleCalendar(ids.property, ids.reservation);
  assert.equal((restored as any).restored, true);
  console.log('PASS Google Calendar create/cancel/restore');

  process.env.SENA_PUBLIC_APP_ORIGIN = 'https://app.sena.invalid';
  const watch = await gcal.ensureGoogleCalendarWatch(ids.property, ids.user);
  assert.ok(watch.channelId);
  console.log('PASS Google Calendar push watch registration');

  const reconciled = await gcal.reconcileGoogleCalendar(ids.property);
  assert.ok(reconciled.synced >= 1);
  console.log('PASS Google Calendar reconciliation');

  globalThis.fetch = originalFetch;
  console.log('GOOGLE CALENDAR TESTS: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
