/**
 * Provider-agnostic inbound webhook helpers.
 *
 * Payment providers (Paystack / Flutterwave) retain their dedicated verification
 * routes. This module only provides shared recording helpers and must never
 * weaken payment signature checks.
 */
import { and, eq } from 'drizzle-orm';
import { db, integrationWebhookEvents, integrations } from '@sena/database';
import { ensureConnectedAppsPlatformSchema } from './registry';

export async function findIntegrationByWebhookTokenHash(tokenHash: string) {
  return db.query.integrations.findFirst({
    where: eq(integrations.webhookTokenHash, tokenHash),
  });
}

export async function recordInboundWebhookEvent(input: {
  integrationId: string;
  propertyId: string;
  providerEventId?: string | null;
  eventType: string;
  paymentReference?: string | null;
  status?: string;
  errorMessage?: string | null;
}) {
  await ensureConnectedAppsPlatformSchema();

  if (input.providerEventId) {
    const existing = await db.query.integrationWebhookEvents.findFirst({
      where: and(
        eq(integrationWebhookEvents.integrationId, input.integrationId),
        eq(integrationWebhookEvents.providerEventId, input.providerEventId)
      ),
    });
    if (existing) return { event: existing, duplicate: true as const };
  }

  try {
    const [event] = await db
      .insert(integrationWebhookEvents)
      .values({
        integrationId: input.integrationId,
        propertyId: input.propertyId,
        providerEventId: input.providerEventId || null,
        eventType: input.eventType,
        paymentReference: input.paymentReference || null,
        status: input.status || 'received',
        errorMessage: input.errorMessage || null,
      })
      .returning();
    return { event, duplicate: false as const };
  } catch (error: any) {
    if (String(error?.message || '').includes('unique') || error?.code === '23505') {
      const existing = input.providerEventId
        ? await db.query.integrationWebhookEvents.findFirst({
            where: and(
              eq(integrationWebhookEvents.integrationId, input.integrationId),
              eq(integrationWebhookEvents.providerEventId, input.providerEventId)
            ),
          })
        : null;
      if (existing) return { event: existing, duplicate: true as const };
    }
    throw error;
  }
}

export async function markWebhookProcessed(eventId: string, status: 'processed' | 'failed', errorMessage?: string) {
  await db
    .update(integrationWebhookEvents)
    .set({
      status,
      processedAt: new Date(),
      errorMessage: errorMessage || null,
    })
    .where(eq(integrationWebhookEvents.id, eventId));
}
