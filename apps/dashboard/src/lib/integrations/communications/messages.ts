import { and, eq } from 'drizzle-orm';
import { db, guestMessages, guestMessageTemplates, guests, properties } from '@sena/database';
import { ensureConnectedAppsPlatformSchema, getPropertyIntegration, writeIntegrationAudit } from '../platform';

export type SendGuestMessageInput = {
  propertyId: string;
  guestId: string;
  reservationId?: string;
  channel: 'email' | 'whatsapp' | 'sms';
  template: string;
  variables?: Record<string, string>;
  idempotencyKey?: string;
  actorUserId?: string;
};

function renderTemplate(body: string, variables: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');
}

async function resolveTemplate(propertyId: string, templateKey: string, channel: string) {
  await ensureConnectedAppsPlatformSchema();
  const propertyTemplate = await db.query.guestMessageTemplates.findFirst({
    where: and(
      eq(guestMessageTemplates.propertyId, propertyId),
      eq(guestMessageTemplates.templateKey, templateKey),
      eq(guestMessageTemplates.channel, channel)
    ),
  });
  if (propertyTemplate) return propertyTemplate;
  const system = await db
    .select()
    .from(guestMessageTemplates)
    .where(and(eq(guestMessageTemplates.templateKey, templateKey), eq(guestMessageTemplates.channel, channel)))
    .limit(5);
  return system.find((row) => row.propertyId == null) || null;
}

async function deliverCustomEmail(input: { to: string; subject: string; body: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[DEV EMAIL] Simulated guest message to ${input.to}`);
    return { simulated: true as const, messageId: `sim_${Date.now()}` };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.SENA_EMAIL_FROM || 'Sena <noreply@sena.invalid>',
      to: input.to,
      subject: input.subject,
      text: input.body,
      html: `<p>${input.body.replace(/\n/g, '<br/>')}</p>`,
    }),
    cache: 'no-store',
  });
  const json = (await response.json().catch(() => null)) as any;
  if (!response.ok) throw new Error(json?.message || 'EMAIL_SEND_FAILED');
  return { simulated: false as const, messageId: String(json?.id || '') };
}

/**
 * Provider-neutral guest messaging. Automation never auto-sends unless a
 * property explicitly enables automation on a template.
 */
export async function sendGuestMessage(input: SendGuestMessageInput) {
  await ensureConnectedAppsPlatformSchema();
  const [guest] = await db.select().from(guests).where(and(eq(guests.id, input.guestId), eq(guests.propertyId, input.propertyId))).limit(1);
  if (!guest) throw new Error('GUEST_NOT_FOUND');
  const [property] = await db.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);
  if (!property) throw new Error('PROPERTY_NOT_FOUND');

  if (input.idempotencyKey) {
    const existing = await db.query.guestMessages.findFirst({
      where: and(eq(guestMessages.propertyId, input.propertyId), eq(guestMessages.idempotencyKey, input.idempotencyKey)),
    });
    if (existing) return existing;
  }

  const template = await resolveTemplate(input.propertyId, input.template, input.channel);
  if (!template) throw new Error('TEMPLATE_NOT_FOUND');

  const variables = {
    guestName: guest.fullName,
    propertyName: property.name,
    ...(input.variables || {}),
  };
  const body = renderTemplate(template.body, variables);
  const subject = template.subject ? renderTemplate(template.subject, variables) : undefined;

  const [queued] = await db
    .insert(guestMessages)
    .values({
      propertyId: input.propertyId,
      guestId: input.guestId,
      reservationId: input.reservationId || null,
      channel: input.channel,
      templateKey: input.template,
      status: 'queued',
      toAddress: input.channel === 'email' ? guest.email : guest.phone,
      subject: subject || null,
      bodyPreview: body.slice(0, 280),
      idempotencyKey: input.idempotencyKey || null,
      metadata: { variables },
    })
    .returning();

  try {
    if (input.channel === 'email') {
      if (!guest.email) throw new Error('GUEST_EMAIL_REQUIRED');
      const delivered = await deliverCustomEmail({
        to: guest.email,
        subject: subject || `Message from ${property.name}`,
        body,
      });
      const [sent] = await db
        .update(guestMessages)
        .set({
          status: 'sent',
          sentAt: new Date(),
          provider: delivered.simulated ? 'simulated' : 'resend',
          providerMessageId: delivered.messageId,
          updatedAt: new Date(),
        })
        .where(eq(guestMessages.id, queued.id))
        .returning();
      return sent;
    }

    if (input.channel === 'whatsapp') {
      const integration = await getPropertyIntegration(input.propertyId, 'whatsapp');
      const metadata = integration?.metadata && typeof integration.metadata === 'object' ? (integration.metadata as Record<string, unknown>) : {};
      if (!integration || integration.status !== 'connected' || metadata.actionRequired || metadata.metaApprovalRequired || !metadata.phoneNumberId) {
        const [failed] = await db
          .update(guestMessages)
          .set({
            status: 'failed',
            failedAt: new Date(),
            lastError: 'ACTION_REQUIRED: Complete Meta WhatsApp Business Platform approval and phone number setup before sending.',
            provider: 'whatsapp_cloud',
            updatedAt: new Date(),
          })
          .where(eq(guestMessages.id, queued.id))
          .returning();
        return failed;
      }
      const [failed] = await db
        .update(guestMessages)
        .set({
          status: 'failed',
          failedAt: new Date(),
          lastError: 'ACTION_REQUIRED: WhatsApp Cloud API credentials pending Meta approval.',
          provider: 'whatsapp_cloud',
          updatedAt: new Date(),
        })
        .where(eq(guestMessages.id, queued.id))
        .returning();
      return failed;
    }

    if (input.channel === 'sms') {
      const [failed] = await db
        .update(guestMessages)
        .set({
          status: 'failed',
          failedAt: new Date(),
          lastError: 'SMS provider is not connected yet.',
          updatedAt: new Date(),
        })
        .where(eq(guestMessages.id, queued.id))
        .returning();
      return failed;
    }

    throw new Error('CHANNEL_UNSUPPORTED');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SEND_FAILED';
    const [failed] = await db
      .update(guestMessages)
      .set({
        status: 'failed',
        failedAt: new Date(),
        lastError: message.slice(0, 500),
        updatedAt: new Date(),
        attemptCount: queued.attemptCount + 1,
      })
      .where(eq(guestMessages.id, queued.id))
      .returning();
    if (input.actorUserId) {
      await writeIntegrationAudit({
        propertyId: input.propertyId,
        actorUserId: input.actorUserId,
        action: 'guest_message.failed',
        details: { channel: input.channel, template: input.template, messageId: queued.id },
      });
    }
    return failed;
  }
}

export async function listGuestMessageTemplates(propertyId: string) {
  await ensureConnectedAppsPlatformSchema();
  const rows = await db.select().from(guestMessageTemplates).limit(200);
  return rows.filter((row) => row.propertyId == null || row.propertyId === propertyId);
}

export async function listGuestMessages(propertyId: string, limit = 50) {
  await ensureConnectedAppsPlatformSchema();
  return db.select().from(guestMessages).where(eq(guestMessages.propertyId, propertyId)).limit(limit);
}

export function whatsappConnectionTruth(integration: { status: string; metadata: unknown } | null) {
  if (!integration || integration.status === 'disconnected') {
    return { connectionStatus: 'disconnected' as const, healthStatus: null, actionRequired: false };
  }
  const metadata = integration.metadata && typeof integration.metadata === 'object' ? (integration.metadata as Record<string, unknown>) : {};
  if (metadata.actionRequired || metadata.metaApprovalRequired || !metadata.phoneNumberId) {
    return {
      connectionStatus: 'needs_attention' as const,
      healthStatus: 'reauthorization_required' as const,
      actionRequired: true,
      message: 'ACTION_REQUIRED: Complete Meta WhatsApp Business Platform approval and phone number setup.',
    };
  }
  if (integration.status !== 'connected') {
    return {
      connectionStatus: integration.status as 'connecting' | 'error' | 'paused',
      healthStatus: 'awaiting_authorization' as const,
      actionRequired: false,
    };
  }
  return { connectionStatus: 'connected' as const, healthStatus: 'healthy' as const, actionRequired: false };
}
