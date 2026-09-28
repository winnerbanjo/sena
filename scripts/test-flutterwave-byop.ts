import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

requireIsolatedTestDatabase();
process.env.SENA_INTEGRATION_ENCRYPTION_KEY ||= '22'.repeat(32);

async function run() {
  const database = await import('../packages/database/src/index');
  const {
    db, emailLogs, guests, integrationCredentials, integrations, integrationWebhookEvents, organizations, payments, paymentAttempts,
    properties, propertyInvoices, reservations, roomTypes, users, and, eq, sql,
  } = database;
  const callback = await import('../apps/dashboard/src/lib/flutterwave-callback');
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

  const returned = callback.flutterwaveReturnContext(new URLSearchParams({
    resp: JSON.stringify({ data: { data: { txRef: `SENA_${'ab'.repeat(18)}`, id: 55, amount: 1, currency: 'USD', status: 'successful', redirectUrl: 'https://app.sena.ng/site/synthetic-fw-one/confirmation?reference=SYN-FLW-001&payment=confirming' } } }),
    amount: '999',
    currency: 'USD',
    status: 'successful',
  }));
  assert.equal(returned.txRef, `SENA_${'ab'.repeat(18)}`);
  assert.equal(returned.reference, 'SYN-FLW-001');
  assert.equal(returned.confirming, true);
  assert.equal(Object.hasOwn(returned, 'amount'), false);
  const hosted = callback.flutterwaveReturnContext(new URLSearchParams({
    resp: JSON.stringify({
      status: 'success',
      data: {
        data: { responsecode: '00', responsemessage: 'successful' },
        tx: {
          id: 88001,
          txRef: `SENA_${'cd'.repeat(18)}`,
          amount: 1,
          currency: 'USD',
          status: 'successful',
          redirectUrl: 'https://app.sena.ng/synthetic-fw-one/confirmation?reference=SYN-FLW-001&payment=confirming',
        },
      },
    }),
  }));
  assert.equal(hosted.txRef, `SENA_${'cd'.repeat(18)}`);
  assert.equal(hosted.transactionId, '88001');
  assert.equal(hosted.reference, 'SYN-FLW-001');
  assert.equal(hosted.confirming, true);
  assert.equal(Object.hasOwn(hosted, 'amount'), false);
  console.log('PASS Flutterwave return recovers the reference and ignores callback amount, currency, and status');

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
  assert.equal(safe.webhookStatus, 'configured');
  assert.equal(safe.webhookReadiness, 'configured_unverified');
  assert.equal(await online.onlinePaymentAvailable(ids.property, 'direct_booking'), true);
  assert.equal(await online.resolveOnlinePaymentProvider(ids.property, 'direct_booking'), 'flutterwave');
  assert.equal(await paystack.directBookingPaymentAvailable(ids.property), false);
  console.log('PASS credential validation, masking, mode, and tenant isolation');
  console.log('PASS Flutterwave-only properties expose Pay Online via online-provider (not Paystack-only gate)');

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
  const paymentsBeforeAuthFail = (await db.query.payments.findMany({ where: eq(payments.providerReference, initialized.reference) })).length;

  const missing = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: rawEvent }) as any, { params: Promise.resolve({ token }) });
  assert.equal(missing.status, 401);
  const missingDiagnostics = await db.query.integrationWebhookEvents.findMany({ where: and(eq(integrationWebhookEvents.propertyId, ids.property), eq(integrationWebhookEvents.status, 'rejected')) });
  assert.equal(missingDiagnostics.length >= 1, true);
  assert.match(missingDiagnostics.at(-1)!.errorMessage || '', /signature_absent/);
  assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, initialized.reference) })).length, paymentsBeforeAuthFail);

  const bad = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, { method: 'POST', headers: { 'verif-hash': 'bad' }, body: rawEvent }) as any, { params: Promise.resolve({ token }) });
  assert.equal(bad.status, 401);
  const badDiagnostics = await db.query.integrationWebhookEvents.findMany({ where: and(eq(integrationWebhookEvents.propertyId, ids.property), eq(integrationWebhookEvents.status, 'rejected')) });
  assert.equal(badDiagnostics.length >= 2, true);
  assert.match(badDiagnostics.at(-1)!.errorMessage || '', /signature_invalid/);
  assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, initialized.reference) })).length, paymentsBeforeAuthFail);
  assert.equal((await db.query.integrations.findFirst({ where: eq(integrations.id, connectedIntegration!.id) }))?.webhookStatus, 'needs_attention');
  console.log('PASS unsigned and wrong-signature webhooks are rejected with durable diagnostics and no payment mutation');

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
  assert.equal((await db.query.integrations.findFirst({ where: eq(integrations.id, connectedIntegration!.id) }))?.webhookStatus, 'active');
  const typedEvent = JSON.stringify({ type: 'charge.completed', data: { ...verified, id: 88011, tx_ref: initialized.reference } });
  globalThis.fetch = (async () => new Response(JSON.stringify({ status: 'success', data: { ...verified, id: 88011 } }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    const typed = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, { method: 'POST', headers: { 'verif-hash': connected.webhookSecret! }, body: typedEvent }) as any, { params: Promise.resolve({ token }) });
    assert.equal(typed.status, 200);
  } finally { globalThis.fetch = originalFetch; }
  assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, initialized.reference) })).length, 1);
  console.log('PASS signed Flutterwave webhook verifies, settles once, and rejects invalid authenticity');

  const otherTokenState = flutterwave.safeFlutterwaveState(await flutterwave.getPropertyFlutterwave(ids.otherProperty), 'https://preview.invalid');
  assert.equal(otherTokenState.displayStatus, 'disconnected');
  const cross = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, {
    method: 'POST',
    headers: { 'verif-hash': connected.webhookSecret! },
    body: JSON.stringify({ event: 'charge.completed', data: { ...verified, tx_ref: 'SENA_unknownref00000000000000000000000000' } }),
  }) as any, { params: Promise.resolve({ token }) });
  assert.equal(cross.status, 404);
  const paymentsAfterUnknown = await db.query.payments.findMany({ where: eq(payments.propertyId, ids.property) });
  assert.equal(paymentsAfterUnknown.length, 1);
  assert.equal((await db.query.emailLogs.findMany({ where: eq(emailLogs.idempotencyKey, 'payment_receipt_SENA_unknownref00000000000000000000000000') })).length, 0);
  console.log('PASS unknown reference is rejected without a payment or receipt');

  const raceReservation = '20000000-0000-4000-8000-000000000008';
  await db.insert(reservations).values({ id: raceReservation, reference: 'SYN-FLW-RACE', propertyId: ids.property, guestId: ids.guest, roomTypeId: ids.roomType, checkInDate: '2030-03-01', checkOutDate: '2030-03-02', nights: 1, totalAmountMinorUnits: 80000 });
  const confirmRoute = await import('../apps/dashboard/src/app/api/payments/public/confirm/route');
  let currentVerified: any = null;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const href = String(url);
    if (href.includes('/transactions/')) return new Response(JSON.stringify({ status: 'success', data: currentVerified }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ status: 'success', data: { link: 'https://checkout.flutterwave.test/race' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    for (let i = 0; i < 8; i++) {
      const init = await paymentFlow.initializePropertyFlutterwave({
        propertyId: ids.property, reservationId: raceReservation, email: 'guest-fw@qa.invalid', amountMinorUnits: 10000, currency: 'NGN',
        source: 'direct_booking', callbackUrl: 'https://preview.invalid/confirming',
      }, globalThis.fetch);
      const raceAttempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.providerReference, init.reference) });
      currentVerified = {
        id: 89000 + i, status: 'successful', tx_ref: init.reference, amount: 100, currency: 'NGN', payment_type: 'card', created_at: '2030-03-01T12:00:00Z',
        meta: { propertyId: ids.property, reservationId: raceReservation, paymentAttemptId: raceAttempt!.id, source: 'direct_booking' },
      };
      const tampered = JSON.stringify({ tx_ref: init.reference, transaction_id: 1, amount: 1, currency: 'USD', status: 'successful' });
      const event = JSON.stringify({ event: 'charge.completed', data: { ...currentVerified, amount: 1, currency: 'USD' } });
      await Promise.all([
        confirmRoute.POST(new Request('https://preview.invalid/api/payments/public/confirm', { method: 'POST', body: tampered }) as any),
        webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, { method: 'POST', headers: { 'verif-hash': connected.webhookSecret! }, body: event }) as any, { params: Promise.resolve({ token }) }),
        webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, { method: 'POST', headers: { 'verif-hash': connected.webhookSecret! }, body: event }) as any, { params: Promise.resolve({ token }) }),
        paymentFlow.settlePropertyFlutterwave(raceAttempt!.id, currentVerified),
      ]);
      assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, init.reference) })).length, 1);
      assert.equal((await db.query.emailLogs.findMany({ where: eq(emailLogs.idempotencyKey, `payment_receipt_${init.reference}`) })).length, 1);
    }
  } finally { globalThis.fetch = originalFetch; }
  assert.equal((await db.query.reservations.findFirst({ where: eq(reservations.id, raceReservation) }))?.paidAmountMinorUnits, 80000);
  console.log('PASS callback and webhook races settle once');

  const orderReservation = '20000000-0000-4000-8000-000000000009';
  await db.insert(reservations).values({ id: orderReservation, reference: 'SYN-FLW-ORD', propertyId: ids.property, guestId: ids.guest, roomTypeId: ids.roomType, checkInDate: '2030-04-01', checkOutDate: '2030-04-02', nights: 1, totalAmountMinorUnits: 20000, paidAmountMinorUnits: 0 });
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    if (href.includes('/transactions/') || href.includes('verify_by_reference')) {
      return new Response(JSON.stringify({ status: 'success', data: currentVerified }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (init?.method === 'POST') {
      const payload = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ status: 'success', data: { link: 'https://checkout.flutterwave.test/order' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  try {
    const callbackFirst = await paymentFlow.initializePropertyFlutterwave({
      propertyId: ids.property, reservationId: orderReservation, email: 'guest-fw@qa.invalid', amountMinorUnits: 10000, currency: 'NGN',
      source: 'direct_booking', callbackUrl: 'https://preview.invalid/confirming', idempotencyKey: 'order-callback-first',
    }, globalThis.fetch);
    const callbackAttempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.providerReference, callbackFirst.reference) });
    currentVerified = {
      id: 91001, status: 'successful', tx_ref: callbackFirst.reference, amount: 100, currency: 'NGN', payment_type: 'card', created_at: '2030-04-01T12:00:00Z',
      meta: { propertyId: ids.property, reservationId: orderReservation, paymentAttemptId: callbackAttempt!.id, source: 'direct_booking' },
    };
    const confirmFirst = await confirmRoute.POST(new Request('https://preview.invalid/api/payments/public/confirm', { method: 'POST', body: JSON.stringify({ tx_ref: callbackFirst.reference, transaction_id: 91001 }) }) as any);
    assert.equal(confirmFirst.status, 200);
    const webhookSecond = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, {
      method: 'POST', headers: { 'verif-hash': connected.webhookSecret! }, body: JSON.stringify({ event: 'charge.completed', data: currentVerified }),
    }) as any, { params: Promise.resolve({ token }) });
    assert.equal(webhookSecond.status, 200);
    assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, callbackFirst.reference) })).length, 1);
    assert.equal((await db.query.emailLogs.findMany({ where: eq(emailLogs.idempotencyKey, `payment_receipt_${callbackFirst.reference}`) })).length, 1);

    const webhookFirst = await paymentFlow.initializePropertyFlutterwave({
      propertyId: ids.property, reservationId: orderReservation, email: 'guest-fw@qa.invalid', amountMinorUnits: 10000, currency: 'NGN',
      source: 'direct_booking', callbackUrl: 'https://preview.invalid/confirming', idempotencyKey: 'order-webhook-first',
    }, globalThis.fetch);
    const webhookAttempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.providerReference, webhookFirst.reference) });
    currentVerified = {
      id: 91002, status: 'successful', tx_ref: webhookFirst.reference, amount: 100, currency: 'NGN', payment_type: 'card', created_at: '2030-04-01T12:05:00Z',
      meta: { propertyId: ids.property, reservationId: orderReservation, paymentAttemptId: webhookAttempt!.id, source: 'direct_booking' },
    };
    const firstWebhook = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, {
      method: 'POST', headers: { 'verif-hash': connected.webhookSecret! }, body: JSON.stringify({ event: 'charge.completed', data: currentVerified }),
    }) as any, { params: Promise.resolve({ token }) });
    assert.equal(firstWebhook.status, 200);
    const confirmSecond = await confirmRoute.POST(new Request('https://preview.invalid/api/payments/public/confirm', { method: 'POST', body: JSON.stringify({ tx_ref: webhookFirst.reference, transaction_id: 91002 }) }) as any);
    assert.equal(confirmSecond.status, 200);
    const duplicateWebhook = await webhook.POST(new Request(`https://preview.invalid/api/webhooks/flutterwave/${token}`, {
      method: 'POST', headers: { 'verif-hash': connected.webhookSecret! }, body: JSON.stringify({ event: 'charge.completed', data: currentVerified }),
    }) as any, { params: Promise.resolve({ token }) });
    assert.equal(duplicateWebhook.status, 200);
    assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, webhookFirst.reference) })).length, 1);
    assert.equal((await db.query.emailLogs.findMany({ where: eq(emailLogs.idempotencyKey, `payment_receipt_${webhookFirst.reference}`) })).length, 1);
    assert.equal((await db.query.reservations.findFirst({ where: eq(reservations.id, orderReservation) }))?.paidAmountMinorUnits, 20000);
  } finally { globalThis.fetch = originalFetch; }
  console.log('PASS callback-first and webhook-first converge once; duplicate webhook is idempotent');

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
  const { sendVerifiedPaymentNotice } = await import('../apps/dashboard/src/lib/settle-paystack');
  const invoiceReceipt = paymentFlow.flutterwaveReceiptPayload(invoiceAttempt!, {
    id: 88002, status: 'successful', tx_ref: invoiceInit.reference, amount: 1200, currency: 'NGN', payment_type: 'card', created_at: '2030-02-01T13:00:00Z',
  });
  await sendVerifiedPaymentNotice(invoiceReceipt);
  await sendVerifiedPaymentNotice(invoiceReceipt);
  const invoiceReceipts = await db.query.emailLogs.findMany({ where: eq(emailLogs.idempotencyKey, `payment_receipt_${invoiceInit.reference}`) });
  assert.equal(invoiceReceipts.length, 1);
  assert.equal(invoiceReceipts[0]?.status, 'sent');
  const [silentInvoice] = await db.insert(propertyInvoices).values({
    propertyId: ids.property, organizationId: ids.organization, invoiceNumber: 'SYN-FLW-INV-SILENT', recipientName: 'No Email',
    issueDate: '2030-02-01', dueDate: '2030-02-02', totalAmountMinorUnits: 1000, currency: 'NGN', status: 'issued',
  }).returning();
  await sendVerifiedPaymentNotice({ reference: 'SENA_silent_receipt', amount: 1000, currency: 'NGN', metadata: { type: 'invoice_settlement', invoiceId: silentInvoice.id, providerLabel: 'Flutterwave' } });
  assert.equal((await db.query.emailLogs.findMany({ where: eq(emailLogs.idempotencyKey, 'payment_receipt_SENA_silent_receipt') })).length, 0);
  console.log('PASS invoice settlement records one receipt email only when a recipient exists');

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

  const fs = await import('node:fs');
  const roomPage = fs.readFileSync('apps/dashboard/src/app/site/[slug]/rooms/[id]/page.tsx', 'utf8');
  const roomClient = fs.readFileSync('apps/dashboard/src/app/site/[slug]/rooms/[id]/RoomBookingClient.tsx', 'utf8');
  assert.match(roomPage, /from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/online-provider'/);
  assert.doesNotMatch(roomPage, /directBookingPaymentAvailable/);
  assert.match(roomClient, /paymentChoice === 'online'/);
  assert.doesNotMatch(roomClient, /paymentChoice === 'paystack'/);
  console.log('PASS direct-booking storefront gates Pay Online through online-provider');

  const previousKey = process.env.SENA_INTEGRATION_ENCRYPTION_KEY;
  process.env.SENA_INTEGRATION_ENCRYPTION_KEY = '44'.repeat(32);
  const healed = await flutterwave.connectFlutterwave(ids.property, ids.user, plaintext, true, verifyFetch as typeof fetch);
  assert.equal(typeof healed.webhookSecret, 'string');
  const healedConnection = await flutterwave.requireConnectedFlutterwave(ids.property);
  assert.equal(healedConnection.secret, plaintext);
  assert.equal(healedConnection.webhookSecret, healed.webhookSecret);
  process.env.SENA_INTEGRATION_ENCRYPTION_KEY = previousKey;
  console.log('PASS unreadable webhook material is replaced without rejecting a valid secret');

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
