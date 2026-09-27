import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

requireIsolatedTestDatabase();
process.env.SENA_INTEGRATION_ENCRYPTION_KEY ||= '22'.repeat(32);

async function run() {
  const invoiceEmail = await import('../packages/email/src/templates/payment');
  const renderedInvoice = invoiceEmail.renderInvoiceIssuedEmail({
    guestName: 'Ada Guest',
    invoiceNumber: 'SRF-1',
    propertyName: 'Surface Hotel',
    amountDueFormatted: '₦1,000.00',
    dueDate: '2032-04-08',
    summaryLines: [{ label: 'Room', amount: '₦1,000.00' }],
    invoiceUrl: 'https://app.sena.ng/invoice/30000000-0000-4000-8000-000000000008',
  });
  assert.match(renderedInvoice.subject, /^Invoice SRF-1 from Surface Hotel$/);
  assert.match(renderedInvoice.html, /View &amp; Pay Invoice|View & Pay Invoice/);
  assert.match(renderedInvoice.html, /https:\/\/app\.sena\.ng\/invoice\/30000000-0000-4000-8000-000000000008/);
  assert.doesNotMatch(renderedInvoice.html, /checkout\.paystack|authorization_url|Final Folio/);
  assert.match(renderedInvoice.text, /not a receipt/i);
  assert.doesNotMatch(renderedInvoice.subject, /Receipt/);
  console.log('PASS invoice email is an invoice with a Sena payment link');

  const database = await import('../packages/database/src/index');
  const { db, guests, operationalNotifications, organizations, paymentAttempts, payments, properties, propertyInvoices, reservations, roomTypes, users, eq, sql } = database;
  const paystack = await import('../apps/dashboard/src/lib/integrations/paystack');
  const paymentFlow = await import('../apps/dashboard/src/lib/paystack-payments');
  const { PaymentService } = await import('../packages/payments/src/index');
  await db.execute(sql`CREATE TABLE IF NOT EXISTS operational_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE cascade,
    dedupe_key varchar(200) NOT NULL,
    kind varchar(40) NOT NULL,
    title varchar(160) NOT NULL,
    body text NOT NULL,
    href varchar(300),
    read_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
  )`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS operational_notifications_dedupe_idx ON operational_notifications (property_id, dedupe_key)`);

  const ids = {
    organization: '30000000-0000-4000-8000-000000000001',
    user: '30000000-0000-4000-8000-000000000002',
    property: '30000000-0000-4000-8000-000000000003',
    other: '30000000-0000-4000-8000-000000000004',
    roomType: '30000000-0000-4000-8000-000000000005',
    guest: '30000000-0000-4000-8000-000000000006',
    reservation: '30000000-0000-4000-8000-000000000007',
    invoice: '30000000-0000-4000-8000-000000000008',
    voidInvoice: '30000000-0000-4000-8000-000000000009',
  };
  await db.execute(sql`delete from idempotency_keys where key like 'surface-%'`);
  await db.execute(sql`delete from operational_notifications where property_id in (${ids.property}, ${ids.other})`);
  await db.execute(sql`delete from payments where property_id in (${ids.property}, ${ids.other})`);
  await db.execute(sql`delete from payment_attempts where property_id in (${ids.property}, ${ids.other})`);
  await db.execute(sql`delete from property_invoices where property_id in (${ids.property}, ${ids.other})`);
  await db.execute(sql`delete from reservations where property_id in (${ids.property}, ${ids.other})`);
  await db.execute(sql`delete from integration_credentials where integration_id in (select id from integrations where property_id in (${ids.property}, ${ids.other}))`);
  await db.execute(sql`delete from integration_audit_logs where property_id in (${ids.property}, ${ids.other})`);
  await db.execute(sql`delete from integrations where property_id in (${ids.property}, ${ids.other})`);
  await db.execute(sql`delete from guests where property_id in (${ids.property}, ${ids.other})`);
  await db.execute(sql`delete from room_types where property_id in (${ids.property}, ${ids.other})`);
  await db.execute(sql`delete from properties where id in (${ids.property}, ${ids.other})`);
  await db.delete(organizations).where(eq(organizations.id, ids.organization));
  await db.delete(users).where(eq(users.id, ids.user));
  await db.insert(users).values({ id: ids.user, email: 'surfaces@qa.invalid', fullName: 'Surface QA' });
  await db.insert(organizations).values({ id: ids.organization, name: 'Surface QA', slug: 'surface-qa' });
  await db.insert(properties).values([
    { id: ids.property, organizationId: ids.organization, name: 'Surface Hotel', slug: 'surface-hotel', code: 'SRF1', address: 'QA', phone: '+2340000000101', email: 'surface@qa.invalid' },
    { id: ids.other, organizationId: ids.organization, name: 'Other Hotel', slug: 'surface-other', code: 'SRF2', address: 'QA', phone: '+2340000000102', email: 'other@qa.invalid' },
  ]);
  await db.insert(roomTypes).values({ id: ids.roomType, propertyId: ids.property, name: 'Surface Room', bedType: 'Queen', basePriceMinorUnits: 100000 });
  await db.insert(guests).values({ id: ids.guest, organizationId: ids.organization, propertyId: ids.property, fullName: 'Ada Guest', email: 'ada@qa.invalid', phone: '+2340000000103' });
  await db.insert(reservations).values({ id: ids.reservation, reference: 'SEN-SRF001', propertyId: ids.property, guestId: ids.guest, roomTypeId: ids.roomType, checkInDate: '2032-04-01', checkOutDate: '2032-04-03', nights: 2, totalAmountMinorUnits: 200000, paidAmountMinorUnits: 0, paymentStatus: 'pay_later' });
  await db.insert(propertyInvoices).values([
    { id: ids.invoice, propertyId: ids.property, organizationId: ids.organization, invoiceNumber: 'SRF-INV-001', recipientName: 'Ada Guest', recipientEmail: 'ada@qa.invalid', issueDate: '2032-04-01', dueDate: '2032-04-08', totalAmountMinorUnits: 150000, paidAmountMinorUnits: 50000, status: 'issued', currency: 'NGN', items: [] },
    { id: ids.voidInvoice, propertyId: ids.property, organizationId: ids.organization, invoiceNumber: 'SRF-INV-VOID', recipientName: 'Ada Guest', recipientEmail: 'ada@qa.invalid', issueDate: '2032-04-01', dueDate: '2032-04-08', totalAmountMinorUnits: 10000, status: 'void', currency: 'NGN', items: [] },
  ]);

  assert.equal(await paystack.directBookingPaymentAvailable(ids.property), false);
  const verifyFetch = async () => new Response(JSON.stringify({ status: true, data: [{ currency: 'NGN', balance: 0 }] }), { status: 200 });
  await paystack.connectPaystack(ids.property, ids.user, 'sk_test_surface_secret_4321', false, verifyFetch as typeof fetch);
  assert.equal(await paystack.directBookingPaymentAvailable(ids.property), true);
  await paystack.updatePaystackPaymentControls(ids.property, ids.user, { acceptOnlinePayments: false });
  assert.equal(await paystack.directBookingPaymentAvailable(ids.property), false);
  await paystack.updatePaystackPaymentControls(ids.property, ids.user, { acceptOnlinePayments: true, directBooking: false });
  assert.equal(await paystack.directBookingPaymentAvailable(ids.property), false);
  await paystack.updatePaystackPaymentControls(ids.property, ids.user, { directBooking: true, invoices: true });
  console.log('PASS direct booking eligibility follows connection and toggles');

  await assert.rejects(PaymentService.recordPayment({ reservationId: ids.reservation, amountMinorUnits: 200001, provider: 'manual', providerReference: 'MAN-OVER', method: 'cash' }, 'surface-over'), /outstanding/);
  const cash = await PaymentService.recordPayment({ reservationId: ids.reservation, amountMinorUnits: 50000, provider: 'manual', providerReference: 'MAN-CASH', method: 'cash' }, 'surface-cash');
  const cashRetry = await PaymentService.recordPayment({ reservationId: ids.reservation, amountMinorUnits: 50000, provider: 'manual', providerReference: 'MAN-CASH', method: 'cash' }, 'surface-cash');
  assert.equal(cashRetry.id, cash.id);
  const pos = await PaymentService.recordPayment({ reservationId: ids.reservation, amountMinorUnits: 25000, provider: 'manual', providerReference: 'MAN-POS', method: 'pos' }, 'surface-pos');
  const transfer = await PaymentService.recordPayment({ reservationId: ids.reservation, amountMinorUnits: 25000, provider: 'manual', providerReference: 'MAN-TRF', method: 'bank_transfer' }, 'surface-transfer');
  assert.equal((await db.select().from(payments).where(eq(payments.reservationId, ids.reservation))).length, 3);
  assert.notEqual(pos.id, transfer.id);
  const afterManual = await db.query.reservations.findFirst({ where: eq(reservations.id, ids.reservation) });
  assert.equal(afterManual?.paidAmountMinorUnits, 100000);
  assert.equal(afterManual?.paymentStatus, 'part_payment');
  console.log('PASS manual cash, POS, transfer, overpayment block, and idempotency');

  const checkout = await import('../apps/dashboard/src/app/api/invoices/public/[number]/checkout/route');
  const voidPay = await checkout.POST(new Request('https://preview.invalid/api/invoices/public/x/checkout', { method: 'POST' }) as any, { params: Promise.resolve({ number: ids.voidInvoice }) });
  assert.equal(voidPay.status, 400);
  const initializeFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.amount, 100000);
    assert.equal(payload.currency, 'NGN');
    return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.test/surface', reference: payload.reference } }), { status: 200 });
  };
  const started = await paymentFlow.initializePropertyPaystack({ propertyId: ids.property, invoiceId: ids.invoice, email: 'ada@qa.invalid', amountMinorUnits: 100000, currency: 'NGN', source: 'invoice', callbackUrl: 'https://preview.invalid/invoice?payment=confirming', idempotencyKey: 'surface-invoice' }, initializeFetch as typeof fetch);
  const attempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.providerReference, started.reference) });
  assert.equal(attempt?.source, 'invoice');
  assert.equal(attempt?.amountMinorUnits, 100000);
  const invoiceBefore = await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, ids.invoice) });
  assert.equal(invoiceBefore?.status, 'issued');
  const verified = { id: 42, status: 'success', reference: started.reference, amount: 100000, currency: 'NGN', channel: 'card', paid_at: '2032-04-02T10:00:00Z', metadata: { paymentAttemptId: attempt!.id, propertyId: ids.property, source: 'invoice' } };
  const settled = await paymentFlow.settlePropertyPaystack(attempt!.id, verified);
  const replay = await paymentFlow.settlePropertyPaystack(attempt!.id, verified);
  assert.equal(settled.status, 'success');
  assert.equal(replay.status, 'already_processed');
  const invoiceAfter = await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, ids.invoice) });
  assert.equal(invoiceAfter?.status, 'paid');
  assert.equal(invoiceAfter?.paidAmountMinorUnits, 150000);
  const notices = await db.select().from(operationalNotifications).where(eq(operationalNotifications.propertyId, ids.property));
  assert.equal(notices.length, 1);
  assert.equal((await db.select().from(payments).where(eq(payments.invoiceId, ids.invoice))).length, 1);
  console.log('PASS invoice amount, void block, settlement, receipt once, and notification once');
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
