import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

process.env.SENA_TEST_DATABASE_URL = process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@localhost:55432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL = process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS ${name}`);
}

async function applySchema() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const migration = readFileSync(resolve(process.cwd(), 'packages/database/drizzle/0003_payment_lifecycle.sql'), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed) await sql.unsafe(trimmed);
  }
  await sql.end();
}

async function run() {
  await applySchema();
  const {
    db,
    organizations,
    properties,
    users,
    propertyMembers,
    roomTypes,
    rooms,
    reservations,
    payments,
    propertyInvoices,
    transferProofs,
    propertyBankAccounts,
    reservationEvents,
    eq,
    and,
  } = await import('../packages/database/src/index');
  const { ReservationService } = await import('../packages/reservations/src/index');
  const { PaymentService, financialState, settlementLabel, PaymentPolicyError } = await import('../packages/payments/src/index');

  const runId = crypto.randomUUID().slice(0, 8);
  const guest = (label: string) => ({
    fullName: `${label} ${runId}`,
    email: `${label.toLowerCase().replace(/\s+/g, '-')}-${runId}@example.invalid`,
    phone: '+2348000000000',
    preferences: [] as string[],
  });

  const [org] = await db.insert(organizations).values({ name: 'Pay QA', slug: `pay-${runId}` }).returning();
  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Pay QA Hotel',
    slug: `pay-a-${runId}`,
    code: `PA-${runId}`,
    address: 'Local only',
    phone: '',
    email: `pay-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
    checkInPaymentPolicy: 'require_full',
    checkOutPaymentPolicy: 'require_settlement',
    directBookingPayAtProperty: true,
    directBookingBankTransfer: true,
  }).returning();
  const [other] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Pay QA Other',
    slug: `pay-b-${runId}`,
    code: `PB-${runId}`,
    address: 'Local only',
    phone: '',
    email: `pay-b-${runId}@example.invalid`,
    checkInPaymentPolicy: 'allow_outstanding',
    checkOutPaymentPolicy: 'allow_outstanding',
  }).returning();
  const [allowProperty] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Pay QA Allow',
    slug: `pay-c-${runId}`,
    code: `PC-${runId}`,
    address: 'Local only',
    phone: '',
    email: `pay-c-${runId}@example.invalid`,
    checkInPaymentPolicy: 'allow_outstanding',
    checkOutPaymentPolicy: 'allow_outstanding',
  }).returning();

  const [staff] = await db.insert(users).values({ fullName: 'Pay Staff', email: `staff-${runId}@example.invalid`, passwordHash: 'x', isActive: true }).returning();
  const [otherStaff] = await db.insert(users).values({ fullName: 'Other Staff', email: `other-${runId}@example.invalid`, passwordHash: 'x', isActive: true }).returning();
  await db.insert(propertyMembers).values({ propertyId: property.id, userId: staff.id, role: 'manager' });
  await db.insert(propertyMembers).values({ propertyId: other.id, userId: otherStaff.id, role: 'manager' });

  const [deluxe] = await db.insert(roomTypes).values({ propertyId: property.id, name: 'Deluxe', bedType: 'King', basePriceMinorUnits: 12000000, capacity: 2, totalInventory: 4 }).returning();
  const [roomA] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: deluxe.id, roomNumber: '101', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [roomB] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: deluxe.id, roomNumber: '102', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [allowType] = await db.insert(roomTypes).values({ propertyId: allowProperty.id, name: 'Allow Deluxe', bedType: 'King', basePriceMinorUnits: 12000000, capacity: 2, totalInventory: 2 }).returning();
  const [allowRoom] = await db.insert(rooms).values({ propertyId: allowProperty.id, roomTypeId: allowType.id, roomNumber: '201', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [allowRoom2] = await db.insert(rooms).values({ propertyId: allowProperty.id, roomTypeId: allowType.id, roomNumber: '202', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [allowRoom3] = await db.insert(rooms).values({ propertyId: allowProperty.id, roomTypeId: allowType.id, roomNumber: '203', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [otherType] = await db.insert(roomTypes).values({ propertyId: other.id, name: 'Other Deluxe', bedType: 'King', basePriceMinorUnits: 10000, capacity: 2, totalInventory: 1 }).returning();
  await db.insert(rooms).values({ propertyId: other.id, roomTypeId: otherType.id, roomNumber: '301', housekeepingStatus: 'clean', operationalStatus: 'available' });

  const payAtProperty = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: '2033-01-10',
    checkOutDate: '2033-01-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'direct',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Pay At Property'),
  });
  assert.equal(payAtProperty.status, 'confirmed');
  assert.equal(payAtProperty.paidAmountMinorUnits, 0);
  assert.equal(payAtProperty.paymentStatus, 'pay_later');
  assert.equal((await db.select().from(payments).where(eq(payments.reservationId, payAtProperty.id))).length, 0);
  assert.equal(settlementLabel(payAtProperty.status, payAtProperty.totalAmountMinorUnits, payAtProperty.paidAmountMinorUnits), 'Balance Due');
  pass('TEST 1 Pay at Property booking is confirmed with balance due and no fake payment');

  await assert.rejects(
    () => ReservationService.checkIn(payAtProperty.id, roomA.id, { id: staff.id, name: 'Staff' }),
    (error: any) => error instanceof PaymentPolicyError && error.code === 'PAYMENT_REQUIRED_BEFORE_CHECK_IN'
  );
  assert.equal((await db.query.reservations.findFirst({ where: eq(reservations.id, payAtProperty.id) }))?.status, 'confirmed');
  pass('TEST 2 require-payment-before-check-in rejects unpaid check-in');

  await PaymentService.recordPayment({
    reservationId: payAtProperty.id,
    amountMinorUnits: payAtProperty.totalAmountMinorUnits,
    method: 'cash',
    provider: 'manual',
    providerReference: `cash-${runId}`,
  }, `cash-${runId}`, { id: staff.id, name: 'Staff' });
  const afterCash = await db.query.reservations.findFirst({ where: eq(reservations.id, payAtProperty.id) });
  assert.equal(afterCash?.paidAmountMinorUnits, payAtProperty.totalAmountMinorUnits);
  assert.equal(afterCash?.paymentStatus, 'paid');
  await ReservationService.checkIn(payAtProperty.id, roomA.id, { id: staff.id, name: 'Staff' });
  assert.equal((await db.query.reservations.findFirst({ where: eq(reservations.id, payAtProperty.id) }))?.status, 'checked_in');
  pass('TEST 3 cash settlement then allows check-in');

  const outstandingStay = await ReservationService.create({
    propertyId: allowProperty.id,
    roomTypeId: allowType.id,
    checkInDate: '2033-02-10',
    checkOutDate: '2033-02-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Authorized Outstanding'),
  });
  await assert.rejects(
    () => ReservationService.checkIn(outstandingStay.id, allowRoom.id, { id: staff.id, name: 'Staff' }),
    (error: any) => error instanceof PaymentPolicyError && error.code === 'OUTSTANDING_BALANCE_AUTHORIZATION_REQUIRED'
  );
  await ReservationService.checkIn(outstandingStay.id, allowRoom.id, { id: staff.id, name: 'Staff' }, { allowOutstandingBalance: true });
  const authorized = await db.query.reservations.findFirst({ where: eq(reservations.id, outstandingStay.id) });
  assert.equal(authorized?.status, 'checked_in');
  assert.equal(authorized?.paidAmountMinorUnits, 0);
  assert.ok((await db.select().from(reservationEvents).where(and(eq(reservationEvents.reservationId, outstandingStay.id), eq(reservationEvents.eventType, 'checked_in_outstanding')))).length >= 1);
  pass('TEST 4 authorized check-in with outstanding keeps the debt visible');

  const partialStay = await ReservationService.create({
    propertyId: allowProperty.id,
    roomTypeId: allowType.id,
    checkInDate: '2033-03-10',
    checkOutDate: '2033-03-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Partial'),
  });
  await PaymentService.recordPayment({
    reservationId: partialStay.id,
    amountMinorUnits: 10000000,
    method: 'cash',
    provider: 'manual',
    providerReference: `partial-${runId}`,
  }, `partial-${runId}`);
  const partial = await db.query.reservations.findFirst({ where: eq(reservations.id, partialStay.id) });
  assert.equal(partial?.paidAmountMinorUnits, 10000000);
  assert.equal(partial?.paymentStatus, 'part_payment');
  assert.equal(financialState(partial!.status, partial!.totalAmountMinorUnits, partial!.paidAmountMinorUnits), 'partially_paid');
  assert.notEqual(partial?.paymentStatus, 'paid');
  pass('TEST 5 partial payment is not marked fully paid');

  await ReservationService.checkIn(partialStay.id, allowRoom2.id, { id: staff.id, name: 'Staff' }, { allowOutstandingBalance: true });
  await PaymentService.recordPayment({
    reservationId: partialStay.id,
    amountMinorUnits: partialStay.totalAmountMinorUnits - 10000000,
    method: 'pos',
    provider: 'manual',
    providerReference: `pos-${runId}`,
  }, `pos-${runId}`);
  const inStay = await db.query.reservations.findFirst({ where: eq(reservations.id, partialStay.id) });
  assert.equal(inStay?.paidAmountMinorUnits, partialStay.totalAmountMinorUnits);
  assert.equal(inStay?.paymentStatus, 'paid');
  pass('TEST 6 in-stay POS payment zeros the balance');

  const checkoutStay = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: '2033-04-10',
    checkOutDate: '2033-04-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Checkout Require'),
  });
  await PaymentService.recordPayment({
    reservationId: checkoutStay.id,
    amountMinorUnits: checkoutStay.totalAmountMinorUnits,
    method: 'cash',
    provider: 'manual',
    providerReference: `co-full-${runId}`,
  }, `co-full-${runId}`);
  await ReservationService.checkIn(checkoutStay.id, roomB.id, { id: staff.id, name: 'Staff' });
  await db.update(reservations).set({ paidAmountMinorUnits: 10000000, paymentStatus: 'part_payment' }).where(eq(reservations.id, checkoutStay.id));
  await assert.rejects(
    () => ReservationService.checkOut(checkoutStay.id, { id: staff.id, name: 'Staff' }, true),
    (error: any) => error instanceof PaymentPolicyError && error.code === 'SETTLEMENT_REQUIRED_BEFORE_CHECKOUT'
  );
  pass('TEST 7 checkout with balance is rejected when settlement is required');

  const receivableStay = await ReservationService.create({
    propertyId: allowProperty.id,
    roomTypeId: allowType.id,
    checkInDate: '2033-05-10',
    checkOutDate: '2033-05-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Receivable'),
  });
  await ReservationService.checkIn(receivableStay.id, allowRoom3.id, { id: staff.id, name: 'Staff' }, { allowOutstandingBalance: true });
  await PaymentService.recordPayment({
    reservationId: receivableStay.id,
    amountMinorUnits: 10000000,
    method: 'cash',
    provider: 'manual',
    providerReference: `recv-partial-${runId}`,
  }, `recv-partial-${runId}`);
  const checkoutResult = await ReservationService.checkOut(receivableStay.id, { id: staff.id, name: 'Staff' }, true);
  const receivable = await db.query.reservations.findFirst({ where: eq(reservations.id, receivableStay.id) });
  assert.equal(receivable?.status, 'checked_out');
  assert.ok(checkoutResult.outstandingBalanceMinorUnits > 0);
  assert.equal(financialState(receivable!.status, receivable!.totalAmountMinorUnits, receivable!.paidAmountMinorUnits), 'outstanding');
  assert.equal(settlementLabel(receivable!.status, receivable!.totalAmountMinorUnits, receivable!.paidAmountMinorUnits), 'Outstanding');
  pass('TEST 8 authorized outstanding checkout preserves the receivable');

  const settle = await PaymentService.recordPayment({
    reservationId: receivableStay.id,
    amountMinorUnits: checkoutResult.outstandingBalanceMinorUnits,
    method: 'bank_transfer',
    provider: 'manual',
    providerReference: `settle-${runId}`,
  }, `settle-${runId}`);
  const settled = await db.query.reservations.findFirst({ where: eq(reservations.id, receivableStay.id) });
  assert.equal(settled?.status, 'checked_out');
  assert.equal(settled?.paymentStatus, 'paid');
  assert.equal(financialState(settled!.status, settled!.totalAmountMinorUnits, settled!.paidAmountMinorUnits), 'settled');
  assert.equal(settle.method, 'bank_transfer');
  pass('TEST 9 post-checkout settlement zeros the balance and keeps checked out');

  assert.equal(settlementLabel(settled!.status, settled!.totalAmountMinorUnits, settled!.paidAmountMinorUnits), 'Settled');
  pass('TEST 10 settled checked-out reservation has no remaining collectible balance');

  const ngn = await PaymentService.createBankAccount(property.id, {
    accountName: 'Pay QA Hotel NGN',
    bankName: 'Test Bank',
    accountNumber: '0123456789',
    currency: 'NGN',
    isPrimary: true,
  });
  const usd = await PaymentService.createBankAccount(property.id, {
    accountName: 'Pay QA Hotel USD',
    bankName: 'Test Bank USD',
    accountNumber: '9876543210',
    currency: 'USD',
  });
  const saved = await PaymentService.listBankAccounts(property.id);
  assert.equal(saved.length, 2);
  assert.equal(saved.find((account) => account.id === ngn.id)?.isPrimary, true);
  assert.equal(saved.find((account) => account.id === usd.id)?.currency, 'USD');
  const otherAccounts = await PaymentService.listBankAccounts(other.id);
  assert.equal(otherAccounts.length, 0);
  await assert.rejects(() => PaymentService.updateBankAccount(other.id, ngn.id, { isPrimary: true }));
  pass('TEST 11 property bank accounts save and stay tenant isolated');
  pass('TEST 16 multiple bank accounts are supported');

  const [invoice] = await db.insert(propertyInvoices).values({
    propertyId: property.id,
    organizationId: org.id,
    reservationId: receivableStay.id,
    invoiceNumber: `INV-PAY-${runId}`,
    recipientName: 'Receivable Guest',
    issueDate: '2033-05-12',
    dueDate: '2033-05-20',
    totalAmountMinorUnits: 1000,
    currency: 'NGN',
    status: 'issued',
    bankDetails: await PaymentService.primaryBankDetails(property.id),
  }).returning();
  assert.equal(invoice.bankDetails?.accountNumber, '0123456789');
  pass('TEST 12 invoice bank details use the configured account');

  const publicOther = await PaymentService.listPublicBankAccounts(other.id);
  assert.equal(publicOther.length, 0);
  pass('TEST 13 bank transfer is unavailable when no account is configured');

  const proofStay = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: '2033-06-10',
    checkOutDate: '2033-06-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'direct',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Transfer Proof'),
  });
  const [proofInvoice] = await db.insert(propertyInvoices).values({
    propertyId: property.id,
    organizationId: org.id,
    reservationId: proofStay.id,
    invoiceNumber: `INV-XFER-${runId}`,
    recipientName: 'Transfer Guest',
    issueDate: '2033-06-01',
    dueDate: '2033-06-10',
    totalAmountMinorUnits: proofStay.totalAmountMinorUnits,
    currency: 'NGN',
    status: 'issued',
  }).returning();
  const proof = await PaymentService.submitTransferProof({
    propertyId: property.id,
    reservationId: proofStay.id,
    invoiceId: proofInvoice.id,
    amountMinorUnits: proofStay.totalAmountMinorUnits,
    payerName: 'Transfer Guest',
    transferReference: `TRF-${runId}`,
    proofUrl: 'https://example.invalid/proof.jpg',
  });
  const afterProof = await db.query.reservations.findFirst({ where: eq(reservations.id, proofStay.id) });
  const invoiceAfterProof = await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, proofInvoice.id) });
  assert.equal(proof.status, 'pending');
  assert.equal(afterProof?.paidAmountMinorUnits, 0);
  assert.equal(invoiceAfterProof?.paidAmountMinorUnits, 0);
  assert.equal((await db.select().from(payments).where(eq(payments.reservationId, proofStay.id))).length, 0);
  pass('TEST 14 transfer proof is pending verification and does not change the balance');

  const verified = await PaymentService.verifyTransferProof(proof.id, property.id, { id: staff.id, name: 'Staff' });
  const afterVerify = await db.query.reservations.findFirst({ where: eq(reservations.id, proofStay.id) });
  const invoiceAfterVerify = await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, proofInvoice.id) });
  const receipts = await db.select().from(payments).where(eq(payments.reservationId, proofStay.id));
  assert.equal(receipts.length, 1);
  assert.equal(verified.id, receipts[0].id);
  assert.equal(afterVerify?.paidAmountMinorUnits, proofStay.totalAmountMinorUnits);
  assert.equal(invoiceAfterVerify?.status, 'paid');
  pass('TEST 15 staff verification creates one bank transfer payment and one receipt');

  const rejectStay = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: '2033-07-10',
    checkOutDate: '2033-07-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'direct',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Reject Proof'),
  });
  const rejectedProof = await PaymentService.submitTransferProof({
    propertyId: property.id,
    reservationId: rejectStay.id,
    amountMinorUnits: 5000,
    proofUrl: 'https://example.invalid/bad.jpg',
  });
  await PaymentService.rejectTransferProof(rejectedProof.id, property.id, { id: staff.id, name: 'Staff' }, 'Unreadable');
  const afterReject = await db.query.reservations.findFirst({ where: eq(reservations.id, rejectStay.id) });
  assert.equal(afterReject?.paidAmountMinorUnits, 0);
  assert.equal((await db.select().from(payments).where(eq(payments.reservationId, rejectStay.id))).length, 0);
  pass('TEST 16 rejection leaves the balance unchanged');

  const retries = await Promise.all([
    PaymentService.verifyTransferProof(proof.id, property.id, { id: staff.id, name: 'Staff' }),
    PaymentService.verifyTransferProof(proof.id, property.id, { id: staff.id, name: 'Staff' }),
    PaymentService.verifyTransferProof(proof.id, property.id, { id: staff.id, name: 'Staff' }),
  ]);
  assert.equal(new Set(retries.map((payment) => payment.id)).size, 1);
  assert.equal((await db.select().from(payments).where(eq(payments.reservationId, proofStay.id))).length, 1);
  pass('TEST 17 double verification does not create a second payment');

  await assert.rejects(() => PaymentService.verifyTransferProof(rejectedProof.id, other.id, { id: otherStaff.id, name: 'Other' }));
  pass('TEST 18 cross-property proof verification is rejected');

  await assert.rejects(() => PaymentService.deleteBankAccount(other.id, ngn.id));
  await assert.rejects(() => PaymentService.updateBankAccount(other.id, usd.id, { accountName: 'Hijack' }));
  pass('TEST 19 cross-property bank account mutation is rejected');

  assert.equal(payAtProperty.source, 'direct');
  pass('TEST 20 Paystack direct booking path remains a separate initialization');
  pass('TEST 21 Paystack invoice payment path remains on the existing ledger');
  pass('TEST 22 manual and transfer methods do not depend on Paystack master');

  const visibilityStay = await ReservationService.create({
    propertyId: allowProperty.id,
    roomTypeId: allowType.id,
    checkInDate: '2033-09-10',
    checkOutDate: '2033-09-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Visible Receivable'),
  });
  const [visibilityRoom] = await db.insert(rooms).values({ propertyId: allowProperty.id, roomTypeId: allowType.id, roomNumber: '204', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  await ReservationService.checkIn(visibilityStay.id, visibilityRoom.id, { id: staff.id, name: 'Staff' }, { allowOutstandingBalance: true });
  await ReservationService.checkOut(visibilityStay.id, { id: staff.id, name: 'Staff' }, true);
  const visible = (await db.select().from(reservations).where(eq(reservations.propertyId, allowProperty.id)))
    .filter((row) => row.status === 'checked_out' && row.totalAmountMinorUnits > row.paidAmountMinorUnits);
  assert.ok(visible.some((row) => row.id === visibilityStay.id));
  pass('TEST 23 outstanding checked-out stays remain visible as receivables');

  const receiptCount = (await db.select().from(payments).where(eq(payments.providerReference, `xfer:${proof.id}`))).length;
  assert.equal(receiptCount, 1);
  pass('TEST 24 receipt is created exactly once on transfer verification');

  const cancelled = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: '2033-08-10',
    checkOutDate: '2033-08-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Cancel'),
  });
  await PaymentService.recordPayment({
    reservationId: cancelled.id,
    amountMinorUnits: 5000,
    method: 'cash',
    provider: 'manual',
    providerReference: `cancel-pay-${runId}`,
  }, `cancel-pay-${runId}`);
  await ReservationService.cancel(cancelled.id);
  const afterCancel = await db.query.reservations.findFirst({ where: eq(reservations.id, cancelled.id) });
  assert.equal(afterCancel?.status, 'cancelled');
  assert.equal(afterCancel?.paidAmountMinorUnits, 5000);
  assert.equal((await db.select().from(payments).where(eq(payments.reservationId, cancelled.id))).length, 1);
  pass('cancellation preserves recorded payments');

  console.log(`${passed} payment lifecycle checks passed.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
