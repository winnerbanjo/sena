import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

requireIsolatedTestDatabase();
process.env.SENA_INTEGRATION_ENCRYPTION_KEY ||= '33'.repeat(32);
process.env.AUTH_SECRET ||= 'local-release-test-only-secret-not-production';
process.env.NEXTAUTH_SECRET ||= 'local-release-test-only-secret-not-production';

async function run() {
  const database = await import('../packages/database/src/index');
  const {
    db,
    guests,
    integrationAuditLogs,
    integrationCredentials,
    integrations,
    organizations,
    paymentAttempts,
    payments,
    properties,
    propertyInvoices,
    reservations,
    roomTypes,
    users,
    eq,
    sql,
  } = database;

  const paystack = await import('../apps/dashboard/src/lib/integrations/paystack');
  const paymentFlow = await import('../apps/dashboard/src/lib/paystack-payments');
  const { PaymentService } = await import('../packages/payments/src/index');
  const { createPublicInvoiceToken } = await import('../apps/dashboard/src/lib/public-invoice-token');

  const ids = {
    organization: '40000000-0000-4000-8000-000000000001',
    ownerUser: '40000000-0000-4000-8000-000000000002',
    otherUser: '40000000-0000-4000-8000-000000000003',
    property: '40000000-0000-4000-8000-000000000004',
    otherProperty: '40000000-0000-4000-8000-000000000005',
    roomType: '40000000-0000-4000-8000-000000000006',
    guest: '40000000-0000-4000-8000-000000000007',
    reservation: '40000000-0000-4000-8000-000000000008',
    invoice: '40000000-0000-4000-8000-000000000009',
  };

  // Clean test scope
  await db.execute(sql`delete from payments where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from payment_attempts where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from integration_webhook_events where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from integration_audit_logs where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from integration_credentials where integration_id in (select id from integrations where property_id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from integrations where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from property_invoices where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from reservations where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from room_types where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from guests where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from properties where id in (${ids.property}, ${ids.otherProperty})`);
  await db.delete(organizations).where(eq(organizations.id, ids.organization));
  await db.delete(users).where(eq(users.id, ids.ownerUser));
  await db.delete(users).where(eq(users.id, ids.otherUser));

  // Seed baseline
  await db.insert(users).values([
    { id: ids.ownerUser, email: 'owner@mastercontrol.invalid', fullName: 'Owner' },
    { id: ids.otherUser, email: 'other@mastercontrol.invalid', fullName: 'Other' },
  ]);
  await db.insert(organizations).values({ id: ids.organization, name: 'Master Control Test Org', slug: 'master-control-org' });
  await db.insert(properties).values([
    { id: ids.property, organizationId: ids.organization, name: 'Master Hotel', slug: 'master-hotel', code: 'MST1', address: 'Test', phone: '+2340000000001', email: 'master@test.invalid' },
    { id: ids.otherProperty, organizationId: ids.organization, name: 'Other Hotel', slug: 'other-hotel', code: 'MST2', address: 'Test', phone: '+2340000000002', email: 'other@test.invalid' },
  ]);
  await db.insert(roomTypes).values({ id: ids.roomType, propertyId: ids.property, name: 'Master Room', bedType: 'King', basePriceMinorUnits: 80000 });
  await db.insert(guests).values({ id: ids.guest, organizationId: ids.organization, propertyId: ids.property, fullName: 'Master Guest', email: 'guest@test.invalid', phone: '+2340000000003' });
  await db.insert(reservations).values({ id: ids.reservation, reference: 'SEN-MST-001', propertyId: ids.property, guestId: ids.guest, roomTypeId: ids.roomType, checkInDate: '2030-05-01', checkOutDate: '2030-05-03', nights: 2, totalAmountMinorUnits: 160000, paidAmountMinorUnits: 0, paymentStatus: 'pay_later' });
  await db.insert(propertyInvoices).values({ id: ids.invoice, propertyId: ids.property, organizationId: ids.organization, invoiceNumber: 'MST-INV-001', recipientName: 'Master Guest', recipientEmail: 'guest@test.invalid', issueDate: '2030-05-01', dueDate: '2030-05-05', totalAmountMinorUnits: 160000, paidAmountMinorUnits: 0, status: 'issued', currency: 'NGN', items: [] });

  const testSecret = 'sk_test_synthetic_master_key_9999';
  const verifyFetch = async () => new Response(JSON.stringify({ status: true, data: [{ currency: 'NGN', balance: 0 }] }), { status: 200, headers: { 'content-type': 'application/json' } });

  // 1. CONNECTED + ENABLED
  await paystack.connectPaystack(ids.property, ids.ownerUser, testSecret, false, verifyFetch as typeof fetch);
  const connectedRecord = await paystack.getPropertyPaystack(ids.property);
  assert.equal(connectedRecord?.integration.status, 'connected');
  const controlsInitial = paystack.paystackPaymentControls(connectedRecord?.integration.metadata);
  assert.equal(controlsInitial.enabled, true);
  assert.equal(controlsInitial.acceptOnlinePayments, true);
  assert.equal(paystack.paystackDisplayStatus(connectedRecord), 'connected');
  assert.equal(await paystack.directBookingPaymentAvailable(ids.property), true);
  assert.equal(await paystack.invoicePaymentAvailable(ids.property), true);

  const mockInitFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.test/master', reference: payload.reference } }), { status: 200 });
  };
  const initSuccess = await paymentFlow.initializePropertyPaystack({
    propertyId: ids.property,
    reservationId: ids.reservation,
    email: 'guest@test.invalid',
    amountMinorUnits: 50000,
    currency: 'NGN',
    source: 'direct_booking',
    callbackUrl: 'https://preview.invalid/callback',
    idempotencyKey: 'mst-init-1',
  }, mockInitFetch as typeof fetch);
  assert.match(initSuccess.reference, /^SENA_/);
  console.log('PASS 1: CONNECTED + ENABLED -> Paystack eligible');

  // 2. CONNECTED + DISABLED (Master toggle OFF)
  // Store custom child preferences first: directBooking: true, invoices: false
  await paystack.updatePaystackPaymentControls(ids.property, ids.ownerUser, { directBooking: true, invoices: false });
  // Now turn master toggle OFF
  const disabledControls = await paystack.updatePaystackPaymentControls(ids.property, ids.ownerUser, { enabled: false });
  assert.equal(disabledControls.enabled, false);
  assert.equal(disabledControls.acceptOnlinePayments, false);
  // Child preferences directBooking and invoices must be preserved!
  assert.equal(disabledControls.directBooking, true);
  assert.equal(disabledControls.invoices, false);

  const disabledRecord = await paystack.getPropertyPaystack(ids.property);
  assert.equal(disabledRecord?.integration.status, 'connected', 'status remains connected when disabled');
  assert.equal(paystack.paystackDisplayStatus(disabledRecord), 'disabled');

  // Audit trail verification
  const auditLogs = await db.query.integrationAuditLogs.findMany({ where: eq(integrationAuditLogs.propertyId, ids.property) });
  assert.ok(auditLogs.some((l) => l.action === 'paystack.disabled'), 'audit log contains paystack.disabled');

  // Server rejection on new initialization
  await assert.rejects(
    paymentFlow.initializePropertyPaystack({
      propertyId: ids.property,
      reservationId: ids.reservation,
      email: 'guest@test.invalid',
      amountMinorUnits: 50000,
      currency: 'NGN',
      source: 'direct_booking',
      callbackUrl: 'https://preview.invalid/callback',
      idempotencyKey: 'mst-init-disabled',
    }, mockInitFetch as typeof fetch),
    /PAYSTACK_PAYMENTS_DISABLED/
  );
  console.log('PASS 2: CONNECTED + DISABLED -> new initialization rejected');

  // 3. DISABLED + DIRECT BOOKING
  assert.equal(await paystack.directBookingPaymentAvailable(ids.property), false);
  const checkoutRoute = await import('../apps/dashboard/src/app/api/checkout/route');
  const directBookingAttempt = await checkoutRoute.POST(new Request('https://preview.invalid/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      propertyId: ids.property,
      roomTypeId: ids.roomType,
      checkInDate: '2030-05-01',
      checkOutDate: '2030-05-03',
      guestName: 'Direct Guest',
      guestEmail: 'direct@test.invalid',
      paymentMethod: 'paystack',
    }),
  }) as any);
  assert.equal(directBookingAttempt.status, 400);
  const directBookingBody = await directBookingAttempt.json();
  assert.match(directBookingBody.error, /Online payments are unavailable/i);
  console.log('PASS 3: DISABLED + DIRECT BOOKING -> Pay Online rejected at API');

  // 4. DISABLED + INVOICE
  assert.equal(await paystack.invoicePaymentAvailable(ids.property), false);
  const invoiceCheckoutRoute = await import('../apps/dashboard/src/app/api/invoices/public/[number]/checkout/route');
  const invoicePublicRoute = await import('../apps/dashboard/src/app/api/invoices/public/[number]/route');
  const invoiceToken = createPublicInvoiceToken(ids.invoice);

  const publicInvoiceRes = await invoicePublicRoute.GET(new Request('https://preview.invalid') as any, { params: Promise.resolve({ number: invoiceToken }) });
  assert.equal(publicInvoiceRes.status, 200);
  const publicInvoiceBody = await publicInvoiceRes.json();
  assert.equal(publicInvoiceBody.onlinePaymentAvailable, false, 'public invoice reports onlinePaymentAvailable: false');

  const invoiceCheckoutAttempt = await invoiceCheckoutRoute.POST(new Request('https://preview.invalid/api/invoices/public/x/checkout', { method: 'POST' }) as any, { params: Promise.resolve({ number: invoiceToken }) });
  assert.equal(invoiceCheckoutAttempt.status, 503);
  const invoiceCheckoutBody = await invoiceCheckoutAttempt.json();
  assert.match(invoiceCheckoutBody.error, /Online payments are unavailable/i);
  console.log('PASS 4: DISABLED + INVOICE -> Pay Online unavailable and checkout rejected with 503');

  // 5. DISABLED + MANUAL PAYMENT
  const manualCash = await PaymentService.recordPayment({
    reservationId: ids.reservation,
    amountMinorUnits: 30000,
    provider: 'manual',
    providerReference: 'MST-MANUAL-CASH',
    method: 'cash',
  }, 'mst-manual-cash');
  assert.ok(manualCash.id);
  const updatedRes = await db.query.reservations.findFirst({ where: eq(reservations.id, ids.reservation) });
  assert.equal(updatedRes?.paidAmountMinorUnits, 30000);
  console.log('PASS 5: DISABLED + MANUAL PAYMENT -> Cash/POS/Bank Transfer unaffected');

  // 6. DISABLED + EXISTING VALID PAYMENT ATTEMPT + VERIFIED WEBHOOK
  // Re-enable briefly to create an in-flight attempt
  await paystack.updatePaystackPaymentControls(ids.property, ids.ownerUser, { enabled: true, directBooking: true });
  const inFlight = await paymentFlow.initializePropertyPaystack({
    propertyId: ids.property,
    reservationId: ids.reservation,
    email: 'guest@test.invalid',
    amountMinorUnits: 50000,
    currency: 'NGN',
    source: 'direct_booking',
    callbackUrl: 'https://preview.invalid/callback',
    idempotencyKey: 'mst-inflight',
  }, mockInitFetch as typeof fetch);

  // Now turn master toggle OFF while this payment is in-flight!
  await paystack.updatePaystackPaymentControls(ids.property, ids.ownerUser, { enabled: false });

  // Webhook arrives while Paystack is paused
  const inFlightAttempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.providerReference, inFlight.reference) });
  const verifiedPayload = {
    id: 8888,
    status: 'success',
    reference: inFlight.reference,
    amount: 50000,
    currency: 'NGN',
    channel: 'card',
    paid_at: '2030-05-01T14:00:00Z',
    metadata: {
      type: 'reservation_settlement',
      propertyId: ids.property,
      reservationId: ids.reservation,
      paymentAttemptId: inFlightAttempt!.id,
      source: 'direct_booking',
    },
  };

  const rawWebhookEvent = JSON.stringify({ event: 'charge.success', data: verifiedPayload });
  const webhookSignature = crypto.createHmac('sha512', testSecret).update(rawWebhookEvent).digest('hex');
  const tokenRecord = await paystack.getPropertyPaystack(ids.property);
  const safeState = paystack.safePaystackState(tokenRecord, 'https://preview.invalid');
  const webhookTokenStr = new URL(safeState.webhookUrl!).pathname.split('/').pop()!;

  const webhookRoute = await import('../apps/dashboard/src/app/api/webhooks/paystack/[token]/route');
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ status: true, data: verifiedPayload }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;

  try {
    const webhookRes = await webhookRoute.POST(
      new Request(`https://preview.invalid/api/webhooks/paystack/${webhookTokenStr}`, {
        method: 'POST',
        headers: { 'x-paystack-signature': webhookSignature },
        body: rawWebhookEvent,
      }) as any,
      { params: Promise.resolve({ token: webhookTokenStr }) }
    );
    assert.equal(webhookRes.status, 200);

    // Idempotency: replay the same webhook while still disabled
    const replayRes = await webhookRoute.POST(
      new Request(`https://preview.invalid/api/webhooks/paystack/${webhookTokenStr}`, {
        method: 'POST',
        headers: { 'x-paystack-signature': webhookSignature },
        body: rawWebhookEvent,
      }) as any,
      { params: Promise.resolve({ token: webhookTokenStr }) }
    );
    assert.equal(replayRes.status, 200);
    const replayBody = await replayRes.json();
    assert.equal(replayBody.status, 'already_processed');
  } finally {
    globalThis.fetch = origFetch;
  }

  const finalRes = await db.query.reservations.findFirst({ where: eq(reservations.id, ids.reservation) });
  assert.equal(finalRes?.paidAmountMinorUnits, 80000, '30,000 manual + 50,000 in-flight webhook settled');
  console.log('PASS 6: DISABLED + EXISTING VALID PAYMENT ATTEMPT + VERIFIED WEBHOOK -> settlement works and idempotent');

  // 7. REENABLE -> previous child preferences restored
  // Before reenabling, check that directBooking was true, invoices was false
  const reenabledControls = await paystack.updatePaystackPaymentControls(ids.property, ids.ownerUser, { enabled: true });
  assert.equal(reenabledControls.enabled, true);
  assert.equal(reenabledControls.acceptOnlinePayments, true);
  assert.equal(reenabledControls.directBooking, true, 'directBooking preserved as true');
  assert.equal(reenabledControls.invoices, false, 'invoices preserved as false');
  console.log('PASS 7: REENABLE -> previous child preferences restored');

  // 8. TENANT ATTACK -> rejected
  await assert.rejects(
    paystack.updatePaystackPaymentControls(ids.otherProperty, ids.ownerUser, { enabled: false }),
    /PAYSTACK_NOT_CONNECTED/,
    'cross-property attack rejected'
  );
  console.log('PASS 8: TENANT ATTACK -> rejected');

  // 9. DOUBLE TOGGLE / RETRY -> safe
  await paystack.updatePaystackPaymentControls(ids.property, ids.ownerUser, { enabled: true });
  await paystack.updatePaystackPaymentControls(ids.property, ids.ownerUser, { enabled: true });
  const doubleOn = paystack.paystackPaymentControls((await paystack.getPropertyPaystack(ids.property))?.integration.metadata);
  assert.equal(doubleOn.enabled, true);

  await paystack.updatePaystackPaymentControls(ids.property, ids.ownerUser, { enabled: false });
  await paystack.updatePaystackPaymentControls(ids.property, ids.ownerUser, { enabled: false });
  const doubleOff = paystack.paystackPaymentControls((await paystack.getPropertyPaystack(ids.property))?.integration.metadata);
  assert.equal(doubleOff.enabled, false);
  console.log('PASS 9: DOUBLE TOGGLE / RETRY -> safe');

  console.log('ALL PAYSTACK MASTER CONTROL TESTS PASSED SUCCESSFULLY.');
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
