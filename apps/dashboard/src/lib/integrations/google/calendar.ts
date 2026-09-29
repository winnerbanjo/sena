import { and, eq, gte } from 'drizzle-orm';
import {
  db,
  reservations,
  guests,
  roomTypes,
  rooms,
  properties,
  integrations,
  integrationExternalObjects,
} from '@sena/database';
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

export type GoogleCalendarMeta = {
  calendarId?: string | null;
  calendarName?: string | null;
  syncEnabled?: boolean;
  syncEnabledAt?: string | null;
  calendarSelectedAt?: string | null;
  accountEmail?: string | null;
  watchChannelId?: string | null;
  watchResourceId?: string | null;
  watchExpiration?: number | null;
  watchTokenHash?: string | null;
};

export function readGoogleMeta(integration: { metadata?: unknown } | null | undefined): GoogleCalendarMeta {
  const raw = integration?.metadata && typeof integration.metadata === 'object' ? (integration.metadata as Record<string, unknown>) : {};
  return {
    calendarId: typeof raw.calendarId === 'string' && raw.calendarId.trim() ? raw.calendarId.trim() : null,
    calendarName: typeof raw.calendarName === 'string' ? raw.calendarName : null,
    syncEnabled: raw.syncEnabled === true || raw.syncEnabled === 'true',
    syncEnabledAt: typeof raw.syncEnabledAt === 'string' ? raw.syncEnabledAt : null,
    calendarSelectedAt: typeof raw.calendarSelectedAt === 'string' ? raw.calendarSelectedAt : null,
    accountEmail: typeof raw.accountEmail === 'string' ? raw.accountEmail : null,
    watchChannelId: typeof raw.watchChannelId === 'string' ? raw.watchChannelId : null,
    watchResourceId: typeof raw.watchResourceId === 'string' ? raw.watchResourceId : null,
    watchExpiration: typeof raw.watchExpiration === 'number' ? raw.watchExpiration : null,
    watchTokenHash: typeof raw.watchTokenHash === 'string' ? raw.watchTokenHash : null,
  };
}

export function isGoogleCalendarSyncEnabled(integration: { metadata?: unknown } | null | undefined): boolean {
  const meta = readGoogleMeta(integration);
  return Boolean(meta.syncEnabled && meta.calendarId);
}

function googleClient() {
  const clientId =
    process.env.SENA_GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.SENA_GOOGLE_CALENDAR_CLIENT_SECRET ||
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET;
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

export async function getGoogleCalendarContext(propertyId: string, options?: { requireCalendar?: boolean }) {
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
  const meta = readGoogleMeta(integration);
  if (options?.requireCalendar !== false && !meta.calendarId) {
    throw new Error('GOOGLE_CALENDAR_REQUIRED');
  }
  return { integration, tokens, meta, calendarId: meta.calendarId };
}

async function googleFetch(
  propertyId: string,
  path: string,
  init?: RequestInit,
  options?: { requireCalendar?: boolean }
) {
  const ctx = await getGoogleCalendarContext(propertyId, options);
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${ctx.tokens.accessToken}`);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...init, headers, cache: 'no-store' });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new Error('GOOGLE_REAUTH_REQUIRED');
    if (response.status === 404 || response.status === 410) throw new Error(`GOOGLE_API_${response.status}`);
    throw new Error(`GOOGLE_API_${response.status}`);
  }
  return { ctx, json, response };
}

/**
 * Timed events using property check-in/out times + timezone.
 * Reservations store dates only; property-level checkInTime/checkOutTime are authoritative.
 */
function eventBody(input: {
  guestName: string;
  reference: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  timezone: string;
  roomTypeName?: string | null;
  roomNumber?: string | null;
  status: string;
  paymentStatus?: string | null;
  source?: string | null;
  guestCount?: number | null;
  reservationUrl?: string | null;
}) {
  const summary = `Reservation · ${input.guestName}`;
  const roomLine = [input.roomTypeName, input.roomNumber ? `Room ${input.roomNumber}` : null].filter(Boolean).join(' · ');
  const description = [
    `Reservation ${input.reference}`,
    `Guest: ${input.guestName}`,
    roomLine || null,
    `Status: ${input.status}`,
    input.paymentStatus ? `Payment: ${input.paymentStatus}` : null,
    input.source ? `Source: ${input.source}` : null,
    typeof input.guestCount === 'number' ? `Guests: ${input.guestCount}` : null,
    input.reservationUrl || null,
    'Synced from Sena. Sena remains the source of truth.',
  ]
    .filter(Boolean)
    .join('\n');

  const checkInTime = /^\d{2}:\d{2}$/.test(input.checkInTime) ? input.checkInTime : '14:00';
  const checkOutTime = /^\d{2}:\d{2}$/.test(input.checkOutTime) ? input.checkOutTime : '11:00';

  return {
    summary,
    description,
    start: {
      dateTime: `${input.checkInDate}T${checkInTime}:00`,
      timeZone: input.timezone || 'Africa/Lagos',
    },
    end: {
      dateTime: `${input.checkOutDate}T${checkOutTime}:00`,
      timeZone: input.timezone || 'Africa/Lagos',
    },
    extendedProperties: {
      private: {
        senaReservationRef: input.reference,
        senaSource: 'sena',
      },
    },
  };
}

function mappingCalendarId(mapping: { metadata?: unknown } | null | undefined): string | null {
  const meta = mapping?.metadata && typeof mapping.metadata === 'object' ? (mapping.metadata as Record<string, unknown>) : {};
  return typeof meta.calendarId === 'string' && meta.calendarId ? meta.calendarId : null;
}

export async function listGoogleCalendars(propertyId: string) {
  const result = await googleFetch(propertyId, '/users/me/calendarList', { method: 'GET' }, { requireCalendar: false });
  const items = Array.isArray(result.json?.items) ? result.json.items : [];
  return items.map((item: any) => ({
    id: String(item.id),
    summary: String(item.summary || item.id),
    primary: Boolean(item.primary),
    accessRole: typeof item.accessRole === 'string' ? item.accessRole : null,
  }));
}

export async function selectGoogleCalendar(
  propertyId: string,
  actorUserId: string,
  input: { calendarId: string; calendarName?: string | null }
) {
  const integration = await getPropertyIntegration(propertyId, 'google_calendar');
  if (!integration || integration.status !== 'connected') throw new Error('GOOGLE_CALENDAR_NOT_CONNECTED');
  const previous = readGoogleMeta(integration);
  const calendarId = input.calendarId.trim();
  if (!calendarId) throw new Error('GOOGLE_CALENDAR_REQUIRED');
  const changed = previous.calendarId && previous.calendarId !== calendarId;
  const nextMeta: GoogleCalendarMeta = {
    ...previous,
    calendarId,
    calendarName: input.calendarName || previous.calendarName || null,
    calendarSelectedAt: new Date().toISOString(),
    // Changing calendars disables sync until operator explicitly re-enables (no silent historical dump).
    syncEnabled: changed ? false : previous.syncEnabled && Boolean(previous.calendarId),
    syncEnabledAt: changed ? null : previous.syncEnabledAt,
  };
  await db
    .update(integrations)
    .set({ metadata: nextMeta, updatedAt: new Date() })
    .where(eq(integrations.id, integration.id));
  await writeIntegrationAudit({
    propertyId,
    integrationId: integration.id,
    actorUserId,
    action: 'google_calendar.calendar_selected',
    details: { calendarId, changed: Boolean(changed) },
  });
  return { calendarId, syncEnabled: Boolean(nextMeta.syncEnabled), calendarChanged: Boolean(changed) };
}

export async function setGoogleCalendarSyncEnabled(propertyId: string, actorUserId: string, enabled: boolean) {
  const integration = await getPropertyIntegration(propertyId, 'google_calendar');
  if (!integration || integration.status !== 'connected') throw new Error('GOOGLE_CALENDAR_NOT_CONNECTED');
  const meta = readGoogleMeta(integration);
  if (enabled && !meta.calendarId) throw new Error('GOOGLE_CALENDAR_REQUIRED');
  const nextMeta: GoogleCalendarMeta = {
    ...meta,
    syncEnabled: enabled,
    syncEnabledAt: enabled ? meta.syncEnabledAt || new Date().toISOString() : meta.syncEnabledAt,
  };
  await db
    .update(integrations)
    .set({
      metadata: nextMeta,
      healthStatus: enabled ? 'healthy' : integration.healthStatus,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integration.id));
  await writeIntegrationAudit({
    propertyId,
    integrationId: integration.id,
    actorUserId,
    action: enabled ? 'google_calendar.sync_enabled' : 'google_calendar.sync_disabled',
    details: {
      calendarId: meta.calendarId,
      // Disabling stops NEW outbound mutations; existing Google events are left untouched.
      existingEventsPolicy: 'leave_untouched',
    },
  });
  return { syncEnabled: enabled, calendarId: meta.calendarId };
}

export async function getGoogleCalendarManageState(propertyId: string) {
  const integration = await getPropertyIntegration(propertyId, 'google_calendar');
  if (!integration || integration.status !== 'connected') {
    return {
      connected: false,
      calendars: [] as Array<{ id: string; summary: string; primary: boolean }>,
      selectedCalendarId: null as string | null,
      selectedCalendarName: null as string | null,
      syncEnabled: false,
      accountEmail: null as string | null,
      canEnableSync: false,
    };
  }
  const meta = readGoogleMeta(integration);
  let calendars: Array<{ id: string; summary: string; primary: boolean }> = [];
  try {
    calendars = await listGoogleCalendars(propertyId);
  } catch {
    calendars = [];
  }
  return {
    connected: true,
    calendars,
    selectedCalendarId: meta.calendarId,
    selectedCalendarName: meta.calendarName,
    syncEnabled: isGoogleCalendarSyncEnabled(integration),
    accountEmail: meta.accountEmail,
    canEnableSync: Boolean(meta.calendarId),
  };
}

export async function syncReservationToGoogleCalendar(propertyId: string, reservationId: string) {
  const integration = await getPropertyIntegration(propertyId, 'google_calendar');
  if (!integration || integration.status !== 'connected') throw new Error('GOOGLE_CALENDAR_NOT_CONNECTED');
  if (!isGoogleCalendarSyncEnabled(integration)) throw new Error('GOOGLE_SYNC_DISABLED');

  const [reservation] = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.id, reservationId), eq(reservations.propertyId, propertyId)))
    .limit(1);
  if (!reservation) throw new Error('RESERVATION_NOT_FOUND');

  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
  const [guest] = reservation.guestId
    ? await db.select().from(guests).where(eq(guests.id, reservation.guestId)).limit(1)
    : [null];
  const [roomType] = reservation.roomTypeId
    ? await db.select().from(roomTypes).where(eq(roomTypes.id, reservation.roomTypeId)).limit(1)
    : [null];
  const [room] = reservation.roomId
    ? await db.select().from(rooms).where(eq(rooms.id, reservation.roomId)).limit(1)
    : [null];

  const meta = readGoogleMeta(integration);
  const currentCalendarId = meta.calendarId;
  if (!currentCalendarId) throw new Error('GOOGLE_CALENDAR_REQUIRED');

  const origin = (process.env.SENA_PUBLIC_APP_ORIGIN || 'https://app.sena.ng').replace(/\/$/, '');
  const body = eventBody({
    guestName: guest?.fullName || 'Guest',
    reference: reservation.reference,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    checkInTime: property?.checkInTime || '14:00',
    checkOutTime: property?.checkOutTime || '11:00',
    timezone: property?.timezone || 'Africa/Lagos',
    roomTypeName: roomType?.name || null,
    roomNumber: room?.roomNumber || null,
    status: reservation.status,
    paymentStatus: reservation.paymentStatus || null,
    source: reservation.source || null,
    guestCount: reservation.numGuests ?? null,
    reservationUrl: `${origin}/reservations?ref=${encodeURIComponent(reservation.reference)}`,
  });

  const existing = await findMappingBySenaObject({
    integrationId: integration.id,
    senaObjectType: 'reservation',
    senaObjectId: reservation.id,
  });

  const cancelled = ['cancelled', 'canceled', 'no_show'].includes(String(reservation.status).toLowerCase());
  const mappedCalendarId = mappingCalendarId(existing) || currentCalendarId;

  if (cancelled) {
    if (existing?.externalObjectId) {
      try {
        await googleFetch(
          propertyId,
          `/calendars/${encodeURIComponent(mappedCalendarId)}/events/${encodeURIComponent(existing.externalObjectId)}`,
          { method: 'DELETE' }
        );
      } catch (error: any) {
        const message = typeof error?.message === 'string' ? error.message : '';
        // Already gone is success for idempotent cancel.
        if (!message.includes('GOOGLE_API_404') && !message.includes('GOOGLE_API_410')) throw error;
      }
      await upsertExternalObjectMapping({
        propertyId,
        integrationId: integration.id,
        provider: 'google_calendar',
        senaObjectType: 'reservation',
        senaObjectId: reservation.id,
        externalObjectType: 'event',
        externalObjectId: existing.externalObjectId,
        syncState: 'deleted',
        metadata: { calendarId: mappedCalendarId, reference: reservation.reference },
      });
    }
    return { deleted: true as const, eventId: existing?.externalObjectId || null };
  }

  // Existing mapping on a different calendar: do not migrate/duplicate. Leave old event; skip create.
  if (existing?.externalObjectId && mappingCalendarId(existing) && mappingCalendarId(existing) !== currentCalendarId) {
    if (existing.syncState === 'deleted') {
      // Previously deleted on old calendar — create on newly selected calendar.
    } else {
      return {
        eventId: existing.externalObjectId,
        skipped: true as const,
        reason: 'mapped_to_previous_calendar',
      };
    }
  }

  if (existing?.externalObjectId && existing.syncState === 'deleted') {
    const created = await googleFetch(propertyId, `/calendars/${encodeURIComponent(currentCalendarId)}/events`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const eventId = String(created.json?.id || '');
    if (!eventId) throw new Error('GOOGLE_EVENT_CREATE_FAILED');
    await db.delete(integrationExternalObjects).where(eq(integrationExternalObjects.id, existing.id));
    await upsertExternalObjectMapping({
      propertyId,
      integrationId: integration.id,
      provider: 'google_calendar',
      senaObjectType: 'reservation',
      senaObjectId: reservation.id,
      externalObjectType: 'event',
      externalObjectId: eventId,
      syncState: 'synced',
      metadata: { calendarId: currentCalendarId, reference: reservation.reference },
    });
    return { eventId, restored: true as const };
  }

  if (existing?.externalObjectId) {
    const targetCalendar = mappingCalendarId(existing) || currentCalendarId;
    try {
      await googleFetch(
        propertyId,
        `/calendars/${encodeURIComponent(targetCalendar)}/events/${encodeURIComponent(existing.externalObjectId)}`,
        { method: 'PUT', body: JSON.stringify(body) }
      );
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : '';
      if (message.includes('GOOGLE_API_404') || message.includes('GOOGLE_API_410')) {
        const created = await googleFetch(propertyId, `/calendars/${encodeURIComponent(currentCalendarId)}/events`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        const eventId = String(created.json?.id || '');
        if (!eventId) throw new Error('GOOGLE_EVENT_CREATE_FAILED');
        await db.delete(integrationExternalObjects).where(eq(integrationExternalObjects.id, existing.id));
        await upsertExternalObjectMapping({
          propertyId,
          integrationId: integration.id,
          provider: 'google_calendar',
          senaObjectType: 'reservation',
          senaObjectId: reservation.id,
          externalObjectType: 'event',
          externalObjectId: eventId,
          syncState: 'synced',
          metadata: { calendarId: currentCalendarId, reference: reservation.reference },
        });
        return { eventId, recreated: true as const };
      }
      throw error;
    }
    await upsertExternalObjectMapping({
      propertyId,
      integrationId: integration.id,
      provider: 'google_calendar',
      senaObjectType: 'reservation',
      senaObjectId: reservation.id,
      externalObjectType: 'event',
      externalObjectId: existing.externalObjectId,
      syncState: 'synced',
      metadata: { calendarId: targetCalendar, reference: reservation.reference },
    });
    return { eventId: existing.externalObjectId, updated: true as const };
  }

  const created = await googleFetch(propertyId, `/calendars/${encodeURIComponent(currentCalendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const eventId = String(created.json?.id || '');
  if (!eventId) throw new Error('GOOGLE_EVENT_CREATE_FAILED');
  await upsertExternalObjectMapping({
    propertyId,
    integrationId: integration.id,
    provider: 'google_calendar',
    senaObjectType: 'reservation',
    senaObjectId: reservation.id,
    externalObjectType: 'event',
    externalObjectId: eventId,
    syncState: 'synced',
    metadata: { calendarId: currentCalendarId, reference: reservation.reference },
  });
  return { eventId, created: true as const };
}

/**
 * Bounded sync for Sync Now — reservations created/updated since sync enablement, plus already-mapped ones.
 * Never dumps the entire historical reservation database.
 */
export async function syncGoogleCalendarSinceEnabled(propertyId: string) {
  const integration = await getPropertyIntegration(propertyId, 'google_calendar');
  if (!integration || integration.status !== 'connected') throw new Error('GOOGLE_CALENDAR_NOT_CONNECTED');
  if (!isGoogleCalendarSyncEnabled(integration)) throw new Error('GOOGLE_SYNC_DISABLED');
  const meta = readGoogleMeta(integration);
  const since = meta.syncEnabledAt ? new Date(meta.syncEnabledAt) : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recent = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(and(eq(reservations.propertyId, propertyId), gte(reservations.updatedAt, since)));

  const mapped = await db
    .select({ senaObjectId: integrationExternalObjects.senaObjectId })
    .from(integrationExternalObjects)
    .where(
      and(
        eq(integrationExternalObjects.propertyId, propertyId),
        eq(integrationExternalObjects.provider, 'google_calendar'),
        eq(integrationExternalObjects.senaObjectType, 'reservation')
      )
    );

  const ids = Array.from(new Set([...recent.map((r) => r.id), ...mapped.map((m) => m.senaObjectId)]));
  let synced = 0;
  for (const id of ids) {
    await syncReservationToGoogleCalendar(propertyId, id);
    synced += 1;
  }
  await db
    .update(integrations)
    .set({ lastSyncAt: new Date(), healthStatus: 'healthy', lastErrorMessage: null, lastErrorAt: null, updatedAt: new Date() })
    .where(eq(integrations.id, integration.id));
  return { synced };
}

/** @deprecated Prefer syncGoogleCalendarSinceEnabled — kept for handler compatibility. */
export async function reconcileGoogleCalendar(propertyId: string) {
  return syncGoogleCalendarSinceEnabled(propertyId);
}

export async function ensureGoogleCalendarWatch(propertyId: string, actorUserId: string) {
  const ctx = await getGoogleCalendarContext(propertyId);
  if (!ctx.calendarId) throw new Error('GOOGLE_CALENDAR_REQUIRED');
  const channelToken = crypto.randomUUID();
  const webhookBase = process.env.SENA_PUBLIC_APP_ORIGIN?.replace(/\/$/, '');
  if (!webhookBase) throw new Error('PUBLIC_ORIGIN_REQUIRED');
  const expiration = Date.now() + 6 * 24 * 60 * 60 * 1000;
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
  const meta = readGoogleMeta(ctx.integration);
  await db
    .update(integrations)
    .set({
      metadata: {
        ...meta,
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

export async function handleGoogleCalendarSyncJob(job: { propertyId: string; jobType: string; payload: unknown }) {
  const payload = job.payload && typeof job.payload === 'object' ? (job.payload as Record<string, unknown>) : {};
  if ((job.jobType === 'reservation_sync' || job.jobType === 'full_sync') && typeof payload.reservationId === 'string') {
    return syncReservationToGoogleCalendar(job.propertyId, payload.reservationId);
  }
  if (job.jobType === 'reconcile' || job.jobType === 'sync_since_enabled' || job.jobType === 'full_sync') {
    return syncGoogleCalendarSinceEnabled(job.propertyId);
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
  root.__senaSyncHandlers['google_calendar:sync_since_enabled'] = async (job) => handleGoogleCalendarSyncJob(job);
  root.__senaSyncHandlers['google_calendar:full_sync'] = async (job) => handleGoogleCalendarSyncJob(job);
}

/**
 * Fire-and-forget safe: never throws into reservation workflows.
 * Connected ≠ Enabled: requires syncEnabled + calendarId.
 */
export async function maybeQueueGoogleReservationSync(propertyId: string, reservationId: string) {
  try {
    const integration = await getPropertyIntegration(propertyId, 'google_calendar');
    if (!integration || integration.status !== 'connected') return null;
    if (!isGoogleCalendarSyncEnabled(integration)) return null;
    return enqueueSyncJob({
      propertyId,
      integrationId: integration.id,
      provider: 'google_calendar',
      direction: 'outbound',
      trigger: 'event',
      jobType: 'reservation_sync',
      idempotencyKey: `gcal:res:${reservationId}`,
      payload: { reservationId },
    });
  } catch {
    return null;
  }
}

/** @deprecated Use maybeQueueGoogleReservationSync */
export async function queueGoogleReservationSync(propertyId: string, reservationId: string) {
  return maybeQueueGoogleReservationSync(propertyId, reservationId);
}
