import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db, integrationWebhookEvents, integrations, paymentAttempts, eq, and } from '@sena/database';
import { flutterwaveWebhookAuthentic, requireConnectedFlutterwave } from '@/lib/integrations/flutterwave';
import { flutterwaveReceiptPayload, settlePropertyFlutterwave, verifyPropertyFlutterwaveTransaction } from '@/lib/flutterwave-payments';
import { sendVerifiedPaymentNotice } from '@/lib/settle-paystack';

type SafeWebhookBody = {
  event: any;
  eventType: string;
  txRef: string | null;
  transactionId: string | null;
  parseable: boolean;
};

function parseSafeWebhookBody(rawBody: string): SafeWebhookBody {
  try {
    const event = JSON.parse(rawBody);
    const eventType = typeof event?.event === 'string' ? event.event.slice(0, 100) : 'unparseable';
    const txRef = typeof event?.data?.tx_ref === 'string' ? event.data.tx_ref.slice(0, 255) : null;
    const transactionId = event?.data?.id != null ? String(event.data.id).slice(0, 64) : null;
    return { event, eventType, txRef, transactionId, parseable: true };
  } catch {
    return { event: null, eventType: 'unparseable', txRef: null, transactionId: null, parseable: false };
  }
}

function signaturePresence(verifHash: string | null, signature: string | null) {
  if (verifHash && signature) return 'verif-hash+flutterwave-signature';
  if (verifHash) return 'verif-hash';
  if (signature) return 'flutterwave-signature';
  return 'absent';
}

async function recordWebhookDelivery(input: {
  integrationId: string;
  propertyId: string;
  providerEventId: string;
  eventType: string;
  paymentReference: string | null;
  status: string;
  errorMessage?: string | null;
}) {
  const inserted = await db.insert(integrationWebhookEvents).values({
    integrationId: input.integrationId,
    propertyId: input.propertyId,
    providerEventId: input.providerEventId,
    eventType: input.eventType,
    paymentReference: input.paymentReference,
    status: input.status,
    processedAt: input.status === 'received' ? null : new Date(),
    errorMessage: input.errorMessage || null,
  }).onConflictDoNothing().returning({ id: integrationWebhookEvents.id, status: integrationWebhookEvents.status });
  if (inserted[0]) return inserted[0];
  return db.query.integrationWebhookEvents.findFirst({
    where: and(
      eq(integrationWebhookEvents.integrationId, input.integrationId),
      eq(integrationWebhookEvents.providerEventId, input.providerEventId),
    ),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const integration = await db.query.integrations.findFirst({ where: eq(integrations.webhookTokenHash, tokenHash) });
  if (!integration || integration.provider !== 'flutterwave') return NextResponse.json({ error: 'Webhook not found.' }, { status: 404 });

  const rawBody = await req.text();
  const parsed = parseSafeWebhookBody(rawBody);
  const verifHash = req.headers.get('verif-hash');
  const signature = req.headers.get('flutterwave-signature');
  const headerPresence = signaturePresence(verifHash, signature);
  const { webhookSecret } = await requireConnectedFlutterwave(integration.propertyId).catch(() => ({ webhookSecret: '' }));
  const authentic = flutterwaveWebhookAuthentic(webhookSecret, rawBody, { verifHash, signature });

  if (!webhookSecret || !authentic) {
    const reason = !webhookSecret
      ? 'webhook_secret_unreadable'
      : headerPresence === 'absent'
        ? 'signature_absent'
        : 'signature_invalid';
    console.info('[flutterwave]', 'webhook_rejected', {
      propertyId: integration.propertyId,
      reason,
      signatureHeader: headerPresence,
      eventType: parsed.eventType,
      hasReference: Boolean(parsed.txRef),
    });
    await recordWebhookDelivery({
      integrationId: integration.id,
      propertyId: integration.propertyId,
      providerEventId: `rejected:${crypto.randomUUID()}`,
      eventType: parsed.eventType,
      paymentReference: parsed.txRef,
      status: 'rejected',
      errorMessage: `${reason};header=${headerPresence}`,
    });
    if (integration.webhookStatus === 'not_configured' || integration.webhookStatus === 'configured') {
      await db.update(integrations).set({ webhookStatus: 'needs_attention', updatedAt: new Date() }).where(eq(integrations.id, integration.id));
    }
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  if (!parsed.parseable) return NextResponse.json({ error: 'Invalid event.' }, { status: 400 });
  if (parsed.event.event !== 'charge.completed') {
    await recordWebhookDelivery({
      integrationId: integration.id,
      propertyId: integration.propertyId,
      providerEventId: `ignored:${crypto.randomUUID()}`,
      eventType: parsed.eventType,
      paymentReference: parsed.txRef,
      status: 'ignored',
      errorMessage: 'unsupported_event',
    });
    return NextResponse.json({ status: 'ignored' });
  }
  const txRef = parsed.txRef;
  const transactionId = parsed.transactionId;
  if (!txRef || txRef.length > 255) return NextResponse.json({ error: 'Invalid payment reference.' }, { status: 400 });

  const eventId = crypto.createHash('sha256').update(`${parsed.event.event}:${txRef}:${transactionId || ''}`).digest('hex');
  const delivery = await recordWebhookDelivery({
    integrationId: integration.id,
    propertyId: integration.propertyId,
    providerEventId: eventId,
    eventType: parsed.event.event,
    paymentReference: txRef,
    status: 'received',
  });
  if (!delivery) return NextResponse.json({ error: 'Event could not be recorded.' }, { status: 500 });
  if ('status' in delivery && delivery.status === 'processed') return NextResponse.json({ status: 'already_processed' });

  try {
    const attempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.internalReference, txRef) });
    if (!attempt || attempt.integrationId !== integration.id || attempt.propertyId !== integration.propertyId) {
      console.info('[flutterwave]', 'webhook_unknown_reference', { propertyId: integration.propertyId });
      await db.update(integrationWebhookEvents).set({ status: 'ignored', processedAt: new Date(), errorMessage: 'Unknown payment reference.' }).where(eq(integrationWebhookEvents.id, delivery.id));
      return NextResponse.json({ status: 'ignored' }, { status: 404 });
    }
    const verified = await verifyPropertyFlutterwaveTransaction(integration.propertyId, { transactionId, txRef });
    const result = await settlePropertyFlutterwave(attempt.id, verified);
    await db.update(integrationWebhookEvents).set({ status: 'processed', processedAt: new Date(), errorMessage: null }).where(eq(integrationWebhookEvents.id, delivery.id));
    await db.update(integrations).set({ webhookStatus: 'active', webhookVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(integrations.id, integration.id));
    await sendVerifiedPaymentNotice(flutterwaveReceiptPayload(attempt, verified)).catch(() => undefined);
    return NextResponse.json(result);
  } catch (error: any) {
    const mismatch = error?.message === 'AMOUNT_MISMATCH' || error?.message === 'CURRENCY_MISMATCH' || error?.message === 'PAYMENT_MISMATCH';
    console.info('[flutterwave]', mismatch ? 'webhook_mismatch' : 'webhook_settlement_failed', { propertyId: integration.propertyId, reason: mismatch ? error.message : 'verification_or_settlement' });
    await db.update(integrationWebhookEvents).set({ status: 'failed', processedAt: new Date(), errorMessage: 'Payment verification or settlement failed.' }).where(eq(integrationWebhookEvents.id, delivery.id));
    await db.update(integrations).set({ webhookStatus: 'needs_attention', updatedAt: new Date() }).where(eq(integrations.id, integration.id));
    return NextResponse.json({ error: 'Payment could not be verified. Retry this event.' }, { status: mismatch ? 409 : 500 });
  }
}
