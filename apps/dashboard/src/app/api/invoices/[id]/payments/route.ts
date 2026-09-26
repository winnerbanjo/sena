import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { db, propertyInvoices, payments, reservations, idempotencyKeys, eq, sql } from '@sena/database';

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
    if (!invoice || ['void', 'draft'].includes(invoice.status)) throw new Error('Invoice unavailable');
    const paid = invoice.paidAmountMinorUnits + amount;
    const [updated] = await tx.update(propertyInvoices).set({ paidAmountMinorUnits: paid, status: paid >= invoice.totalAmountMinorUnits ? 'paid' : 'partially_paid', updatedAt: new Date() }).where(eq(propertyInvoices.id, id)).returning();
    if (invoice.reservationId) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${invoice.reservationId}))`);
      const [reservation] = await tx.select().from(reservations).where(eq(reservations.id, invoice.reservationId)).for('update');
      if (!reservation || reservation.propertyId !== invoice.propertyId) throw new Error('Reservation unavailable');
      await tx.insert(payments).values({ propertyId: invoice.propertyId, reservationId: reservation.id, amountMinorUnits: amount, currency: invoice.currency, provider: 'manual', providerReference: body.providerReference || requestKey, method: body.method, status: 'successful', notes: typeof body.notes === 'string' ? body.notes.trim() : '' });
      const balancePaid = reservation.paidAmountMinorUnits + amount;
      await tx.update(reservations).set({ paidAmountMinorUnits: balancePaid, paymentStatus: balancePaid >= reservation.totalAmountMinorUnits ? 'paid' : 'part_payment', updatedAt: new Date() }).where(eq(reservations.id, reservation.id));
    }
    const payload = { success: true, message: 'Payment recorded', invoice: updated };
    await tx.insert(idempotencyKeys).values({ key, action: 'invoice_payment', responsePayload: payload, expiresAt: new Date(Date.now() + 86400000) });
    return payload;
  });
  return NextResponse.json(result);
}
export const POST = withMerchant(handlePOST, 'invoices');
