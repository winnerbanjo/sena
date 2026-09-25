import crypto from 'crypto';
import { db, webhookEndpoints, webhookDeliveries } from '@sena/database';
import { and, eq } from 'drizzle-orm';

export type WebhookEventType =
  | 'reservation.created'
  | 'reservation.confirmed'
  | 'reservation.cancelled'
  | 'payment.received'
  | 'guest.checked_in'
  | 'guest.checked_out'
  | 'room.status_changed';

export interface WebhookEventPayload<T = any> {
  id: string; // evt_...
  type: WebhookEventType;
  created_at: string;
  property_id: string;
  data: T;
}

/**
 * Generate HMAC SHA-256 signature for webhook payload
 */
export function signWebhookPayload(payloadString: string, secret: string, timestamp: number): string {
  const signaturePayload = `${timestamp}.${payloadString}`;
  return crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
}

/**
 * Verify incoming webhook signature (used by SDK or developers)
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): boolean {
  try {
    const parts = signatureHeader.split(',');
    let timestamp = 0;
    let signature = '';

    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === 't') timestamp = parseInt(v, 10);
      if (k === 'v1') signature = v;
    }

    if (!timestamp || !signature) return false;

    // Replay attack prevention: check tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false;
    }

    const expectedSignature = signWebhookPayload(rawBody, secret, timestamp);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

/**
 * Dispatch a webhook event asynchronously to all active subscribed endpoints for a property.
 * Records delivery logs and HTTP statuses in PostgreSQL.
 */
export async function dispatchWebhookEvent<T = any>(
  propertyId: string,
  eventType: WebhookEventType,
  data: T
): Promise<void> {
  try {
    const endpoints = await db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.propertyId, propertyId), eq(webhookEndpoints.isActive, true)));

    if (endpoints.length === 0) return;

    const eventId = `evt_${crypto.randomBytes(12).toString('hex')}`;
    const payload: WebhookEventPayload<T> = {
      id: eventId,
      type: eventType,
      created_at: new Date().toISOString(),
      property_id: propertyId,
      data,
    };

    const payloadString = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);

    for (const ep of endpoints) {
      // Check if endpoint is subscribed to this event type
      const subscribedEvents = (ep.events as string[]) || [];
      if (subscribedEvents.length > 0 && !subscribedEvents.includes(eventType)) {
        continue;
      }

      const signature = signWebhookPayload(payloadString, ep.signingSecret, timestamp);
      const signatureHeader = `t=${timestamp},v1=${signature}`;

      // Dispatch HTTP request in non-blocking manner
      deliverWebhook(ep.id, propertyId, eventType, eventId, payload, payloadString, ep.url, signatureHeader);
    }
  } catch (error) {
    console.error('Failed to trigger webhook event dispatch:', error);
  }
}

async function deliverWebhook(
  endpointId: string,
  propertyId: string,
  eventType: string,
  eventId: string,
  payload: any,
  payloadString: string,
  url: string,
  signatureHeader: string
) {
  let httpStatus: number | null = null;
  let status: 'success' | 'failed' = 'failed';
  let responseBody = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Sena-Webhooks/1.0',
        'sena-signature': signatureHeader,
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    httpStatus = res.status;
    responseBody = await res.text().catch(() => '');

    if (res.ok) {
      status = 'success';
    }
  } catch (err: any) {
    responseBody = err.message || 'Connection error / timeout';
    httpStatus = 504;
  }

  // Record delivery attempt in database
  try {
    await db.insert(webhookDeliveries).values({
      webhookEndpointId: endpointId,
      propertyId,
      eventType,
      eventId,
      payload,
      status,
      httpStatus,
      attemptCount: 1,
      responseBody: responseBody.slice(0, 1000), // sanitize length
      lastAttemptAt: new Date(),
      nextRetryAt: status === 'failed' ? new Date(Date.now() + 60 * 1000) : null,
    });
  } catch (err) {
    console.error('Failed to save webhook delivery log:', err);
  }
}
