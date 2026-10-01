import { ROLE_PERMISSIONS } from '@sena/config';
import type { Role } from '@sena/types';
import {
  activityLogs,
  apartments,
  bookingHolds,
  db,
  housekeepingTasks,
  payments,
  properties,
  propertyInvoices,
  reservations,
  roomImages,
  and,
  eq,
  isNull,
  ne,
  or,
  sql,
} from '@sena/database';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE_HOUSEKEEPING = ['dirty', 'cleaning', 'inspection'] as const;
const HISTORY_NEUTRAL_STATUSES = ['cancelled', 'no_show', 'checked_out'] as const;

const ROLE_ALIASES: Record<string, Role> = {
  'general manager': 'manager',
  'property manager': 'manager',
  'front desk lead': 'front_desk',
  'front desk': 'front_desk',
  'front desk agent': 'front_desk',
  receptionist: 'front_desk',
  staff: 'front_desk',
  housekeeper: 'housekeeping',
  'housekeeping lead': 'housekeeping',
  'housekeeping supervisor': 'housekeeping',
  'room attendant': 'housekeeping',
  finance: 'accountant',
};

export const APARTMENT_REMOVAL_MESSAGES = {
  active_reservation: 'This apartment has an active reservation and cannot be removed yet.',
  upcoming_reservations: 'This apartment has upcoming reservations. Reassign or cancel those reservations before removing it.',
  active_hold: 'This apartment has an active booking hold and cannot be removed yet.',
  active_housekeeping: 'This apartment has active housekeeping and cannot be removed yet.',
  confirmation_required: 'Type the apartment name to confirm deletion.',
  already_archived: 'This apartment is already archived.',
  already_active: 'This apartment is already active.',
} as const;

export type ApartmentRemovalCode = keyof typeof APARTMENT_REMOVAL_MESSAGES;

export type ApartmentRemovalFacts = {
  today: string;
  now: Date;
  operationalStatus: string;
  housekeepingStatus: string;
  reservations: Array<{ status: string; checkInDate: string; checkOutDate: string }>;
  holds: Array<{ status: string; expiresAt: Date }>;
  tasks: Array<{ status: string }>;
  paymentCount: number;
  invoiceCount: number;
};

export type ApartmentRemovalDecision =
  | { action: 'delete' }
  | { action: 'archive' }
  | { action: 'blocked'; code: ApartmentRemovalCode; message: string };

export function roleMayEditApartmentInventory(role: string) {
  const normalized = role.trim().toLowerCase();
  const resolved = ROLE_ALIASES[normalized] || normalized;
  const permissions = ROLE_PERMISSIONS[resolved as Role] || [];
  return permissions.includes('room.edit');
}

function blocked(
  code: 'active_reservation' | 'upcoming_reservations' | 'active_hold' | 'active_housekeeping'
): ApartmentRemovalDecision {
  return { action: 'blocked', code, message: APARTMENT_REMOVAL_MESSAGES[code] };
}

/** Pending, confirmed, checked-in, active holds, and open housekeeping block removal. */
export function classifyApartmentRemoval(input: ApartmentRemovalFacts): ApartmentRemovalDecision {
  if (input.operationalStatus === 'occupied' || input.reservations.some((stay) => stay.status === 'checked_in')) {
    return blocked('active_reservation');
  }

  const openReservations = input.reservations.filter((stay) => stay.status === 'pending' || stay.status === 'confirmed');
  if (openReservations.length > 0) {
    const onlyUpcoming = openReservations.every((stay) => stay.checkInDate > input.today);
    return blocked(onlyUpcoming ? 'upcoming_reservations' : 'active_reservation');
  }

  if (input.holds.some((hold) => hold.status === 'active' && hold.expiresAt > input.now)) {
    return blocked('active_hold');
  }

  const activeHousekeeping =
    ACTIVE_HOUSEKEEPING.includes(input.housekeepingStatus as (typeof ACTIVE_HOUSEKEEPING)[number]) ||
    input.tasks.some((task) => ACTIVE_HOUSEKEEPING.includes(task.status as (typeof ACTIVE_HOUSEKEEPING)[number]));
  if (activeHousekeeping) return blocked('active_housekeeping');

  const hasHistory =
    input.reservations.length > 0 ||
    input.holds.length > 0 ||
    input.tasks.length > 0 ||
    input.paymentCount > 0 ||
    input.invoiceCount > 0 ||
    input.reservations.some((stay) =>
      HISTORY_NEUTRAL_STATUSES.includes(stay.status as (typeof HISTORY_NEUTRAL_STATUSES)[number])
    );
  return hasHistory ? { action: 'archive' } : { action: 'delete' };
}

export function apartmentOwnedStorageKey(propertyId: string, apartmentId: string, storageKey: string) {
  return storageKey.startsWith(`apartments/${propertyId}/${apartmentId}/`);
}

type RemovalActor = { id?: string; name: string };
type RemovalTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function actorUserId(actor: RemovalActor) {
  return actor.id && UUID.test(actor.id) ? actor.id : null;
}

function postgresErrorCode(error: unknown) {
  const current = error as { code?: string; cause?: { code?: string } };
  return current?.code || current?.cause?.code;
}

async function loadRemovalFacts(
  tx: RemovalTx,
  propertyId: string,
  apartmentId: string,
  today: string,
  now: Date,
  apartment: { operationalStatus: string; housekeepingStatus: string }
): Promise<ApartmentRemovalFacts> {
  const [stayRows, holdRows, taskRows, paymentRows, invoiceRows] = await Promise.all([
    tx
      .select({
        status: reservations.status,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
      })
      .from(reservations)
      .where(and(eq(reservations.propertyId, propertyId), eq(reservations.apartmentId, apartmentId))),
    tx
      .select({ status: bookingHolds.status, expiresAt: bookingHolds.expiresAt })
      .from(bookingHolds)
      .where(and(eq(bookingHolds.propertyId, propertyId), eq(bookingHolds.apartmentId, apartmentId))),
    tx
      .select({ status: housekeepingTasks.status })
      .from(housekeepingTasks)
      .where(and(eq(housekeepingTasks.propertyId, propertyId), eq(housekeepingTasks.apartmentId, apartmentId))),
    tx
      .select({ id: payments.id })
      .from(payments)
      .innerJoin(reservations, eq(payments.reservationId, reservations.id))
      .where(and(eq(reservations.propertyId, propertyId), eq(reservations.apartmentId, apartmentId))),
    tx
      .select({ id: propertyInvoices.id })
      .from(propertyInvoices)
      .innerJoin(reservations, eq(propertyInvoices.reservationId, reservations.id))
      .where(and(eq(reservations.propertyId, propertyId), eq(reservations.apartmentId, apartmentId))),
  ]);

  return {
    today,
    now,
    operationalStatus: apartment.operationalStatus,
    housekeepingStatus: apartment.housekeepingStatus,
    reservations: stayRows,
    holds: holdRows,
    tasks: taskRows,
    paymentCount: paymentRows.length,
    invoiceCount: invoiceRows.length,
  };
}

async function writeAudit(
  tx: RemovalTx,
  input: {
    organizationId: string;
    propertyId: string;
    actor: RemovalActor;
    action: 'apartment_deleted' | 'apartment_archived' | 'apartment_restored';
    apartmentId: string;
    previousValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
  }
) {
  await tx.insert(activityLogs).values({
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    actorId: actorUserId(input.actor),
    actorName: input.actor.name || 'Staff',
    action: input.action,
    resource: 'apartment',
    resourceId: input.apartmentId,
    previousValue: input.previousValue,
    newValue: input.newValue,
  });
}

async function deletableStorageKeys(tx: RemovalTx, propertyId: string, apartmentId: string) {
  const images = await tx
    .select({ storageKey: roomImages.storageKey })
    .from(roomImages)
    .where(and(eq(roomImages.propertyId, propertyId), eq(roomImages.apartmentId, apartmentId)));
  const keys: string[] = [];
  for (const image of images) {
    if (!apartmentOwnedStorageKey(propertyId, apartmentId, image.storageKey)) continue;
    const [external] = await tx
      .select({ id: roomImages.id })
      .from(roomImages)
      .where(
        and(
          eq(roomImages.storageKey, image.storageKey),
          or(isNull(roomImages.apartmentId), ne(roomImages.apartmentId, apartmentId))
        )
      )
      .limit(1);
    if (!external) keys.push(image.storageKey);
  }
  return [...new Set(keys)];
}

export type ApartmentRemovalResult =
  | { outcome: 'deleted'; apartmentId: string; storageKeys: string[] }
  | { outcome: 'archived'; apartmentId: string }
  | { outcome: 'not_found' }
  | { outcome: 'blocked'; code: ApartmentRemovalCode; message: string }
  | { outcome: 'confirmation_required'; code: 'confirmation_required'; message: string };

async function archiveApartment(
  tx: RemovalTx,
  input: {
    propertyId: string;
    organizationId: string;
    actor: RemovalActor;
    apartment: { id: string; name: string };
    archivedAt: Date;
  }
) {
  await tx
    .update(apartments)
    .set({ archivedAt: input.archivedAt, archivedBy: actorUserId(input.actor), updatedAt: input.archivedAt })
    .where(and(eq(apartments.id, input.apartment.id), eq(apartments.propertyId, input.propertyId)));
  await writeAudit(tx, {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    actor: input.actor,
    action: 'apartment_archived',
    apartmentId: input.apartment.id,
    previousValue: { name: input.apartment.name, archivedAt: null },
    newValue: { archivedAt: input.archivedAt.toISOString() },
  });
  return { outcome: 'archived' as const, apartmentId: input.apartment.id };
}

export async function removeApartment(input: {
  propertyId: string;
  apartmentId: string;
  organizationId: string;
  actor: RemovalActor;
  today: string;
  confirmName?: string;
  now?: Date;
  deleteOwnedMedia?: (storageKey: string) => Promise<void>;
}): Promise<ApartmentRemovalResult> {
  const now = input.now ?? new Date();
  const result = await db.transaction(async (tx) => {
    const [property] = await tx
      .select({ organizationId: properties.organizationId })
      .from(properties)
      .where(eq(properties.id, input.propertyId))
      .limit(1);
    if (!property || property.organizationId !== input.organizationId) return { outcome: 'not_found' as const };

    const [apartment] = await tx
      .select()
      .from(apartments)
      .where(and(eq(apartments.id, input.apartmentId), eq(apartments.propertyId, input.propertyId)))
      .limit(1)
      .for('update');
    if (!apartment) return { outcome: 'not_found' as const };
    if (apartment.archivedAt) {
      return { outcome: 'blocked' as const, code: 'already_archived' as const, message: APARTMENT_REMOVAL_MESSAGES.already_archived };
    }

    const facts = await loadRemovalFacts(tx, input.propertyId, apartment.id, input.today, now, apartment);
    const decision = classifyApartmentRemoval(facts);
    if (decision.action === 'blocked') {
      return { outcome: 'blocked' as const, code: decision.code, message: decision.message };
    }
    if (decision.action === 'archive') {
      return archiveApartment(tx, {
        propertyId: input.propertyId,
        organizationId: input.organizationId,
        actor: input.actor,
        apartment,
        archivedAt: now,
      });
    }

    if ((input.confirmName ?? '').trim() !== apartment.name) {
      return {
        outcome: 'confirmation_required' as const,
        code: 'confirmation_required' as const,
        message: APARTMENT_REMOVAL_MESSAGES.confirmation_required,
      };
    }

    const storageKeys = await deletableStorageKeys(tx, input.propertyId, apartment.id);
    await tx.execute(sql`SAVEPOINT apartment_delete`);
    try {
      await writeAudit(tx, {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        actor: input.actor,
        action: 'apartment_deleted',
        apartmentId: apartment.id,
        previousValue: { name: apartment.name, archivedAt: null },
        newValue: { deleted: true },
      });
      await tx.delete(apartments).where(and(eq(apartments.id, apartment.id), eq(apartments.propertyId, input.propertyId)));
      await tx.execute(sql`RELEASE SAVEPOINT apartment_delete`);
      return { outcome: 'deleted' as const, apartmentId: apartment.id, storageKeys };
    } catch (error) {
      await tx.execute(sql`ROLLBACK TO SAVEPOINT apartment_delete`);
      if (postgresErrorCode(error) !== '23503') throw error;
      const again = classifyApartmentRemoval(
        await loadRemovalFacts(tx, input.propertyId, apartment.id, input.today, now, apartment)
      );
      if (again.action === 'blocked') return { outcome: 'blocked' as const, code: again.code, message: again.message };
      if (again.action !== 'archive') throw error;
      return archiveApartment(tx, {
        propertyId: input.propertyId,
        organizationId: input.organizationId,
        actor: input.actor,
        apartment,
        archivedAt: now,
      });
    }
  });

  if (result.outcome === 'deleted' && input.deleteOwnedMedia) {
    for (const key of result.storageKeys) {
      await input.deleteOwnedMedia(key).catch((error) => {
        console.error('Apartment gallery storage delete failed:', error instanceof Error ? error.message : 'storage');
      });
    }
  }
  return result;
}

export async function restoreApartment(input: {
  propertyId: string;
  apartmentId: string;
  organizationId: string;
  actor: RemovalActor;
}): Promise<
  | { outcome: 'restored'; apartmentId: string }
  | { outcome: 'not_found' }
  | { outcome: 'blocked'; code: 'already_active'; message: string }
> {
  return db.transaction(async (tx) => {
    const [property] = await tx
      .select({ organizationId: properties.organizationId })
      .from(properties)
      .where(eq(properties.id, input.propertyId))
      .limit(1);
    if (!property || property.organizationId !== input.organizationId) return { outcome: 'not_found' };

    const [apartment] = await tx
      .select()
      .from(apartments)
      .where(and(eq(apartments.id, input.apartmentId), eq(apartments.propertyId, input.propertyId)))
      .limit(1)
      .for('update');
    if (!apartment) return { outcome: 'not_found' };
    if (!apartment.archivedAt) {
      return { outcome: 'blocked', code: 'already_active', message: APARTMENT_REMOVAL_MESSAGES.already_active };
    }

    await tx
      .update(apartments)
      .set({ archivedAt: null, archivedBy: null, updatedAt: new Date() })
      .where(and(eq(apartments.id, apartment.id), eq(apartments.propertyId, input.propertyId)));
    await writeAudit(tx, {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      actor: input.actor,
      action: 'apartment_restored',
      apartmentId: apartment.id,
      previousValue: { name: apartment.name, archivedAt: apartment.archivedAt.toISOString() },
      newValue: { archivedAt: null },
    });
    return { outcome: 'restored', apartmentId: apartment.id };
  });
}
