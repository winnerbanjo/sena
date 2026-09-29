import { NextRequest } from 'next/server';
import { jsonNoStore, ownerOnly, resolveAppsTenant } from '@/lib/integrations/platform/access';
import {
  ensureGoogleCalendarWatch,
  getGoogleCalendarManageState,
  maybeQueueGoogleReservationSync,
  selectGoogleCalendar,
  setGoogleCalendarSyncEnabled,
  syncGoogleCalendarSinceEnabled,
} from '@/lib/integrations/google/calendar';

export async function GET(req: NextRequest) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) {
    return jsonNoStore({ error: 'Only a property owner can manage Google Calendar.' }, { status: 403 });
  }
  try {
    const state = await getGoogleCalendarManageState(result.resolved.propertyId);
    return jsonNoStore({
      property: {
        id: result.resolved.propertyId,
        name: result.resolved.property.name,
        slug: result.resolved.property.slug,
      },
      ...state,
    });
  } catch (error: any) {
    return jsonNoStore(
      {
        property: {
          id: result.resolved.propertyId,
          name: result.resolved.property.name,
          slug: result.resolved.property.slug,
        },
        error: error?.message || 'Could not load Google Calendar.',
      },
      { status: 422 }
    );
  }
}

export async function POST(req: NextRequest) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) {
    return jsonNoStore({ error: 'Only a property owner can manage Google Calendar.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === 'select_calendar' && typeof body.calendarId === 'string') {
      const outcome = await selectGoogleCalendar(result.resolved.propertyId, result.resolved.userId, {
        calendarId: body.calendarId,
        calendarName: typeof body.calendarName === 'string' ? body.calendarName : null,
      });
      return jsonNoStore({
        property: { id: result.resolved.propertyId },
        ...outcome,
      });
    }
    if (body.action === 'set_sync_enabled' && typeof body.enabled === 'boolean') {
      const outcome = await setGoogleCalendarSyncEnabled(
        result.resolved.propertyId,
        result.resolved.userId,
        body.enabled
      );
      return jsonNoStore({ property: { id: result.resolved.propertyId }, ...outcome });
    }
    if (body.action === 'sync_now') {
      const outcome = await syncGoogleCalendarSinceEnabled(result.resolved.propertyId);
      return jsonNoStore({ property: { id: result.resolved.propertyId }, outcome });
    }
    if (body.action === 'enable_watch') {
      const watch = await ensureGoogleCalendarWatch(result.resolved.propertyId, result.resolved.userId);
      return jsonNoStore({ property: { id: result.resolved.propertyId }, watch });
    }
    if (body.action === 'sync_reservation' && typeof body.reservationId === 'string') {
      const job = await maybeQueueGoogleReservationSync(result.resolved.propertyId, body.reservationId);
      return jsonNoStore(
        { property: { id: result.resolved.propertyId }, job: job ? { id: job.id, status: job.status } : null },
        { status: 202 }
      );
    }
    return jsonNoStore({ error: 'Invalid action.' }, { status: 422 });
  } catch (error: any) {
    return jsonNoStore({ error: error?.message || 'Google Calendar action failed.' }, { status: 422 });
  }
}
