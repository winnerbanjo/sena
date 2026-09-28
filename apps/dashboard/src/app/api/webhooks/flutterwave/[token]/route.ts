import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db, integrationWebhookEvents, integrations, paymentAttempts, eq, and } from '@sena/database';
import { flutterwaveWebhookAuthentic, requireConnectedFlutterwave } from '@/lib/integrations/flutterwave';
import { flutterwaveReceiptPayload, settlePropertyFlutterwave, verifyPropertyFlutterwaveTransaction } from '@/lib/flutterwave-payments';
import { sendVerifiedPaymentNotice } from '@/lib/settle-paystack';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const integration = await db.query.integrations.findFirst({ where: eq(integrations.webhookTokenHash, tokenHash) });
  if (!integration || integration.provider !== 'flutterwave') return NextResponse.json({ error: 'Webhook not found.' }, { status: 404 });
  const rawBody = await req.text();
  const { webhookSecret } = await requireConnectedFlutterwave(integration.propertyId).catch(() => ({ webhookSecret: '' }));
  const authentic = flutterwaveWebhookAuthentic(webhookSecret, rawBody, {
    verifHash: req.headers.get('verif-hash'),
    signature: req.headers.get('flutterwave-signature'),
  });
  if (!webhookSecret || !authentic) {
    console.info('[flutterwave]', 'webhook_rejected', { propertyId: integration.propertyId, reason: 'unauthentic' });
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid event.' }, { status: 400 }); }
  if (event.event !== 'charge.completed') return NextResponse.json({ status: 'ignored' });
  const txRef = event.data?.tx_ref;
  const transactionId = event.data?.id;
  if (typeof txRef !== 'string' || txRef.length > 255) return NextResponse.json({ error: 'Invalid payment reference.' }, { status: 400 });
  const eventId = crypto.createHash('sha256').update(`${event.event}:${txRef}:${transactionId || ''}`).digest('hex');
  const inserted = await db.insert(integrationWebhookEvents).values({ integrationId: integration.id, propertyId: integration.propertyId, providerEventId: eventId, eventType: event.event, paymentReference: txRef }).onConflictDoNothing().returning({ id: integrationWebhookEvents.id });
  const delivery = inserted[0] || await db.query.integrationWebhookEvents.findFirst({ where: and(eq(integrationWebhookEvents.integrationId, integration.id), eq(integrationWebhookEvents.providerEventId, eventId)) });
  if (!delivery) return NextResponse.json({ error: 'Event could not be recorded.' }, { status: 500 });
  if ('status' in delivery && delivery.status === 'processed') return NextResponse.json({ status: 'already_processed' });

  try {
    const attempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.internalReference, txRef) });
    if (!attempt || attempt.integrationId !== integration.id || attempt.propertyId !== integration.propertyId) {
      console.info('[flutterwave]', 'webhook_unknown_reference', { propertyId: integration.propertyId });
      throw new Error('ATTEMPT_NOT_FOUND');
    }
    const verified = await verifyPropertyFlutterwaveTransaction(integration.propertyId, { transactionId, txRef });
    const result = await settlePropertyFlutterwave(attempt.id, verified);
    await db.update(integrationWebhookEvents).set({ status: 'processed', processedAt: new Date() }).where(eq(integrationWebhookEvents.id, delivery.id));
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
