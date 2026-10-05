import { calculateNights, getDatesBetween } from '@sena/config';
import {
  apartments,
  bookingHolds,
  db,
  guests,
  idempotencyKeys,
  properties,
  reservationEvents,
  reservations,
  rooms,
  roomTypes,
} from '@sena/database';
import { ensureOpenHousekeepingTask } from '@sena/housekeeping';
import {
  releaseInventoryInTransaction,
  reserveInventoryInTransaction,
} from '@sena/inventory';
import { folioBalance, PaymentPolicyError } from '@sena/payments';
import type { Reservation, ReservationEvent } from '@sena/types';
import type { CreateReservationInput } from '@sena/validation';
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { APARTMENT_BLOCKING_STATUSES } from '@sena/inventory';
import { assertRoomEligible, listEligibleRooms, type AssignmentScope, type EligibleRoom } from './assignment';
import { categoryNightsAvailable, categorySoldOutMessage, roomUnavailableForStay } from './category-availability';

export { listEligibleRooms, listStayEligibleRooms, type EligibleRoom, type AssignmentScope } from './assignment';
import { listStayEligibleRooms } from './assignment';
import { createBookingGroup as createGroupRecords, getBookingGroup as loadBookingGroup, addAccommodationToBooking as addAccommodationRecord, type AddAccommodationInput } from './booking-group';
import { updateStay as editReservationStay, type StayEditInput } from './edit';
export { updateStay } from './edit';
export { createBookingGroup, getBookingGroup, addAccommodationToBooking, type AddAccommodationInput } from './booking-group';

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
    if (input.apartmentId && input.roomTypeId) throw new Error('Choose a room or an apartment.');
    if (input.apartmentId) return ReservationService.createForApartment(input, actor, requestKey);
    if (!input.roomTypeId) throw new Error('Choose a room or an apartment.');
    const roomTypeId = input.roomTypeId;
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
        .where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.propertyId, input.propertyId)))
        .limit(1).for('update');

      if (rt.length === 0) {
        throw new Error('Room type not found');
      }

      const standardAmountMinorUnits = rt[0].basePriceMinorUnits * nights;
      const totalAmountMinorUnits = input.customTotalAmountMinorUnits != null
        ? Math.max(0, input.customTotalAmountMinorUnits)
        : standardAmountMinorUnits;
      const discountAmountMinorUnits = Math.max(0, standardAmountMinorUnits - totalAmountMinorUnits);

      // Consume only a matching, active hold within this allocation transaction.
      const holdId = (input as any).holdId;
      if (holdId) {
        const [hold] = await tx.select().from(bookingHolds).where(eq(bookingHolds.id, holdId)).for('update');
        if (!hold || hold.propertyId !== input.propertyId || hold.roomTypeId !== roomTypeId || hold.checkInDate !== input.checkInDate || hold.checkOutDate !== input.checkOutDate || hold.status !== 'active' || hold.expiresAt <= new Date() || hold.quantity !== 1) throw new Error('Your room hold has expired. Please choose your room again.');
        await tx.update(bookingHolds).set({ status: 'converted' }).where(eq(bookingHolds.id, holdId));
      }

      let assignedRoomNumber: string | null = null;
      if (input.roomId) {
        const assignedRoom = await assertRoomEligible(
          tx,
          {
            propertyId: input.propertyId,
            roomTypeId,
            checkInDate: input.checkInDate,
            checkOutDate: input.checkOutDate,
            forCheckIn: false,
          },
          input.roomId
        );
        assignedRoomNumber = assignedRoom.roomNumber;
      }

      const category = await categoryNightsAvailable(
        tx,
        input.propertyId,
        roomTypeId,
        input.checkInDate,
        input.checkOutDate,
      );
      if (category.minAvailable < 1) {
        const detail = categorySoldOutMessage(category.blockers);
        throw new Error(assignedRoomNumber ? roomUnavailableForStay(assignedRoomNumber, detail) : detail);
      }

      // 2. Lock & Reserve Inventory for each night
      try {
        await reserveInventoryInTransaction(
          tx,
          input.propertyId,
          roomTypeId,
          stayDates,
          1
        );
      } catch (error) {
        if (error instanceof Error && /no longer available for date/i.test(error.message)) {
          const latest = await categoryNightsAvailable(tx, input.propertyId, roomTypeId, input.checkInDate, input.checkOutDate);
          const detail = categorySoldOutMessage(latest.blockers);
          throw new Error(assignedRoomNumber ? roomUnavailableForStay(assignedRoomNumber, detail) : detail);
        }
        throw error;
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

      // 4. Insert Reservation Record
      const reference = generateReference();
      const [resRecord] = await tx
        .insert(reservations)
        .values({
          reference,
          propertyId: input.propertyId,
          guestId: resolvedGuestId,
          roomTypeId,
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
          standardAmountMinorUnits,
          discountAmountMinorUnits,
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

  static async createForApartment(
    input: CreateReservationInput,
    actor = { id: '', name: 'System' },
    requestKey?: string,
  ): Promise<Reservation> {
    const apartmentId = input.apartmentId;
    if (!apartmentId) throw new Error('Choose an apartment.');
    if (input.roomId) throw new Error('Apartments do not use a room number.');
    const nights = calculateNights(input.checkInDate, input.checkOutDate);

    return db.transaction(async (tx) => {
      const key = requestKey ? `reservation:${input.propertyId}:${requestKey}` : undefined;
      if (key) {
        if (key.length > 255) throw new Error('Invalid request reference.');
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
        const previous = await tx.query.idempotencyKeys.findFirst({ where: eq(idempotencyKeys.key, key) });
        if (previous) return previous.responsePayload as unknown as Reservation;
      }

      const [apartment] = await tx
        .select()
        .from(apartments)
        .where(and(eq(apartments.id, apartmentId), eq(apartments.propertyId, input.propertyId)))
        .limit(1)
        .for('update');
      if (!apartment) throw new Error('Apartment not found');
      if (apartment.archivedAt) throw new Error('This apartment is archived and cannot take new reservations.');
      if (apartment.operationalStatus === 'blocked' || apartment.operationalStatus === 'maintenance') {
        throw new Error('This apartment is out of service.');
      }
      if (input.numGuests > apartment.maxGuests) throw new Error('This apartment cannot take that many guests.');
      if (input.source === 'direct' && !apartment.bookingVisibility) {
        throw new Error('This apartment is not available for online booking.');
      }

      const holdId = (input as { holdId?: string }).holdId;
      if (holdId) {
        const [hold] = await tx.select().from(bookingHolds).where(eq(bookingHolds.id, holdId)).for('update');
        if (
          !hold ||
          hold.propertyId !== input.propertyId ||
          hold.apartmentId !== apartmentId ||
          hold.checkInDate !== input.checkInDate ||
          hold.checkOutDate !== input.checkOutDate ||
          hold.status !== 'active' ||
          hold.expiresAt <= new Date() ||
          hold.quantity !== 1
        ) {
          throw new Error('Your apartment hold has expired. Please choose your dates again.');
        }
        await tx.update(bookingHolds).set({ status: 'converted' }).where(eq(bookingHolds.id, holdId));
      }

      const blocking = await tx
        .select({ id: reservations.id })
        .from(reservations)
        .where(
          and(
            eq(reservations.propertyId, input.propertyId),
            eq(reservations.apartmentId, apartmentId),
            inArray(reservations.status, [...APARTMENT_BLOCKING_STATUSES]),
            sql`${reservations.checkInDate} < ${input.checkOutDate}`,
            sql`${reservations.checkOutDate} > ${input.checkInDate}`
          )
        )
        .for('update');
      if (blocking.length > 0) throw new Error('This apartment is already booked for those dates.');

      const otherHolds = await tx
        .select({ id: bookingHolds.id, checkInDate: bookingHolds.checkInDate, checkOutDate: bookingHolds.checkOutDate })
        .from(bookingHolds)
        .where(
          and(
            eq(bookingHolds.propertyId, input.propertyId),
            eq(bookingHolds.apartmentId, apartmentId),
            eq(bookingHolds.status, 'active'),
            gt(bookingHolds.expiresAt, new Date())
          )
        );
      if (otherHolds.some((hold) => hold.id !== holdId && hold.checkInDate < input.checkOutDate && hold.checkOutDate > input.checkInDate)) {
        throw new Error('This apartment is already booked for those dates.');
      }

      let resolvedGuestId = input.guestId;
      if (!resolvedGuestId && input.guest) {
        const existing = input.guest.email
          ? await tx.select().from(guests).where(and(eq(guests.propertyId, input.propertyId), eq(guests.email, input.guest.email))).limit(1)
          : [];
        if (existing.length > 0) {
          resolvedGuestId = existing[0].id;
        } else {
          const propList = await tx.select({ organizationId: properties.organizationId }).from(properties).where(eq(properties.id, input.propertyId)).limit(1);
          const organizationId = propList[0]?.organizationId;
          if (!organizationId) throw new Error('Property has no parent organization');
          const inserted = await tx.insert(guests).values({
            organizationId,
            propertyId: input.propertyId,
            fullName: input.guest.fullName,
            email: input.guest.email,
            phone: input.guest.phone,
            identificationType: input.guest.identificationType,
            identificationNumber: input.guest.identificationNumber,
            preferences: input.guest.preferences || [],
            notes: input.guest.notes,
          }).returning();
          resolvedGuestId = inserted[0].id;
        }
      }
      if (!resolvedGuestId) throw new Error('Could not resolve or create guest profile');
      const linkedGuest = await tx.query.guests.findFirst({ where: and(eq(guests.id, resolvedGuestId), eq(guests.propertyId, input.propertyId)) });
      if (!linkedGuest) throw new Error('Guest not found in this property.');

      const reference = generateReference();
      const standardAmountMinorUnits = apartment.basePriceMinorUnits * nights;
      const totalAmountMinorUnits = input.customTotalAmountMinorUnits != null
        ? Math.max(0, input.customTotalAmountMinorUnits)
        : standardAmountMinorUnits;
      const discountAmountMinorUnits = Math.max(0, standardAmountMinorUnits - totalAmountMinorUnits);
      const [resRecord] = await tx.insert(reservations).values({
        reference,
        propertyId: input.propertyId,
        guestId: resolvedGuestId,
        roomTypeId: null,
        apartmentId,
        roomId: null,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        nights,
        numGuests: input.numGuests,
        adults: input.adults,
        children: input.children,
        source: input.source,
        status: 'confirmed',
        paymentStatus: input.paymentStatus,
        standardAmountMinorUnits,
        discountAmountMinorUnits,
        totalAmountMinorUnits,
        paidAmountMinorUnits: input.paidAmountMinorUnits,
        specialRequests: input.specialRequests,
      }).returning();

      await tx.insert(reservationEvents).values({
        reservationId: resRecord.id,
        actorId: actor.id || undefined,
        actorName: actor.name,
        eventType: 'reservation_created',
        description: `Reservation ${reference} created for ${nights} nights (${apartment.name}).`,
      });

      const result = {
        ...resRecord,
        balanceMinorUnits: resRecord.totalAmountMinorUnits - resRecord.paidAmountMinorUnits,
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
    roomId?: string | null,
    actor = { id: '', name: 'Receptionist' },
    options?: { allowOutstandingBalance?: boolean }
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

      if (res.apartmentId) {
        if (res.status === 'checked_in') return;
        if (res.status !== 'confirmed') throw new Error('Only confirmed reservations can be checked in.');
        const [apartment] = await tx.select().from(apartments).where(and(eq(apartments.id, res.apartmentId), eq(apartments.propertyId, res.propertyId))).limit(1).for('update');
        if (!apartment) throw new Error('Apartment not found');
        const property = await tx.query.properties.findFirst({ where: eq(properties.id, res.propertyId) });
        const policy = property?.checkInPaymentPolicy || 'allow_outstanding';
        const balance = folioBalance(res.totalAmountMinorUnits, res.paidAmountMinorUnits);
        if (balance > 0) {
          if (policy === 'require_full') throw new PaymentPolicyError('PAYMENT_REQUIRED_BEFORE_CHECK_IN', balance);
          if (!options?.allowOutstandingBalance) throw new PaymentPolicyError('OUTSTANDING_BALANCE_AUTHORIZATION_REQUIRED', balance);
        }
        await tx.update(reservations).set({ status: 'checked_in', updatedAt: new Date() }).where(eq(reservations.id, reservationId));
        await tx.update(apartments).set({ operationalStatus: 'occupied', updatedAt: new Date() }).where(eq(apartments.id, apartment.id));
        await tx.insert(reservationEvents).values({
          reservationId,
          actorId: actor.id || undefined,
          actorName: actor.name,
          eventType: balance > 0 ? 'checked_in_outstanding' : 'checked_in',
          description: balance > 0
            ? `Checked in by ${actor.name} with outstanding balance of ₦${(balance / 100).toLocaleString('en-NG')}. Apartment: ${apartment.name}.`
            : `Checked in by ${actor.name}. Apartment: ${apartment.name}.`,
        });
        return;
      }

      if (!roomId) throw new Error('ROOM_ASSIGNMENT_REQUIRED');
      if (res.status === 'checked_in' && res.roomId === roomId) return;
      if (res.status !== 'confirmed') throw new Error('Only confirmed reservations can be checked in.');
      if (!res.roomTypeId) throw new Error('ROOM_ASSIGNMENT_REQUIRED');

      const assignedRoom = await assertRoomEligible(
        tx,
        {
          propertyId: res.propertyId,
          roomTypeId: res.roomTypeId,
          checkInDate: res.checkInDate,
          checkOutDate: res.checkOutDate,
          excludeReservationId: reservationId,
          forCheckIn: true,
        },
        roomId
      );

      const property = await tx.query.properties.findFirst({ where: eq(properties.id, res.propertyId) });
      const policy = property?.checkInPaymentPolicy || 'allow_outstanding';
      const balance = folioBalance(res.totalAmountMinorUnits, res.paidAmountMinorUnits);
      if (balance > 0) {
        if (policy === 'require_full') {
          throw new PaymentPolicyError('PAYMENT_REQUIRED_BEFORE_CHECK_IN', balance);
        }
        if (!options?.allowOutstandingBalance) {
          throw new PaymentPolicyError('OUTSTANDING_BALANCE_AUTHORIZATION_REQUIRED', balance);
        }
      }

      await tx
        .update(reservations)
        .set({
          status: 'checked_in',
          roomId,
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, reservationId));

      await tx
        .update(rooms)
        .set({
          operationalStatus: 'occupied',
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, roomId));

      await tx.insert(reservationEvents).values({
        reservationId,
        actorId: actor.id || undefined,
        actorName: actor.name,
        eventType: balance > 0 ? 'checked_in_outstanding' : 'checked_in',
        description:
          balance > 0
            ? `Checked in by ${actor.name} with outstanding balance of ₦${(balance / 100).toLocaleString('en-NG')}. Room assigned: ${assignedRoom.roomNumber}.`
            : `Checked in by ${actor.name}. Room assigned: ${assignedRoom.roomNumber}.`,
      });
    });
  }

  /**
   * Assign or change a physical room on a confirmed reservation without checking in.
   */
  static async assignRoom(
    reservationId: string,
    roomId: string,
    actor = { id: '', name: 'Receptionist' }
  ): Promise<{ roomId: string; roomNumber: string }> {
    if (!roomId) throw new Error('ROOM_ASSIGNMENT_REQUIRED');

    return await db.transaction(async (tx) => {
      const resList = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId))
        .limit(1)
        .for('update');

      if (resList.length === 0) {
        throw new Error('Reservation not found');
      }

      const res = resList[0];
      if (res.apartmentId) throw new Error('This stay is an apartment and does not use a room number.');
      if (res.status !== 'confirmed') {
        throw new Error('Only confirmed reservations can have their room assignment changed.');
      }
      if (!res.roomTypeId) throw new Error('ROOM_ASSIGNMENT_REQUIRED');

      const assignedRoom = await assertRoomEligible(
        tx,
        {
          propertyId: res.propertyId,
          roomTypeId: res.roomTypeId,
          checkInDate: res.checkInDate,
          checkOutDate: res.checkOutDate,
          excludeReservationId: reservationId,
          forCheckIn: false,
        },
        roomId
      );

      const previousRoomId = res.roomId;
      await tx
        .update(reservations)
        .set({
          roomId,
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, reservationId));

      const changed = previousRoomId && previousRoomId !== roomId;
      await tx.insert(reservationEvents).values({
        reservationId,
        actorId: actor.id || undefined,
        actorName: actor.name,
        eventType: changed ? 'room_changed' : 'room_assigned',
        description: changed
          ? `Room changed to ${assignedRoom.roomNumber} by ${actor.name}.`
          : `Room ${assignedRoom.roomNumber} assigned by ${actor.name}.`,
      });

      return { roomId: assignedRoom.id, roomNumber: assignedRoom.roomNumber };
    });
  }

  static async eligibleRooms(scope: AssignmentScope): Promise<EligibleRoom[]> {
    return listEligibleRooms(scope);
  }

  static async stayEligibleRooms(propertyId: string, checkInDate: string, checkOutDate: string, excludeReservationId?: string | null) {
    return listStayEligibleRooms(propertyId, checkInDate, checkOutDate, excludeReservationId);
  }

  static async updateStay(
    reservationId: string,
    propertyId: string,
    input: StayEditInput,
    actor?: { id: string; name: string },
    preview = false,
  ) {
    return editReservationStay(reservationId, propertyId, input, actor, preview);
  }

  static async createGroup(
    input: Parameters<typeof createGroupRecords>[0],
    actor?: { id: string; name: string },
    requestKey?: string,
  ) {
    return createGroupRecords(input, actor, requestKey);
  }

  static async bookingGroup(propertyId: string, bookingGroupId: string) {
    return loadBookingGroup(propertyId, bookingGroupId);
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
      const balance = folioBalance(res.totalAmountMinorUnits, res.paidAmountMinorUnits);
      if (res.status === 'checked_out') return { outstandingBalanceMinorUnits: balance };
      if (res.status !== 'checked_in') throw new Error('Only checked-in stays can be checked out.');

      const property = await tx.query.properties.findFirst({ where: eq(properties.id, res.propertyId) });
      const policy = property?.checkOutPaymentPolicy || 'allow_outstanding';
      if (balance > 0 && policy === 'require_settlement') {
        throw new PaymentPolicyError('SETTLEMENT_REQUIRED_BEFORE_CHECKOUT', balance);
      }

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
        await ensureOpenHousekeepingTask(tx, {
          propertyId: res.propertyId,
          roomId: res.roomId,
          notes: `Guest checked out from reservation ${res.reference}`,
        });
      }

      if (res.apartmentId) {
        await tx
          .update(apartments)
          .set({ operationalStatus: 'available', housekeepingStatus: 'dirty', updatedAt: new Date() })
          .where(and(eq(apartments.id, res.apartmentId), eq(apartments.propertyId, res.propertyId)));
        await ensureOpenHousekeepingTask(tx, {
          propertyId: res.propertyId,
          apartmentId: res.apartmentId,
          notes: `Guest checked out from reservation ${res.reference}`,
        });
      }

      // Record timeline
      await tx.insert(reservationEvents).values({
        reservationId,
        actorId: actor.id || undefined,
        actorName: actor.name,
        eventType: balance > 0 ? 'checked_out_outstanding' : 'checked_out',
        description: `Checked out by ${actor.name}.${balance > 0 ? ` Outstanding receivable: ₦${(balance / 100).toLocaleString('en-NG')}.` : ''}`,
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

      if (res.roomTypeId) {
        await releaseInventoryInTransaction(
          tx,
          res.propertyId,
          res.roomTypeId,
          stayDates,
          1
        );
      }

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

    const roomTypeRecord = res[0].roomTypeId
      ? (await db.select().from(roomTypes).where(eq(roomTypes.id, res[0].roomTypeId)).limit(1))[0]
      : null;
    const apartmentRecord = res[0].apartmentId
      ? (await db.select().from(apartments).where(eq(apartments.id, res[0].apartmentId)).limit(1))[0]
      : null;

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
      apartment: apartmentRecord,
      events,
    };
  }

  static async addAccommodation(
    input: AddAccommodationInput,
    actor = { id: '', name: 'Hotel Staff' }
  ) {
    return addAccommodationRecord(input, actor);
  }
}
