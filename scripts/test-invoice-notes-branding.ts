import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROLE_PERMISSIONS } from '../packages/config/src/index';
import {
  BELOW_PAID,
  CLOSED_INVOICE,
  PAID_FINANCIAL_LOCK,
  calculateInvoiceAmounts,
  planInvoiceEdit,
  type EditableInvoice,
} from '../apps/dashboard/src/lib/invoice-edit';
import { invoiceStatusLabel, presentInvoiceDocument } from '../apps/dashboard/src/lib/invoice-document';
import { applyInvoiceSettlementToReservation } from '../apps/dashboard/src/lib/invoice-settlement';

delete process.env.PAYSTACK_SECRET_KEY;
delete process.env.PAYSTACK_PUBLIC_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_PASSWORD;
delete process.env.REDIS_URL;
delete process.env.S3_ACCESS_KEY_ID;
delete process.env.S3_SECRET_ACCESS_KEY;
delete process.env.FLUTTERWAVE_SECRET_KEY;
delete process.env.FLUTTERWAVE_TEST_SECRET_KEY;

process.env.SENA_TEST_DATABASE_URL = process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@localhost:55432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL = process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

const STAY_CONNECT = '63c6b4f4-fee4-415c-be16-c064a44edc76';
const PROPERTY_A = '33000000-0000-4000-8000-000000000003';
const ORG_A = '33000000-0000-4000-8000-000000000001';
const PROPERTY_B = '33000000-0000-4000-8000-000000000004';

function source(path: string) {
  return readFileSync(resolve(path), 'utf8');
}

function invoice(overrides: Partial<EditableInvoice> = {}): EditableInvoice {
  return {
    status: 'issued',
    recipientName: 'Ada Okonkwo',
    recipientEmail: 'ada@example.invalid',
    recipientPhone: '+2348000000000',
    recipientAddress: '12 Broad Street',
    companyTin: null,
    issueDate: '2026-10-01',
    dueDate: '2026-10-08',
    subtotalMinorUnits: 10_000_00,
    taxVatMinorUnits: 0,
    taxConsumptionMinorUnits: 0,
    serviceChargeMinorUnits: 0,
    discountMinorUnits: 0,
    totalAmountMinorUnits: 10_000_00,
    paidAmountMinorUnits: 0,
    items: [{
      id: 'item_1',
      description: 'Deluxe room, 2 nights',
      category: 'room',
      quantity: 2,
      unitPriceMinorUnits: 5_000_00,
      totalMinorUnits: 10_000_00,
    }],
    bankDetails: null,
    paymentTerms: 'Due on receipt',
    notes: null,
    ...overrides,
  };
}

const unpaid = planInvoiceEdit(invoice(), {
  recipientName: 'Ada Okonkwo Ltd',
  recipientEmail: 'ACCOUNTS@Example.invalid',
  dueDate: '2026-10-15',
  items: [{ id: 'item_1', description: 'A very long stay description for a company guest who needs the full accommodation name printed clearly', category: 'room', quantity: 3, unitPriceMinorUnits: 4_000_00 }],
  applyVat: true,
  discountMinorUnits: 1_000_00,
  notes: 'Please quote the invoice number.',
}, { today: '2026-10-01' });
assert.equal(unpaid.ok, true);
if (!unpaid.ok) throw new Error('unpaid edit');
assert.equal(unpaid.patch.recipientEmail, 'accounts@example.invalid');
assert.equal(unpaid.patch.dueDate, '2026-10-15');
assert.equal(unpaid.patch.subtotalMinorUnits, 12_000_00);
assert.equal(unpaid.patch.taxVatMinorUnits, Math.round(12_000_00 * 0.075));
assert.equal(unpaid.patch.discountMinorUnits, 1_000_00);
assert.equal(unpaid.patch.totalAmountMinorUnits, 12_000_00 + Math.round(12_000_00 * 0.075) - 1_000_00);
assert.equal(unpaid.patch.paidAmountMinorUnits, undefined);
assert.equal(unpaid.changes.some((change) => change.field === 'recipientName'), true);
assert.equal(unpaid.changes.some((change) => change.field === 'totalAmountMinorUnits'), true);
console.log('PASS unpaid invoice edit recalculates totals, due date, customer, and lines');

const ignoredTotal = planInvoiceEdit(invoice(), {
  notes: 'Front desk correction',
  totalAmountMinorUnits: 1,
  paidAmountMinorUnits: 999,
} as never, { today: '2026-10-01' });
assert.equal(ignoredTotal.ok, true);
if (!ignoredTotal.ok) throw new Error('notes');
assert.equal(ignoredTotal.patch.totalAmountMinorUnits, undefined);
assert.equal(ignoredTotal.patch.paidAmountMinorUnits, undefined);
assert.deepEqual(ignoredTotal.changes.map((change) => change.field), ['notes']);
console.log('PASS server ignores browser totals');

const partial = planInvoiceEdit(invoice({ status: 'partially_paid', paidAmountMinorUnits: 6_000_00 }), {
  items: [{ description: 'Reduced stay', category: 'room', quantity: 1, unitPriceMinorUnits: 5_000_00 }],
}, { today: '2026-10-01' });
assert.equal(partial.ok, false);
if (partial.ok) throw new Error('partial should fail');
assert.equal(partial.error, BELOW_PAID);
assert.equal(partial.status, 409);
console.log('PASS partial payment cannot drop the total below the amount paid');

const partialOk = planInvoiceEdit(invoice({ status: 'partially_paid', paidAmountMinorUnits: 6_000_00 }), {
  items: [{ description: 'Adjusted stay', category: 'room', quantity: 2, unitPriceMinorUnits: 4_000_00 }],
}, { today: '2026-10-01' });
assert.equal(partialOk.ok, true);
if (!partialOk.ok) throw new Error('partial ok');
assert.equal(partialOk.patch.totalAmountMinorUnits, 8_000_00);
assert.equal(partialOk.patch.paidAmountMinorUnits, undefined);
assert.equal(partialOk.patch.status, undefined);
const settledByEdit = planInvoiceEdit(invoice({ status: 'partially_paid', paidAmountMinorUnits: 6_000_00 }), {
  items: [{ description: 'Exact cover', category: 'room', quantity: 1, unitPriceMinorUnits: 6_000_00 }],
}, { today: '2026-10-01' });
assert.equal(settledByEdit.ok, true);
if (!settledByEdit.ok) throw new Error('settled by edit');
assert.equal(settledByEdit.patch.totalAmountMinorUnits, 6_000_00);
assert.equal(settledByEdit.patch.status, 'paid');
assert.equal(settledByEdit.patch.paidAmountMinorUnits, undefined);
console.log('PASS partial payment can correct lines while keeping the amount paid');

const paid = planInvoiceEdit(invoice({ status: 'paid', paidAmountMinorUnits: 10_000_00 }), {
  items: [{ description: 'Changed', category: 'room', quantity: 1, unitPriceMinorUnits: 1 }],
  recipientName: 'Ada Okonkwo',
}, { today: '2026-10-01' });
assert.equal(paid.ok, false);
if (paid.ok) throw new Error('paid should lock');
assert.equal(paid.error, PAID_FINANCIAL_LOCK);
const paidSafe = planInvoiceEdit(invoice({ status: 'paid', paidAmountMinorUnits: 10_000_00 }), {
  recipientPhone: '+2348000000001',
  notes: 'Accounts copy',
}, { today: '2026-10-01' });
assert.equal(paidSafe.ok, true);
if (!paidSafe.ok) throw new Error('paid safe');
assert.equal(paidSafe.patch.totalAmountMinorUnits, undefined);
assert.equal(paidSafe.patch.notes, 'Accounts copy');
const paidDueDate = planInvoiceEdit(invoice({ status: 'paid', paidAmountMinorUnits: 1_000_00, totalAmountMinorUnits: 10_000_00 }), {
  dueDate: '2026-10-20',
}, { today: '2026-10-01' });
assert.equal(paidDueDate.ok, true);
if (!paidDueDate.ok) throw new Error('paid due date');
assert.equal(paidDueDate.patch.status, undefined);
assert.equal(paidDueDate.patch.dueDate, '2026-10-20');
console.log('PASS paid invoices lock financial amounts and allow contact corrections');

const closed = planInvoiceEdit(invoice({ status: 'void' }), { notes: 'nope' });
assert.equal(closed.ok, false);
if (closed.ok) throw new Error('void');
assert.equal(closed.error, CLOSED_INVOICE);
console.log('PASS void invoices stay closed');

const settlement = applyInvoiceSettlementToReservation({
  reservationPaidMinorUnits: 0,
  reservationTotalMinorUnits: 15_000_000,
  amountMinorUnits: 16_000_000,
});
assert.equal(settlement.paidAmountMinorUnits, 16_000_000);
assert.equal(settlement.paymentStatus, 'paid');
const paymentRoute = source('apps/dashboard/src/app/api/invoices/[id]/payments/route.ts');
assert.match(paymentRoute, /applyInvoiceSettlementToReservation/);
assert.doesNotMatch(paymentRoute, /Amount is more than the reservation outstanding balance/);
const editRoute = source('apps/dashboard/src/app/api/invoices/[id]/route.ts');
assert.match(editRoute, /planInvoiceEdit/);
assert.match(editRoute, /activityLogs/);
assert.doesNotMatch(editRoute, /applyInvoiceSettlementToReservation/);
assert.doesNotMatch(editRoute, /paidAmountMinorUnits:/);
console.log('PASS invoice edits do not rewrite settlement or payment rows');

assert.equal(ROLE_PERMISSIONS.housekeeping.includes('payment.record'), false);
assert.equal(ROLE_PERMISSIONS.housekeeping.includes('reservation.read'), false);
assert.equal(ROLE_PERMISSIONS.front_desk.includes('payment.record'), true);
assert.equal(ROLE_PERMISSIONS.front_desk.includes('reservation.create'), true);
assert.match(source('apps/dashboard/src/app/api/reservations/[id]/notes/route.ts'), /withMerchant\(handlePOST, 'reservations'\)/);
assert.match(editRoute, /withMerchant\(handlePATCH, 'invoices'\)/);
console.log('PASS housekeeping cannot edit invoices or reservation notes');

const shaped = presentInvoiceDocument({
  property: { name: 'A very long property name that must stay readable on a printed invoice', address: '1 Long Address Road', phone: '+2341', email: 'stay@example.invalid' },
  logoUrl: 'https://example.invalid/logo.png',
  reservation: {
    reference: 'SEN-LONG-REFERENCE',
    guestName: 'Guest With A Very Long Legal Name',
    accommodation: 'Two bedroom apartment with a long published name',
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-04',
    specialRequests: 'late arrival secret',
    notes: [{ body: 'internal staff note' }],
  },
  payments: [{
    id: 'pay-1',
    paidAt: '2026-10-02T10:00:00.000Z',
    method: 'bank_transfer',
    reference: 'TRF-1',
    amountMinorUnits: 4_000_00,
    hasReceipt: true,
    notes: 'staff only',
    storageKey: 'private/spaces/receipt.jpg',
  }],
  audience: 'public',
});
assert.equal(shaped.property.logoUrl, 'https://example.invalid/logo.png');
assert.equal(shaped.reservation?.guestName, 'Guest With A Very Long Legal Name');
assert.equal(shaped.payments[0].id, undefined);
assert.equal(shaped.payments[0].hasReceipt, undefined);
assert.equal(JSON.stringify(shaped).includes('internal staff note'), false);
assert.equal(JSON.stringify(shaped).includes('storageKey'), false);
assert.equal(JSON.stringify(shaped).includes('private/spaces'), false);
const staffShape = presentInvoiceDocument({
  property: { name: 'No Logo Hotel', address: '', phone: '', email: '' },
  logoUrl: null,
  reservation: null,
  payments: [{ id: 'pay-1', paidAt: '2026-10-02T10:00:00.000Z', method: 'cash', reference: 'CASH-1', amountMinorUnits: 100, hasReceipt: true }],
  audience: 'staff',
});
assert.equal(staffShape.property.logoUrl, null);
assert.equal(staffShape.payments[0].hasReceipt, true);
assert.equal(invoiceStatusLabel('partially_paid', 100), 'Partially paid');
assert.equal(invoiceStatusLabel('paid', 0), 'Paid');
const branded = source('apps/dashboard/src/components/branded-invoice-document.tsx');
assert.match(branded, /logoUrl/);
assert.match(branded, /onError/);
assert.match(branded, /poweredBy/);
assert.match(branded, /overflow-x-auto/);
assert.match(branded, /break-words/);
assert.match(source('apps/dashboard/src/app/globals.css'), /size: A4/);
assert.match(source('apps/dashboard/src/app/globals.css'), /sena-invoice-sheet/);
assert.doesNotMatch(source('apps/dashboard/src/app/api/invoices/public/[number]/route.ts'), /reservation_notes|reservationNotes/);
assert.match(source('apps/dashboard/src/components/reservation-notes.tsx'), /Internal note|internalOnly/);
assert.match(source('apps/dashboard/src/components/reservation-drawer.tsx'), /ReservationNotes/);
assert.match(source('apps/dashboard/src/app/front-desk/page.tsx'), /NoteCount/);
assert.match(source('apps/dashboard/src/app/reservations/page.tsx'), /NoteCount/);
assert.match(source('apps/dashboard/src/app/calendar/page.tsx'), /NoteCount/);
assert.match(source('apps/dashboard/src/components/invoice-view-modal.tsx'), /Edit invoice|t\('edit'\)/);
assert.match(source('apps/dashboard/src/components/branded-invoice-document.tsx'), /\/api\/payments\/\$\{payment.id\}\/receipt/);
console.log('PASS branded invoice and internal notes stay off public payloads');

const totals = calculateInvoiceAmounts({
  items: [{ description: 'Room', quantity: 2, unitPriceMinorUnits: 1000 }],
  applyVat: false,
  applyConsumptionTax: false,
  applyServiceCharge: true,
  discountMinorUnits: 0,
});
assert.equal(totals.ok, true);
if (!totals.ok) throw new Error('totals');
assert.equal(totals.serviceChargeMinorUnits, 200);
assert.equal(totals.totalAmountMinorUnits, 2200);
console.log('PASS service charge is calculated on the server');

async function main() {
  const postgres = createRequire(resolve('packages/database/package.json'))('postgres') as (url: string, options: { max: number }) => {
    unsafe: (sql: string) => Promise<unknown>;
    end: () => Promise<void>;
  };
  const migrator = postgres(process.env.DATABASE_URL!, { max: 1 });
  await migrator.unsafe(readFileSync(resolve('packages/database/drizzle/0011_reservation_notes.sql'), 'utf8'));
  await migrator.end();

  const { db, and, eq, organizations, properties, users, guests, reservations, roomTypes, propertyInvoices, payments, reservationNotes, activityLogs } = await import('../packages/database/src/index');
  const { addReservationNote, listReservationNotes } = await import('../apps/dashboard/src/lib/reservation-notes');

  assert.notEqual(PROPERTY_A, STAY_CONNECT);
  const runId = crypto.randomUUID().slice(0, 8);
  const [existingOrg] = await db.select().from(organizations).where(eq(organizations.id, ORG_A));
  if (!existingOrg) {
    await db.insert(organizations).values({ id: ORG_A, name: 'Synthetic Invoice Org', slug: `syn-org-${runId}` });
  }
  const [existingProperty] = await db.select().from(properties).where(eq(properties.id, PROPERTY_A));
  if (!existingProperty) {
    await db.insert(properties).values({
      id: PROPERTY_A,
      organizationId: ORG_A,
      name: 'Synthetic Invoice Hotel',
      slug: `syn-prop-${runId}`,
      code: `SYN-${runId}`,
      address: '3 Test Close',
      phone: '+234800',
      email: `syn-${runId}@example.invalid`,
    });
  }
  const [author] = await db.insert(users).values({
    email: `notes-${runId}@example.invalid`,
    fullName: 'Front Desk Tester',
  }).returning();
  const [guest] = await db.insert(guests).values({
    organizationId: ORG_A,
    propertyId: PROPERTY_A,
    fullName: 'Synthetic Guest',
    email: `guest-${runId}@example.invalid`,
    phone: '+234801',
  }).returning();
  const [roomType] = await db.insert(roomTypes).values({
    propertyId: PROPERTY_A,
    name: `Synthetic Room ${runId}`,
    bedType: 'Queen',
    basePriceMinorUnits: 5_000_00,
  }).returning();
  const [stay] = await db.insert(reservations).values({
    reference: `SYN-${runId}`,
    propertyId: PROPERTY_A,
    guestId: guest.id,
    roomTypeId: roomType.id,
    checkInDate: '2026-10-02',
    checkOutDate: '2026-10-04',
    nights: 2,
    totalAmountMinorUnits: 10_000_00,
    paidAmountMinorUnits: 4_000_00,
    paymentStatus: 'part_payment',
  }).returning();
  const [row] = await db.insert(propertyInvoices).values({
    propertyId: PROPERTY_A,
    organizationId: ORG_A,
    reservationId: stay.id,
    guestId: guest.id,
    invoiceNumber: `INV-TEST-${runId}`,
    recipientName: 'Synthetic Guest',
    issueDate: '2026-10-01',
    dueDate: '2026-10-08',
    subtotalMinorUnits: 10_000_00,
    totalAmountMinorUnits: 10_000_00,
    paidAmountMinorUnits: 4_000_00,
    status: 'partially_paid',
    items: invoice().items,
  }).returning();
  const [payment] = await db.insert(payments).values({
    propertyId: PROPERTY_A,
    reservationId: stay.id,
    invoiceId: row.id,
    amountMinorUnits: 4_000_00,
    currency: 'NGN',
    provider: 'manual',
    providerReference: `SYN-PAY-${runId}`,
    method: 'cash',
    status: 'successful',
    source: 'invoice',
  }).returning();

  await addReservationNote({
    propertyId: PROPERTY_A,
    reservationId: stay.id,
    authorUserId: author.id,
    authorName: author.fullName,
    body: 'Airport pickup at 18:00',
  });
  await addReservationNote({
    propertyId: PROPERTY_A,
    reservationId: stay.id,
    authorUserId: author.id,
    authorName: author.fullName,
    body: 'Balance due at check-in',
  });
  const notes = await listReservationNotes(PROPERTY_A, stay.id);
  assert.equal(notes.length, 2);
  assert.equal(notes[0].authorName, 'Front Desk Tester');
  assert.equal(notes[0].body, 'Airport pickup at 18:00');
  assert.ok(notes[0].createdAt);
  assert.equal(notes[1].body, 'Balance due at check-in');
  const foreign = await listReservationNotes(PROPERTY_B, stay.id);
  assert.equal(foreign.length, 0);
  console.log('PASS notes keep author, time, property, and reservation scope');

  const rejected = planInvoiceEdit(row, {
    items: [{ description: 'Too small', category: 'room', quantity: 1, unitPriceMinorUnits: 100 }],
  }, { today: '2026-10-01' });
  assert.equal(rejected.ok, false);
  const [paymentAfterReject] = await db.select().from(payments).where(eq(payments.id, payment.id));
  assert.equal(paymentAfterReject.amountMinorUnits, 4_000_00);
  const [stayAfterReject] = await db.select().from(reservations).where(eq(reservations.id, stay.id));
  assert.equal(stayAfterReject.paidAmountMinorUnits, 4_000_00);

  const accepted = planInvoiceEdit(row, {
    recipientName: 'Synthetic Company',
    items: [{ id: 'item_1', description: 'Adjusted room', category: 'room', quantity: 2, unitPriceMinorUnits: 5_000_00 }],
  }, { today: '2026-10-01' });
  assert.equal(accepted.ok, true);
  if (!accepted.ok) throw new Error('accepted');
  await db.transaction(async (tx) => {
    await tx.update(propertyInvoices).set(accepted.patch).where(eq(propertyInvoices.id, row.id));
    await tx.insert(activityLogs).values({
      organizationId: ORG_A,
      propertyId: PROPERTY_A,
      actorId: author.id,
      actorName: author.fullName,
      action: 'invoice.updated',
      resource: 'invoice',
      resourceId: row.id,
      previousValue: Object.fromEntries(accepted.changes.map((change) => [change.field, change.from])),
      newValue: Object.fromEntries(accepted.changes.map((change) => [change.field, change.to])),
    });
  });
  const [saved] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, row.id));
  assert.equal(saved.recipientName, 'Synthetic Company');
  assert.equal(saved.totalAmountMinorUnits, 10_000_00);
  assert.equal(saved.paidAmountMinorUnits, 4_000_00);
  const [paymentAfter] = await db.select().from(payments).where(eq(payments.id, payment.id));
  assert.equal(paymentAfter.amountMinorUnits, 4_000_00);
  assert.equal(paymentAfter.providerReference, `SYN-PAY-${runId}`);
  const [audit] = await db.select().from(activityLogs).where(and(eq(activityLogs.resourceId, row.id), eq(activityLogs.action, 'invoice.updated')));
  assert.equal(audit.actorId, author.id);
  assert.equal(audit.propertyId, PROPERTY_A);
  assert.equal((audit.newValue as { recipientName?: string }).recipientName, 'Synthetic Company');
  const [stayAfter] = await db.select().from(reservations).where(eq(reservations.id, stay.id));
  assert.equal(stayAfter.paidAmountMinorUnits, 4_000_00);
  assert.equal(stayAfter.paymentStatus, 'part_payment');
  console.log('PASS stored edit keeps payments, reservation settlement, and writes an audit row');

  await db.delete(reservationNotes).where(eq(reservationNotes.reservationId, stay.id));
  await db.delete(activityLogs).where(eq(activityLogs.resourceId, row.id));
  await db.delete(payments).where(eq(payments.id, payment.id));
  await db.delete(propertyInvoices).where(eq(propertyInvoices.id, row.id));
  await db.delete(reservations).where(eq(reservations.id, stay.id));
  await db.delete(roomTypes).where(eq(roomTypes.id, roomType.id));
  await db.delete(guests).where(eq(guests.id, guest.id));
  await db.delete(users).where(eq(users.id, author.id));
  assert.notEqual(PROPERTY_A, STAY_CONNECT);
  console.log('PASS synthetic rows cleaned up without touching Stay Connect');
}

main().catch((error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : 'invoice notes test failed';
  console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[database]'));
  process.exit(1);
});
