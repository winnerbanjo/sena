import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { db, propertyInvoices, payments, reservations, idempotencyKeys, operationalNotifications, eq, sql } from '@sena/database';

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const amount = Number(body.amountMinorUnits);
  const requestKey = req.headers.get('idempotency-key');
  if (!requestKey || requestKey.length > 100) return NextResponse.json({ error: 'A payment reference is required. Please try again.' }, { status: 400 });
  if (!Number.isSafeInteger(amount) || amount <= 0 || !['cash', 'pos', 'bank_transfer', 'card'].includes(body.method)) return NextResponse.json({ error: 'Enter a valid payment amount and method.' }, { status: 422 });
  const key = `invoice-payment:${id}:${requestKey}`;
  const result = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
    const prior = await tx.query.idempotencyKeys.findFirst({ where: eq(idempotencyKeys.key, key) });
    if (prior) return prior.responsePayload;
    const [invoice] = await tx.select().from(propertyInvoices).where(eq(propertyInvoices.id, id)).for('update');
    if (!invoice || ['void', 'draft', 'cancelled', 'paid'].includes(invoice.status)) throw new Error('Invoice unavailable');
    if (amount > invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits) return { error: 'Amount is more than the outstanding balance.' };
    const paid = invoice.paidAmountMinorUnits + amount;
    const [updated] = await tx.update(propertyInvoices).set({ paidAmountMinorUnits: paid, status: paid >= invoice.totalAmountMinorUnits ? 'paid' : 'partially_paid', updatedAt: new Date() }).where(eq(propertyInvoices.id, id)).returning();
    if (invoice.reservationId) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${invoice.reservationId}))`);
      const [reservation] = await tx.select().from(reservations).where(eq(reservations.id, invoice.reservationId)).for('update');
      if (!reservation || reservation.propertyId !== invoice.propertyId) throw new Error('Reservation unavailable');
      if (amount > reservation.totalAmountMinorUnits - reservation.paidAmountMinorUnits) throw new Error('Amount is more than the reservation outstanding balance.');
      const balancePaid = reservation.paidAmountMinorUnits + amount;
      await tx.update(reservations).set({ paidAmountMinorUnits: balancePaid, paymentStatus: balancePaid >= reservation.totalAmountMinorUnits ? 'paid' : 'part_payment', updatedAt: new Date() }).where(eq(reservations.id, reservation.id));
    }
    const [payment] = await tx.insert(payments).values({ propertyId: invoice.propertyId, invoiceId: invoice.id, reservationId: invoice.reservationId, amountMinorUnits: amount, currency: invoice.currency, provider: 'manual', providerReference: body.providerReference || requestKey, method: body.method, status: 'successful', source: 'invoice', notes: typeof body.notes === 'string' ? body.notes.trim() : '' }).returning();
    await tx.insert(operationalNotifications).values({ propertyId: invoice.propertyId, dedupeKey: `manual:${payment.id}`, kind: 'invoice', title: 'Invoice payment received', body: 'An invoice payment was recorded at the property.', href: '/invoices' }).onConflictDoNothing();
    const payload = { success: true, message: 'Payment recorded', invoice: updated, paymentId: payment.id, propertyId: invoice.propertyId };
    await tx.insert(idempotencyKeys).values({ key, action: 'invoice_payment', responsePayload: payload, expiresAt: new Date(Date.now() + 86400000) });
    return payload;
  });
  if (result && typeof result === 'object' && 'paymentId' in result && 'propertyId' in result) {
    // Zoho payment sync is outbound bookkeeping only — never mutates Sena ledger.
    void import('@/lib/integrations/zoho/invoice')
      .then(({ maybeQueueZohoPaymentSync }) =>
        maybeQueueZohoPaymentSync(String((result as any).propertyId), String((result as any).paymentId))
      )
      .catch(() => null);
    void import('@/lib/integrations/zoho/books')
      .then(({ maybeQueueZohoBooksPaymentSync }) =>
        maybeQueueZohoBooksPaymentSync(String((result as any).propertyId), String((result as any).paymentId))
      )
      .catch(() => null);
  }
  return NextResponse.json(result, { status: result && typeof result === 'object' && 'error' in result ? 422 : 200 });
}
export const POST = withMerchant(handlePOST, 'invoices');
