import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

requireIsolatedTestDatabase();
process.env.SENA_INTEGRATION_ENCRYPTION_KEY ||= '22'.repeat(32);

async function run() {
  const database = await import('../packages/database/src/index');
  const {
    db, guests, integrationCredentials, integrations, organizations, payments, paymentAttempts,
    properties, propertyInvoices, reservations, roomTypes, users, and, eq, sql,
  } = database;
  const flutterwave = await import('../apps/dashboard/src/lib/integrations/flutterwave');
  const paymentFlow = await import('../apps/dashboard/src/lib/flutterwave-payments');
  const paystack = await import('../apps/dashboard/src/lib/integrations/paystack');
  const online = await import('../apps/dashboard/src/lib/online-provider');
  const cryptoModule = await import('../apps/dashboard/src/lib/integrations/crypto');

  const ids = {
    organization: '20000000-0000-4000-8000-000000000001',
    user: '20000000-0000-4000-8000-000000000002',
    property: '20000000-0000-4000-8000-000000000003',
    otherProperty: '20000000-0000-4000-8000-000000000004',
    roomType: '20000000-0000-4000-8000-000000000005',
    guest: '20000000-0000-4000-8000-000000000006',
    reservation: '20000000-0000-4000-8000-000000000007',
  };

  await db.execute(sql`delete from payments where property_id in (select id from properties where organization_id = ${ids.organization} or id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from payment_attempts where property_id in (select id from properties where organization_id = ${ids.organization} or id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from integration_webhook_events where property_id in (select id from properties where organization_id = ${ids.organization} or id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from integration_audit_logs where property_id in (select id from properties where organization_id = ${ids.organization} or id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from integration_credentials where integration_id in (select id from integrations where property_id in (select id from properties where organization_id = ${ids.organization} or id in (${ids.property}, ${ids.otherProperty})))`);
  await db.execute(sql`delete from integrations where property_id in (select id from properties where organization_id = ${ids.organization} or id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from property_invoices where property_id in (select id from properties where organization_id = ${ids.organization} or id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from reservations where property_id in (select id from properties where organization_id = ${ids.organization} or id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from room_types where property_id in (select id from properties where organization_id = ${ids.organization} or id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from guests where property_id in (select id from properties where organization_id = ${ids.organization} or id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from properties where organization_id = ${ids.organization} or id in (${ids.property}, ${ids.otherProperty})`);
  await db.delete(organizations).where(eq(organizations.id, ids.organization));
  await db.delete(users).where(eq(users.id, ids.user));
  await flutterwave.ensureFlutterwaveSchema();
  await db.insert(users).values({ id: ids.user, email: 'owner-fw@qa.invalid', fullName: 'QA Owner' });
  await db.insert(organizations).values({ id: ids.organization, name: 'Synthetic Flutterwave QA', slug: 'synthetic-flutterwave-qa' });
  await db.insert(properties).values([
    { id: ids.property, organizationId: ids.organization, name: 'Synthetic FW One', slug: 'synthetic-fw-one', code: 'SFW1', address: 'QA only', phone: '+2340000000011', email: 'fw-one@qa.invalid' },
    { id: ids.otherProperty, organizationId: ids.organization, name: 'Synthetic FW Two', slug: 'synthetic-fw-two', code: 'SFW2', address: 'QA only', phone: '+2340000000012', email: 'fw-two@qa.invalid' },
  ]);
  await db.insert(roomTypes).values({ id: ids.roomType, propertyId: ids.property, name: 'QA Room', bedType: 'Test', basePriceMinorUnits: 24000000 });
  await db.insert(guests).values({ id: ids.guest, organizationId: ids.organization, propertyId: ids.property, fullName: 'Synthetic Guest', email: 'guest-fw@qa.invalid', phone: '+2340000000013' });
  await db.insert(reservations).values({ id: ids.reservation, reference: 'SYN-FLW-001', propertyId: ids.property, guestId: ids.guest, roomTypeId: ids.roomType, checkInDate: '2030-02-01', checkOutDate: '2030-02-02', nights: 1, totalAmountMinorUnits: 24000000 });

  const plaintext = 'FLWSECK_TEST-synthetic_secret_abcd';
  const encrypted = cryptoModule.encryptIntegrationSecret(plaintext);
  assert(!encrypted.includes(plaintext));
  assert.equal(cryptoModule.decryptIntegrationSecret(encrypted), plaintext);
  console.log('PASS AES-GCM credential round trip stores no plaintext');

  const verifyFetch = async () => new Response(JSON.stringify({ status: 'success', data: [{ currency: 'NGN', available_balance: 0 }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  const connected = await flutterwave.connectFlutterwave(ids.property, ids.user, plaintext, false, verifyFetch as typeof fetch);
  assert.equal(typeof connected.webhookSecret, 'string');
  assert(connected.webhookSecret && connected.webhookSecret.length >= 32);
  const connectedIntegration = await db.query.integrations.findFirst({ where: and(eq(integrations.propertyId, ids.property), eq(integrations.provider, 'flutterwave')) });
  const secretCredential = await db.query.integrationCredentials.findFirst({
    where: and(
      eq(integrationCredentials.integrationId, connectedIntegration!.id),
      eq(integrationCredentials.credentialType, 'secret_key'),
    ),
  });
  assert(secretCredential && !secretCredential.encryptedValue.includes(plaintext) && secretCredential.maskedSuffix === 'abcd');
  await assert.rejects(flutterwave.connectFlutterwave(ids.otherProperty, ids.user, 'sk_test_not_flutterwave', false, verifyFetch as typeof fetch), /INVALID_CREDENTIAL/);
  await assert.rejects(flutterwave.requireConnectedFlutterwave(ids.otherProperty), /FLUTTERWAVE_NOT_CONNECTED/);
  const safe = flutterwave.safeFlutterwaveState(await flutterwave.getPropertyFlutterwave(ids.property), 'https://preview.invalid');
  assert.equal(JSON.stringify(safe).includes(plaintext), false);
  assert.equal(JSON.stringify(safe).includes(connected.webhookSecret || 'missing'), false);
  assert.equal(safe.mode, 'test');
  console.log('PASS credential validation, masking, mode, and tenant isolation');

  let initializedReference = '';
  const initializeFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body));
    initializedReference = payload.tx_ref;
    assert.equal(payload.amount, 240000);
    assert.equal(payload.currency, 'NGN');
    assert.equal(payload.customer.email, 'guest-fw@qa.invalid');
    assert.equal(payload.tx_ref.startsWith('SENA_'), true);
    return new Response(JSON.stringify({ status: 'success', data: { link: 'https://checkout.flutterwave.test/synthetic' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const initialized = await paymentFlow.initializePropertyFlutterwave({
    propertyId: ids.property, reservationId: ids.reservation, email: 'guest-fw@qa.invalid', amountMinorUnits: 24000000, currency: 'NGN',
    source: 'direct_booking', callbackUrl: 'https://preview.invalid/confirming', idempotencyKey: 'fw-click-1',
  }, initializeFetch as typeof fetch);
  const retry = await paymentFlow.initializePropertyFlutterwave({
    propertyId: ids.property, reservationId: ids.reservation, email: 'guest-fw@qa.invalid', amountMinorUnits: 24000000, currency: 'NGN',
    source: 'direct_booking', callbackUrl: 'https://preview.invalid/confirming', idempotencyKey: 'fw-click-1',
  }, initializeFetch as typeof fetch);
  assert.match(initialized.reference, /^SENA_[0-9a-f]{36}$/);
  assert.equal(retry.reference, initialized.reference);
  assert.equal(initializedReference, initialized.reference);
  console.log('PASS initialization uses server amount in major units and click idempotency');

  const attempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.providerReference, initialized.reference) });
  const verified = {
    id: 88001, status: 'successful', tx_ref: initialized.reference, flw_ref: 'FLW-SYN-1', amount: 240000, currency: 'NGN',
    payment_type: 'card', created_at: '2030-02-01T12:00:00Z',
    meta: { type: 'reservation_settlement', propertyId: ids.property, reservationId: ids.reservation, paymentAttemptId: attempt!.id, source: 'direct_booking' },
  };
  await assert.rejects(paymentFlow.settlePropertyFlutterwave(attempt!.id, { ...verified, amount: 2400 }), /AMOUNT_MISMATCH/);
  await assert.rejects(paymentFlow.settlePropertyFlutterwave(attempt!.id, { ...verified, currency: 'USD' }), /CURRENCY_MISMATCH/);
  await assert.rejects(paymentFlow.settlePropertyFlutterwave(attempt!.id, { ...verified, tx_ref: 'SENA_tampered' }), /PAYMENT_MISMATCH/);
  assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, initialized.reference) })).length, 0);
  console.log('PASS amount, currency, and reference mismatches do not settle');

  const token = new URL(safe.webhookUrl!).pathname.split('/').pop()!;
  const rawEvent = JSON.stringify({ event: 'charge.completed', data: verified });
  const webhook = await import('../apps/dashboard/src/app/api/webhooks/flutterwave/[token]/route');
  const bad = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, { method: 'POST', headers: { 'verif-hash': 'bad' }, body: rawEvent }) as any, { params: Promise.resolve({ token }) });
  assert.equal(bad.status, 401);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
  try {
    const failed = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, { method: 'POST', headers: { 'verif-hash': connected.webhookSecret! }, body: rawEvent }) as any, { params: Promise.resolve({ token }) });
    assert.equal(failed.status, 500);
  } finally { globalThis.fetch = originalFetch; }

  globalThis.fetch = (async () => new Response(JSON.stringify({ status: 'success', data: verified }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    const responses = await Promise.all(Array.from({ length: 6 }, () => webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, { method: 'POST', headers: { 'verif-hash': connected.webhookSecret! }, body: rawEvent }) as any, { params: Promise.resolve({ token }) })));
    assert(responses.every((response) => response.status === 200 || response.status === 409));
  } finally { globalThis.fetch = originalFetch; }
  assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, initialized.reference) })).length, 1);
  assert.equal((await db.query.reservations.findFirst({ where: eq(reservations.id, ids.reservation) }))?.paidAmountMinorUnits, 24000000);
  console.log('PASS signed Flutterwave webhook verifies, settles once, and rejects invalid authenticity');

  const otherTokenState = flutterwave.safeFlutterwaveState(await flutterwave.getPropertyFlutterwave(ids.otherProperty), 'https://preview.invalid');
  assert.equal(otherTokenState.displayStatus, 'disconnected');
  const cross = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, {
    method: 'POST',
    headers: { 'verif-hash': connected.webhookSecret! },
    body: JSON.stringify({ event: 'charge.completed', data: { ...verified, tx_ref: 'SENA_unknownref00000000000000000000000000' } }),
  }) as any, { params: Promise.resolve({ token }) });
  assert.notEqual(cross.status, 200);
  console.log('PASS unknown reference is rejected');

  const [invoice] = await db.insert(propertyInvoices).values({
    propertyId: ids.property, organizationId: ids.organization, invoiceNumber: 'SYN-FLW-INV-001', recipientName: 'Synthetic Guest',
    recipientEmail: 'guest-fw@qa.invalid', issueDate: '2030-02-01', dueDate: '2030-02-02', totalAmountMinorUnits: 120000, currency: 'NGN', status: 'issued',
  }).returning();
  const invoiceFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ status: 'success', data: { link: 'https://checkout.flutterwave.test/invoice' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const invoiceInit = await paymentFlow.initializePropertyFlutterwave({
    propertyId: ids.property, invoiceId: invoice.id, email: 'guest-fw@qa.invalid', amountMinorUnits: 120000, currency: 'NGN',
    source: 'invoice', callbackUrl: 'https://preview.invalid/invoice/confirming',
  }, invoiceFetch as typeof fetch);
  const invoiceAttempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.providerReference, invoiceInit.reference) });
  await paymentFlow.settlePropertyFlutterwave(invoiceAttempt!.id, {
    id: 88002, status: 'successful', tx_ref: invoiceInit.reference, amount: 1200, currency: 'NGN', payment_type: 'card', created_at: '2030-02-01T13:00:00Z',
    meta: { type: 'invoice_settlement', propertyId: ids.property, invoiceId: invoice.id, paymentAttemptId: invoiceAttempt!.id, source: 'invoice' },
  });
  assert.equal((await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, invoice.id) }))?.status, 'paid');
  assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, invoiceInit.reference) })).length, 1);
  console.log('PASS invoice settlement records one receipt');

  await flutterwave.updateFlutterwavePaymentControls(ids.property, ids.user, { enabled: false });
  assert.equal(flutterwave.flutterwaveDisplayStatus(await flutterwave.getPropertyFlutterwave(ids.property)), 'disabled');
  await assert.rejects(paymentFlow.initializePropertyFlutterwave({
    propertyId: ids.property, invoiceId: invoice.id, email: 'guest-fw@qa.invalid', amountMinorUnits: 1000, currency: 'NGN',
    source: 'invoice', callbackUrl: 'https://preview.invalid/invoice',
  }, invoiceFetch as typeof fetch), /FLUTTERWAVE_PAYMENTS_DISABLED/);

  const inFlight = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.internalReference, initialized.reference) });
  const inFlightAgain = await paymentFlow.settlePropertyFlutterwave(inFlight!.id, verified);
  assert.equal(inFlightAgain.status, 'already_processed');
  assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, initialized.reference) })).length, 1);
  console.log('PASS disable blocks new init and in-flight settlement is not lost');

  const paystackSecret = 'sk_test_synthetic_fw_paystack_9999';
  const paystackVerify = async () => new Response(JSON.stringify({ status: true, data: [{ currency: 'NGN', balance: 0 }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  await paystack.connectPaystack(ids.property, ids.user, paystackSecret, false, paystackVerify as typeof fetch);
  await flutterwave.updateFlutterwavePaymentControls(ids.property, ids.user, { enabled: true, acceptOnlinePayments: true, directBooking: true, invoices: true });
  assert.equal(await online.resolveOnlinePaymentProvider(ids.property, 'direct_booking'), 'paystack');
  await online.setPreferredOnlineProvider(ids.property, ids.user, 'flutterwave');
  assert.equal(await online.resolveOnlinePaymentProvider(ids.property, 'direct_booking'), 'flutterwave');
  await online.setPreferredOnlineProvider(ids.property, ids.user, 'paystack');
  assert.equal(await online.resolveOnlinePaymentProvider(ids.property, 'direct_booking'), 'paystack');
  const untouched = await db.query.properties.findFirst({ where: eq(properties.id, ids.otherProperty) });
  assert.equal(untouched?.preferredOnlineProvider || null, null);
  console.log('PASS preferred provider is deterministic and unset properties keep Paystack default');

  await flutterwave.disconnectFlutterwave(ids.property, ids.user);
  await assert.rejects(flutterwave.requireConnectedFlutterwave(ids.property), /FLUTTERWAVE_NOT_CONNECTED/);
  assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, initialized.reference) })).length, 1);
  console.log('PASS disconnect preserves financial history');

  const liveKey = 'FLWSECK-livekey_not_used_in_qa_zzzz';
  assert.equal(flutterwave.detectFlutterwaveMode(liveKey), 'live');
  assert.equal(flutterwave.detectFlutterwaveMode(plaintext), 'test');
  await assert.rejects(() => Promise.resolve().then(() => flutterwave.detectFlutterwaveMode('sk_test_not_flutterwave')), /INVALID_CREDENTIAL/);
  console.log('PASS test/live key prefixes are explicit');

  if (process.env.FLUTTERWAVE_TEST_SECRET_KEY?.startsWith('FLWSECK_TEST-')) {
    console.log('GENUINE Flutterwave TEST credentials are present; live-network certification is a separate operator gate.');
  } else {
    console.log('BLOCKED, TEST CREDENTIALS REQUIRED for genuine Flutterwave TEST transactions and webhooks.');
  }

  console.log('Flutterwave BYOP groups passed with synthetic data and mocked provider calls.');
  process.exit(0);
}

run().catch((error) => { console.error(error); process.exit(1); });
