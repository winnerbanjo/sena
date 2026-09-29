import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, integrations } from '@sena/database';
import { jsonNoStore, ownerOnly, resolveAppsTenant } from '@/lib/integrations/platform/access';
import {
  ensureGoogleCalendarWatch,
  getGoogleCalendarContext,
  queueGoogleReservationSync,
  reconcileGoogleCalendar,
} from '@/lib/integrations/google/calendar';
import { getPropertyIntegration } from '@/lib/integrations/platform/registry';
import { writeIntegrationAudit } from '@/lib/integrations/platform/audit';

async function listCalendars(propertyId: string) {
  const ctx = await getGoogleCalendarContext(propertyId);
  const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${ctx.tokens.accessToken}` },
    cache: 'no-store',
  });
  const json = (await response.json().catch(() => null)) as any;
  if (!response.ok) throw new Error(response.status === 401 ? 'GOOGLE_REAUTH_REQUIRED' : `GOOGLE_API_${response.status}`);
  const items = Array.isArray(json?.items) ? json.items : [];
  return items.map((item: any) => ({
    id: String(item.id),
    summary: String(item.summary || item.id),
    primary: Boolean(item.primary),
  }));
}

export async function GET(req: NextRequest) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return jsonNoStore({ error: 'Only a property owner can manage Google Calendar.' }, { status: 403 });
  try {
    const calendars = await listCalendars(result.resolved.propertyId);
    const integration = await getPropertyIntegration(result.resolved.propertyId, 'google_calendar');
    const metadata = integration?.metadata && typeof integration.metadata === 'object' ? (integration.metadata as Record<string, unknown>) : {};
    return jsonNoStore({
      calendars,
      selectedCalendarId: typeof metadata.calendarId === 'string' ? metadata.calendarId : 'primary',
    });
  } catch (error: any) {
    return jsonNoStore({ error: error?.message || 'Could not list calendars.' }, { status: 422 });
  }
}

export async function POST(req: NextRequest) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return jsonNoStore({ error: 'Only a property owner can manage Google Calendar.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === 'select_calendar' && typeof body.calendarId === 'string') {
      const integration = await getPropertyIntegration(result.resolved.propertyId, 'google_calendar');
      if (!integration || integration.status !== 'connected') throw new Error('GOOGLE_CALENDAR_NOT_CONNECTED');
      await db
        .update(integrations)
        .set({
          metadata: {
            ...(integration.metadata && typeof integration.metadata === 'object' ? (integration.metadata as object) : {}),
            calendarId: body.calendarId,
          },
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, integration.id));
      await writeIntegrationAudit({
        propertyId: result.resolved.propertyId,
        integrationId: integration.id,
        actorUserId: result.resolved.userId,
        action: 'google_calendar.calendar_selected',
        details: { calendarId: body.calendarId },
      });
      return jsonNoStore({ calendarId: body.calendarId });
    }
    if (body.action === 'enable_watch') {
      const watch = await ensureGoogleCalendarWatch(result.resolved.propertyId, result.resolved.userId);
      return jsonNoStore({ watch });
    }
    if (body.action === 'reconcile') {
      const outcome = await reconcileGoogleCalendar(result.resolved.propertyId);
      return jsonNoStore({ outcome });
    }
    if (body.action === 'sync_reservation' && typeof body.reservationId === 'string') {
      const job = await queueGoogleReservationSync(result.resolved.propertyId, body.reservationId);
      return jsonNoStore({ job: job ? { id: job.id, status: job.status } : null }, { status: 202 });
    }
    return jsonNoStore({ error: 'Invalid action.' }, { status: 422 });
  } catch (error: any) {
    return jsonNoStore({ error: error?.message || 'Google Calendar action failed.' }, { status: 422 });
  }
}
