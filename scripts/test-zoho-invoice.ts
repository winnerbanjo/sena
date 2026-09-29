import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

process.env.SENA_TEST_DATABASE_URL =
  process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@127.0.0.1:5432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL =
  process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://production.invalid/sena_prod';
requireIsolatedTestDatabase();
process.env.SENA_INTEGRATION_ENCRYPTION_KEY ||= '33'.repeat(32);

async function run() {
  const database = await import('../packages/database/src/index');
  const { db, organizations, properties, users, guests, propertyInvoices, payments, reservations, roomTypes, integrations, eq, sql } =
    database;
  const platform = await import('../apps/dashboard/src/lib/integrations/platform/index');
  const zoho = await import('../apps/dashboard/src/lib/integrations/zoho/invoice');

  const ids = {
    organization: '31000000-0000-4000-8000-000000000001',
    user: '31000000-0000-4000-8000-000000000002',
    property: '31000000-0000-4000-8000-000000000003',
    guest: '31000000-0000-4000-8000-000000000004',
    roomType: '31000000-0000-4000-8000-000000000005',
    reservation: '31000000-0000-4000-8000-000000000006',
    invoice: '31000000-0000-4000-8000-000000000007',
    payment: '31000000-0000-4000-8000-000000000008',
  };

  await platform.ensureConnectedAppsPlatformSchema();
  await db.execute(sql`delete from integration_sync_jobs where property_id = ${ids.property}`);
  await db.execute(sql`delete from integration_external_objects where property_id = ${ids.property}`);
  await db.execute(sql`delete from integration_oauth_tokens where integration_id in (select id from integrations where property_id = ${ids.property})`);
  await db.execute(sql`delete from integration_audit_logs where property_id = ${ids.property}`);
  await db.execute(sql`delete from payments where property_id = ${ids.property} or id = ${ids.payment}`);
  await db.execute(sql`delete from property_invoices where property_id = ${ids.property} or id = ${ids.invoice}`);
  await db.execute(sql`delete from reservations where property_id = ${ids.property}`);
  await db.execute(sql`delete from room_types where property_id = ${ids.property}`);
  await db.execute(sql`delete from guests where property_id = ${ids.property}`);
  await db.execute(sql`delete from integrations where property_id = ${ids.property}`);
  await db.delete(organizations).where(eq(organizations.id, ids.organization));
  await db.delete(users).where(eq(users.id, ids.user));

  await db.insert(users).values({ id: ids.user, email: 'zoho-owner@qa.invalid', fullName: 'Zoho QA' });
  await db.insert(organizations).values({ id: ids.organization, name: 'Zoho QA Org', slug: 'zoho-qa-org' });
  await db.insert(properties).values({
    id: ids.property,
    organizationId: ids.organization,
    name: 'Zoho QA Hotel',
    slug: 'zoho-qa-hotel',
    code: 'ZQH',
    address: 'QA',
    phone: '+2340000000201',
    email: 'hotel@zoho-qa.invalid',
  });
  await db.insert(guests).values({
    id: ids.guest,
    organizationId: ids.organization,
    propertyId: ids.property,
    fullName: 'Ada Guest',
    email: 'ada@zoho-qa.invalid',
    phone: '+2340000000202',
  });
  await db.insert(roomTypes).values({ id: ids.roomType, propertyId: ids.property, name: 'Deluxe', bedType: 'King', basePriceMinorUnits: 50000 });
  await db.insert(reservations).values({
    id: ids.reservation,
    reference: 'ZOHO-RES-1',
    propertyId: ids.property,
    guestId: ids.guest,
    roomTypeId: ids.roomType,
    checkInDate: '2031-01-01',
    checkOutDate: '2031-01-03',
    nights: 2,
    totalAmountMinorUnits: 100000,
    status: 'confirmed',
  });
  await db.insert(propertyInvoices).values({
    id: ids.invoice,
    propertyId: ids.property,
    organizationId: ids.organization,
    guestId: ids.guest,
    reservationId: ids.reservation,
    invoiceNumber: 'INV-ZOHO-QA-1',
    recipientName: 'Ada Guest',
    recipientEmail: 'ada@zoho-qa.invalid',
    issueDate: '2031-01-01',
    dueDate: '2031-01-05',
    totalAmountMinorUnits: 100000,
    items: [{ id: 'line-1', description: 'Deluxe stay', category: 'room', quantity: 2, unitPriceMinorUnits: 50000, totalMinorUnits: 100000 }],
  });
  await db.insert(payments).values({
    id: ids.payment,
    propertyId: ids.property,
    invoiceId: ids.invoice,
    reservationId: ids.reservation,
    amountMinorUnits: 100000,
    currency: 'NGN',
    provider: 'manual',
    method: 'cash',
    status: 'successful',
    paidAt: new Date('2031-01-01T12:00:00Z'),
  });

  const zohoIntegration = await platform.markIntegrationAuthorized({
    propertyId: ids.property,
    provider: 'zoho_invoice',
    category: 'accounting',
    actorUserId: ids.user,
    accountLabel: 'Zoho QA',
    environment: 'https://www.zohoapis.com',
    accountMetadata: { apiDomain: 'https://www.zohoapis.com', organizationId: 'org-1' },
  });
  await platform.upsertOAuthTokens({
    integrationId: zohoIntegration.id,
    accessToken: 'zoho-access',
    refreshToken: 'zoho-refresh',
    expiresAt: new Date(Date.now() + 3600_000),
  });
  await db
    .update(integrations)
    .set({
      metadata: { apiDomain: 'https://www.zohoapis.com', organizationId: 'org-1' },
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, zohoIntegration.id));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    if (url.includes('/contacts') && method === 'GET') {
      return new Response(JSON.stringify({ contacts: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/contacts') && (method === 'POST' || method === 'PUT')) {
      return new Response(JSON.stringify({ contact: { contact_id: 'z-contact-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/invoices') && (method === 'POST' || method === 'PUT')) {
      return new Response(JSON.stringify({ invoice: { invoice_id: 'z-inv-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/customerpayments') && method === 'POST') {
      return new Response(JSON.stringify({ payment: { payment_id: 'z-pay-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/organizations')) {
      return new Response(
        JSON.stringify({ organizations: [{ organization_id: 'org-1', name: 'QA Org', currency_code: 'NGN' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const orgs = await zoho.listZohoOrganizations(ids.property);
  assert.equal(orgs[0]?.organizationId, 'org-1');

  const contact = await zoho.syncZohoContact(ids.property, ids.guest);
  assert.equal(contact.contactId, 'z-contact-1');
  const invoice = await zoho.syncZohoInvoice(ids.property, ids.invoice);
  assert.equal(invoice.invoiceId, 'z-inv-1');
  const payment = await zoho.syncZohoPayment(ids.property, ids.payment);
  assert.equal(payment.paymentId, 'z-pay-1');
  const paymentAgain = await zoho.syncZohoPayment(ids.property, ids.payment);
  assert.equal(paymentAgain.duplicate, true);
  console.log('PASS Zoho contact/invoice/payment sync + payment idempotency');

  const paymentRow = await db.query.payments.findFirst({ where: eq(payments.id, ids.payment) });
  assert.equal(paymentRow?.status, 'successful');
  assert.equal(paymentRow?.amountMinorUnits, 100000);
  console.log('PASS Zoho payment sync does not mutate Sena settlement');

  zoho.registerZohoSyncHandlers();
  const handlers = (globalThis as any).__senaSyncHandlers;
  assert.equal(typeof handlers['zoho_invoice:contact_sync'], 'function');
  console.log('PASS Zoho sync handlers registered');

  globalThis.fetch = originalFetch;
  console.log('ZOHO INVOICE TESTS: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
