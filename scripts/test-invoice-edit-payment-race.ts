/**
 * Concurrency test: editing an invoice while a payment is recorded.
 *
 * Requires a disposable local database with the current schema applied:
 *   SENA_TEST_DATABASE_URL=postgresql://...@localhost:55432/sena_test
 *   SENA_PRODUCTION_DATABASE_URL=postgresql://placeholder/sena_prod_remote
 *
 * Invariant under test: `paid_amount_minor_units` never exceeds
 * `total_amount_minor_units`, whichever transaction commits first.
 */
import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

process.env.SENA_TEST_DATABASE_URL = process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@localhost:55432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL = process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

const ITERATIONS = 6;
const ORIGINAL_TOTAL = 10_000_000;
const REDUCED_TOTAL = 4_000_000;
const PAYMENT_AMOUNT = 5_000_000;

async function run() {
  const { db, eq, organizations, properties, users, propertyInvoices, payments } = await import('../packages/database/src/index');
  const { ReservationService } = await import('../packages/reservations/src/index');
  const { applyInvoiceEdit } = await import('../apps/dashboard/src/lib/invoice-edit-apply');

  const runId = crypto.randomUUID().slice(0, 8);
  const [org] = await db.insert(organizations).values({ name: 'Race QA', slug: `race-${runId}` }).returning();
  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Race QA Hotel',
    slug: `race-hotel-${runId}`,
    code: `RC-${runId}`,
    address: 'Local only',
    phone: '',
    email: `race-${runId}@example.invalid`,
    checkInPaymentPolicy: 'allow_outstanding',
    checkOutPaymentPolicy: 'allow_outstanding',
  }).returning();
  const [staff] = await db.insert(users).values({
    fullName: 'Race Staff',
    email: `race-staff-${runId}@example.invalid`,
    passwordHash: 'x',
    isActive: true,
  }).returning();
  const { roomTypes } = await import('../packages/database/src/index');
  const [roomType] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Race Deluxe',
    bedType: 'King',
    basePriceMinorUnits: ORIGINAL_TOTAL / 2,
    capacity: 2,
    totalInventory: 1,
  }).returning();

  const stay = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    checkInDate: '2034-01-10',
    checkOutDate: '2034-01-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'direct',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: {
      fullName: `Race Guest ${runId}`,
      email: `race-guest-${runId}@example.invalid`,
      phone: '+2348000000000',
    },
  } as any);

  const originalItems = [
    {
      id: 'race-room',
      description: 'Race stay',
      category: 'room' as const,
      quantity: 1,
      unitPriceMinorUnits: ORIGINAL_TOTAL,
      totalMinorUnits: ORIGINAL_TOTAL,
      reservationId: stay.id,
    },
  ];

  const [invoice] = await db.insert(propertyInvoices).values({
    propertyId: property.id,
    organizationId: org.id,
    reservationId: stay.id,
    invoiceNumber: `INV-RACE-${runId}`,
    status: 'issued',
    recipientName: `Race Guest ${runId}`,
    issueDate: '2034-01-10',
    dueDate: '2034-01-12',
    currency: 'NGN',
    subtotalMinorUnits: ORIGINAL_TOTAL,
    totalAmountMinorUnits: ORIGINAL_TOTAL,
    paidAmountMinorUnits: 0,
    items: originalItems,
  }).returning();

  let editWon = 0;
  let paymentWon = 0;

  for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
    await db
      .update(propertyInvoices)
      .set({
        status: 'issued',
        subtotalMinorUnits: ORIGINAL_TOTAL,
        totalAmountMinorUnits: ORIGINAL_TOTAL,
        paidAmountMinorUnits: 0,
        taxVatMinorUnits: 0,
        taxConsumptionMinorUnits: 0,
        serviceChargeMinorUnits: 0,
        discountMinorUnits: 0,
        items: originalItems,
        updatedAt: new Date(),
      })
      .where(eq(propertyInvoices.id, invoice.id));

    const edit = applyInvoiceEdit({
      propertyId: property.id,
      invoiceId: invoice.id,
      actor: { userId: staff.id, fullName: 'Race Staff' },
      body: {
        items: [
          {
            id: 'race-room',
            description: 'Race stay',
            category: 'room',
            quantity: 1,
            unitPriceMinorUnits: REDUCED_TOTAL,
          },
        ],
      },
    });

    // Mirrors the locked invoice settlement in
    // apps/dashboard/src/app/api/invoices/[id]/payments/route.ts.
    const payment = db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(propertyInvoices)
        .where(eq(propertyInvoices.id, invoice.id))
        .for('update');
      if (!row) return { recorded: false as const, reason: 'missing' };
      if (['void', 'draft', 'cancelled', 'paid'].includes(row.status)) {
        return { recorded: false as const, reason: 'status' };
      }
      if (PAYMENT_AMOUNT > row.totalAmountMinorUnits - row.paidAmountMinorUnits) {
        return { recorded: false as const, reason: 'outstanding' };
      }
      const paid = row.paidAmountMinorUnits + PAYMENT_AMOUNT;
      await tx
        .update(propertyInvoices)
        .set({
          paidAmountMinorUnits: paid,
          status: paid >= row.totalAmountMinorUnits ? 'paid' : 'partially_paid',
          updatedAt: new Date(),
        })
        .where(eq(propertyInvoices.id, invoice.id));
      await tx.insert(payments).values({
        propertyId: property.id,
        invoiceId: invoice.id,
        reservationId: stay.id,
        amountMinorUnits: PAYMENT_AMOUNT,
        currency: 'NGN',
        provider: 'manual',
        providerReference: `race-${runId}-${iteration}`,
        method: 'cash',
        status: 'successful',
        source: 'invoice',
      });
      return { recorded: true as const };
    });

    const [editOutcome, paymentOutcome] = await Promise.allSettled([edit, payment]);
    assert.equal(paymentOutcome.status, 'fulfilled', 'payment transaction must not fail with a database error');
    if (editOutcome.status === 'rejected') {
      assert.match(String(editOutcome.reason?.message || ''), /less than the amount already paid|maximum|whole amount/i);
    }

    const [row] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invoice.id));
    assert.ok(row, 'invoice still exists');
    assert.ok(
      row.paidAmountMinorUnits <= row.totalAmountMinorUnits,
      `iteration ${iteration}: paid ${row.paidAmountMinorUnits} exceeded total ${row.totalAmountMinorUnits}`,
    );
    assert.ok(row.paidAmountMinorUnits >= 0, `iteration ${iteration}: negative paid amount`);
    if (row.paidAmountMinorUnits > 0) {
      assert.ok(
        row.status === 'paid' || row.status === 'partially_paid',
        `iteration ${iteration}: unexpected status ${row.status}`,
      );
    }

    const editSucceeded = editOutcome.status === 'fulfilled' && editOutcome.value.ok;
    const paymentSucceeded = paymentOutcome.status === 'fulfilled' && paymentOutcome.value.recorded;
    if (editSucceeded && !paymentSucceeded) editWon++;
    if (!editSucceeded && paymentSucceeded) paymentWon++;
  }

  console.log(`PASS invoice edit vs payment invariant held for ${ITERATIONS} concurrent runs`);
  console.log(`INFO edit applied first ${editWon}×, payment applied first ${paymentWon}×`);

  await db.delete(organizations).where(eq(organizations.id, org.id)).catch(() => undefined);
}

run().catch((error) => {
  console.error('FAIL invoice edit vs payment race', error);
  process.exitCode = 1;
});
