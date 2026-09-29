import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

process.env.SENA_TEST_DATABASE_URL =
  process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@127.0.0.1:5432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL =
  process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://production.invalid/sena_prod';
requireIsolatedTestDatabase();
process.env.SENA_INTEGRATION_ENCRYPTION_KEY ||= '33'.repeat(32);
process.env.SENA_ZOHO_INVOICE_CLIENT_ID ||= 'zoho-test-client';
process.env.SENA_ZOHO_INVOICE_CLIENT_SECRET ||= 'zoho-test-secret';

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
      metadata: {
        apiDomain: 'https://www.zohoapis.com',
        organizationId: 'org-1',
        organizationName: 'QA Org',
        syncEnabled: true,
        location: 'us',
        accountsDomain: 'https://accounts.zoho.com',
      },
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, zohoIntegration.id));

  assert.equal(zoho.accountsBaseFromMetadata({ location: 'eu' }), 'https://accounts.zoho.eu');
  assert.equal(zoho.accountsBaseFromMetadata({ location: 'in' }), 'https://accounts.zoho.in');
  assert.equal(zoho.zohoApiBaseFromMetadata({ apiDomain: 'https://www.zohoapis.in' }), 'https://www.zohoapis.in/invoice/v3');
  console.log('PASS regional accounts/api domain mapping');

  const originalFetch = globalThis.fetch;
  let contactCreates = 0;
  let invoiceCreates = 0;
  let lastContactCreateBody: any = null;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    if (url.includes('/oauth/v2/token') && method === 'POST') {
      return new Response(JSON.stringify({ access_token: 'zoho-access-refreshed', expires_in: 3600, api_domain: 'https://www.zohoapis.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/contacts') && method === 'GET') {
      return new Response(JSON.stringify({ contacts: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/contacts') && (method === 'POST' || method === 'PUT')) {
      if (method === 'POST') {
        contactCreates += 1;
        lastContactCreateBody = JSON.parse(String(init?.body || '{}'));
      }
      return new Response(JSON.stringify({ contact: { contact_id: 'z-contact-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/invoices') && (method === 'POST' || method === 'PUT')) {
      if (method === 'POST') invoiceCreates += 1;
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
        JSON.stringify({
          organizations: [
            { organization_id: 'org-1', name: 'QA Org', currency_code: 'NGN' },
            { organization_id: 'org-2', name: 'Other Org', currency_code: 'USD' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const orgs = await zoho.listZohoOrganizations(ids.property);
  assert.equal(orgs.length, 2);
  assert.equal(orgs[0]?.organizationId, 'org-1');

  const contact = await zoho.syncZohoContact(ids.property, ids.guest);
  assert.equal(contact.contactId, 'z-contact-1');
  assert.equal(lastContactCreateBody?.email, 'ada@zoho-qa.invalid');
  assert.equal(lastContactCreateBody?.contact_persons?.[0]?.email, 'ada@zoho-qa.invalid');
  assert.equal(lastContactCreateBody?.contact_persons?.[0]?.is_primary_contact, true);
  const contactAgain = await zoho.syncZohoContact(ids.property, ids.guest);
  assert.equal(contactAgain.contactId, 'z-contact-1');
  assert.equal(contactCreates, 1, 'must not create duplicate Zoho contacts');
  console.log('PASS contact mapping + duplicate contact protection + contact_persons email');

  const invoice = await zoho.syncZohoInvoice(ids.property, ids.invoice);
  assert.equal(invoice.invoiceId, 'z-inv-1');
  const invoiceAgain = await zoho.syncZohoInvoice(ids.property, ids.invoice);
  assert.equal(invoiceAgain.invoiceId, 'z-inv-1');
  assert.equal(invoiceCreates, 1, 'must not create duplicate Zoho invoices');
  console.log('PASS invoice sync + duplicate invoice protection');

  // Paid Zoho invoices reject edits — remapping must not fail (mapping stays authoritative).
  let rejectPaidInvoicePut = true;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    if (url.includes('/oauth/v2/token') && method === 'POST') {
      return new Response(JSON.stringify({ access_token: 'zoho-access-refreshed', expires_in: 3600, api_domain: 'https://www.zohoapis.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/contacts') && method === 'GET') {
      return new Response(JSON.stringify({ contacts: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/contacts') && (method === 'POST' || method === 'PUT')) {
      if (method === 'POST') {
        contactCreates += 1;
        lastContactCreateBody = JSON.parse(String(init?.body || '{}'));
      }
      return new Response(JSON.stringify({ contact: { contact_id: 'z-contact-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/invoices/') && method === 'PUT' && rejectPaidInvoicePut) {
      return new Response(JSON.stringify({ code: 110701, message: 'Invoice cannot be edited' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/invoices') && (method === 'POST' || method === 'PUT')) {
      if (method === 'POST') invoiceCreates += 1;
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
        JSON.stringify({
          organizations: [
            { organization_id: 'org-1', name: 'QA Org', currency_code: 'NGN' },
            { organization_id: 'org-2', name: 'Other Org', currency_code: 'USD' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  const paidInvoiceAgain = await zoho.syncZohoInvoice(ids.property, ids.invoice);
  assert.equal(paidInvoiceAgain.invoiceId, 'z-inv-1');
  console.log('PASS paid Zoho invoice remapping tolerates 110701');
  rejectPaidInvoicePut = false;

  const payment = await zoho.syncZohoPayment(ids.property, ids.payment);
  assert.equal(payment.paymentId, 'z-pay-1');
  const paymentAgain = await zoho.syncZohoPayment(ids.property, ids.payment);
  assert.equal(paymentAgain.duplicate, true);
  console.log('PASS Zoho contact/invoice/payment sync + payment idempotency');

  const paymentRow = await db.query.payments.findFirst({ where: eq(payments.id, ids.payment) });
  assert.equal(paymentRow?.status, 'successful');
  assert.equal(paymentRow?.amountMinorUnits, 100000);
  console.log('PASS Zoho payment sync does not mutate Sena settlement');

  await zoho.setZohoSyncEnabled(ids.property, ids.user, false);
  const disabledQueue = await zoho.maybeQueueZohoInvoiceExport(ids.property, ids.invoice);
  assert.equal(disabledQueue, null);
  console.log('PASS disable sync stops new outbound enqueue');

  await zoho.setZohoSyncEnabled(ids.property, ids.user, true);
  const queued = await zoho.maybeQueueZohoInvoiceExport(ids.property, ids.invoice);
  assert.ok(queued?.id);
  const queuedAgain = await zoho.maybeQueueZohoInvoiceExport(ids.property, ids.invoice);
  assert.equal(queuedAgain?.id, queued?.id, 'invoice export enqueue is idempotent');
  console.log('PASS background enqueue + idempotent job');

  const status = await zoho.getZohoInvoiceSyncStatus(ids.property, ids.invoice);
  assert.equal(status.status, 'synced');
  assert.ok(status.invoiceUrl?.includes('z-inv-1'));
  console.log('PASS invoice UI sync status');

  // Token refresh path
  await platform.upsertOAuthTokens({
    integrationId: zohoIntegration.id,
    accessToken: 'zoho-access-expired',
    refreshToken: 'zoho-refresh',
    expiresAt: new Date(Date.now() - 60_000),
  });
  const ctx = await zoho.getZohoAccessContext(ids.property);
  assert.equal(ctx.tokens.accessToken, 'zoho-access-refreshed');
  console.log('PASS token refresh');

  await platform.disconnectOAuthIntegration({
    propertyId: ids.property,
    provider: 'zoho_invoice',
    actorUserId: ids.user,
  });
  const mappingStill = await platform.findMappingBySenaObject({
    integrationId: zohoIntegration.id,
    senaObjectType: 'invoice',
    senaObjectId: ids.invoice,
  });
  assert.ok(mappingStill?.externalObjectId);
  const invoiceStill = await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, ids.invoice) });
  assert.equal(invoiceStill?.invoiceNumber, 'INV-ZOHO-QA-1');
  console.log('PASS disconnect preserves mappings and Sena invoices');

  // Reconnect without duplicating mapped invoice
  const reconnected = await platform.markIntegrationAuthorized({
    propertyId: ids.property,
    provider: 'zoho_invoice',
    category: 'accounting',
    actorUserId: ids.user,
    accountLabel: 'Zoho QA',
    environment: 'https://www.zohoapis.com',
    accountMetadata: { apiDomain: 'https://www.zohoapis.com', organizationId: 'org-1', syncEnabled: true },
  });
  await platform.upsertOAuthTokens({
    integrationId: reconnected.id,
    accessToken: 'zoho-access-2',
    refreshToken: 'zoho-refresh-2',
    expiresAt: new Date(Date.now() + 3600_000),
  });
  await db
    .update(integrations)
    .set({
      metadata: { apiDomain: 'https://www.zohoapis.com', organizationId: 'org-1', syncEnabled: true },
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, reconnected.id));
  invoiceCreates = 0;
  const afterReconnect = await zoho.syncZohoInvoice(ids.property, ids.invoice);
  assert.equal(afterReconnect.invoiceId, 'z-inv-1');
  assert.equal(invoiceCreates, 0, 'reconnect must update mapped invoice, not create another');
  console.log('PASS reconnect without duplicates');

  zoho.registerZohoSyncHandlers();
  const handlers = (globalThis as any).__senaSyncHandlers;
  assert.equal(typeof handlers['zoho_invoice:contact_sync'], 'function');
  console.log('PASS Zoho sync handlers registered');

  // Disconnected manage snapshot must not throw — UI needs Connect CTA.
  await db.execute(sql`delete from integration_oauth_tokens where integration_id in (select id from integrations where property_id = ${ids.property})`);
  await db.execute(sql`delete from integrations where property_id = ${ids.property}`);
  const disconnected = await zoho.getZohoManageState(ids.property);
  assert.equal(disconnected.connectionStatus, 'disconnected');
  assert.deepEqual(disconnected.organizations, []);
  assert.equal(disconnected.syncEnabled, false);
  assert.equal(disconnected.selectedOrganizationId, null);
  console.log('PASS disconnected Zoho manage state');

  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve(process.cwd());
  assert.equal(fs.existsSync(path.join(root, 'apps/dashboard/src/app/api/apps/zoho_invoice/route.ts')), false);
  assert.equal(fs.existsSync(path.join(root, 'apps/dashboard/src/app/api/apps/zoho_invoice/manage/route.ts')), true);
  const panel = fs.readFileSync(path.join(root, 'apps/dashboard/src/components/connected-app-detail-panel.tsx'), 'utf8');
  assert.match(panel, /fetch\(`\/api\/apps\/\$\{provider\}`/);
  assert.match(panel, /\/api\/apps\/zoho_invoice\/manage/);
  assert.doesNotMatch(panel, /fetch\('\/api\/apps\/zoho_invoice'/);
  console.log('PASS Zoho detail route no longer shadowed');

  // Callback token exchange must include PKCE verifier and honor Zoho user DC.
  assert.equal(zoho.accountsBaseForLocation('eu'), 'https://accounts.zoho.eu');
  assert.equal(zoho.accountsBaseForLocation('in'), 'https://accounts.zoho.in');
  assert.equal(zoho.accountsBaseForLocation(null), 'https://accounts.zoho.com');
  const tokenBody = zoho.buildZohoAuthorizationCodeTokenBody({
    code: 'auth-code',
    redirectUri: 'https://app.sena.ng/api/apps/oauth/callback',
    clientId: 'client',
    clientSecret: 'secret',
    codeVerifier: 'verifier-value',
  });
  assert.equal(tokenBody.get('grant_type'), 'authorization_code');
  assert.equal(tokenBody.get('code_verifier'), 'verifier-value');
  assert.equal(tokenBody.get('redirect_uri'), 'https://app.sena.ng/api/apps/oauth/callback');
  const withoutPkce = zoho.buildZohoAuthorizationCodeTokenBody({
    code: 'auth-code',
    redirectUri: 'https://app.sena.ng/api/apps/oauth/callback',
    clientId: 'client',
    clientSecret: 'secret',
  });
  assert.equal(withoutPkce.get('code_verifier'), null);
  console.log('PASS Zoho token exchange PKCE + regional accounts base');

  // Org list must surface API business errors and regional API hosts.
  assert.equal(zoho.zohoApiBaseFromMetadata({ location: 'eu' }), 'https://www.zohoapis.eu/invoice/v3');
  assert.equal(zoho.zohoApiBaseFromMetadata({ apiDomain: 'https://www.zohoapis.in' }), 'https://www.zohoapis.in/invoice/v3');
  const originalFetch2 = globalThis.fetch;
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    if (url.includes('/organizations')) {
      return new Response(JSON.stringify({ code: 5, message: 'Invalid URL Passed' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return originalFetch2(input);
  }) as typeof fetch;
  // Re-seed connected zoho with tokens for manage-state org fetch
  const zohoIntegration2 = await platform.markIntegrationAuthorized({
    propertyId: ids.property,
    provider: 'zoho_invoice',
    category: 'accounting',
    actorUserId: ids.user,
    accountLabel: 'Zoho QA',
    environment: 'https://www.zohoapis.com',
    accountMetadata: { apiDomain: 'https://www.zohoapis.com', organizationId: undefined, location: 'us' },
  });
  await platform.upsertOAuthTokens({
    integrationId: zohoIntegration2.id,
    accessToken: 'zoho-access',
    refreshToken: 'zoho-refresh',
    expiresAt: new Date(Date.now() + 3600_000),
    accountMetadata: { apiDomain: 'https://www.zohoapis.com', location: 'us' },
  });
  const manageFailed = await zoho.getZohoManageState(ids.property);
  assert.equal(manageFailed.connectionStatus, 'connected');
  assert.deepEqual(manageFailed.organizations, []);
  assert.equal(manageFailed.organizationsError, 'ZOHO_API_5');
  globalThis.fetch = originalFetch2;
  console.log('PASS Zoho organizations fetch surfaces API errors');

  // UI must not hide org selection when list is empty.
  const panelSource = fs.readFileSync(path.join(root, 'apps/dashboard/src/components/connected-app-detail-panel.tsx'), 'utf8');
  assert.match(panelSource, /zohoOrgsEmpty/);
  assert.match(panelSource, /zohoOrgsRetry/);
  assert.match(panelSource, /loadZohoManage/);
  assert.match(panelSource, /organizationsError/);
  console.log('PASS Zoho organization picker always rendered when connected');

  globalThis.fetch = originalFetch;
  console.log('ZOHO INVOICE TESTS: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
