import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

process.env.SENA_TEST_DATABASE_URL =
  process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@127.0.0.1:5432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL =
  process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://production.invalid/sena_prod';
requireIsolatedTestDatabase();
process.env.SENA_INTEGRATION_ENCRYPTION_KEY ||= '55'.repeat(32);
delete process.env.RESEND_API_KEY;

async function run() {
  const database = await import('../packages/database/src/index');
  const { db, organizations, properties, users, guests, eq, sql } = database;
  const platform = await import('../apps/dashboard/src/lib/integrations/platform/index');
  const comms = await import('../apps/dashboard/src/lib/integrations/communications/messages');

  const ids = {
    organization: '33000000-0000-4000-8000-000000000001',
    user: '33000000-0000-4000-8000-000000000002',
    property: '33000000-0000-4000-8000-000000000003',
    guest: '33000000-0000-4000-8000-000000000004',
  };

  await platform.ensureConnectedAppsPlatformSchema();
  await db.execute(sql`delete from guest_messages where property_id = ${ids.property}`);
  await db.execute(sql`delete from guests where property_id = ${ids.property}`);
  await db.execute(sql`delete from integrations where property_id = ${ids.property}`);
  await db.delete(organizations).where(eq(organizations.id, ids.organization));
  await db.delete(users).where(eq(users.id, ids.user));

  await db.insert(users).values({ id: ids.user, email: 'comms-owner@qa.invalid', fullName: 'Comms QA' });
  await db.insert(organizations).values({ id: ids.organization, name: 'Comms QA Org', slug: 'comms-qa-org' });
  await db.insert(properties).values({
    id: ids.property,
    organizationId: ids.organization,
    name: 'Comms QA Hotel',
    slug: 'comms-qa-hotel',
    code: 'CQH',
    address: 'QA',
    phone: '+2340000000401',
    email: 'hotel@comms-qa.invalid',
  });
  await db.insert(guests).values({
    id: ids.guest,
    organizationId: ids.organization,
    propertyId: ids.property,
    fullName: 'Chi Guest',
    email: 'chi@comms-qa.invalid',
    phone: '+2340000000402',
  });

  const templates = await comms.listGuestMessageTemplates(ids.property);
  assert(templates.some((row) => row.templateKey === 'booking_confirmation'));

  const msg1 = await comms.sendGuestMessage({
    propertyId: ids.property,
    guestId: ids.guest,
    channel: 'email',
    template: 'booking_confirmation',
    variables: { reservationRef: 'COMMS-1', checkIn: '2033-01-01', checkOut: '2033-01-03' },
    idempotencyKey: 'comms-msg-1',
  });
  assert.equal(msg1.status, 'sent');
  const msg2 = await comms.sendGuestMessage({
    propertyId: ids.property,
    guestId: ids.guest,
    channel: 'email',
    template: 'booking_confirmation',
    variables: { reservationRef: 'COMMS-1', checkIn: '2033-01-01', checkOut: '2033-01-03' },
    idempotencyKey: 'comms-msg-1',
  });
  assert.equal(msg2.id, msg1.id);

  const wa = await comms.sendGuestMessage({
    propertyId: ids.property,
    guestId: ids.guest,
    channel: 'whatsapp',
    template: 'check_in',
    idempotencyKey: 'comms-wa-1',
  });
  assert.equal(wa.status, 'failed');
  assert.match(String(wa.lastError), /ACTION_REQUIRED/);

  const truth = comms.whatsappConnectionTruth(null);
  assert.equal(truth.connectionStatus, 'disconnected');
  const attention = comms.whatsappConnectionTruth({ status: 'connecting', metadata: { metaApprovalRequired: true } });
  assert.equal(attention.connectionStatus, 'needs_attention');
  assert.equal(attention.actionRequired, true);

  console.log('PASS communications message log, templates, WhatsApp ACTION_REQUIRED');
  console.log('COMMUNICATIONS TESTS: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
