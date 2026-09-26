import { calculateNights, getDatesBetween } from '@sena/config';
import {
  activityLogs,
  bookingHolds,
  db,
  guests,
  housekeepingTasks,
  idempotencyKeys,
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
import { and, desc, eq, sql } from 'drizzle-orm';

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
    actor = { id: '', name: 'System' },
    requestKey?: string,
  ): Promise<Reservation> {
    if ((input.paidAmountMinorUnits || 0) !== 0 || (input.paymentStatus && input.paymentStatus !== 'pay_later')) throw new Error('Record the payment after creating the reservation.');
    if (!Number.isInteger(input.numGuests) || input.numGuests < 1) throw new Error('Enter the number of guests.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.checkOutDate) || input.checkOutDate <= input.checkInDate || !Number.isFinite(Date.parse(input.checkInDate)) || !Number.isFinite(Date.parse(input.checkOutDate))) throw new Error('Check-out must be after check-in.');
    const nights = calculateNights(input.checkInDate, input.checkOutDate);
    const stayDates = getDatesBetween(input.checkInDate, input.checkOutDate);

    return await db.transaction(async (tx) => {
      const key = requestKey ? `reservation:${input.propertyId}:${requestKey}` : undefined;
      if (key) {
        if (key.length > 255) throw new Error('Invalid request reference.');
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
        const previous = await tx.query.idempotencyKeys.findFirst({ where: eq(idempotencyKeys.key, key) });
        if (previous) return previous.responsePayload as unknown as Reservation;
      }
      // 1. Fetch Room Type and compute pricing
      const rt = await tx
        .select()
        .from(roomTypes)
        .where(and(eq(roomTypes.id, input.roomTypeId), eq(roomTypes.propertyId, input.propertyId)))
        .limit(1).for('update');

      if (rt.length === 0) {
        throw new Error('Room type not found');
      }

      const totalAmountMinorUnits = rt[0].basePriceMinorUnits * nights;

      // Consume only a matching, active hold within this allocation transaction.
      const holdId = (input as any).holdId;
      if (holdId) {
        const [hold] = await tx.select().from(bookingHolds).where(eq(bookingHolds.id, holdId)).for('update');
        if (!hold || hold.propertyId !== input.propertyId || hold.roomTypeId !== input.roomTypeId || hold.checkInDate !== input.checkInDate || hold.checkOutDate !== input.checkOutDate || hold.status !== 'active' || hold.expiresAt <= new Date() || hold.quantity !== 1) throw new Error('Your room hold has expired. Please choose your room again.');
        await tx.update(bookingHolds).set({ status: 'converted' }).where(eq(bookingHolds.id, holdId));
      }

      // 2. Lock & Reserve Inventory for each night
      await reserveInventoryInTransaction(
        tx,
        input.propertyId,
        input.roomTypeId,
        stayDates,
        1
      );

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

        if (input.guest.email && existing.length > 0) {
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

      const linkedGuest = await tx.query.guests.findFirst({ where: and(eq(guests.id, resolvedGuestId), eq(guests.propertyId, input.propertyId)) });
      if (!linkedGuest) throw new Error('Guest not found in this property.');
      if (input.roomId) {
        const assignedRoom = await tx.query.rooms.findFirst({ where: and(eq(rooms.id, input.roomId), eq(rooms.propertyId, input.propertyId), eq(rooms.roomTypeId, input.roomTypeId)) });
        if (!assignedRoom) throw new Error('Choose a room in this room type.');
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

      const result = {
        ...resRecord,
        balanceMinorUnits:
          resRecord.totalAmountMinorUnits - resRecord.paidAmountMinorUnits,
      } as unknown as Reservation;
      if (key) await tx.insert(idempotencyKeys).values({ key, action: 'create_reservation', responsePayload: result as any, expiresAt: new Date(Date.now() + 86400000) });
      return result;
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
        .limit(1).for('update');

      if (resList.length === 0) {
        throw new Error('Reservation not found');
      }

      const res = resList[0];

      if (res.status === 'checked_in' && res.roomId === roomId) return;
      if (res.status !== 'confirmed') throw new Error('Only confirmed reservations can be checked in.');
      const [assignedRoom] = await tx.select().from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.propertyId, res.propertyId), eq(rooms.roomTypeId, res.roomTypeId))).for('update');
      if (!assignedRoom || assignedRoom.operationalStatus !== 'available' || !['clean', 'inspected'].includes(assignedRoom.housekeepingStatus)) throw new Error('Choose an available, clean room of the booked room type.');

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
        .limit(1).for('update');

      if (resList.length === 0) {
        throw new Error('Reservation not found');
      }

      const res = resList[0];
      const balance = res.totalAmountMinorUnits - res.paidAmountMinorUnits;
      if (res.status === 'checked_out') return { outstandingBalanceMinorUnits: balance };
      if (res.status !== 'checked_in') throw new Error('Only checked-in stays can be checked out.');

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
        .limit(1).for('update');

      if (resList.length === 0) {
        throw new Error('Reservation not found');
      }

      const res = resList[0];
      if (res.status === 'cancelled') return;
      if (res.status === 'checked_in' || res.status === 'checked_out') throw new Error('This stay cannot be cancelled.');

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
