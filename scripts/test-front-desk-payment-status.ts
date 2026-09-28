import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

delete process.env.PAYSTACK_SECRET_KEY;
delete process.env.PAYSTACK_PUBLIC_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_PASSWORD;

process.env.SENA_TEST_DATABASE_URL = process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@localhost:55432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL = process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS ${name}`);
}

function source(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

async function run() {
  const { deskPaymentStatus } = await import('../apps/dashboard/src/lib/financial-status');
  const { formatNaira } = await import('../packages/config/src/index');

  const unpaidStatus = deskPaymentStatus({
    totalAmountMinorUnits: 2500000,
    paidAmountMinorUnits: 0,
    pendingTransferProof: false,
  });
  assert.equal(unpaidStatus.kind, 'not_paid');
  assert.equal(unpaidStatus.label, 'NOT PAID');
  assert.equal(unpaidStatus.columnLabel, `Not Paid ${formatNaira(2500000)} due`);
  assert.equal(unpaidStatus.amountDueMinorUnits, 2500000);
  assert.equal(unpaidStatus.dueLabel, formatNaira(2500000));
  pass('TEST 1 NOT PAID uses folio amounts, not reservation status');

  const partialStatus = deskPaymentStatus({
    totalAmountMinorUnits: 2500000,
    paidAmountMinorUnits: 1000000,
  });
  assert.equal(partialStatus.kind, 'partially_paid');
  assert.equal(partialStatus.label, 'PARTIALLY PAID');
  assert.equal(partialStatus.columnLabel, `Partially Paid ${formatNaira(1500000)} due`);
  assert.equal(partialStatus.paidMinorUnits, 1000000);
  assert.equal(partialStatus.amountDueMinorUnits, 1500000);
  pass('TEST 2 PARTIALLY PAID shows paid amount and amount due');

  const paidDespitePayLater = deskPaymentStatus({
    totalAmountMinorUnits: 2500000,
    paidAmountMinorUnits: 2500000,
  });
  assert.equal(paidDespitePayLater.kind, 'paid');
  assert.equal(paidDespitePayLater.label, 'PAID');
  assert.equal(paidDespitePayLater.columnLabel, 'Paid');
  assert.equal(paidDespitePayLater.amountDueMinorUnits, 0);
  assert.equal(paidDespitePayLater.receivedLabel, formatNaira(2500000));
  pass('TEST 3 PAID is derived from zero folio balance, not paymentStatus');

  const pending = deskPaymentStatus({
    totalAmountMinorUnits: 2500000,
    paidAmountMinorUnits: 0,
    pendingTransferProof: true,
  });
  assert.equal(pending.kind, 'pending_verification');
  assert.equal(pending.label, 'PENDING VERIFICATION');
  assert.equal(pending.columnLabel, 'Pending Verification');
  assert.equal(pending.amountDueMinorUnits, 2500000);
  const pendingIgnoredWhenPaid = deskPaymentStatus({
    totalAmountMinorUnits: 2500000,
    paidAmountMinorUnits: 2500000,
    pendingTransferProof: true,
  });
  assert.equal(pendingIgnoredWhenPaid.kind, 'paid');
  pass('TEST 4 PENDING VERIFICATION is shown only while proof is unverified and money is due');

  assert.equal(unpaidStatus.dueLabel, '₦25,000');
  assert.equal(partialStatus.dueLabel, '₦15,000');
  pass('TEST 5 Amount due is shown in naira without accounting jargon');

  const {
    db,
    organizations,
    properties,
    roomTypes,
    rooms,
    reservations,
    transferProofs,
    eq,
  } = await import('../packages/database/src/index');
  const { ReservationService, listEligibleRooms } = await import('../packages/reservations/src/index');
  const { PaymentService, PaymentPolicyError } = await import('../packages/payments/src/index');

  const runId = crypto.randomUUID().slice(0, 8);
  const guest = (label: string) => ({
    fullName: `${label} ${runId}`,
    email: `${label.toLowerCase().replace(/\s+/g, '-')}-${runId}@example.invalid`,
    phone: '+2348000000000',
    preferences: [] as string[],
  });

  const [org] = await db.insert(organizations).values({ name: 'Desk UX QA', slug: `desk-${runId}` }).returning();
  const [requireProperty] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Desk UX Require',
    slug: `desk-r-${runId}`,
    code: `DR-${runId}`,
    address: 'Local only',
    phone: '',
    email: `desk-r-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
    checkInPaymentPolicy: 'require_full',
  }).returning();
  const [allowProperty] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Desk UX Allow',
    slug: `desk-a-${runId}`,
    code: `DA-${runId}`,
    address: 'Local only',
    phone: '',
    email: `desk-a-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
    checkInPaymentPolicy: 'allow_outstanding',
  }).returning();

  const [requireType] = await db.insert(roomTypes).values({
    propertyId: requireProperty.id,
    name: 'Deluxe',
    bedType: 'King',
    basePriceMinorUnits: 2000000,
    capacity: 2,
    totalInventory: 3,
  }).returning();
  const [allowType] = await db.insert(roomTypes).values({
    propertyId: allowProperty.id,
    name: 'Deluxe',
    bedType: 'King',
    basePriceMinorUnits: 2000000,
    capacity: 2,
    totalInventory: 3,
  }).returning();
  const [requireClean] = await db.insert(rooms).values({
    propertyId: requireProperty.id,
    roomTypeId: requireType.id,
    roomNumber: '101',
    housekeepingStatus: 'clean',
    operationalStatus: 'available',
  }).returning();
  const [requireDirty] = await db.insert(rooms).values({
    propertyId: requireProperty.id,
    roomTypeId: requireType.id,
    roomNumber: '102',
    housekeepingStatus: 'dirty',
    operationalStatus: 'available',
  }).returning();
  const [allowClean] = await db.insert(rooms).values({
    propertyId: allowProperty.id,
    roomTypeId: allowType.id,
    roomNumber: '201',
    housekeepingStatus: 'clean',
    operationalStatus: 'available',
  }).returning();
  const [allowClean2] = await db.insert(rooms).values({
    propertyId: allowProperty.id,
    roomTypeId: allowType.id,
    roomNumber: '202',
    housekeepingStatus: 'clean',
    operationalStatus: 'available',
  }).returning();

  const unpaidStay = await ReservationService.create({
    propertyId: requireProperty.id,
    roomTypeId: requireType.id,
    checkInDate: '2034-01-10',
    checkOutDate: '2034-01-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Unpaid Arrival'),
  });

  await PaymentService.recordPayment({
    reservationId: unpaidStay.id,
    amountMinorUnits: unpaidStay.totalAmountMinorUnits,
    method: 'cash',
    provider: 'manual',
    providerReference: `desk-cash-${runId}`,
  }, `desk-cash-${runId}`, { id: '', name: 'Front Desk' });
  const afterCash = await db.query.reservations.findFirst({ where: eq(reservations.id, unpaidStay.id) });
  const afterCashStatus = deskPaymentStatus({
    totalAmountMinorUnits: afterCash!.totalAmountMinorUnits,
    paidAmountMinorUnits: afterCash!.paidAmountMinorUnits,
  });
  assert.equal(afterCashStatus.kind, 'paid');
  assert.equal(afterCash?.paidAmountMinorUnits, unpaidStay.totalAmountMinorUnits);
  pass('TEST 6 Record Payment reuses the certified payment domain and zeros the folio');

  const liveStay = await ReservationService.create({
    propertyId: allowProperty.id,
    roomTypeId: allowType.id,
    checkInDate: '2034-02-10',
    checkOutDate: '2034-02-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Live Refresh'),
  });
  let live = deskPaymentStatus({
    totalAmountMinorUnits: liveStay.totalAmountMinorUnits,
    paidAmountMinorUnits: liveStay.paidAmountMinorUnits,
  });
  assert.equal(live.kind, 'not_paid');
  await PaymentService.recordPayment({
    reservationId: liveStay.id,
    amountMinorUnits: 1000000,
    method: 'pos',
    provider: 'manual',
    providerReference: `desk-pos-${runId}`,
  }, `desk-pos-${runId}`);
  const afterPartial = await db.query.reservations.findFirst({ where: eq(reservations.id, liveStay.id) });
  live = deskPaymentStatus({
    totalAmountMinorUnits: afterPartial!.totalAmountMinorUnits,
    paidAmountMinorUnits: afterPartial!.paidAmountMinorUnits,
  });
  assert.equal(live.kind, 'partially_paid');
  await PaymentService.recordPayment({
    reservationId: liveStay.id,
    amountMinorUnits: afterPartial!.totalAmountMinorUnits - afterPartial!.paidAmountMinorUnits,
    method: 'cash',
    provider: 'manual',
    providerReference: `desk-cash-2-${runId}`,
  }, `desk-cash-2-${runId}`);
  const afterFull = await db.query.reservations.findFirst({ where: eq(reservations.id, liveStay.id) });
  live = deskPaymentStatus({
    totalAmountMinorUnits: afterFull!.totalAmountMinorUnits,
    paidAmountMinorUnits: afterFull!.paidAmountMinorUnits,
  });
  assert.equal(live.kind, 'paid');
  pass('TEST 7 payment status live-refreshes from the folio after each certified payment');

  const blockedStay = await ReservationService.create({
    propertyId: requireProperty.id,
    roomTypeId: requireType.id,
    checkInDate: '2034-03-10',
    checkOutDate: '2034-03-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Require Full'),
  });
  await assert.rejects(
    () => ReservationService.checkIn(blockedStay.id, requireClean.id, { id: '', name: 'Front Desk' }, { allowOutstandingBalance: true }),
    (error: unknown) => error instanceof PaymentPolicyError && (error as PaymentPolicyError).code === 'PAYMENT_REQUIRED_BEFORE_CHECK_IN'
  );
  assert.equal((await db.query.reservations.findFirst({ where: eq(reservations.id, blockedStay.id) }))?.status, 'confirmed');
  pass('TEST 8 require_full still rejects unpaid check-in on the server');

  const allowStay = await ReservationService.create({
    propertyId: allowProperty.id,
    roomTypeId: allowType.id,
    checkInDate: '2034-04-10',
    checkOutDate: '2034-04-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Continue Without'),
  });
  await assert.rejects(
    () => ReservationService.checkIn(allowStay.id, allowClean.id, { id: '', name: 'Front Desk' }),
    (error: unknown) => error instanceof PaymentPolicyError && (error as PaymentPolicyError).code === 'OUTSTANDING_BALANCE_AUTHORIZATION_REQUIRED'
  );
  await ReservationService.checkIn(allowStay.id, allowClean.id, { id: '', name: 'Front Desk' }, { allowOutstandingBalance: true });
  const continued = await db.query.reservations.findFirst({ where: eq(reservations.id, allowStay.id) });
  assert.equal(continued?.status, 'checked_in');
  assert.equal(continued?.paidAmountMinorUnits, 0);
  pass('TEST 9 Continue without payment still requires explicit authorization');

  const dialogSource = source('apps/dashboard/src/components/check-in-room-dialog.tsx');
  assert.match(dialogSource, /Continue without payment\?/);
  assert.match(dialogSource, /will remain due/);
  assert.match(dialogSource, /The guest will still owe/);
  assert.doesNotMatch(dialogSource, /window\.confirm|[^.\w]confirm\(/);
  assert.doesNotMatch(dialogSource, /collectible|outstanding receivable|This stay will remain collectible/i);
  pass('TEST 10 outstanding confirmation uses the Sena dialog, not native confirm');

  const eligible = await listEligibleRooms({
    propertyId: requireProperty.id,
    roomTypeId: requireType.id,
    checkInDate: '2034-05-10',
    checkOutDate: '2034-05-12',
    forCheckIn: true,
  });
  assert.equal(eligible.find((room) => room.id === requireDirty.id)?.eligible, false);
  assert.equal(eligible.find((room) => room.id === requireDirty.id)?.readinessLabel, 'Dirty');
  assert.equal(eligible.find((room) => room.id === requireClean.id)?.eligible, true);
  await assert.rejects(() => ReservationService.checkIn(blockedStay.id, requireDirty.id, { id: '', name: 'Front Desk' }), /clean room/i);
  assert.match(dialogSource, /PhysicalRoomSelect/);
  pass('TEST 11 room selector still blocks dirty rooms at check-in');

  assert.equal(unpaidStatus.columnLabel, 'Not Paid ₦25,000 due');
  assert.equal(partialStatus.columnLabel, 'Partially Paid ₦15,000 due');
  assert.equal(paidDespitePayLater.columnLabel, 'Paid');
  assert.equal(pending.columnLabel, 'Pending Verification');
  const frontDesk = source('apps/dashboard/src/app/front-desk/page.tsx');
  assert.match(frontDesk, /DeskPaymentBadge/);
  assert.doesNotMatch(frontDesk, /isPaid \? 'Settled'/);
  pass('TEST 12 Front Desk Settlement uses Paid / Not Paid / Partially Paid / Pending Verification');

  const overview = source('apps/dashboard/src/app/page.tsx');
  const reservationsPage = source('apps/dashboard/src/app/reservations/page.tsx');
  const drawer = source('apps/dashboard/src/components/reservation-drawer.tsx');
  assert.match(overview, /CheckInRoomDialog/);
  assert.match(overview, /DeskPaymentBadge/);
  assert.match(reservationsPage, /CheckInRoomDialog/);
  assert.match(reservationsPage, /DeskPaymentBadge/);
  assert.match(drawer, /CheckInPaymentStatus/);
  assert.match(dialogSource, /CheckInPaymentStatus/);
  pass('TEST 13 Overview check-in uses the shared payment-status presentation');
  pass('TEST 14 Reservations check-in uses the shared payment-status presentation');

  await PaymentService.recordPayment({
    reservationId: blockedStay.id,
    amountMinorUnits: blockedStay.totalAmountMinorUnits,
    method: 'cash',
    provider: 'manual',
    providerReference: `desk-require-${runId}`,
  }, `desk-require-${runId}`);
  await ReservationService.checkIn(blockedStay.id, requireClean.id, { id: '', name: 'Front Desk' });
  assert.equal((await db.query.reservations.findFirst({ where: eq(reservations.id, blockedStay.id) }))?.status, 'checked_in');
  pass('TEST 15 server payment invariant: paid folio can check in; unpaid require_full cannot');

  const occupiedStay = await ReservationService.create({
    propertyId: allowProperty.id,
    roomTypeId: allowType.id,
    checkInDate: '2034-06-10',
    checkOutDate: '2034-06-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Occupied Room'),
  });
  await assert.rejects(
    () => ReservationService.checkIn(occupiedStay.id, allowClean.id, { id: '', name: 'Front Desk' }, { allowOutstandingBalance: true }),
    /no longer available|occupied|already/i
  );
  pass('TEST 16 server room invariant: occupied rooms stay blocked');

  await db.insert(transferProofs).values({
    propertyId: allowProperty.id,
    reservationId: liveStay.id,
    amountMinorUnits: 5000,
    proofUrl: 'https://example.invalid/proof.jpg',
    status: 'pending',
  });
  const proofStay = await db.query.reservations.findFirst({ where: eq(reservations.id, liveStay.id) });
  const proofStatus = deskPaymentStatus({
    totalAmountMinorUnits: proofStay!.totalAmountMinorUnits,
    paidAmountMinorUnits: proofStay!.paidAmountMinorUnits,
    pendingTransferProof: true,
  });
  assert.equal(proofStatus.kind, 'paid');
  pass('TEST 17 verified/paid folio stays PAID even if a leftover proof flag is present');

  assert.match(dialogSource, /Record Payment/);
  assert.match(dialogSource, /Send Invoice/);
  assert.match(dialogSource, /Payment required before check-in/);
  assert.match(dialogSource, /allowOutstandingBalance/);
  assert.match(dialogSource, /embedded/);
  assert.match(dialogSource, /min-h-11/);
  assert.match(source('apps/dashboard/src/components/record-payment-dialog.tsx'), /cash/);
  assert.match(source('apps/dashboard/src/components/record-payment-dialog.tsx'), /pos/);
  assert.match(source('apps/dashboard/src/components/record-payment-dialog.tsx'), /bank_transfer/);
  pass('TEST 18 check-in records Cash, POS, or Bank Transfer through the existing payment dialog');

  console.log(`\nFront Desk payment status UX: ${passed} checks passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
