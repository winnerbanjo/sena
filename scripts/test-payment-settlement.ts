import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

requireIsolatedTestDatabase();

async function run() {
  const { db, organizations, properties, guests, reservations, propertyInvoices, payments, idempotencyKeys, eq } =
    await import('../packages/database/src/index');
  const { settlePaystack } = await import('../apps/dashboard/src/lib/settle-paystack');
  const runId = crypto.randomUUID();
  const [organization] = await db.insert(organizations).values({ name: 'Local settlement QA', slug: `settlement-${runId}` }).returning();
  const [property] = await db.insert(properties).values({
    organizationId: organization.id,
    name: 'Local settlement QA',
    slug: `settlement-${runId}`,
    code: `ST-${runId.slice(0, 8)}`,
    address: 'Local only',
    phone: '',
    email: `settlement-${runId}@example.invalid`,
  }).returning();
  const [guest] = await db.insert(guests).values({
    organizationId: organization.id,
    propertyId: property.id,
    fullName: 'Local settlement guest',
    email: `guest-${runId}@example.invalid`,
    phone: '',
  }).returning();
  const [reservation] = await db.insert(reservations).values({
    propertyId: property.id,
    guestId: guest.id,
    reference: `QA-${runId}`,
    checkInDate: '2030-01-01',
    checkOutDate: '2030-01-02',
    nights: 1,
    totalAmountMinorUnits: 1_000,
  }).returning();

  try {
    const reference = `pay-${runId}`;
    const [invoice] = await db.insert(propertyInvoices).values({
      propertyId: property.id,
      organizationId: organization.id,
      reservationId: reservation.id,
      invoiceNumber: `INV-${runId}`,
      recipientName: guest.fullName,
      issueDate: '2030-01-01',
      dueDate: '2030-01-02',
      totalAmountMinorUnits: 1_000,
      status: 'issued',
    }).returning();
    const payment = {
      reference,
      status: 'success',
      amount: 1_000,
      currency: 'NGN',
      paid_at: new Date().toISOString(),
      metadata: { type: 'invoice_settlement', invoiceId: invoice.id, propertyId: property.id },
    };
    await Promise.all(Array.from({ length: 8 }, () => settlePaystack(payment)));
    assert.equal((await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, invoice.id) }))?.paidAmountMinorUnits, 1_000);
    assert.equal((await db.query.reservations.findFirst({ where: eq(reservations.id, reservation.id) }))?.paidAmountMinorUnits, 1_000);
    assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, reference) })).length, 1);
    console.log('PASS eight settlement retries add one receipt and update both balances once');

    const overpayReference = `overpay-${runId}`;
    const [overpayInvoice] = await db.insert(propertyInvoices).values({
      propertyId: property.id,
      organizationId: organization.id,
      invoiceNumber: `OVER-${runId}`,
      recipientName: guest.fullName,
      issueDate: '2030-01-01',
      dueDate: '2030-01-02',
      totalAmountMinorUnits: 1_000,
      status: 'issued',
    }).returning();
    await assert.rejects(settlePaystack({
      ...payment,
      reference: overpayReference,
      amount: 1_001,
      metadata: { type: 'invoice_settlement', invoiceId: overpayInvoice.id, propertyId: property.id },
    }), /invoice balance/i);
    assert.equal((await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, overpayInvoice.id) }))?.paidAmountMinorUnits, 0);
    assert.equal((await db.query.payments.findMany({ where: eq(payments.providerReference, overpayReference) })).length, 0);
    console.log('PASS provider settlement rejects overpayment without mutating the invoice or ledger');

    const maxReference = `maximum-${runId}`;
    const [maxInvoice] = await db.insert(propertyInvoices).values({
      propertyId: property.id,
      organizationId: organization.id,
      invoiceNumber: `MAX-${runId}`,
      recipientName: guest.fullName,
      issueDate: '2030-01-01',
      dueDate: '2030-01-02',
      totalAmountMinorUnits: 2_147_483_647,
      status: 'issued',
    }).returning();
    await settlePaystack({
      ...payment,
      reference: maxReference,
      amount: 2_147_483_647,
      metadata: { type: 'invoice_settlement', invoiceId: maxInvoice.id, propertyId: property.id },
    });
    assert.equal((await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, maxInvoice.id) }))?.paidAmountMinorUnits, 2_147_483_647);
    console.log('PASS provider settlement accepts the PostgreSQL integer money maximum exactly');
  } finally {
    for (const reference of [`pay-${runId}`, `overpay-${runId}`, `maximum-${runId}`]) {
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, `paystack-settlement:${reference}`));
    }
    await db.delete(organizations).where(eq(organizations.id, organization.id));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
