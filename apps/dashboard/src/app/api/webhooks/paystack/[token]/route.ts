import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@sena/payments';
import { db, integrationWebhookEvents, integrations, paymentAttempts, eq, and } from '@sena/database';
import { requireConnectedPaystack } from '@/lib/integrations/paystack';
import { settlePropertyPaystack, verifyPropertyPaystackTransaction } from '@/lib/paystack-payments';
import { sendVerifiedPaymentNotice } from '@/lib/settle-paystack';

async function markWebhookVerified(integrationId: string, deliveryId: string) {
  await db.update(integrationWebhookEvents).set({ status: 'processed', processedAt: new Date(), errorMessage: null }).where(eq(integrationWebhookEvents.id, deliveryId));
  await db.update(integrations).set({ webhookStatus: 'active', webhookVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(integrations.id, integrationId));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const integration = await db.query.integrations.findFirst({ where: eq(integrations.webhookTokenHash, tokenHash) });
  if (!integration || integration.provider !== 'paystack') return NextResponse.json({ error: 'Webhook not found.' }, { status: 404 });
  const rawBody = await req.text();
  const { secret } = await requireConnectedPaystack(integration.propertyId).catch(() => ({ secret: '' }));
  if (!secret || !PaymentService.verifyWebhookSignature(req.headers.get('x-paystack-signature') || '', rawBody, secret)) {
    if (integration.webhookStatus === 'not_configured' || integration.webhookStatus === 'configured') {
      await db.update(integrations).set({ webhookStatus: 'needs_attention', updatedAt: new Date() }).where(eq(integrations.id, integration.id));
    }
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid event.' }, { status: 400 }); }
  if (event.event !== 'charge.success') return NextResponse.json({ status: 'ignored' });
  const reference = event.data?.reference;
  if (typeof reference !== 'string' || reference.length > 255) return NextResponse.json({ error: 'Invalid payment reference.' }, { status: 400 });
  const eventId = crypto.createHash('sha256').update(`${event.event}:${reference}:${event.data?.id || ''}`).digest('hex');
  const inserted = await db.insert(integrationWebhookEvents).values({ integrationId: integration.id, propertyId: integration.propertyId, providerEventId: eventId, eventType: event.event, paymentReference: reference }).onConflictDoNothing().returning({ id: integrationWebhookEvents.id, status: integrationWebhookEvents.status });
  const delivery = inserted[0] || await db.query.integrationWebhookEvents.findFirst({ where: and(eq(integrationWebhookEvents.integrationId, integration.id), eq(integrationWebhookEvents.providerEventId, eventId)) });
  if (!delivery) return NextResponse.json({ error: 'Event could not be recorded.' }, { status: 500 });
  if ('status' in delivery && delivery.status === 'processed') {
    // Duplicate authentic delivery: keep webhook health active without re-settling.
    if (integration.webhookStatus !== 'active') {
      await db.update(integrations).set({ webhookStatus: 'active', webhookVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(integrations.id, integration.id));
    }
    return NextResponse.json({ status: 'already_processed' });
  }
  // Failed or interrupted deliveries may retry. Settlement serializes the attempt
  // and the receipt's stable email key prevents duplicate financial effects.

  try {
    const attempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.providerReference, reference) });
    if (!attempt || attempt.integrationId !== integration.id || attempt.propertyId !== integration.propertyId) {
      await db.update(integrationWebhookEvents).set({ status: 'ignored', processedAt: new Date(), errorMessage: 'Unknown payment reference.' }).where(eq(integrationWebhookEvents.id, delivery.id));
      return NextResponse.json({ status: 'ignored' }, { status: 404 });
    }
    const verified = await verifyPropertyPaystackTransaction(integration.propertyId, reference);
    const result = await settlePropertyPaystack(attempt.id, verified);
    await markWebhookVerified(integration.id, delivery.id);
    if (result.status === 'success') {
      await sendVerifiedPaymentNotice(verified).catch(() => undefined);
    }
    return NextResponse.json(result);
  } catch (error: any) {
    const mismatch = error?.message === 'AMOUNT_MISMATCH' || error?.message === 'CURRENCY_MISMATCH' || error?.message === 'PAYMENT_MISMATCH';
    await db.update(integrationWebhookEvents).set({ status: 'failed', processedAt: new Date(), errorMessage: 'Payment verification or settlement failed.' }).where(eq(integrationWebhookEvents.id, delivery.id));
    await db.update(integrations).set({ webhookStatus: 'needs_attention', updatedAt: new Date() }).where(eq(integrations.id, integration.id));
    return NextResponse.json({ error: 'Payment could not be verified. Retry this event.' }, { status: mismatch ? 409 : 500 });
  }
}
