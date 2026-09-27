import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db, paymentAttempts, payments, propertyInvoices, reservations } from '@sena/database';
import { requireConnectedPaystack } from './integrations/paystack';

const SUPPORTED_CURRENCIES = new Set(['NGN', 'GHS', 'ZAR', 'USD', 'KES', 'XOF']);

type InitializeInput = {
  propertyId: string;
  invoiceId?: string | null;
  reservationId?: string | null;
  email: string;
  amountMinorUnits: number;
  currency: string;
  source: 'invoice' | 'direct_booking' | 'api_booking';
  callbackUrl: string;
  idempotencyKey?: string;
};

export async function initializePropertyPaystack(input: InitializeInput, fetcher: typeof fetch = fetch) {
  if (!Number.isSafeInteger(input.amountMinorUnits) || input.amountMinorUnits <= 0) throw new Error('INVALID_AMOUNT');
  if (!SUPPORTED_CURRENCIES.has(input.currency)) throw new Error('UNSUPPORTED_CURRENCY');
  const { integration, secret } = await requireConnectedPaystack(input.propertyId);
  const lock = `paystack-init:${input.propertyId}:${input.idempotencyKey || input.invoiceId || input.reservationId || input.email}`;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lock}))`);
    if (input.idempotencyKey) {
      const prior = await tx.query.paymentAttempts.findFirst({ where: and(eq(paymentAttempts.propertyId, input.propertyId), eq(paymentAttempts.idempotencyKey, input.idempotencyKey)) });
      if (prior?.status === 'initialized') return prior.metadata as any;
    }
    const internalReference = `SENA_${crypto.randomBytes(18).toString('hex')}`;
    const [attempt] = await tx.insert(paymentAttempts).values({
      propertyId: input.propertyId, integrationId: integration.id, invoiceId: input.invoiceId || null,
      reservationId: input.reservationId || null, idempotencyKey: input.idempotencyKey || null, internalReference, amountMinorUnits: input.amountMinorUnits,
      currency: input.currency, source: input.source, status: 'pending', expiresAt: new Date(Date.now() + 30 * 60_000),
    }).returning();
    const response = await fetcher('https://api.paystack.co/transaction/initialize', {
      method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({
        email: input.email, amount: input.amountMinorUnits, currency: input.currency, reference: internalReference,
        callback_url: input.callbackUrl,
        metadata: { type: input.invoiceId ? 'invoice_settlement' : 'reservation_settlement', propertyId: input.propertyId, invoiceId: input.invoiceId || undefined, reservationId: input.reservationId || undefined, paymentAttemptId: attempt.id, source: input.source },
      }),
    });
    const result = await response.json().catch(() => null) as any;
    if (!response.ok || !result?.status || !result.data?.authorization_url || !result.data?.reference) {
      await tx.update(paymentAttempts).set({ status: 'failed', updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
      throw new Error(response.status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'INITIALIZATION_FAILED');
    }
    if (result.data.reference !== internalReference) {
      await tx.update(paymentAttempts).set({ status: 'failed', updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
      throw new Error('INITIALIZATION_FAILED');
    }
    const safe = { authorizationUrl: result.data.authorization_url, reference: result.data.reference, paymentAttemptId: attempt.id };
    await tx.update(paymentAttempts).set({ providerReference: result.data.reference, status: 'initialized', initializedAt: new Date(), metadata: safe, updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
    return safe;
  });
}

export async function verifyPropertyPaystackTransaction(propertyId: string, reference: string, fetcher: typeof fetch = fetch) {
  const { secret } = await requireConnectedPaystack(propertyId);
  const response = await fetcher(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' });
  const result = await response.json().catch(() => null) as any;
  if (!response.ok || !result?.status || !result.data) throw new Error('VERIFICATION_FAILED');
  return result.data;
}

export async function settlePropertyPaystack(attemptId: string, verified: any) {
  if (verified?.status !== 'success' || typeof verified.reference !== 'string' || !Number.isSafeInteger(verified.amount) || verified.amount <= 0) throw new Error('INVALID_VERIFICATION');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`property-paystack:${attemptId}`}))`);
    const [attempt] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId)).for('update');
    if (!attempt) throw new Error('ATTEMPT_NOT_FOUND');
    if (attempt.status === 'completed') return { status: 'already_processed', attemptId };
    const metadata = verified.metadata || {};
    if (attempt.providerReference !== verified.reference || attempt.internalReference !== verified.reference ||
        attempt.amountMinorUnits !== verified.amount || attempt.currency !== verified.currency ||
        metadata.paymentAttemptId !== attempt.id || metadata.propertyId !== attempt.propertyId || metadata.source !== attempt.source) {
      throw new Error('PAYMENT_MISMATCH');
    }
    const paidAt = new Date(verified.paid_at || verified.paidAt || Date.now());
    if (!Number.isFinite(paidAt.getTime())) throw new Error('INVALID_PAYMENT_DATE');
    if (attempt.invoiceId) {
      const [invoice] = await tx.select().from(propertyInvoices).where(eq(propertyInvoices.id, attempt.invoiceId)).for('update');
      if (!invoice || invoice.propertyId !== attempt.propertyId || invoice.currency !== attempt.currency || ['draft', 'void'].includes(invoice.status)) throw new Error('INVOICE_UNAVAILABLE');
      const outstanding = invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits;
      if (outstanding < attempt.amountMinorUnits) throw new Error('PAYMENT_EXCEEDS_BALANCE');
      const paid = invoice.paidAmountMinorUnits + attempt.amountMinorUnits;
      await tx.update(propertyInvoices).set({ paidAmountMinorUnits: paid, status: paid === invoice.totalAmountMinorUnits ? 'paid' : 'partially_paid', updatedAt: new Date() }).where(eq(propertyInvoices.id, invoice.id));
      if (invoice.reservationId) {
        const [reservation] = await tx.select().from(reservations).where(eq(reservations.id, invoice.reservationId)).for('update');
        if (!reservation || reservation.propertyId !== attempt.propertyId) throw new Error('RESERVATION_UNAVAILABLE');
        const reservationPaid = reservation.paidAmountMinorUnits + attempt.amountMinorUnits;
        await tx.update(reservations).set({ paidAmountMinorUnits: reservationPaid, paymentStatus: reservationPaid >= reservation.totalAmountMinorUnits ? 'paid' : 'part_payment', updatedAt: new Date() }).where(eq(reservations.id, reservation.id));
      }
      await tx.insert(payments).values({ propertyId: attempt.propertyId, reservationId: invoice.reservationId, invoiceId: invoice.id, integrationId: attempt.integrationId, internalReference: attempt.internalReference, amountMinorUnits: attempt.amountMinorUnits, currency: attempt.currency, provider: 'paystack', providerReference: verified.reference, providerTransactionId: verified.id ? String(verified.id) : null, method: verified.channel || 'card', status: 'successful', source: attempt.source, paidAt, notes: `Invoice ${invoice.invoiceNumber}` });
    } else if (attempt.reservationId) {
      const [reservation] = await tx.select().from(reservations).where(eq(reservations.id, attempt.reservationId)).for('update');
      if (!reservation || reservation.propertyId !== attempt.propertyId) throw new Error('RESERVATION_UNAVAILABLE');
      const outstanding = reservation.totalAmountMinorUnits - reservation.paidAmountMinorUnits;
      if (outstanding < attempt.amountMinorUnits) throw new Error('PAYMENT_EXCEEDS_BALANCE');
      const paid = reservation.paidAmountMinorUnits + attempt.amountMinorUnits;
      await tx.insert(payments).values({ propertyId: attempt.propertyId, reservationId: reservation.id, integrationId: attempt.integrationId, internalReference: attempt.internalReference, amountMinorUnits: attempt.amountMinorUnits, currency: attempt.currency, provider: 'paystack', providerReference: verified.reference, providerTransactionId: verified.id ? String(verified.id) : null, method: verified.channel || 'card', status: 'successful', source: attempt.source, paidAt });
      await tx.update(reservations).set({ paidAmountMinorUnits: paid, paymentStatus: paid >= reservation.totalAmountMinorUnits ? 'paid' : 'part_payment', updatedAt: new Date() }).where(eq(reservations.id, reservation.id));
    } else throw new Error('PAYMENT_TARGET_MISSING');
    await tx.update(paymentAttempts).set({ status: 'completed', completedAt: paidAt, updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
    return { status: 'success', attemptId: attempt.id };
  });
}
