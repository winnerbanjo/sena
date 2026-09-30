import { applyInvoiceSettlementToReservation } from '@/lib/invoice-settlement';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { optionalReceiptFromForm, settleWithOptionalReceipt, type ReceiptFileInput } from '@/lib/payment-receipt-file';
import { persistPaymentReceipt } from '@/lib/payment-receipt-persist';
import { NextRequest, NextResponse } from 'next/server';
import { db, propertyInvoices, payments, reservations, idempotencyKeys, operationalNotifications, eq, sql } from '@sena/database';

async function readSettlementInput(req: NextRequest): Promise<{ body: Record<string, unknown>; receipt: ReceiptFileInput | null; error?: { status: number; error: string; code: string } }> {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return { body: await req.json(), receipt: null };
  }
  const form = await req.formData();
  const uploaded = await optionalReceiptFromForm(form);
  if (uploaded.error) return { body: {}, receipt: uploaded.receipt, error: uploaded.error };
  return {
    body: {
      amountMinorUnits: Number(form.get('amountMinorUnits')),
      method: String(form.get('method') || ''),
      providerReference: String(form.get('providerReference') || ''),
      notes: String(form.get('notes') || ''),
    },
    receipt: uploaded.receipt,
  };
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = await readSettlementInput(req);
  if (parsed.error) return NextResponse.json({ error: parsed.error.error, code: parsed.error.code, paymentRecorded: false }, { status: parsed.error.status });
  const body = parsed.body;
  const amount = Number(body.amountMinorUnits);
  const requestKey = req.headers.get('idempotency-key');
  if (!requestKey || requestKey.length > 100) return NextResponse.json({ error: 'A payment reference is required. Please try again.', paymentRecorded: false }, { status: 400 });
  if (!Number.isSafeInteger(amount) || amount <= 0 || !['cash', 'pos', 'bank_transfer', 'card'].includes(String(body.method))) return NextResponse.json({ error: 'Enter a valid payment amount and method.', paymentRecorded: false }, { status: 422 });
  const key = `invoice-payment:${id}:${requestKey}`;
  const merchant = getMerchantRequest(req);
  let settled: Awaited<ReturnType<typeof settleWithOptionalReceipt>>;
  try {
  settled = await settleWithOptionalReceipt({
    receipt: parsed.receipt,
    recordPayment: () => db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
      const prior = await tx.query.idempotencyKeys.findFirst({ where: eq(idempotencyKeys.key, key) });
      if (prior) return prior.responsePayload as { success?: boolean; paymentId?: string; propertyId?: string; error?: string };
      const [invoice] = await tx.select().from(propertyInvoices).where(eq(propertyInvoices.id, id)).for('update');
      if (!invoice || ['void', 'draft', 'cancelled', 'paid'].includes(invoice.status)) throw new Error('Invoice unavailable');
      if (amount > invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits) return { error: 'Amount is more than the outstanding balance.', paymentRecorded: false };
      const paid = invoice.paidAmountMinorUnits + amount;
      const [updated] = await tx.update(propertyInvoices).set({ paidAmountMinorUnits: paid, status: paid >= invoice.totalAmountMinorUnits ? 'paid' : 'partially_paid', updatedAt: new Date() }).where(eq(propertyInvoices.id, id)).returning();
      if (invoice.reservationId) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${invoice.reservationId}))`);
        const [reservation] = await tx.select().from(reservations).where(eq(reservations.id, invoice.reservationId)).for('update');
      if (!reservation || reservation.propertyId !== invoice.propertyId) throw new Error('Reservation unavailable');
      const settlement = applyInvoiceSettlementToReservation({
        reservationPaidMinorUnits: reservation.paidAmountMinorUnits,
        reservationTotalMinorUnits: reservation.totalAmountMinorUnits,
        amountMinorUnits: amount,
      });
      await tx.update(reservations).set({ paidAmountMinorUnits: settlement.paidAmountMinorUnits, paymentStatus: settlement.paymentStatus, updatedAt: new Date() }).where(eq(reservations.id, reservation.id));
      }
      const [payment] = await tx.insert(payments).values({ propertyId: invoice.propertyId, invoiceId: invoice.id, reservationId: invoice.reservationId, amountMinorUnits: amount, currency: invoice.currency, provider: 'manual', providerReference: String(body.providerReference || '') || requestKey, method: String(body.method), status: 'successful', source: 'invoice', notes: typeof body.notes === 'string' ? body.notes.trim() : '', recordedByUserId: merchant?.tenant.userId }).returning();
      await tx.insert(operationalNotifications).values({ propertyId: invoice.propertyId, dedupeKey: `manual:${payment.id}`, kind: 'invoice', title: 'Invoice payment received', body: 'An invoice payment was recorded at the property.', href: '/invoices' }).onConflictDoNothing();
      const payload = { success: true, message: 'Payment recorded', invoice: updated, paymentId: payment.id, propertyId: invoice.propertyId };
      await tx.insert(idempotencyKeys).values({ key, action: 'invoice_payment', responsePayload: payload, expiresAt: new Date(Date.now() + 86400000) });
      return payload;
    }),
    attach: async (payment) => {
      if (!parsed.receipt || !merchant || payment.propertyId !== merchant.tenant.propertyId) {
        return { attached: false, error: 'Payment was recorded, but the receipt was not attached.' };
      }
      return persistPaymentReceipt({
        propertyId: payment.propertyId,
        paymentId: payment.paymentId,
        userId: merchant.tenant.userId,
        actorName: merchant.tenant.user.fullName,
        organizationId: merchant.tenant.property.organizationId,
        file: parsed.receipt,
      });
    },
  });
  } catch (error) {
    console.error('[invoice-payment]', { invoiceId: id, name: error instanceof Error ? error.name : 'Error' });
    const message = error instanceof Error ? error.message : '';
    const safe = message === 'Invoice unavailable'
      ? 'This invoice can no longer accept a payment. Refresh it before trying again.'
      : 'This payment could not be recorded. No payment was added. Please try again.';
    return NextResponse.json({ error: safe, paymentRecorded: false }, { status: 409 });
  }
  const result = settled.body;
  if (result && typeof result === 'object' && 'paymentId' in result && 'propertyId' in result) {
    // Zoho payment sync is outbound bookkeeping only — never mutates Sena ledger.
    void import('@/lib/integrations/zoho/invoice')
      .then(({ maybeQueueZohoPaymentSync }) =>
        maybeQueueZohoPaymentSync(String((result as { propertyId?: string }).propertyId), String((result as { paymentId?: string }).paymentId))
      )
      .catch(() => null);
    void import('@/lib/integrations/zoho/books')
      .then(({ maybeQueueZohoBooksPaymentSync }) =>
        maybeQueueZohoBooksPaymentSync(String((result as { propertyId?: string }).propertyId), String((result as { paymentId?: string }).paymentId))
      )
      .catch(() => null);
  }
  return NextResponse.json(result, { status: settled.status });
}
export const POST = withMerchant(handlePOST, 'invoices');
