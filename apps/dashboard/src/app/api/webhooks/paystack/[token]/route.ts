import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@sena/payments';
import { db, integrationWebhookEvents, integrations, paymentAttempts, eq } from '@sena/database';
import { requireConnectedPaystack } from '@/lib/integrations/paystack';
import { settlePropertyPaystack, verifyPropertyPaystackTransaction } from '@/lib/paystack-payments';
import { sendVerifiedPaymentNotice } from '@/lib/settle-paystack';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const integration = await db.query.integrations.findFirst({ where: eq(integrations.webhookTokenHash, tokenHash) });
  if (!integration || integration.provider !== 'paystack') return NextResponse.json({ error: 'Webhook not found.' }, { status: 404 });
  const rawBody = await req.text();
  const { secret } = await requireConnectedPaystack(integration.propertyId).catch(() => ({ secret: '' }));
  if (!secret || !PaymentService.verifyWebhookSignature(req.headers.get('x-paystack-signature') || '', rawBody, secret)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid event.' }, { status: 400 }); }
  if (event.event !== 'charge.success') return NextResponse.json({ status: 'ignored' });
  const reference = event.data?.reference;
  if (typeof reference !== 'string' || reference.length > 255) return NextResponse.json({ error: 'Invalid payment reference.' }, { status: 400 });
  const eventId = crypto.createHash('sha256').update(`${event.event}:${reference}:${event.data?.id || ''}`).digest('hex');
  const inserted = await db.insert(integrationWebhookEvents).values({ integrationId: integration.id, propertyId: integration.propertyId, providerEventId: eventId, eventType: event.event, paymentReference: reference }).onConflictDoNothing().returning({ id: integrationWebhookEvents.id });
  if (!inserted.length) return NextResponse.json({ status: 'already_processed' });
  try {
    const attempt = await db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.providerReference, reference) });
    if (!attempt || attempt.integrationId !== integration.id || attempt.propertyId !== integration.propertyId) throw new Error('ATTEMPT_NOT_FOUND');
    const verified = await verifyPropertyPaystackTransaction(integration.propertyId, reference);
    const result = await settlePropertyPaystack(attempt.id, verified);
    await db.update(integrationWebhookEvents).set({ status: 'processed', processedAt: new Date() }).where(eq(integrationWebhookEvents.id, inserted[0].id));
    await db.update(integrations).set({ webhookStatus: 'active', webhookVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(integrations.id, integration.id));
    await sendVerifiedPaymentNotice(verified).catch(() => undefined);
    return NextResponse.json(result);
  } catch {
    await db.update(integrationWebhookEvents).set({ status: 'failed', processedAt: new Date(), errorMessage: 'Payment verification or settlement failed.' }).where(eq(integrationWebhookEvents.id, inserted[0].id));
    return NextResponse.json({ error: 'Payment could not be verified. Retry this event.' }, { status: 500 });
  }
}
