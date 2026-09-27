import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

requireIsolatedTestDatabase();
process.env.SENA_INTEGRATION_ENCRYPTION_KEY ||= '11'.repeat(32);

async function run() {
  const database = await import('../packages/database/src/index');
  const { db, guests, integrationAuditLogs, integrationCredentials, integrations, organizations, payments, paymentAttempts, properties, propertyInvoices, reservations, roomTypes, users, eq, sql } = database;
  const paystack = await import('../apps/dashboard/src/lib/integrations/paystack');
  const paymentFlow = await import('../apps/dashboard/src/lib/paystack-payments');
  const cryptoModule = await import('../apps/dashboard/src/lib/integrations/crypto');
  const ids = {
    organization: '10000000-0000-4000-8000-000000000001', user: '10000000-0000-4000-8000-000000000002',
    property: '10000000-0000-4000-8000-000000000003', otherProperty: '10000000-0000-4000-8000-000000000004',
    roomType: '10000000-0000-4000-8000-000000000005', guest: '10000000-0000-4000-8000-000000000006', reservation: '10000000-0000-4000-8000-000000000007',
  };
  await db.execute(sql`delete from payments where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from payment_attempts where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from integration_webhook_events where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from integration_audit_logs where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from integrations where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.delete(organizations).where(eq(organizations.id, ids.organization));
  await db.delete(users).where(eq(users.id, ids.user));
  await db.insert(users).values({ id: ids.user, email: 'owner@qa.invalid', fullName: 'QA Owner' });
  await db.insert(organizations).values({ id: ids.organization, name: 'Synthetic QA', slug: 'synthetic-paystack-qa' });
  await db.insert(properties).values([
    { id: ids.property, organizationId: ids.organization, name: 'Synthetic One', slug: 'synthetic-one', code: 'SYN1', address: 'QA only', phone: '+2340000000001', email: 'one@qa.invalid' },
    { id: ids.otherProperty, organizationId: ids.organization, name: 'Synthetic Two', slug: 'synthetic-two', code: 'SYN2', address: 'QA only', phone: '+2340000000002', email: 'two@qa.invalid' },
  ]);
  await db.insert(roomTypes).values({ id: ids.roomType, propertyId: ids.property, name: 'QA Room', bedType: 'Test', basePriceMinorUnits: 50000 });
  await db.insert(guests).values({ id: ids.guest, organizationId: ids.organization, propertyId: ids.property, fullName: 'Synthetic Guest', email: 'guest@qa.invalid', phone: '+2340000000003' });
  await db.insert(reservations).values({ id: ids.reservation, reference: 'SYN-BYOP-001', propertyId: ids.property, guestId: ids.guest, roomTypeId: ids.roomType, checkInDate: '2030-01-01', checkOutDate: '2030-01-02', nights: 1, totalAmountMinorUnits: 50000 });

  const plaintext = 'sk_test_synthetic_secret_1234';
  const encrypted = cryptoModule.encryptIntegrationSecret(plaintext);
  assert(!encrypted.includes(plaintext));
  assert.equal(cryptoModule.decryptIntegrationSecret(encrypted), plaintext);
  console.log('PASS AES-GCM credential round trip stores no plaintext');

  const verifyFetch = async () => new Response(JSON.stringify({ status: true, data: [{ currency: 'NGN', balance: 0 }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  await paystack.connectPaystack(ids.property, ids.user, plaintext, false, verifyFetch as typeof fetch);
  const connectedIntegration = await db.query.integrations.findFirst({ where: eq(integrations.propertyId, ids.property) });
  const credential = await db.query.integrationCredentials.findFirst({ where: eq(integrationCredentials.integrationId, connectedIntegration!.id) });
  assert(credential && !credential.encryptedValue.includes(plaintext) && credential.maskedSuffix === '1234');
  assert.equal((await db.query.integrationAuditLogs.findMany({ where: eq(integrationAuditLogs.propertyId, ids.property) })).length, 1);
  await assert.rejects(paystack.connectPaystack(ids.otherProperty, ids.user, 'bad-key', false, verifyFetch as typeof fetch), /INVALID_CREDENTIAL/);
  await assert.rejects(paystack.requireConnectedPaystack(ids.otherProperty), /PAYSTACK_NOT_CONNECTED/);
  console.log('PASS credential verification, masking, and tenant isolation');

  let initializedReference = '';
  const initializeFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body));
    initializedReference = payload.reference;
    assert.equal(payload.amount, 50000);
    assert.equal(payload.currency, 'NGN');
    assert.equal(payload.email, 'guest@qa.invalid');
    return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.test/synthetic', reference: payload.reference } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const initialized = await paymentFlow.initializePropertyPaystack({ propertyId: ids.property, reservationId: ids.reservation, email: 'guest@qa.invalid', amountMinorUnits: 50000, currency: 'NGN', source: 'direct_booking', callbackUrl: 'https://preview.invalid/confirming', idempotencyKey: 'synthetic-click-1' }, initializeFetch as typeof fetch);
  const retry = await paymentFlow.initializePropertyPaystack({ propertyId: ids.property, reservationId: ids.reservation, email: 'guest@qa.invalid', amountMinorUnits: 50000, currency: 'NGN', source: 'direct_booking', callbackUrl: 'https://preview.invalid/confirming', idempotencyKey: 'synthetic-click-1' }, initializeFetch as typeof fetch);
  assert.match(initialized.reference, /^SENA_[0-9a-f]{36}$/);
  assert.equal(retry.reference, initialized.reference);
  assert.equal(initializedReference, initialized.reference);
  console.log('PASS initialization uses trusted values, secure references, and click idempotency');

  const attempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.providerReference, initialized.reference) });
  const verified = { id: 9001, status: 'success', reference: initialized.reference, amount: 50000, currency: 'NGN', channel: 'card', paid_at: '2030-01-01T12:00:00Z', metadata: { type: 'reservation_settlement', propertyId: ids.property, reservationId: ids.reservation, paymentAttemptId: attempt!.id, source: 'direct_booking' } };
  await assert.rejects(paymentFlow.settlePropertyPaystack(attempt!.id, { ...verified, reference: 'SENA_tampered' }), /PAYMENT_MISMATCH/);
  const record = await paystack.getPropertyPaystack(ids.property);
  const state = paystack.safePaystackState(record, 'https://preview.invalid');
  const token = new URL(state.webhookUrl!).pathname.split('/').pop()!;
  assert(token.length >= 40 && !record!.integration.webhookTokenHash.includes(token));
  const rawEvent = JSON.stringify({ event: 'charge.success', data: verified });
  const signature = (await import('node:crypto')).createHmac('sha512', plaintext).update(rawEvent).digest('hex');
  const webhook = await import('../apps/dashboard/src/app/api/webhooks/paystack/[token]/route');
  const bad = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/paystack/${token}`, { method: 'POST', headers: { 'x-paystack-signature': 'bad' }, body: rawEvent }) as any, { params: Promise.resolve({ token }) });
  assert.equal(bad.status, 401);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
  try {
    const failed = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/paystack/${token}`, { method: 'POST', headers: { 'x-paystack-signature': signature }, body: rawEvent }) as any, { params: Promise.resolve({ token }) });
    assert.equal(failed.status, 500);
  } finally { globalThis.fetch = originalFetch; }

  globalThis.fetch = (async () => new Response(JSON.stringify({ status: true, data: verified }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    const responses = await Promise.all(Array.from({ length: 6 }, () => webhook.POST(new Request(`https://preview.invalid/api/webhooks/paystack/${token}`, { method: 'POST', headers: { 'x-paystack-signature': signature }, body: rawEvent }) as any, { params: Promise.resolve({ token }) })));
    assert(responses.every((response) => response.status === 200));
  } finally { globalThis.fetch = originalFetch; }
  assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, initialized.reference) })).length, 1);
  assert.equal((await db.query.reservations.findFirst({ where: eq(reservations.id, ids.reservation) }))?.paidAmountMinorUnits, 50000);
  assert.equal((await db.query.integrations.findFirst({ where: eq(integrations.propertyId, ids.property) }))?.webhookStatus, 'active');
  console.log('PASS signed property webhook verifies directly, settles once, and reports health');

  const [invoice] = await db.insert(propertyInvoices).values({ propertyId: ids.property, organizationId: ids.organization, invoiceNumber: 'SYN-BYOP-INV-001', recipientName: 'Synthetic Guest', recipientEmail: 'guest@qa.invalid', issueDate: '2030-01-01', dueDate: '2030-01-02', totalAmountMinorUnits: 12000, currency: 'NGN', status: 'issued' }).returning();
  const invoiceFetch = async (_url: string | URL | Request, init?: RequestInit) => { const payload = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.test/invoice', reference: payload.reference } }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  const invoiceInit = await paymentFlow.initializePropertyPaystack({ propertyId: ids.property, invoiceId: invoice.id, email: 'guest@qa.invalid', amountMinorUnits: 12000, currency: 'NGN', source: 'invoice', callbackUrl: 'https://preview.invalid/invoice/confirming' }, invoiceFetch as typeof fetch);
  const invoiceAttempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.providerReference, invoiceInit.reference) });
  await paymentFlow.settlePropertyPaystack(invoiceAttempt!.id, { id: 9002, status: 'success', reference: invoiceInit.reference, amount: 12000, currency: 'NGN', channel: 'card', paid_at: '2030-01-01T13:00:00Z', metadata: { type: 'invoice_settlement', propertyId: ids.property, invoiceId: invoice.id, paymentAttemptId: invoiceAttempt!.id, source: 'invoice' } });
  assert.equal((await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, invoice.id) }))?.status, 'paid');
  assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, invoiceInit.reference) })).length, 1);
  console.log('PASS invoice settlement records one receipt without requiring a reservation');

  const disconnected = paystack.safePaystackState(await paystack.getPropertyPaystack(ids.otherProperty), 'https://app.sena.ng');
  assert.equal(disconnected.displayStatus, 'disconnected');
  assert.equal('webhookUrl' in disconnected, false);
  const connectedState = paystack.safePaystackState(await paystack.getPropertyPaystack(ids.property), 'https://app.sena.ng');
  assert.equal(connectedState.displayStatus, 'connected');
  assert.equal(connectedState.mode, 'test');
  assert.equal(connectedState.secret, '••••••••••••••1234');
  assert.equal(JSON.stringify(connectedState).includes(plaintext), false);
  assert.match(connectedState.webhookUrl || '', /^https:\/\/app\.sena\.ng\/api\/webhooks\/paystack\/.+/);
  await assert.rejects(paystack.updatePaystackPaymentControls(ids.otherProperty, ids.user, { acceptOnlinePayments: false }), /PAYSTACK_NOT_CONNECTED/);
  console.log('PASS unconnected and connected states stay on the authorized property');

  await paystack.updatePaystackPaymentControls(ids.property, ids.user, { acceptOnlinePayments: false });
  assert.equal(paystack.paystackDisplayStatus(await paystack.getPropertyPaystack(ids.property)), 'disabled');
  await assert.rejects(paymentFlow.initializePropertyPaystack({ propertyId: ids.property, invoiceId: invoice.id, email: 'guest@qa.invalid', amountMinorUnits: 1000, currency: 'NGN', source: 'invoice', callbackUrl: 'https://preview.invalid/invoice' }, invoiceFetch as typeof fetch), /PAYSTACK_PAYMENTS_DISABLED/);
  await paystack.updatePaystackPaymentControls(ids.property, ids.user, { acceptOnlinePayments: true, directBooking: false, invoices: true });
  await assert.rejects(paymentFlow.initializePropertyPaystack({ propertyId: ids.property, reservationId: ids.reservation, email: 'guest@qa.invalid', amountMinorUnits: 1000, currency: 'NGN', source: 'direct_booking', callbackUrl: 'https://preview.invalid/booking' }, invoiceFetch as typeof fetch), /PAYSTACK_PAYMENTS_DISABLED/);
  const invoiceWhileBookingOff = await paymentFlow.initializePropertyPaystack({ propertyId: ids.property, invoiceId: invoice.id, email: 'guest@qa.invalid', amountMinorUnits: 1000, currency: 'NGN', source: 'invoice', callbackUrl: 'https://preview.invalid/invoice', idempotencyKey: 'surface-invoice' }, invoiceFetch as typeof fetch);
  assert.match(invoiceWhileBookingOff.reference, /^SENA_/);
  await paystack.updatePaystackPaymentControls(ids.property, ids.user, { directBooking: true, invoices: false });
  await assert.rejects(paymentFlow.initializePropertyPaystack({ propertyId: ids.property, invoiceId: invoice.id, email: 'guest@qa.invalid', amountMinorUnits: 1000, currency: 'NGN', source: 'invoice', callbackUrl: 'https://preview.invalid/invoice', idempotencyKey: 'surface-invoice-off' }, invoiceFetch as typeof fetch), /PAYSTACK_PAYMENTS_DISABLED/);
  await paystack.updatePaystackPaymentControls(ids.property, ids.user, { acceptOnlinePayments: true, directBooking: true, invoices: true });
  await paystack.testPaystackConnection(ids.property, verifyFetch as typeof fetch);
  assert.equal((await paystack.getPropertyPaystack(ids.property))?.integration.status, 'connected');
  console.log('PASS payment controls block only new initialization and test connection does not charge');

  const failingVerify = async () => new Response(JSON.stringify({ status: false }), { status: 401, headers: { 'content-type': 'application/json' } });
  await assert.rejects(paystack.connectPaystack(ids.property, ids.user, 'sk_test_rejected_key_9999', true, failingVerify as typeof fetch), /INVALID_CREDENTIAL/);
  assert.equal((await paystack.requireConnectedPaystack(ids.property)).secret, plaintext);
  console.log('PASS replacement is rejected before the stored secret changes');

  await paystack.connectPaystack(ids.property, ids.user, 'sk_test_rotated_secret_5678', true, verifyFetch as typeof fetch);
  assert.equal((await paystack.requireConnectedPaystack(ids.property)).secret, 'sk_test_rotated_secret_5678');
  await paystack.disconnectPaystack(ids.property, ids.user);
  await assert.rejects(paystack.requireConnectedPaystack(ids.property), /PAYSTACK_NOT_CONNECTED/);
  assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, initialized.reference) })).length, 1);
  console.log('PASS key rotation and disconnect preserve financial history');
  console.log('Paystack BYOP groups passed with synthetic data and mocked provider calls.');
  process.exit(0);
}

run().catch((error) => { console.error(error); process.exit(1); });
