/**
 * Concurrency test: editing a stay while a payment is recorded.
 *
 * Requires a disposable local database with the current schema applied:
 *   SENA_TEST_DATABASE_URL=postgresql://...@localhost:55432/sena_test
 *   SENA_PRODUCTION_DATABASE_URL=postgresql://placeholder/sena_prod_remote
 *
 * Global ledger lock order: property_invoices (ascending id) first, then
 * reservations (ascending id). This script proves both halves:
 *   1. the old order (edit reservation -> invoice, payment invoice -> reservation)
 *      deadlocks deterministically under a barrier and Postgres raises 40P01;
 *   2. the new order never raises 40P01, and paid never exceeds total.
 * It then runs the real `updateStay` and `PaymentService.recordPayment` paths
 * concurrently for the same reservation.
 */
import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

delete process.env.PAYSTACK_SECRET_KEY;
delete process.env.PAYSTACK_PUBLIC_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_PASSWORD;
delete process.env.REDIS_URL;
delete process.env.S3_ACCESS_KEY_ID;
delete process.env.S3_SECRET_ACCESS_KEY;
delete process.env.FLUTTERWAVE_SECRET_KEY;
delete process.env.FLUTTERWAVE_TEST_SECRET_KEY;

process.env.SENA_TEST_DATABASE_URL =
  process.env.SENA_TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:55432/sena_test';
process.env.SENA_PRODUCTION_DATABASE_URL =
  process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

const ITERATIONS = 10;
const OLD_ORDER_ATTEMPTS = 5;
const ORIGINAL_TOTAL = 10_000_000;
const EXTENDED_TOTAL = 12_000_000;
const PAYMENT_AMOUNT = 5_000_000;
const DEADLOCK = '40P01';
const LOCK_ORDER = 'invoice-first';

type Order = 'invoice-first' | 'reservation-first';

function errorCode(error: unknown) {
  return (error as { code?: string } | null)?.code;
}

/** Releases both transactions together once both have taken their first lock. */
function makeBarrier(parties: number, timeoutMs: number) {
  let arrived = 0;
  let release!: () => void;
  const all = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    arrived += 1;
    if (arrived >= parties) release();
    await Promise.race([all, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
  };
}

async function run() {
  const {
    db,
    eq,
    inArray,
    organizations,
    properties,
    propertyInvoices,
    payments,
    reservations,
    roomTypes,
    sql,
    users,
  } = await import('../packages/database/src/index');
  const { ReservationService } = await import('../packages/reservations/src/index');
  const { updateStay } = await import('../packages/reservations/src/edit');
  const { PaymentService } = await import('../packages/payments/src/index');

  const runId = crypto.randomUUID().slice(0, 8);
  const [org] = await db.insert(organizations).values({ name: 'Lock Order QA', slug: `lock-order-${runId}` }).returning();
  const [property] = await db
    .insert(properties)
    .values({
      organizationId: org.id,
      name: 'Lock Order QA Hotel',
      slug: `lock-order-hotel-${runId}`,
      code: `LO-${runId}`,
      address: 'Local only',
      phone: '',
      email: `lock-order-${runId}@example.invalid`,
      checkInPaymentPolicy: 'allow_outstanding',
      checkOutPaymentPolicy: 'allow_outstanding',
    })
    .returning();
  const [staff] = await db
    .insert(users)
    .values({
      fullName: 'Lock Order Staff',
      email: `lock-order-staff-${runId}@example.invalid`,
      passwordHash: 'x',
      isActive: true,
    })
    .returning();
  const [roomType] = await db
    .insert(roomTypes)
    .values({
      propertyId: property.id,
      name: 'Lock Order Deluxe',
      bedType: 'King',
      basePriceMinorUnits: ORIGINAL_TOTAL / 2,
      capacity: 2,
      totalInventory: 1,
    })
    .returning();

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
      fullName: `Lock Order Guest ${runId}`,
      email: `lock-order-guest-${runId}@example.invalid`,
      phone: '+2348000000000',
    },
  } as any);

  const originalItems = [
    {
      id: 'lock-order-room',
      description: 'Lock order stay',
      category: 'room' as const,
      quantity: 1,
      unitPriceMinorUnits: ORIGINAL_TOTAL,
      totalMinorUnits: ORIGINAL_TOTAL,
      reservationId: stay.id,
    },
  ];

  const invoiceRows = await db
    .insert(propertyInvoices)
    .values([
      {
        propertyId: property.id,
        organizationId: org.id,
        reservationId: stay.id,
        invoiceNumber: `INV-LOCK-A-${runId}`,
        status: 'issued',
        recipientName: `Lock Order Guest ${runId}`,
        issueDate: '2034-01-10',
        dueDate: '2034-01-12',
        currency: 'NGN',
        subtotalMinorUnits: ORIGINAL_TOTAL - 4_000_000,
        totalAmountMinorUnits: ORIGINAL_TOTAL - 4_000_000,
        paidAmountMinorUnits: 0,
        items: originalItems,
      },
      {
        propertyId: property.id,
        organizationId: org.id,
        reservationId: stay.id,
        invoiceNumber: `INV-LOCK-B-${runId}`,
        status: 'issued',
        recipientName: `Lock Order Guest ${runId}`,
        issueDate: '2034-01-10',
        dueDate: '2034-01-12',
        currency: 'NGN',
        subtotalMinorUnits: 4_000_000,
        totalAmountMinorUnits: 4_000_000,
        paidAmountMinorUnits: 0,
        items: [{ ...originalItems[0], id: 'lock-order-room-b', totalMinorUnits: 4_000_000, unitPriceMinorUnits: 4_000_000 }],
      },
    ])
    .returning({ id: propertyInvoices.id });

  const invoiceIds = invoiceRows.map((row) => row.id);

  async function reset() {
    await db.delete(payments).where(eq(payments.reservationId, stay.id));
    await db
      .update(reservations)
      .set({
        status: 'confirmed',
        checkInDate: '2034-01-10',
        checkOutDate: '2034-01-12',
        nights: 2,
        totalAmountMinorUnits: ORIGINAL_TOTAL,
        paidAmountMinorUnits: 0,
        paymentStatus: 'pay_later',
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, stay.id));
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
        dueDate: '2034-01-12',
        updatedAt: new Date(),
      })
      .where(inArray(propertyInvoices.id, invoiceIds));
  }

  async function assertLedgerInvariant(label: string) {
    const [reservationRow] = await db.select().from(reservations).where(eq(reservations.id, stay.id));
    assert.ok(reservationRow, `${label}: reservation exists`);
    assert.ok(
      reservationRow.paidAmountMinorUnits <= reservationRow.totalAmountMinorUnits,
      `${label}: reservation paid ${reservationRow.paidAmountMinorUnits} exceeded total ${reservationRow.totalAmountMinorUnits}`,
    );
    const rows = await db.select().from(propertyInvoices).where(inArray(propertyInvoices.id, invoiceIds));
    for (const row of rows) {
      assert.ok(
        row.paidAmountMinorUnits <= row.totalAmountMinorUnits,
        `${label}: invoice ${row.invoiceNumber} paid ${row.paidAmountMinorUnits} exceeded total ${row.totalAmountMinorUnits}`,
      );
    }
  }

  /**
   * Mirrors the edit transaction. `reservation-first` is the order this branch
   * replaced; `invoice-first` is the global order now used by updateStay.
   */
  async function mirroredEdit(order: Order, barrier: () => Promise<void>) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL deadlock_timeout = '150ms'`);
      if (order === 'invoice-first') {
        await tx
          .select({ id: propertyInvoices.id })
          .from(propertyInvoices)
          .where(inArray(propertyInvoices.id, invoiceIds))
          .orderBy(propertyInvoices.id)
          .for('update');
        await barrier();
        await tx.select({ id: reservations.id }).from(reservations).where(eq(reservations.id, stay.id)).for('update');
      } else {
        await tx.select({ id: reservations.id }).from(reservations).where(eq(reservations.id, stay.id)).for('update');
        await barrier();
        await tx
          .select({ id: propertyInvoices.id })
          .from(propertyInvoices)
          .where(inArray(propertyInvoices.id, invoiceIds))
          .orderBy(propertyInvoices.id)
          .for('update');
      }
      await tx
        .update(reservations)
        .set({ totalAmountMinorUnits: EXTENDED_TOTAL, updatedAt: new Date() })
        .where(eq(reservations.id, stay.id));
    });
  }

  /** Mirrors the payment transaction, which has always locked invoices first. */
  async function mirroredPayment(order: Order, barrier: () => Promise<void>) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL deadlock_timeout = '150ms'`);
      const lockInvoices = () =>
        tx
          .select()
          .from(propertyInvoices)
          .where(inArray(propertyInvoices.id, invoiceIds))
          .orderBy(propertyInvoices.id)
          .for('update');
      const lockReservation = () =>
        tx.select().from(reservations).where(eq(reservations.id, stay.id)).for('update');

      let invoices: (typeof propertyInvoices.$inferSelect)[];
      let reservation: typeof reservations.$inferSelect;
      if (order === 'invoice-first') {
        invoices = await lockInvoices();
        await barrier();
        const [row] = await lockReservation();
        assert.ok(row, 'payment mirror: reservation exists');
        reservation = row;
      } else {
        const [row] = await lockReservation();
        assert.ok(row, 'payment mirror: reservation exists');
        reservation = row;
        await barrier();
        invoices = await lockInvoices();
      }
      const target = invoices[0];
      assert.ok(target, 'payment mirror: invoice exists');
      await tx
        .update(propertyInvoices)
        .set({
          paidAmountMinorUnits: target.paidAmountMinorUnits + PAYMENT_AMOUNT,
          status: 'partially_paid',
          updatedAt: new Date(),
        })
        .where(eq(propertyInvoices.id, target.id));
      await tx
        .update(reservations)
        .set({
          paidAmountMinorUnits: reservation.paidAmountMinorUnits + PAYMENT_AMOUNT,
          paymentStatus: 'part_payment',
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, stay.id));
      await tx.insert(payments).values({
        propertyId: property.id,
        reservationId: stay.id,
        invoiceId: target.id,
        amountMinorUnits: PAYMENT_AMOUNT,
        currency: 'NGN',
        provider: 'manual',
        providerReference: `lock-order-mirror-${runId}-${crypto.randomUUID().slice(0, 6)}`,
        method: 'cash',
        status: 'successful',
        source: 'invoice',
      });
    });
  }

  // 1. Old order: edit reservation-first vs payment invoice-first deadlocks.
  for (let attempt = 1; attempt <= OLD_ORDER_ATTEMPTS; attempt++) {
    await reset();
    const barrier = makeBarrier(2, 2_000);
    const outcomes = await Promise.allSettled([
      mirroredEdit('reservation-first', barrier),
      mirroredPayment('invoice-first', barrier),
    ]);
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected') as PromiseRejectedResult[];
    assert.equal(
      rejected.length,
      1,
      `old order attempt ${attempt}: expected exactly one deadlock victim, got ${rejected.length} rejections`,
    );
    assert.equal(
      errorCode(rejected[0].reason),
      DEADLOCK,
      `old order attempt ${attempt}: expected ${DEADLOCK}, got ${errorCode(rejected[0].reason)} (${rejected[0].reason?.message})`,
    );
    await assertLedgerInvariant(`old order attempt ${attempt}`);
  }
  console.log(`PASS old reservation-first order deadlocked on all ${OLD_ORDER_ATTEMPTS} attempts (${DEADLOCK})`);

  // 2. New order: both transactions invoice-first, same invoice ordering.
  for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
    await reset();
    const barrier = makeBarrier(2, 250);
    const outcomes = await Promise.allSettled([
      mirroredEdit(LOCK_ORDER, barrier),
      mirroredPayment(LOCK_ORDER, barrier),
    ]);
    for (const outcome of outcomes) {
      assert.equal(
        outcome.status,
        'fulfilled',
        `new order iteration ${iteration}: unexpected failure ${outcome.status === 'rejected' ? outcome.reason?.message : ''}`,
      );
    }
    await assertLedgerInvariant(`new order iteration ${iteration}`);
  }
  console.log(`PASS invoice-first order completed ${ITERATIONS} barrier-synchronised edit/payment runs without ${DEADLOCK}`);

  // 3. Real production paths: updateStay and PaymentService.recordPayment.
  for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
    await reset();
    const edit = updateStay(
      stay.id,
      property.id,
      {
        checkInDate: '2034-01-10',
        checkOutDate: '2034-01-12',
        numGuests: 1,
        customTotalAmountMinorUnits: EXTENDED_TOTAL,
      },
      { id: staff.id, name: 'Lock Order Staff' },
    );
    const payment = PaymentService.recordPayment(
      {
        reservationId: stay.id,
        amountMinorUnits: PAYMENT_AMOUNT,
        method: 'cash',
        provider: 'manual',
        providerReference: `lock-order-real-${runId}-${iteration}`,
      },
      `lock-order-real-${runId}-${iteration}`,
      { id: staff.id, name: 'Lock Order Staff' },
    );

    const [editOutcome, paymentOutcome] = await Promise.allSettled([edit, payment]);
    for (const [name, outcome] of [
      ['edit', editOutcome],
      ['payment', paymentOutcome],
    ] as const) {
      if (outcome.status === 'rejected') {
        assert.notEqual(
          errorCode(outcome.reason),
          DEADLOCK,
          `real path iteration ${iteration}: ${name} deadlocked: ${outcome.reason?.message}`,
        );
        assert.fail(`real path iteration ${iteration}: ${name} failed: ${outcome.reason?.message}`);
      }
    }
    await assertLedgerInvariant(`real path iteration ${iteration}`);
  }
  console.log(`PASS real updateStay + recordPayment ran ${ITERATIONS} concurrent iterations without ${DEADLOCK}`);

  const [finalReservation] = await db
    .select({ paid: reservations.paidAmountMinorUnits, total: reservations.totalAmountMinorUnits })
    .from(reservations)
    .where(eq(reservations.id, stay.id));
  assert.ok(finalReservation, 'final reservation exists');
  console.log(`INFO final reservation paid=${finalReservation.paid} total=${finalReservation.total}`);
  console.log(`INFO lock order enforced: ${LOCK_ORDER}, invoices ordered by id, reservations ordered by id`);

  await db.delete(organizations).where(eq(organizations.id, org.id)).catch(() => undefined);
}

run().catch((error) => {
  console.error('FAIL invoice/reservation lock order', error);
  process.exitCode = 1;
});
