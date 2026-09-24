import { calculateNights, getDatesBetween } from '@sena/config';
import {
  activityLogs,
  bookingHolds,
  db,
  guests,
  housekeepingTasks,
  properties,
  reservationEvents,
  reservations,
  rooms,
  roomTypes,
} from '@sena/database';
import {
  releaseInventoryInTransaction,
  reserveInventoryInTransaction,
} from '@sena/inventory';
import type { Reservation, ReservationEvent } from '@sena/types';
import type { CreateReservationInput } from '@sena/validation';
import { and, desc, eq } from 'drizzle-orm';

function generateReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SEN-${code}`;
}

export class ReservationService {
  /**
   * Create Reservation with strict atomic concurrency locking.
   * Section 39 of PRD:
   * BEGIN -> Lock inventory -> Check every night -> Reserve inventory -> Create record -> COMMIT
   */
  static async create(
    input: CreateReservationInput,
    actor = { id: '', name: 'System' }
  ): Promise<Reservation> {
    const nights = calculateNights(input.checkInDate, input.checkOutDate);
    const stayDates = getDatesBetween(input.checkInDate, input.checkOutDate);

    return await db.transaction(async (tx) => {
      // 1. Fetch Room Type and compute pricing
      const rt = await tx
        .select()
        .from(roomTypes)
        .where(eq(roomTypes.id, input.roomTypeId))
        .limit(1);

      if (rt.length === 0) {
        throw new Error('Room type not found');
      }

      const totalAmountMinorUnits = rt[0].basePriceMinorUnits * nights;

      // 2. Lock & Reserve Inventory for each night
      await reserveInventoryInTransaction(
        tx,
        input.propertyId,
        input.roomTypeId,
        stayDates,
        1
      );

      // Convert server-side hold if one was passed
      if ((input as any).holdId) {
        await tx
          .update(bookingHolds)
          .set({ status: 'converted' })
          .where(eq(bookingHolds.id, (input as any).holdId));
      }

      // 3. Resolve Guest ID (find existing or create new)
      let resolvedGuestId = input.guestId;
      if (!resolvedGuestId && input.guest) {
        // Query by email first
        const existing = await tx
          .select()
          .from(guests)
          .where(
            and(
              eq(guests.propertyId, input.propertyId),
              eq(guests.email, input.guest.email)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          resolvedGuestId = existing[0].id;
        } else {
          // Resolve property organizationId
          const propList = await tx
            .select({ organizationId: properties.organizationId })
            .from(properties)
            .where(eq(properties.id, input.propertyId))
            .limit(1);

          const organizationId = propList[0]?.organizationId;
          if (!organizationId) {
            throw new Error(`Property ${input.propertyId} has no parent organization`);
          }

          const inserted = await tx
            .insert(guests)
            .values({
              organizationId,
              propertyId: input.propertyId,
              fullName: input.guest.fullName,
              email: input.guest.email,
              phone: input.guest.phone,
              identificationType: input.guest.identificationType,
              identificationNumber: input.guest.identificationNumber,
              preferences: input.guest.preferences || [],
              notes: input.guest.notes,
            })
            .returning();
          resolvedGuestId = inserted[0].id;
        }
      }

      if (!resolvedGuestId) {
        throw new Error('Could not resolve or create guest profile');
      }

      // 4. Insert Reservation Record
      const reference = generateReference();
      const [resRecord] = await tx
        .insert(reservations)
        .values({
          reference,
          propertyId: input.propertyId,
          guestId: resolvedGuestId,
          roomTypeId: input.roomTypeId,
          roomId: input.roomId,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          nights,
          numGuests: input.numGuests,
          adults: input.adults,
          children: input.children,
          source: input.source,
          status: 'confirmed',
          paymentStatus: input.paymentStatus,
          totalAmountMinorUnits,
          paidAmountMinorUnits: input.paidAmountMinorUnits,
          specialRequests: input.specialRequests,
        })
        .returning();

      // 5. Create Audit Timeline Event
      await tx.insert(reservationEvents).values({
        reservationId: resRecord.id,
        actorId: actor.id || undefined,
        actorName: actor.name,
        eventType: 'reservation_created',
        description: `Reservation ${reference} created for ${nights} nights (${rt[0].name}).`,
      });

      return {
        ...resRecord,
        balanceMinorUnits:
          resRecord.totalAmountMinorUnits - resRecord.paidAmountMinorUnits,
      } as unknown as Reservation;
    });
  }

  /**
   * Check in guest
   * Section 45: Reservation -> Checked in; Room -> Occupied
   */
  static async checkIn(
    reservationId: string,
    roomId: string,
    actor = { id: '', name: 'Receptionist' }
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const resList = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId))
        .limit(1);

      if (resList.length === 0) {
        throw new Error('Reservation not found');
      }

      const res = resList[0];

      // Update reservation status and assign room
      await tx
        .update(reservations)
        .set({
          status: 'checked_in',
          roomId,
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, reservationId));

      // Mark Room operational status as occupied
      await tx
        .update(rooms)
        .set({
          operationalStatus: 'occupied',
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, roomId));

      // Timeline event
      await tx.insert(reservationEvents).values({
        reservationId,
        actorId: actor.id || undefined,
        actorName: actor.name,
        eventType: 'checked_in',
        description: `Checked in by ${actor.name}. Room assigned: ${roomId}.`,
      });
    });
  }

  /**
   * Check out guest
   * Section 46: Check balance -> Reservation -> Checked out; Room -> Available; Housekeeping -> Dirty
   */
  static async checkOut(
    reservationId: string,
    actor = { id: '', name: 'Receptionist' },
    force = false
  ): Promise<{ outstandingBalanceMinorUnits: number }> {
    return await db.transaction(async (tx) => {
      const resList = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId))
        .limit(1);

      if (resList.length === 0) {
        throw new Error('Reservation not found');
      }

      const res = resList[0];
      const balance = res.totalAmountMinorUnits - res.paidAmountMinorUnits;

      if (balance > 0 && !force) {
        return { outstandingBalanceMinorUnits: balance };
      }

      // Update reservation
      await tx
        .update(reservations)
        .set({
          status: 'checked_out',
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, reservationId));

      // If room was assigned, transition room & trigger housekeeping
      if (res.roomId) {
        await tx
          .update(rooms)
          .set({
            operationalStatus: 'available',
            housekeepingStatus: 'dirty',
            updatedAt: new Date(),
          })
          .where(eq(rooms.id, res.roomId));

        // Create Housekeeping Task
        await tx.insert(housekeepingTasks).values({
          propertyId: res.propertyId,
          roomId: res.roomId,
          status: 'dirty',
          notes: `Guest checked out from reservation ${res.reference}`,
        });
      }

      // Record timeline
      await tx.insert(reservationEvents).values({
        reservationId,
        actorId: actor.id || undefined,
        actorName: actor.name,
        eventType: 'checked_out',
        description: `Checked out by ${actor.name}.${balance > 0 ? ` Outstanding balance: ₦${balance / 100}.` : ''}`,
      });

      return { outstandingBalanceMinorUnits: balance };
    });
  }

  /**
   * Cancel reservation
   * Releases reserved inventory and updates status
   */
  static async cancel(
    reservationId: string,
    actor = { id: '', name: 'Staff' }
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const resList = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId))
        .limit(1);

      if (resList.length === 0) {
        throw new Error('Reservation not found');
      }

      const res = resList[0];
      if (res.status === 'cancelled') return;

      const stayDates = getDatesBetween(res.checkInDate, res.checkOutDate);

      // Release inventory
      await releaseInventoryInTransaction(
        tx,
        res.propertyId,
        res.roomTypeId,
        stayDates,
        1
      );

      // Update reservation
      await tx
        .update(reservations)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, reservationId));

      // Release room if assigned
      if (res.roomId) {
        await tx
          .update(rooms)
          .set({
            operationalStatus: 'available',
            updatedAt: new Date(),
          })
          .where(eq(rooms.id, res.roomId));
      }

      // Record timeline
      await tx.insert(reservationEvents).values({
        reservationId,
        actorId: actor.id || undefined,
        actorName: actor.name,
        eventType: 'cancelled',
        description: `Reservation cancelled by ${actor.name}. Inventory released.`,
      });
    });
  }

  /**
   * Get Reservation by ID with Guest, Room, and Events
   */
  static async getById(reservationId: string) {
    const res = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .limit(1);

    if (res.length === 0) return null;

    const [guestRecord] = await db
      .select()
      .from(guests)
      .where(eq(guests.id, res[0].guestId))
      .limit(1);

    const [roomTypeRecord] = await db
      .select()
      .from(roomTypes)
      .where(eq(roomTypes.id, res[0].roomTypeId))
      .limit(1);

    const events = await db
      .select()
      .from(reservationEvents)
      .where(eq(reservationEvents.reservationId, reservationId))
      .orderBy(desc(reservationEvents.createdAt));

    return {
      ...res[0],
      balanceMinorUnits: res[0].totalAmountMinorUnits - res[0].paidAmountMinorUnits,
      guest: guestRecord,
      roomType: roomTypeRecord,
      events,
    };
  }
}
