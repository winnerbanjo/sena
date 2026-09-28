import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db, operationalNotifications, paymentAttempts, payments, propertyInvoices, reservations, integrations } from '@sena/database';
import { assertFlutterwavePayable, requireConnectedFlutterwave } from './integrations/flutterwave';

const SUPPORTED_CURRENCIES = new Set(['NGN', 'GHS', 'ZAR', 'USD', 'KES', 'XOF', 'UGX', 'TZS', 'RWF', 'GBP', 'EUR']);

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

export function flutterwaveMajorAmount(amountMinorUnits: number) {
  return Math.round(amountMinorUnits) / 100;
}

export function flutterwaveMinorAmount(amount: unknown) {
  const major = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(major) || major <= 0) return null;
  return Math.round(major * 100);
}

export function flutterwaveMeta(verified: any): Record<string, unknown> {
  const meta = verified?.meta ?? verified?.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) return meta as Record<string, unknown>;
  if (Array.isArray(meta)) {
    const out: Record<string, unknown> = {};
    for (const entry of meta) {
      if (entry?.metakey) out[String(entry.metakey)] = entry.metavalue;
    }
    return out;
  }
  return {};
}

export function normalizeFlutterwaveTransaction(verified: any) {
  const amountMinorUnits = flutterwaveMinorAmount(verified?.amount);
  const status = typeof verified?.status === 'string' ? verified.status.toLowerCase() : '';
  return {
    id: verified?.id != null ? String(verified.id) : null,
    txRef: typeof verified?.tx_ref === 'string' ? verified.tx_ref : '',
    flwRef: typeof verified?.flw_ref === 'string' ? verified.flw_ref : null,
    status,
    amountMinorUnits,
    currency: typeof verified?.currency === 'string' ? verified.currency : '',
    channel: typeof verified?.payment_type === 'string' ? verified.payment_type : 'card',
    paidAt: verified?.created_at || verified?.charged_at || null,
    customerEmail: verified?.customer?.email || null,
    meta: flutterwaveMeta(verified),
  };
}

function logFlutterwave(event: string, details: Record<string, unknown>) {
  console.info('[flutterwave]', event, details);
}

export async function initializePropertyFlutterwave(input: InitializeInput, fetcher: typeof fetch = fetch) {
  if (!Number.isSafeInteger(input.amountMinorUnits) || input.amountMinorUnits <= 0) throw new Error('INVALID_AMOUNT');
  if (!SUPPORTED_CURRENCIES.has(input.currency)) throw new Error('UNSUPPORTED_CURRENCY');
  const { integration, secret } = await requireConnectedFlutterwave(input.propertyId);
  const lock = `flutterwave-init:${input.propertyId}:${input.idempotencyKey || input.invoiceId || input.reservationId || input.email}`;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lock}))`);
    if (input.idempotencyKey) {
      const prior = await tx.query.paymentAttempts.findFirst({ where: and(eq(paymentAttempts.propertyId, input.propertyId), eq(paymentAttempts.idempotencyKey, input.idempotencyKey)) });
      if (prior?.status === 'initialized') return prior.metadata as any;
    }
    assertFlutterwavePayable(integration, input.source);
    const internalReference = `SENA_${crypto.randomBytes(18).toString('hex')}`;
    const [attempt] = await tx.insert(paymentAttempts).values({
      propertyId: input.propertyId,
      integrationId: integration.id,
      invoiceId: input.invoiceId || null,
      reservationId: input.reservationId || null,
      idempotencyKey: input.idempotencyKey || null,
      internalReference,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency,
      source: input.source,
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 60_000),
    }).returning();
    const response = await fetcher('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        tx_ref: internalReference,
        amount: flutterwaveMajorAmount(input.amountMinorUnits),
        currency: input.currency,
        redirect_url: input.callbackUrl,
        customer: { email: input.email },
        payment_options: 'card,banktransfer,ussd',
        meta: {
          type: input.invoiceId ? 'invoice_settlement' : 'reservation_settlement',
          propertyId: input.propertyId,
          invoiceId: input.invoiceId || undefined,
          reservationId: input.reservationId || undefined,
          paymentAttemptId: attempt.id,
          source: input.source,
        },
      }),
    });
    const result = await response.json().catch(() => null) as any;
    if (!response.ok || result?.status !== 'success' || !result?.data?.link) {
      await tx.update(paymentAttempts).set({ status: 'failed', updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
      logFlutterwave('initialization_failed', { propertyId: input.propertyId, source: input.source, httpStatus: response.status });
      throw new Error(response.status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'INITIALIZATION_FAILED');
    }
    const safe = { authorizationUrl: result.data.link, reference: internalReference, paymentAttemptId: attempt.id, provider: 'flutterwave' as const };
    await tx.update(paymentAttempts).set({ providerReference: internalReference, status: 'initialized', initializedAt: new Date(), metadata: safe, updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
    return safe;
  });
}

export async function verifyPropertyFlutterwaveTransaction(
  propertyId: string,
  input: { transactionId?: string | number | null; txRef?: string | null },
  fetcher: typeof fetch = fetch,
) {
  const { secret } = await requireConnectedFlutterwave(propertyId);
  const transactionId = input.transactionId != null && String(input.transactionId).trim() ? String(input.transactionId).trim() : '';
  const txRef = input.txRef?.trim() || '';
  const url = transactionId
    ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`
    : txRef
      ? `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`
      : '';
  if (!url) throw new Error('VERIFICATION_FAILED');
  const response = await fetcher(url, { headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' }, cache: 'no-store' });
  const result = await response.json().catch(() => null) as any;
  if (!response.ok || result?.status !== 'success' || !result.data) {
    logFlutterwave('verification_failed', { propertyId, hasTransactionId: Boolean(transactionId), httpStatus: response.status });
    throw new Error('VERIFICATION_FAILED');
  }
  return result.data;
}

export async function settlePropertyFlutterwave(attemptId: string, verified: any) {
  const normalized = normalizeFlutterwaveTransaction(verified);
  if (normalized.status !== 'successful' || !normalized.txRef || !normalized.amountMinorUnits) throw new Error('INVALID_VERIFICATION');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`property-flutterwave:${attemptId}`}))`);
    const [attempt] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId)).for('update');
    if (!attempt) throw new Error('ATTEMPT_NOT_FOUND');
    if (attempt.status === 'completed') return { status: 'already_processed', attemptId };
    const metadata = normalized.meta;
    const amountMismatch = attempt.amountMinorUnits !== normalized.amountMinorUnits;
    const currencyMismatch = attempt.currency !== normalized.currency;
    const referenceMismatch = attempt.internalReference !== normalized.txRef || (attempt.providerReference && attempt.providerReference !== normalized.txRef);
    const metaProperty = typeof metadata.propertyId === 'string' ? metadata.propertyId : '';
    const metaAttempt = typeof metadata.paymentAttemptId === 'string' ? metadata.paymentAttemptId : '';
    const metaSource = typeof metadata.source === 'string' ? metadata.source : '';
    if (amountMismatch || currencyMismatch || referenceMismatch ||
        (metaProperty && metaProperty !== attempt.propertyId) ||
        (metaAttempt && metaAttempt !== attempt.id) ||
        (metaSource && metaSource !== attempt.source)) {
      logFlutterwave('settlement_mismatch', {
        attemptId,
        propertyId: attempt.propertyId,
        amountMismatch,
        currencyMismatch,
        referenceMismatch,
        expectedAmount: attempt.amountMinorUnits,
        reportedAmount: normalized.amountMinorUnits,
        expectedCurrency: attempt.currency,
        reportedCurrency: normalized.currency,
      });
      throw new Error(amountMismatch ? 'AMOUNT_MISMATCH' : currencyMismatch ? 'CURRENCY_MISMATCH' : 'PAYMENT_MISMATCH');
    }
    const paidAt = new Date(normalized.paidAt || Date.now());
    if (!Number.isFinite(paidAt.getTime())) throw new Error('INVALID_PAYMENT_DATE');
    const integrationRow = await tx.query.integrations.findFirst({ where: eq(integrations.id, attempt.integrationId) });
    const paymentMeta = { provider: 'flutterwave', mode: integrationRow?.mode || null, flwRef: normalized.flwRef };
    if (attempt.invoiceId) {
      const [invoice] = await tx.select().from(propertyInvoices).where(eq(propertyInvoices.id, attempt.invoiceId)).for('update');
      if (!invoice || invoice.propertyId !== attempt.propertyId || invoice.currency !== attempt.currency || ['draft', 'void', 'cancelled'].includes(invoice.status)) throw new Error('INVOICE_UNAVAILABLE');
      const outstanding = invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits;
      if (outstanding < attempt.amountMinorUnits) throw new Error('PAYMENT_EXCEEDS_BALANCE');
      const paid = invoice.paidAmountMinorUnits + attempt.amountMinorUnits;
      await tx.update(propertyInvoices).set({ paidAmountMinorUnits: paid, status: paid === invoice.totalAmountMinorUnits ? 'paid' : 'partially_paid', updatedAt: new Date() }).where(eq(propertyInvoices.id, invoice.id));
      if (invoice.reservationId) {
        const [reservation] = await tx.select().from(reservations).where(eq(reservations.id, invoice.reservationId)).for('update');
        if (!reservation || reservation.propertyId !== attempt.propertyId || reservation.status === 'cancelled') throw new Error('RESERVATION_UNAVAILABLE');
        const reservationPaid = reservation.paidAmountMinorUnits + attempt.amountMinorUnits;
        await tx.update(reservations).set({ paidAmountMinorUnits: reservationPaid, paymentStatus: reservationPaid >= reservation.totalAmountMinorUnits ? 'paid' : 'part_payment', updatedAt: new Date() }).where(eq(reservations.id, reservation.id));
      }
      await tx.insert(payments).values({
        propertyId: attempt.propertyId,
        reservationId: invoice.reservationId,
        invoiceId: invoice.id,
        integrationId: attempt.integrationId,
        internalReference: attempt.internalReference,
        amountMinorUnits: attempt.amountMinorUnits,
        currency: attempt.currency,
        provider: 'flutterwave',
        providerReference: normalized.txRef,
        providerTransactionId: normalized.id,
        method: normalized.channel || 'card',
        status: 'successful',
        source: attempt.source,
        paidAt,
        notes: `Invoice ${invoice.invoiceNumber}`,
        metadata: paymentMeta,
      });
    } else if (attempt.reservationId) {
      const [reservation] = await tx.select().from(reservations).where(eq(reservations.id, attempt.reservationId)).for('update');
      if (!reservation || reservation.propertyId !== attempt.propertyId || reservation.status === 'cancelled') throw new Error('RESERVATION_UNAVAILABLE');
      const outstanding = reservation.totalAmountMinorUnits - reservation.paidAmountMinorUnits;
      if (outstanding < attempt.amountMinorUnits) throw new Error('PAYMENT_EXCEEDS_BALANCE');
      const paid = reservation.paidAmountMinorUnits + attempt.amountMinorUnits;
      await tx.insert(payments).values({
        propertyId: attempt.propertyId,
        reservationId: reservation.id,
        integrationId: attempt.integrationId,
        internalReference: attempt.internalReference,
        amountMinorUnits: attempt.amountMinorUnits,
        currency: attempt.currency,
        provider: 'flutterwave',
        providerReference: normalized.txRef,
        providerTransactionId: normalized.id,
        method: normalized.channel || 'card',
        status: 'successful',
        source: attempt.source,
        paidAt,
        metadata: paymentMeta,
      });
      await tx.update(reservations).set({ paidAmountMinorUnits: paid, paymentStatus: paid >= reservation.totalAmountMinorUnits ? 'paid' : 'part_payment', updatedAt: new Date() }).where(eq(reservations.id, reservation.id));
    } else throw new Error('PAYMENT_TARGET_MISSING');
    await tx.insert(operationalNotifications).values({
      propertyId: attempt.propertyId,
      dedupeKey: `flutterwave:${attempt.internalReference}`,
      kind: attempt.source === 'invoice' ? 'invoice' : 'payment',
      title: attempt.source === 'invoice' ? 'Invoice paid' : 'Payment received',
      body: attempt.source === 'invoice' ? 'An invoice payment was received through Flutterwave.' : 'A booking payment was received through Flutterwave.',
      href: attempt.source === 'invoice' ? '/invoices' : '/payments',
    }).onConflictDoNothing();
    await tx.update(paymentAttempts).set({ status: 'completed', completedAt: paidAt, updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
    return { status: 'success', attemptId: attempt.id };
  });
}

export function flutterwaveReceiptPayload(attempt: { invoiceId?: string | null; reservationId?: string | null; propertyId: string; source: string }, verified: any) {
  const normalized = normalizeFlutterwaveTransaction(verified);
  return {
    reference: normalized.txRef,
    amount: normalized.amountMinorUnits,
    currency: normalized.currency,
    paid_at: normalized.paidAt,
    customer: { email: normalized.customerEmail },
    metadata: {
      type: attempt.invoiceId ? 'invoice_settlement' : 'reservation_settlement',
      propertyId: attempt.propertyId,
      invoiceId: attempt.invoiceId || undefined,
      reservationId: attempt.reservationId || undefined,
      source: attempt.source,
      providerLabel: 'Flutterwave',
    },
  };
}
