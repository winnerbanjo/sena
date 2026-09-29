import { NextRequest } from 'next/server';
import { jsonNoStore, ownerOnly, resolveAppsTenant } from '@/lib/integrations/platform/access';
import { listGuestMessageTemplates, listGuestMessages, sendGuestMessage } from '@/lib/integrations/communications/messages';

export async function GET(req: NextRequest) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  const [templates, messages] = await Promise.all([
    listGuestMessageTemplates(result.resolved.propertyId),
    listGuestMessages(result.resolved.propertyId, 50),
  ]);
  return jsonNoStore({
    canManage: ownerOnly(result.resolved.role),
    templates: templates.map((row) => ({
      id: row.id,
      templateKey: row.templateKey,
      channel: row.channel,
      name: row.name,
      automationEnabled: row.automationEnabled,
      isSystem: row.isSystem,
    })),
    messages: messages.map((row) => ({
      id: row.id,
      channel: row.channel,
      status: row.status,
      templateKey: row.templateKey,
      toAddress: row.toAddress,
      lastError: row.lastError,
      createdAt: row.createdAt.toISOString(),
      sentAt: row.sentAt?.toISOString() || null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) {
    return jsonNoStore({ error: 'Only a property owner can send guest messages from Connected Apps.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (typeof body.guestId !== 'string' || typeof body.template !== 'string' || !['email', 'whatsapp', 'sms'].includes(body.channel)) {
    return jsonNoStore({ error: 'guestId, channel, and template are required.' }, { status: 422 });
  }
  const message = await sendGuestMessage({
    propertyId: result.resolved.propertyId,
    guestId: body.guestId,
    reservationId: typeof body.reservationId === 'string' ? body.reservationId : undefined,
    channel: body.channel,
    template: body.template,
    variables: body.variables && typeof body.variables === 'object' ? body.variables : undefined,
    idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
    actorUserId: result.resolved.userId,
  });
  return jsonNoStore({ message }, { status: message.status === 'failed' ? 422 : 201 });
}
