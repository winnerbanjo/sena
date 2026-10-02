import { getDatesBetween, roleMayDeleteReservations } from '@sena/config';
import {
  activityLogs,
  apartments,
  bookingGroups,
  db,
  guestMessages,
  payments,
  paymentAttempts,
  properties,
  propertyInvoices,
  reservations,
  reservationEvents,
  reservationNotes,
  reviews,
  rooms,
  transferProofs,
  and,
  count,
  eq,
  ne,
  sql,
} from '@sena/database';
import { ensureOpenHousekeepingTask } from '@sena/housekeeping';
import { releaseInventoryInTransaction } from '@sena/inventory';
import { ACTIVE_STAY_STATUSES } from './assignment';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export { roleMayDeleteReservations };

/** Operational statuses that still hold a unit of stock for their nights. */
const STOCK_HOLDING_STATUSES = ACTIVE_STAY_STATUSES;

export const RESERVATION_REMOVAL_MESSAGES = {
  in_house: 'Check the guest out before deleting this reservation.',
  confirmation_required: 'Type the reservation reference to confirm.',
  not_found: 'This reservation is no longer available.',
  already_removed: 'This reservation has already been removed.',
} as const;

export type ReservationRemovalCode = 'in_house' | 'confirmation_required';

export const RESERVATION_REMOVAL_REASONS = [
  'Duplicate reservation',
  'Created by mistake',
  'Guest cancelled',
  'Test / erroneous entry',
  'Management decision',
  'Other',
] as const;

export type ReservationRemovalReason = (typeof RESERVATION_REMOVAL_REASONS)[number] | string;

/**
 * Dependent records that make a reservation worth keeping forever. A hard delete
 * is only safe when every one of these is empty.
 */
export type ReservationRemovalFacts = {
  status: string;
  paymentCount: number;
  invoiceCount: number;
  paymentAttemptCount: number;
  transferProofCount: number;
  reviewCount: number;
  noteCount: number;
  messageCount: number;
  /** Any check-in or check-out event: the guest physically stayed. */
  hasStayHistory: boolean;
};

export type ReservationRemovalDecision =
  | { action: 'delete' }
  | { action: 'void' }
  | { action: 'blocked'; code: ReservationRemovalCode; message: string };

/** Destructive removal of a reservation is management-only. */
export function normalizeRemovalReason(reason: unknown): ReservationRemovalReason | null {
  if (typeof reason !== 'string') return null;
  const trimmed = reason.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 200);
}

/**
 * An in-house guest must be checked out first, so no destructive action is
 * offered. Everything else resolves to the safest semantics available: a real
 * delete only when nothing meaningful was ever attached.
 */
export function classifyReservationRemoval(facts: ReservationRemovalFacts): ReservationRemovalDecision {
  if (facts.status === 'checked_in') {
    return { action: 'blocked', code: 'in_house', message: RESERVATION_REMOVAL_MESSAGES.in_house };
  }

  const hasHistory =
    facts.paymentCount > 0 ||
    facts.invoiceCount > 0 ||
    facts.paymentAttemptCount > 0 ||
    facts.transferProofCount > 0 ||
    facts.reviewCount > 0 ||
    facts.noteCount > 0 ||
    facts.messageCount > 0 ||
    facts.hasStayHistory ||
    facts.status === 'checked_out';

  return hasHistory ? { action: 'void' } : { action: 'delete' };
}

type RemovalActor = { id?: string; name: string };
type RemovalTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function actorUserId(actor: RemovalActor) {
  return actor.id && UUID.test(actor.id) ? actor.id : null;
}

async function loadRemovalFacts(tx: RemovalTx, reservationId: string, status: string): Promise<ReservationRemovalFacts> {
  const [payments_, invoices, attempts, proofs, reviews_, notes, messages, stayEvents] = await Promise.all([
    tx.select({ value: count() }).from(payments).where(eq(payments.reservationId, reservationId)),
    tx.select({ value: count() }).from(propertyInvoices).where(eq(propertyInvoices.reservationId, reservationId)),
    tx.select({ value: count() }).from(paymentAttempts).where(eq(paymentAttempts.reservationId, reservationId)),
    tx.select({ value: count() }).from(transferProofs).where(eq(transferProofs.reservationId, reservationId)),
    tx.select({ value: count() }).from(reviews).where(eq(reviews.reservationId, reservationId)),
    tx.select({ value: count() }).from(reservationNotes).where(eq(reservationNotes.reservationId, reservationId)),
    tx.select({ value: count() }).from(guestMessages).where(eq(guestMessages.reservationId, reservationId)),
    tx
      .select({ eventType: reservationEvents.eventType })
      .from(reservationEvents)
      .where(
        and(
          eq(reservationEvents.reservationId, reservationId),
          sql`${reservationEvents.eventType} in ('checked_in', 'checked_in_outstanding', 'checked_out', 'checked_out_outstanding')`
        )
      ),
  ]);

  return {
    status,
    paymentCount: Number(payments_[0]?.value || 0),
    invoiceCount: Number(invoices[0]?.value || 0),
    paymentAttemptCount: Number(attempts[0]?.value || 0),
    transferProofCount: Number(proofs[0]?.value || 0),
    reviewCount: Number(reviews_[0]?.value || 0),
    noteCount: Number(notes[0]?.value || 0),
    messageCount: Number(messages[0]?.value || 0),
    hasStayHistory: stayEvents.length > 0,
  };
}

async function writeAudit(
  tx: RemovalTx,
  input: {
    organizationId: string;
    propertyId: string;
    actor: RemovalActor;
    action: 'reservation_deleted' | 'reservation_voided';
    reservation: { id: string; reference: string; status: string; checkInDate: string; checkOutDate: string; totalAmountMinorUnits: number; paidAmountMinorUnits: number; guestId: string; roomTypeId: string | null; roomId: string | null; apartmentId: string | null; bookingGroupId: string | null };
    reason: ReservationRemovalReason | null;
  }
) {
  await tx.insert(activityLogs).values({
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    actorId: actorUserId(input.actor),
    actorName: input.actor.name || 'Staff',
    action: input.action,
    resource: 'reservation',
    resourceId: input.reservation.id,
    previousValue: {
      reference: input.reservation.reference,
      status: input.reservation.status,
      checkInDate: input.reservation.checkInDate,
      checkOutDate: input.reservation.checkOutDate,
      totalAmountMinorUnits: input.reservation.totalAmountMinorUnits,
      paidAmountMinorUnits: input.reservation.paidAmountMinorUnits,
      bookingGroupId: input.reservation.bookingGroupId,
    },
    newValue: {
      removed: input.action === 'reservation_deleted',
      voided: input.action === 'reservation_voided',
      reason: input.reason,
      actor: input.actor.name || 'Staff',
    },
  });
}

/**
 * Frees the unit the stay held. Mirrors the checkout convention for an occupied
 * unit and leaves a future, unoccupied unit untouched.
 */
async function releaseAccommodation(
  tx: RemovalTx,
  reservation: { propertyId: string; reference: string; roomTypeId: string | null; roomId: string | null; apartmentId: string | null; checkInDate: string; checkOutDate: string; status: string }
) {
  if (reservation.roomTypeId && STOCK_HOLDING_STATUSES.includes(reservation.status as (typeof STOCK_HOLDING_STATUSES)[number])) {
    await releaseInventoryInTransaction(
      tx,
      reservation.propertyId,
      reservation.roomTypeId,
      getDatesBetween(reservation.checkInDate, reservation.checkOutDate),
      1
    );
  }

  if (reservation.roomId) {
    const [room] = await tx
      .select({ id: rooms.id, operationalStatus: rooms.operationalStatus })
      .from(rooms)
      .where(and(eq(rooms.id, reservation.roomId), eq(rooms.propertyId, reservation.propertyId)))
      .limit(1)
      .for('update');
    if (room && room.operationalStatus === 'occupied') {
      await tx
        .update(rooms)
        .set({ operationalStatus: 'available', housekeepingStatus: 'dirty', updatedAt: new Date() })
        .where(eq(rooms.id, room.id));
      await ensureOpenHousekeepingTask(tx, {
        propertyId: reservation.propertyId,
        roomId: room.id,
        notes: `Released from removed reservation ${reservation.reference}`,
      });
    }
  }

  if (reservation.apartmentId) {
    const [apartment] = await tx
      .select({ id: apartments.id, operationalStatus: apartments.operationalStatus })
      .from(apartments)
      .where(and(eq(apartments.id, reservation.apartmentId), eq(apartments.propertyId, reservation.propertyId)))
      .limit(1)
      .for('update');
    if (apartment && apartment.operationalStatus === 'occupied') {
      await tx
        .update(apartments)
        .set({ operationalStatus: 'available', housekeepingStatus: 'dirty', updatedAt: new Date() })
        .where(eq(apartments.id, apartment.id));
      await ensureOpenHousekeepingTask(tx, {
        propertyId: reservation.propertyId,
        apartmentId: apartment.id,
        notes: `Released from removed reservation ${reservation.reference}`,
      });
    }
  }
}

/** A booking group with no remaining active child is not left orphaned. */
async function pruneEmptyBookingGroup(tx: RemovalTx, propertyId: string, bookingGroupId: string | null) {
  if (!bookingGroupId) return;
  const [remaining] = await tx
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      and(
        eq(reservations.propertyId, propertyId),
        eq(reservations.bookingGroupId, bookingGroupId),
        ne(reservations.status, 'voided')
      )
    )
    .limit(1);
  if (remaining) return;
  await tx
    .delete(bookingGroups)
    .where(and(eq(bookingGroups.id, bookingGroupId), eq(bookingGroups.propertyId, propertyId)));
}

export type ReservationRemovalResult =
  | { outcome: 'deleted'; reservationId: string; reference: string; bookingGroupId: string | null }
  | { outcome: 'voided'; reservationId: string; reference: string; bookingGroupId: string | null }
  | { outcome: 'already_removed'; reservationId: string; reference: string }
  | { outcome: 'not_found' }
  | { outcome: 'blocked'; code: ReservationRemovalCode; message: string }
  | { outcome: 'confirmation_required'; code: 'confirmation_required'; message: string };

export type ReservationRemovalPreview =
  | { outcome: 'not_found' }
  | {
      outcome: 'preview';
      reference: string;
      status: string;
      alreadyRemoved: boolean;
      /** What Sena will actually do. */
      action: 'delete' | 'void' | 'blocked';
      confirmationRequired: boolean;
      message: string | null;
      /** Plain-language history that forces a void instead of a delete. */
      reasons: string[];
    };

function historyReasons(facts: ReservationRemovalFacts, status: string): string[] {
  const reasons: string[] = [];
  if (facts.paymentCount > 0) reasons.push('payment');
  if (facts.invoiceCount > 0) reasons.push('invoice');
  if (facts.hasStayHistory || status === 'checked_out') reasons.push('stay history');
  if (facts.paymentAttemptCount > 0) reasons.push('payment attempt');
  if (facts.transferProofCount > 0) reasons.push('transfer proof');
  if (facts.reviewCount > 0) reasons.push('review');
  if (facts.noteCount > 0) reasons.push('staff note');
  if (facts.messageCount > 0) reasons.push('guest message');
  return reasons;
}

/** What "Delete reservation" would actually do, so the dialog can say it plainly. */
export async function previewReservationRemoval(input: {
  propertyId: string;
  reservationId: string;
  organizationId: string;
}): Promise<ReservationRemovalPreview> {
  return db.transaction(async (tx) => {
    const [property] = await tx
      .select({ organizationId: properties.organizationId })
      .from(properties)
      .where(eq(properties.id, input.propertyId))
      .limit(1);
    if (!property || property.organizationId !== input.organizationId) return { outcome: 'not_found' as const };

    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, input.reservationId), eq(reservations.propertyId, input.propertyId)))
      .limit(1);
    if (!reservation) return { outcome: 'not_found' as const };

    if (reservation.status === 'voided') {
      return {
        outcome: 'preview' as const,
        reference: reservation.reference,
        status: reservation.status,
        alreadyRemoved: true,
        action: 'void' as const,
        confirmationRequired: false,
        message: RESERVATION_REMOVAL_MESSAGES.already_removed,
        reasons: [],
      };
    }

    const facts = await loadRemovalFacts(tx, reservation.id, reservation.status);
    const decision = classifyReservationRemoval(facts);
    return {
      outcome: 'preview' as const,
      reference: reservation.reference,
      status: reservation.status,
      alreadyRemoved: false,
      action: decision.action,
      confirmationRequired: decision.action === 'void',
      message: decision.action === 'blocked' ? decision.message : null,
      reasons: decision.action === 'void' ? historyReasons(facts, reservation.status) : [],
    };
  });
}

/**
 * One destructive entry point. Sena decides between a real delete and a void so
 * the operator never has to know which records exist.
 */
export async function removeReservation(input: {
  propertyId: string;
  reservationId: string;
  organizationId: string;
  actor: RemovalActor;
  reason?: unknown;
  confirmReference?: string;
  now?: Date;
}): Promise<ReservationRemovalResult> {
  const now = input.now ?? new Date();
  const reason = normalizeRemovalReason(input.reason);

  return db.transaction(async (tx) => {
    const [property] = await tx
      .select({ organizationId: properties.organizationId })
      .from(properties)
      .where(eq(properties.id, input.propertyId))
      .limit(1);
    if (!property || property.organizationId !== input.organizationId) return { outcome: 'not_found' as const };

    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, input.reservationId), eq(reservations.propertyId, input.propertyId)))
      .limit(1)
      .for('update');
    if (!reservation) return { outcome: 'not_found' as const };

    // A repeated request is a safe no-op, never a second mutation.
    if (reservation.status === 'voided') {
      return { outcome: 'already_removed' as const, reservationId: reservation.id, reference: reservation.reference };
    }

    const decision = classifyReservationRemoval(await loadRemovalFacts(tx, reservation.id, reservation.status));
    if (decision.action === 'blocked') {
      return { outcome: 'blocked' as const, code: decision.code, message: decision.message };
    }

    // Voiding keeps money and invoices intact, so it asks for the reference.
    if (decision.action === 'void' && (input.confirmReference ?? '').trim().toUpperCase() !== reservation.reference.toUpperCase()) {
      return {
        outcome: 'confirmation_required' as const,
        code: 'confirmation_required' as const,
        message: RESERVATION_REMOVAL_MESSAGES.confirmation_required,
      };
    }

    await releaseAccommodation(tx, {
      propertyId: reservation.propertyId,
      reference: reservation.reference,
      roomTypeId: reservation.roomTypeId,
      roomId: reservation.roomId,
      apartmentId: reservation.apartmentId,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      status: reservation.status,
    });

    const bookingGroupId = reservation.bookingGroupId;

    if (decision.action === 'delete') {
      // The audit row has no foreign key to the reservation, so the evidence
      // survives the delete that removes the record itself.
      await tx.execute(sql`SAVEPOINT reservation_delete`);
      try {
        await writeAudit(tx, {
          organizationId: input.organizationId,
          propertyId: input.propertyId,
          actor: input.actor,
          action: 'reservation_deleted',
          reservation,
          reason,
        });
        await tx
          .delete(reservations)
          .where(and(eq(reservations.id, reservation.id), eq(reservations.propertyId, input.propertyId)));
        await tx.execute(sql`RELEASE SAVEPOINT reservation_delete`);
      } catch (error) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT reservation_delete`);
        throw error;
      }
      await pruneEmptyBookingGroup(tx, input.propertyId, bookingGroupId);
      return { outcome: 'deleted' as const, reservationId: reservation.id, reference: reservation.reference, bookingGroupId };
    }

    await tx
      .update(reservations)
      .set({ status: 'voided', updatedAt: now })
      .where(and(eq(reservations.id, reservation.id), eq(reservations.propertyId, input.propertyId)));

    await tx.insert(reservationEvents).values({
      reservationId: reservation.id,
      actorId: actorUserId(input.actor) || undefined,
      actorName: input.actor.name || 'Staff',
      eventType: 'reservation_voided',
      description: reason
        ? `Removed from operations by ${input.actor.name || 'staff'} (${reason}). Payment and invoice history preserved.`
        : `Removed from operations by ${input.actor.name || 'staff'}. Payment and invoice history preserved.`,
      metadata: { reason },
    });

    await writeAudit(tx, {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      actor: input.actor,
      action: 'reservation_voided',
      reservation,
      reason,
    });

    await pruneEmptyBookingGroup(tx, input.propertyId, bookingGroupId);
    return { outcome: 'voided' as const, reservationId: reservation.id, reference: reservation.reference, bookingGroupId };
  });
}
