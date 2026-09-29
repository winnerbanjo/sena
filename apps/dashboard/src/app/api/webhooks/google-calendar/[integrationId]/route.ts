import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { db, integrations } from '@sena/database';
import { enqueueSyncJob } from '@/lib/integrations/platform/sync';
import { recordInboundWebhookEvent } from '@/lib/integrations/platform/webhooks';

type Params = { params: Promise<{ integrationId: string }> };

/**
 * Google Calendar push notification receiver.
 * Validates channel token hash from integration metadata — does not trust body for tenancy.
 */
export async function POST(req: NextRequest, context: Params) {
  const { integrationId } = await context.params;
  const channelToken = req.headers.get('x-goog-channel-token') || '';
  const channelId = req.headers.get('x-goog-channel-id') || '';
  const resourceState = req.headers.get('x-goog-resource-state') || 'exists';

  const integration = await db.query.integrations.findFirst({ where: eq(integrations.id, integrationId) });
  if (!integration || integration.provider !== 'google_calendar') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const metadata = integration.metadata && typeof integration.metadata === 'object' ? (integration.metadata as Record<string, unknown>) : {};
  const expectedHash = typeof metadata.watchTokenHash === 'string' ? metadata.watchTokenHash : null;
  const providedHash = channelToken ? createHash('sha256').update(channelToken).digest('hex') : '';
  if (!expectedHash || providedHash !== expectedHash) {
    return NextResponse.json({ error: 'Invalid channel token' }, { status: 401 });
  }
  if (metadata.watchChannelId && channelId && metadata.watchChannelId !== channelId) {
    return NextResponse.json({ error: 'Invalid channel' }, { status: 401 });
  }

  await recordInboundWebhookEvent({
    integrationId: integration.id,
    propertyId: integration.propertyId,
    providerEventId: `${channelId}:${resourceState}:${req.headers.get('x-goog-message-number') || Date.now()}`,
    eventType: `google.calendar.${resourceState}`,
  });

  // Prefer outbound-first: push only schedules reconciliation, never invents Sena reservations.
  if (resourceState !== 'sync') {
    await enqueueSyncJob({
      propertyId: integration.propertyId,
      integrationId: integration.id,
      provider: 'google_calendar',
      direction: 'inbound',
      trigger: 'webhook',
      jobType: 'reconcile',
      idempotencyKey: `gcal:reconcile:${integration.id}:${req.headers.get('x-goog-message-number') || Date.now()}`,
    });
  }

  return NextResponse.json({ ok: true });
}
