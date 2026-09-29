import { and, eq } from 'drizzle-orm';
import { db, reservations, guests, roomTypes, integrations, integrationExternalObjects } from '@sena/database';
import {
  ensureConnectedAppsPlatformSchema,
  getPropertyIntegration,
  readOAuthTokens,
  upsertOAuthTokens,
  enqueueSyncJob,
  upsertExternalObjectMapping,
  findMappingBySenaObject,
  writeIntegrationAudit,
} from '../platform';

function googleClient() {
  const clientId = process.env.SENA_GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.SENA_GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('OAUTH_CLIENT_MISSING');
  return { clientId, clientSecret };
}

async function refreshGoogleToken(refreshToken: string) {
  const { clientId, clientSecret } = googleClient();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const json = (await response.json().catch(() => null)) as any;
  if (!response.ok || !json?.access_token) throw new Error('GOOGLE_REFRESH_FAILED');
  return {
    accessToken: String(json.access_token),
    expiresAt: typeof json.expires_in === 'number' ? new Date(Date.now() + json.expires_in * 1000) : null,
  };
}

export async function getGoogleCalendarContext(propertyId: string) {
  await ensureConnectedAppsPlatformSchema();
  const integration = await getPropertyIntegration(propertyId, 'google_calendar');
  if (!integration || integration.status !== 'connected') throw new Error('GOOGLE_CALENDAR_NOT_CONNECTED');
  let tokens = await readOAuthTokens(integration.id);
  if (!tokens?.accessToken) throw new Error('GOOGLE_CALENDAR_NOT_CONNECTED');
  if (tokens.needsRefresh) {
    if (!tokens.refreshToken) throw new Error('GOOGLE_REAUTH_REQUIRED');
    const refreshed = await refreshGoogleToken(tokens.refreshToken);
    await upsertOAuthTokens({
      integrationId: integration.id,
      accessToken: refreshed.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: refreshed.expiresAt,
      scopes: tokens.scopes,
      accountMetadata: tokens.accountMetadata as Record<string, unknown> | null,
    });
    tokens = await readOAuthTokens(integration.id);
    if (!tokens) throw new Error('GOOGLE_CALENDAR_NOT_CONNECTED');
  }
  const metadata = integration.metadata && typeof integration.metadata === 'object' ? (integration.metadata as Record<string, unknown>) : {};
  const calendarId = typeof metadata.calendarId === 'string' ? metadata.calendarId : 'primary';
  return { integration, tokens, calendarId };
}

async function googleFetch(propertyId: string, path: string, init?: RequestInit) {
  const ctx = await getGoogleCalendarContext(propertyId);
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${ctx.tokens.accessToken}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...init, headers, cache: 'no-store' });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new Error('GOOGLE_REAUTH_REQUIRED');
    throw new Error(`GOOGLE_API_${response.status}`);
  }
  return { ctx, json };
}

function eventBody(input: {
  guestName: string;
  reference: string;
  checkInDate: string;
  checkOutDate: string;
  roomTypeName?: string | null;
  status: string;
}) {
  // Minimize sensitive data: no email/phone/payment details.
  const summary = `${input.guestName} · ${input.reference}`;
  const description = [
    `Reservation ${input.reference}`,
    input.roomTypeName ? `Room type: ${input.roomTypeName}` : null,
    `Status: ${input.status}`,
    'Synced from Sena',
  ]
    .filter(Boolean)
    .join('\n');
  return {
    summary,
    description,
    start: { date: input.checkInDate },
    end: { date: input.checkOutDate },
    extendedProperties: {
      private: {
        senaReservationRef: input.reference,
        senaSource: 'sena',
      },
    },
  };
}

export async function syncReservationToGoogleCalendar(propertyId: string, reservationId: string) {
  const [reservation] = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.id, reservationId), eq(reservations.propertyId, propertyId)))
    .limit(1);
  if (!reservation) throw new Error('RESERVATION_NOT_FOUND');

  const [guest] = reservation.guestId
    ? await db.select().from(guests).where(eq(guests.id, reservation.guestId)).limit(1)
    : [null];
  const [roomType] = reservation.roomTypeId
    ? await db.select().from(roomTypes).where(eq(roomTypes.id, reservation.roomTypeId)).limit(1)
    : [null];

  const ctx = await getGoogleCalendarContext(propertyId);
  const body = eventBody({
    guestName: guest?.fullName || 'Guest',
    reference: reservation.reference,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    roomTypeName: roomType?.name || null,
    status: reservation.status,
  });

  const existing = await findMappingBySenaObject({
    integrationId: ctx.integration.id,
    senaObjectType: 'reservation',
    senaObjectId: reservation.id,
  });

  const cancelled = ['cancelled', 'canceled', 'no_show'].includes(reservation.status.toLowerCase());

  if (cancelled) {
    if (existing?.externalObjectId) {
      await googleFetch(propertyId, `/calendars/${encodeURIComponent(ctx.calendarId)}/events/${encodeURIComponent(existing.externalObjectId)}`, {
        method: 'DELETE',
      }).catch(() => null);
      await upsertExternalObjectMapping({
        propertyId,
        integrationId: ctx.integration.id,
        provider: 'google_calendar',
        senaObjectType: 'reservation',
        senaObjectId: reservation.id,
        externalObjectType: 'event',
        externalObjectId: existing.externalObjectId,
        syncState: 'deleted',
      });
    }
    return { deleted: true as const, eventId: existing?.externalObjectId || null };
  }

  if (existing?.externalObjectId && existing.syncState === 'deleted') {
    // Restore: create a fresh event and remap after clearing the deleted mapping.
    const created = await googleFetch(propertyId, `/calendars/${encodeURIComponent(ctx.calendarId)}/events`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const eventId = String(created.json?.id || '');
    if (!eventId) throw new Error('GOOGLE_EVENT_CREATE_FAILED');
    await db.delete(integrationExternalObjects).where(eq(integrationExternalObjects.id, existing.id));
    await upsertExternalObjectMapping({
      propertyId,
      integrationId: ctx.integration.id,
      provider: 'google_calendar',
      senaObjectType: 'reservation',
      senaObjectId: reservation.id,
      externalObjectType: 'event',
      externalObjectId: eventId,
      syncState: 'synced',
    });
    return { eventId, restored: true as const };
  }

  if (existing?.externalObjectId) {
    await googleFetch(
      propertyId,
      `/calendars/${encodeURIComponent(ctx.calendarId)}/events/${encodeURIComponent(existing.externalObjectId)}`,
      { method: 'PUT', body: JSON.stringify(body) }
    );
    await upsertExternalObjectMapping({
      propertyId,
      integrationId: ctx.integration.id,
      provider: 'google_calendar',
      senaObjectType: 'reservation',
      senaObjectId: reservation.id,
      externalObjectType: 'event',
      externalObjectId: existing.externalObjectId,
      syncState: 'synced',
    });
    return { eventId: existing.externalObjectId, updated: true as const };
  }

  const created = await googleFetch(propertyId, `/calendars/${encodeURIComponent(ctx.calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const eventId = String(created.json?.id || '');
  if (!eventId) throw new Error('GOOGLE_EVENT_CREATE_FAILED');
  await upsertExternalObjectMapping({
    propertyId,
    integrationId: ctx.integration.id,
    provider: 'google_calendar',
    senaObjectType: 'reservation',
    senaObjectId: reservation.id,
    externalObjectType: 'event',
    externalObjectId: eventId,
    syncState: 'synced',
    metadata: { reference: reservation.reference },
  });
  return { eventId, created: true as const };
}

export async function ensureGoogleCalendarWatch(propertyId: string, actorUserId: string) {
  const ctx = await getGoogleCalendarContext(propertyId);
  const channelToken = crypto.randomUUID();
  const webhookBase = process.env.SENA_PUBLIC_APP_ORIGIN?.replace(/\/$/, '');
  if (!webhookBase) throw new Error('PUBLIC_ORIGIN_REQUIRED');
  const expiration = Date.now() + 6 * 24 * 60 * 60 * 1000; // ~6 days; renew before Google max
  const body = {
    id: crypto.randomUUID(),
    type: 'web_hook',
    address: `${webhookBase}/api/webhooks/google-calendar/${ctx.integration.id}`,
    token: channelToken,
    expiration: String(expiration),
  };
  const result = await googleFetch(propertyId, `/calendars/${encodeURIComponent(ctx.calendarId)}/events/watch`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  await db
    .update(integrations)
    .set({
      metadata: {
        ...(ctx.integration.metadata && typeof ctx.integration.metadata === 'object' ? (ctx.integration.metadata as object) : {}),
        calendarId: ctx.calendarId,
        watchChannelId: body.id,
        watchResourceId: result.json?.resourceId || null,
        watchExpiration: expiration,
        watchTokenHash: await hashToken(channelToken),
      },
      webhookStatus: 'configured',
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, ctx.integration.id));
  await writeIntegrationAudit({
    propertyId,
    integrationId: ctx.integration.id,
    actorUserId,
    action: 'google_calendar.watch_created',
    details: { calendarId: ctx.calendarId, expiration },
  });
  return { channelId: body.id, expiration };
}

async function hashToken(token: string) {
  const crypto = await import('node:crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function reconcileGoogleCalendar(propertyId: string) {
  const open = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(and(eq(reservations.propertyId, propertyId)));
  let synced = 0;
  for (const row of open) {
    if (['cancelled', 'canceled'].includes((await db.query.reservations.findFirst({ where: eq(reservations.id, row.id) }))?.status || '')) {
      await syncReservationToGoogleCalendar(propertyId, row.id);
    } else {
      await syncReservationToGoogleCalendar(propertyId, row.id);
    }
    synced += 1;
  }
  return { synced };
}

export async function handleGoogleCalendarSyncJob(job: { propertyId: string; jobType: string; payload: unknown }) {
  const payload = job.payload && typeof job.payload === 'object' ? (job.payload as Record<string, unknown>) : {};
  if ((job.jobType === 'reservation_sync' || job.jobType === 'full_sync') && typeof payload.reservationId === 'string') {
    return syncReservationToGoogleCalendar(job.propertyId, payload.reservationId);
  }
  if (job.jobType === 'reconcile' || job.jobType === 'full_sync') {
    return reconcileGoogleCalendar(job.propertyId);
  }
  if (job.jobType === 'platform_ping') return {};
  throw new Error(`NO_HANDLER:google_calendar:${job.jobType}`);
}

export function registerGoogleCalendarSyncHandlers() {
  const root = globalThis as typeof globalThis & { __senaSyncHandlers?: Record<string, (job: any) => Promise<any>> };
  root.__senaSyncHandlers = root.__senaSyncHandlers || {};
  root.__senaSyncHandlers.google_calendar = async (job) => handleGoogleCalendarSyncJob(job);
  root.__senaSyncHandlers['google_calendar:reservation_sync'] = async (job) => handleGoogleCalendarSyncJob(job);
  root.__senaSyncHandlers['google_calendar:reconcile'] = async (job) => handleGoogleCalendarSyncJob(job);
  root.__senaSyncHandlers['google_calendar:full_sync'] = async (job) => handleGoogleCalendarSyncJob(job);
}

export async function queueGoogleReservationSync(propertyId: string, reservationId: string) {
  const integration = await getPropertyIntegration(propertyId, 'google_calendar');
  if (!integration || integration.status !== 'connected') return null;
  return enqueueSyncJob({
    propertyId,
    integrationId: integration.id,
    provider: 'google_calendar',
    direction: 'outbound',
    trigger: 'event',
    jobType: 'reservation_sync',
    idempotencyKey: `gcal:res:${reservationId}:${Date.now()}`,
    payload: { reservationId },
  });
}
