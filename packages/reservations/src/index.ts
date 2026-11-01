import { calculateNights, getDatesBetween } from '@sena/config';
import {
  activityLogs,
  apartments,
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
  users,
} from '@sena/database';
import { ensureOpenHousekeepingTask } from '@sena/housekeeping';
import {
  releaseInventoryInTransaction,
  reserveInventoryInTransaction,
} from '@sena/inventory';
import { folioBalance, PaymentPolicyError } from '@sena/payments';
import type { Reservation, ReservationEvent } from '@sena/types';
import type { CreateReservationInput } from '@sena/validation';
import { and, desc, eq, gt, inArray, ne, notInArray, sql } from 'drizzle-orm';
import { APARTMENT_BLOCKING_STATUSES } from '@sena/inventory';
import { assertRoomEligible, listEligibleRooms, type AssignmentScope, type EligibleRoom } from './assignment';
import { categoryNightsAvailable, categorySoldOutMessage, roomUnavailableForStay } from './category-availability';

export { listEligibleRooms, listStayEligibleRooms, type EligibleRoom, type AssignmentScope } from './assignment';
import { listStayEligibleRooms } from './assignment';
import { createBookingGroup as createGroupRecords, getBookingGroup as loadBookingGroup, addAccommodationToBooking as addAccommodationRecord, type AddAccommodationInput } from './booking-group';
import { updateStay as editReservationStay, type StayEditInput } from './edit';
export { updateStay } from './edit';
export { createBookingGroup, getBookingGroup, addAccommodationToBooking, type AddAccommodationInput } from './booking-group';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function sanitizeActorId(id?: string | null): string | undefined {
  return id && UUID_REGEX.test(id) ? id : undefined;
}

function generateReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SEN-${code}`;
}

async function resolveOrCreateGuest(
  tx: any,
  propertyId: string,
  guestId?: string,
  guest?: {
    fullName: string;
    email?: string;
    phone?: string;
    identificationType?: any;
    identificationNumber?: string;
    preferences?: string[];
    notes?: string;
  }
): Promise<string> {
  if (guestId) {
    const existing = await tx.query.guests.findFirst({
      where: and(eq(guests.id, guestId), eq(guests.propertyId, propertyId)),
    });
    if (!existing) throw new Error('Guest not found in this property.');
    return existing.id;
  }

  if (!guest || !guest.fullName?.trim()) {
    throw new Error('Enter the guest full name.');
  }

  const cleanEmail = guest.email?.trim().toLowerCase() || undefined;
  const cleanPhone = guest.phone?.trim() || undefined;

  let existing: any[] = [];
  if (cleanEmail) {
    existing = await tx
      .select()
      .from(guests)
      .where(and(eq(guests.propertyId, propertyId), eq(guests.email, cleanEmail)))
      .limit(1);
  }
  if (existing.length === 0 && cleanPhone) {
    existing = await tx
      .select()
      .from(guests)
      .where(and(eq(guests.propertyId, propertyId), eq(guests.phone, cleanPhone)))
      .limit(1);
  }

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [prop] = await tx
    .select({ organizationId: properties.organizationId })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (!prop?.organizationId) {
    throw new Error(`Property ${propertyId} has no parent organization.`);
  }

  const fallbackEmail = cleanEmail || `${cleanPhone ? cleanPhone.replace(/[^\d+]/g, '') : crypto.randomUUID().slice(0, 8)}@guest.sena.ng`;
  const fallbackPhone = cleanPhone || '+2340000000000';

  const inserted = await tx
    .insert(guests)
    .values({
      organizationId: prop.organizationId,
      propertyId,
      fullName: guest.fullName.trim(),
      email: fallbackEmail,
      phone: fallbackPhone,
      identificationType: guest.identificationType,
      identificationNumber: guest.identificationNumber,
      preferences: guest.preferences || [],
      notes: guest.notes,
    })
    .returning();

  return inserted[0].id;
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
      const resolvedGuestId = await resolveOrCreateGuest(
        tx,
        input.propertyId,
        input.guestId,
        input.guest
      );

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
        actorId: sanitizeActorId(actor.id),
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

      const resolvedGuestId = await resolveOrCreateGuest(
        tx,
        input.propertyId,
        input.guestId,
        input.guest
      );

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
        actorId: sanitizeActorId(actor.id),
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

      let balance = folioBalance(res.totalAmountMinorUnits, res.paidAmountMinorUnits);
      if (res.bookingGroupId) {
        const groupStays = await tx
          .select({
            totalAmountMinorUnits: reservations.totalAmountMinorUnits,
            paidAmountMinorUnits: reservations.paidAmountMinorUnits,
          })
          .from(reservations)
          .where(
            and(
              eq(reservations.bookingGroupId, res.bookingGroupId),
              ne(reservations.status, 'cancelled'),
              ne(reservations.status, 'voided')
            )
          );
        if (groupStays.length > 0) {
          const groupTotal = groupStays.reduce((sum, s) => sum + s.totalAmountMinorUnits, 0);
          const groupPaid = groupStays.reduce((sum, s) => sum + s.paidAmountMinorUnits, 0);
          const groupBalance = folioBalance(groupTotal, groupPaid);
          balance = groupBalance;
        }
      }

      if (res.apartmentId) {
        if (res.status === 'checked_in') return;
        if (res.status !== 'confirmed') throw new Error('Only confirmed reservations can be checked in.');
        const [apartment] = await tx.select().from(apartments).where(and(eq(apartments.id, res.apartmentId), eq(apartments.propertyId, res.propertyId))).limit(1).for('update');
        if (!apartment) throw new Error('Apartment not found');
        if (apartment.operationalStatus === 'maintenance' || apartment.operationalStatus === 'blocked') {
          throw new Error(`Apartment ${apartment.name} is currently out of service (${apartment.operationalStatus}).`);
        }
        const [conflictingStay] = await tx
          .select({ id: reservations.id, reference: reservations.reference })
          .from(reservations)
          .where(
            and(
              eq(reservations.apartmentId, res.apartmentId),
              eq(reservations.status, 'checked_in'),
              ne(reservations.id, reservationId)
            )
          )
          .limit(1);
        if (conflictingStay) {
          throw new Error(`Apartment ${apartment.name} is already occupied by active reservation ${conflictingStay.reference}.`);
        }
        const property = await tx.query.properties.findFirst({ where: eq(properties.id, res.propertyId) });
        const policy = property?.checkInPaymentPolicy || 'allow_outstanding';
        if (balance > 0) {
          if (policy === 'require_full') throw new PaymentPolicyError('PAYMENT_REQUIRED_BEFORE_CHECK_IN', balance);
          if (!options?.allowOutstandingBalance) throw new PaymentPolicyError('OUTSTANDING_BALANCE_AUTHORIZATION_REQUIRED', balance);
        }
        const now = new Date();
        await tx.update(reservations).set({ status: 'checked_in', actualCheckInAt: now, updatedAt: now }).where(eq(reservations.id, reservationId));
        await tx.update(apartments).set({ operationalStatus: 'occupied', updatedAt: now }).where(eq(apartments.id, apartment.id));
        await tx.insert(reservationEvents).values({
          reservationId,
          actorId: sanitizeActorId(actor.id),
          actorName: actor.name,
          eventType: balance > 0 ? 'checked_in_outstanding' : 'checked_in',
          description: balance > 0
            ? `Checked in by ${actor.name} with outstanding balance of ₦${(balance / 100).toLocaleString('en-NG')}. Apartment: ${apartment.name}.`
            : `Checked in by ${actor.name}. Apartment: ${apartment.name}.`,
        });
        return;
      }

      const targetRoomId = (roomId ?? res.roomId) || null;
      if (!targetRoomId) throw new Error('ROOM_ASSIGNMENT_REQUIRED');
      if (res.status === 'checked_in' && res.roomId === targetRoomId) return;
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
        targetRoomId
      );

      const property = await tx.query.properties.findFirst({ where: eq(properties.id, res.propertyId) });
      const policy = property?.checkInPaymentPolicy || 'allow_outstanding';
      if (balance > 0) {
        if (policy === 'require_full') {
          throw new PaymentPolicyError('PAYMENT_REQUIRED_BEFORE_CHECK_IN', balance);
        }
        if (!options?.allowOutstandingBalance) {
          throw new PaymentPolicyError('OUTSTANDING_BALANCE_AUTHORIZATION_REQUIRED', balance);
        }
      }

      const now = new Date();
      await tx
        .update(reservations)
        .set({
          status: 'checked_in',
          roomId: targetRoomId,
          actualCheckInAt: now,
          updatedAt: now,
        })
        .where(eq(reservations.id, reservationId));

      await tx
        .update(rooms)
        .set({
          operationalStatus: 'occupied',
          updatedAt: now,
        })
        .where(eq(rooms.id, targetRoomId));

      await tx.insert(reservationEvents).values({
        reservationId,
        actorId: sanitizeActorId(actor.id),
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
   * Assign or change a physical room on a confirmed or checked-in reservation.
   * If the reservation is checked in:
   * - Validates target room is clean, ready and unoccupied.
   * - Atomically marks new room occupied and assigns it to reservation.
   * - Marks previous room as dirty and creates a housekeeping task.
   * - Logs full audit trail with staff, timestamp, and optional reason.
   */
  static async assignRoom(
    reservationId: string,
    roomId: string,
    actor = { id: '', name: 'Receptionist' },
    reason?: string
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
      if (res.status !== 'confirmed' && res.status !== 'checked_in') {
        throw new Error('Only confirmed or checked-in reservations can have their room assignment changed.');
      }

      // Handle apartment stay moves
      if (res.apartmentId) {
        const [targetApt] = await tx
          .select()
          .from(apartments)
          .where(and(eq(apartments.id, roomId), eq(apartments.propertyId, res.propertyId)))
          .limit(1)
          .for('update');

        if (!targetApt) {
          throw new Error('This stay is an apartment and does not use a room number.');
        }

        if (targetApt.operationalStatus === 'maintenance' || targetApt.operationalStatus === 'blocked') {
          throw new Error(`Apartment ${targetApt.name} is currently out of service (${targetApt.operationalStatus}).`);
        }

        const [prevApt] = await tx
          .select()
          .from(apartments)
          .where(eq(apartments.id, res.apartmentId))
          .limit(1)
          .for('update');

        const now = new Date();
        if (res.status === 'checked_in') {
          const [conflictingStay] = await tx
            .select({ id: reservations.id, reference: reservations.reference })
            .from(reservations)
            .where(
              and(
                eq(reservations.apartmentId, targetApt.id),
                eq(reservations.status, 'checked_in'),
                ne(reservations.id, reservationId)
              )
            )
            .limit(1);

          if (conflictingStay) {
            throw new Error(`Apartment ${targetApt.name} is already occupied by active reservation ${conflictingStay.reference}.`);
          }

          await tx
            .update(apartments)
            .set({ operationalStatus: 'occupied', updatedAt: now })
            .where(eq(apartments.id, targetApt.id));

          if (res.apartmentId !== targetApt.id) {
            await tx
              .update(apartments)
              .set({ operationalStatus: 'available', housekeepingStatus: 'dirty', updatedAt: now })
              .where(eq(apartments.id, res.apartmentId));

            await ensureOpenHousekeepingTask(tx, {
              propertyId: res.propertyId,
              apartmentId: res.apartmentId,
              notes: `Guest moved to Apartment ${targetApt.name} from reservation ${res.reference}`,
            });
          }
        }

        await tx
          .update(reservations)
          .set({ apartmentId: targetApt.id, updatedAt: now })
          .where(eq(reservations.id, reservationId));

        const aptDescription = `Stay moved from ${prevApt?.name || 'apartment'} to ${targetApt.name} by ${actor.name}.${reason ? ` Reason: ${reason}` : ''}`;
        await tx.insert(reservationEvents).values({
          reservationId,
          actorId: sanitizeActorId(actor.id),
          actorName: actor.name,
          eventType: 'room_changed',
          description: aptDescription,
          metadata: {
            previousApartmentId: res.apartmentId,
            newApartmentId: targetApt.id,
            status: res.status,
            reason: reason || null,
          },
        });

        return { roomId: targetApt.id, roomNumber: targetApt.name };
      }

      if (!res.roomTypeId) throw new Error('ROOM_ASSIGNMENT_REQUIRED');

      const isCheckedIn = res.status === 'checked_in';
      const assignedRoom = await assertRoomEligible(
        tx,
        {
          propertyId: res.propertyId,
          roomTypeId: res.roomTypeId,
          checkInDate: res.checkInDate,
          checkOutDate: res.checkOutDate,
          excludeReservationId: reservationId,
          forCheckIn: isCheckedIn,
        },
        roomId
      );

      const previousRoomId = res.roomId;
      const changed = Boolean(previousRoomId && previousRoomId !== roomId);
      let previousRoomNumber: string | null = null;
      if (previousRoomId) {
        const [prev] = await tx
          .select({ roomNumber: rooms.roomNumber })
          .from(rooms)
          .where(eq(rooms.id, previousRoomId))
          .limit(1);
        previousRoomNumber = prev?.roomNumber || null;
      }

      const now = new Date();

      if (isCheckedIn) {
        // Mark new room as occupied
        await tx
          .update(rooms)
          .set({
            operationalStatus: 'occupied',
            updatedAt: now,
          })
          .where(eq(rooms.id, roomId));

        // Release previous room as dirty and schedule housekeeping task
        if (changed && previousRoomId) {
          await tx
            .update(rooms)
            .set({
              operationalStatus: 'available',
              housekeepingStatus: 'dirty',
              updatedAt: now,
            })
            .where(eq(rooms.id, previousRoomId));

          await ensureOpenHousekeepingTask(tx, {
            propertyId: res.propertyId,
            roomId: previousRoomId,
            notes: `Guest moved to Room ${assignedRoom.roomNumber} from reservation ${res.reference}`,
          });
        }
      }

      // Update reservation
      await tx
        .update(reservations)
        .set({
          roomId,
          updatedAt: now,
        })
        .where(eq(reservations.id, reservationId));

      let description = '';
      if (changed) {
        if (isCheckedIn) {
          description = `In-house guest moved from Room ${previousRoomNumber || 'unassigned'} to Room ${assignedRoom.roomNumber} by ${actor.name}.${reason ? ` Reason: ${reason}` : ''}`;
        } else {
          description = `Room changed from ${previousRoomNumber || 'unassigned'} to ${assignedRoom.roomNumber} by ${actor.name}.${reason ? ` Reason: ${reason}` : ''}`;
        }
      } else {
        description = `Room ${assignedRoom.roomNumber} assigned by ${actor.name}.`;
      }

      await tx.insert(reservationEvents).values({
        reservationId,
        actorId: sanitizeActorId(actor.id),
        actorName: actor.name,
        eventType: changed ? 'room_changed' : 'room_assigned',
        description,
        metadata: {
          previousRoomId: previousRoomId || null,
          previousRoomNumber,
          newRoomId: roomId,
          newRoomNumber: assignedRoom.roomNumber,
          status: res.status,
          reason: reason || null,
          actorName: actor.name,
          timestamp: now.toISOString(),
        },
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
    force = false,
    options?: { checkoutTimestamp?: string | Date }
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

      const now = new Date();
      if (res.actualCheckInAt && now < res.actualCheckInAt) {
        throw new Error('Check-out timestamp cannot be earlier than check-in time.');
      }
      if (options?.checkoutTimestamp && new Date(options.checkoutTimestamp) > now) {
        throw new Error('Future-dated check-out is not permitted. Check-out must occur at the current operational time.');
      }

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
          actualCheckOutAt: now,
          updatedAt: now,
        })
        .where(eq(reservations.id, reservationId));

      // If room was assigned, transition room & trigger housekeeping
      if (res.roomId) {
        await tx
          .update(rooms)
          .set({
            operationalStatus: 'available',
            housekeepingStatus: 'dirty',
            updatedAt: now,
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
          .set({ operationalStatus: 'available', housekeepingStatus: 'dirty', updatedAt: now })
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
        actorId: sanitizeActorId(actor.id),
        actorName: actor.name,
        eventType: balance > 0 ? 'checked_out_outstanding' : 'checked_out',
        description: `Checked out by ${actor.name}.${balance > 0 ? ` Outstanding receivable: ₦${(balance / 100).toLocaleString('en-NG')}.` : ''}`,
      });

      return { outstandingBalanceMinorUnits: balance };
    });
  }

  /**
   * Reverse an erroneous check-out (Master Administrator operation).
   * Restores status to checked_in, returns room/apartment to occupied,
   * handles housekeeping task cleanup, checks for room conflicts,
   * records timeline event and immutable activityLog entry.
   */
  static async reverseCheckOut(
    reservationId: string,
    actor: { id?: string; name: string; role?: string },
    reason: string,
    options?: { targetRoomId?: string }
  ): Promise<void> {
    if (!reason || reason.trim().length < 5) {
      throw new Error('A detailed operational reason (at least 5 characters) is required to reverse check-out.');
    }

    await db.transaction(async (tx) => {
      const [res] = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId))
        .limit(1)
        .for('update');

      if (!res) throw new Error('Reservation not found');
      if (res.status !== 'checked_out') {
        throw new Error('Only checked-out reservations can have their check-out reversed.');
      }

      const property = await tx.query.properties.findFirst({
        where: eq(properties.id, res.propertyId),
      });
      if (!property) throw new Error('Property not found');

      const now = new Date();

      if (res.apartmentId) {
        const [apartment] = await tx
          .select()
          .from(apartments)
          .where(and(eq(apartments.id, res.apartmentId), eq(apartments.propertyId, res.propertyId)))
          .limit(1)
          .for('update');

        if (!apartment) throw new Error('Apartment not found');

        // Check if another reservation is currently checked_in in this apartment
        const [conflict] = await tx
          .select({ id: reservations.id, reference: reservations.reference })
          .from(reservations)
          .where(
            and(
              eq(reservations.apartmentId, res.apartmentId),
              eq(reservations.status, 'checked_in'),
              ne(reservations.id, reservationId)
            )
          )
          .limit(1);

        if (conflict) {
          const err: any = new Error(
            `Cannot reverse check-out: Apartment ${apartment.name} is currently occupied by active reservation ${conflict.reference}.`
          );
          err.code = 'APARTMENT_OCCUPIED_CONFLICT';
          err.conflictingReservationId = conflict.id;
          err.conflictingReference = conflict.reference;
          throw err;
        }

        if (apartment.operationalStatus === 'maintenance' || apartment.operationalStatus === 'blocked') {
          throw new Error(`Cannot reverse check-out: Apartment ${apartment.name} is currently out of service (${apartment.operationalStatus}).`);
        }

        await tx
          .update(reservations)
          .set({
            status: 'checked_in',
            actualCheckOutAt: null,
            updatedAt: now,
          })
          .where(eq(reservations.id, reservationId));

        await tx
          .update(apartments)
          .set({
            operationalStatus: 'occupied',
            housekeepingStatus: 'clean',
            updatedAt: now,
          })
          .where(eq(apartments.id, apartment.id));

        // Clean up open checkout housekeeping tasks
        await tx
          .delete(housekeepingTasks)
          .where(
            and(
              eq(housekeepingTasks.propertyId, res.propertyId),
              eq(housekeepingTasks.apartmentId, apartment.id),
              inArray(housekeepingTasks.status, ['dirty', 'cleaning'])
            )
          );
      } else {
        const targetRoomId = options?.targetRoomId || res.roomId;
        if (!targetRoomId) {
          throw new Error('ROOM_ASSIGNMENT_REQUIRED: Assign a room to reinstate this check-in.');
        }

        const [room] = await tx
          .select()
          .from(rooms)
          .where(and(eq(rooms.id, targetRoomId), eq(rooms.propertyId, res.propertyId)))
          .limit(1)
          .for('update');

        if (!room) throw new Error('Room not found');

        // Check if another reservation is currently checked_in in this room
        const [conflict] = await tx
          .select({ id: reservations.id, reference: reservations.reference })
          .from(reservations)
          .where(
            and(
              eq(reservations.roomId, targetRoomId),
              eq(reservations.status, 'checked_in'),
              ne(reservations.id, reservationId)
            )
          )
          .limit(1);

        if (conflict) {
          const err: any = new Error(
            `Cannot reverse check-out: Room ${room.roomNumber} is currently occupied by active reservation ${conflict.reference}. Reassign to an available room.`
          );
          err.code = 'ROOM_OCCUPIED_CONFLICT';
          err.conflictingReservationId = conflict.id;
          err.conflictingReference = conflict.reference;
          err.targetRoomId = targetRoomId;
          throw err;
        }

        if (room.operationalStatus === 'maintenance' || room.operationalStatus === 'blocked') {
          throw new Error(`Cannot reverse check-out: Room ${room.roomNumber} is currently out of service (${room.operationalStatus}).`);
        }

        await tx
          .update(reservations)
          .set({
            status: 'checked_in',
            roomId: targetRoomId,
            actualCheckOutAt: null,
            updatedAt: now,
          })
          .where(eq(reservations.id, reservationId));

        await tx
          .update(rooms)
          .set({
            operationalStatus: 'occupied',
            housekeepingStatus: 'clean',
            updatedAt: now,
          })
          .where(eq(rooms.id, targetRoomId));

        // Clean up open checkout housekeeping tasks
        await tx
          .delete(housekeepingTasks)
          .where(
            and(
              eq(housekeepingTasks.propertyId, res.propertyId),
              eq(housekeepingTasks.roomId, targetRoomId),
              inArray(housekeepingTasks.status, ['dirty', 'cleaning'])
            )
          );
      }

      await tx.insert(reservationEvents).values({
        reservationId,
        actorId: sanitizeActorId(actor.id),
        actorName: actor.name,
        eventType: 'checkout_reversed',
        description: `Check-out reversed by ${actor.name}. Reason: ${reason.trim()}`,
      });

      await tx.insert(activityLogs).values({
        organizationId: property.organizationId,
        propertyId: res.propertyId,
        actorId: sanitizeActorId(actor.id),
        actorName: actor.name,
        action: 'reservation.reverse_checkout',
        resource: 'reservation',
        resourceId: res.id,
        previousValue: {
          status: 'checked_out',
          actualCheckOutAt: res.actualCheckOutAt,
        },
        newValue: {
          status: 'checked_in',
          actualCheckOutAt: null,
          reason: reason.trim(),
        },
      });
    });
  }

  /**
   * Emergency status and stay correction (Master Administrator operation).
   * Overrides state with audit trail and mandatory justification.
   */
  static async emergencyCorrectStay(
    reservationId: string,
    actor: { id?: string; name: string },
    input: {
      status?: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
      checkInDate?: string;
      checkOutDate?: string;
      reason: string;
    }
  ): Promise<void> {
    if (!input.reason || input.reason.trim().length < 5) {
      throw new Error('A detailed operational reason (at least 5 characters) is required for emergency correction.');
    }

    await db.transaction(async (tx) => {
      const [res] = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId))
        .limit(1)
        .for('update');

      if (!res) throw new Error('Reservation not found');

      const property = await tx.query.properties.findFirst({
        where: eq(properties.id, res.propertyId),
      });
      if (!property) throw new Error('Property not found');

      const updates: Partial<typeof reservations.$inferInsert> = {
        updatedAt: new Date(),
      };

      const previousValue: Record<string, unknown> = {};
      const newValue: Record<string, unknown> = { reason: input.reason.trim() };

      if (input.status && input.status !== res.status) {
        previousValue.status = res.status;
        newValue.status = input.status;
        updates.status = input.status;

        if (input.status === 'checked_in' && !res.actualCheckInAt) {
          updates.actualCheckInAt = new Date();
        }
        if (input.status === 'checked_out' && !res.actualCheckOutAt) {
          updates.actualCheckOutAt = new Date();
        }
      }

      if (input.checkInDate && input.checkInDate !== res.checkInDate) {
        previousValue.checkInDate = res.checkInDate;
        newValue.checkInDate = input.checkInDate;
        updates.checkInDate = input.checkInDate;
      }

      if (input.checkOutDate && input.checkOutDate !== res.checkOutDate) {
        previousValue.checkOutDate = res.checkOutDate;
        newValue.checkOutDate = input.checkOutDate;
        updates.checkOutDate = input.checkOutDate;
      }

      if (updates.checkInDate || updates.checkOutDate) {
        const inDate = (updates.checkInDate as string) || res.checkInDate;
        const outDate = (updates.checkOutDate as string) || res.checkOutDate;
        if (outDate <= inDate) {
          throw new Error('Check-out date must be strictly after check-in date.');
        }
        const nights = calculateNights(inDate, outDate);
        updates.nights = nights;
        previousValue.nights = res.nights;
        newValue.nights = nights;
      }

      if (Object.keys(previousValue).length === 0) {
        return;
      }

      await tx
        .update(reservations)
        .set(updates)
        .where(eq(reservations.id, reservationId));

      await tx.insert(reservationEvents).values({
        reservationId,
        actorId: sanitizeActorId(actor.id),
        actorName: actor.name,
        eventType: 'status_corrected',
        description: `Emergency correction by ${actor.name}. Reason: ${input.reason.trim()}. Changes: ${JSON.stringify(newValue)}`,
      });

      await tx.insert(activityLogs).values({
        organizationId: property.organizationId,
        propertyId: res.propertyId,
        actorId: sanitizeActorId(actor.id),
        actorName: actor.name,
        action: 'reservation.emergency_corrected',
        resource: 'reservation',
        resourceId: res.id,
        previousValue,
        newValue,
      });
    });
  }

  /**
   * Cancel reservation
   * Releases reserved inventory and updates status
   */
  static async cancel(
    reservationId: string,
    actor = { id: '', name: 'Staff' },
    reason?: string
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
      if (res.status === 'checked_in' || res.status === 'checked_out') {
        throw new Error('This stay cannot be cancelled.');
      }

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

      let validUserId: string | null = null;
      if (actor.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor.id)) {
        const [existingUser] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, actor.id))
          .limit(1);
        if (existingUser) {
          validUserId = existingUser.id;
        }
      }

      // Update reservation
      await tx
        .update(reservations)
        .set({
          status: 'cancelled',
          cancellationReason: reason?.trim() || null,
          cancelledAt: new Date(),
          cancelledBy: validUserId,
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, reservationId));

      // Release room if assigned, but only if not in maintenance/blocked and no other active stay occupies it
      if (res.roomId) {
        const [currentRoom] = await tx
          .select({
            id: rooms.id,
            operationalStatus: rooms.operationalStatus,
          })
          .from(rooms)
          .where(eq(rooms.id, res.roomId))
          .limit(1);

        if (
          currentRoom &&
          currentRoom.operationalStatus !== 'maintenance' &&
          currentRoom.operationalStatus !== 'blocked'
        ) {
          const [activeStay] = await tx
            .select({ id: reservations.id })
            .from(reservations)
            .where(
              and(
                eq(reservations.roomId, res.roomId),
                eq(reservations.status, 'checked_in'),
                ne(reservations.id, reservationId)
              )
            )
            .limit(1);

          if (!activeStay) {
            await tx
              .update(rooms)
              .set({
                operationalStatus: 'available',
                updatedAt: new Date(),
              })
              .where(eq(rooms.id, res.roomId));
          }
        }
      }

      if (res.apartmentId) {
        const [currentApartment] = await tx
          .select({
            id: apartments.id,
            operationalStatus: apartments.operationalStatus,
          })
          .from(apartments)
          .where(eq(apartments.id, res.apartmentId))
          .limit(1);

        if (
          currentApartment &&
          currentApartment.operationalStatus !== 'maintenance' &&
          currentApartment.operationalStatus !== 'blocked'
        ) {
          const [activeStay] = await tx
            .select({ id: reservations.id })
            .from(reservations)
            .where(
              and(
                eq(reservations.apartmentId, res.apartmentId),
                eq(reservations.status, 'checked_in'),
                ne(reservations.id, reservationId)
              )
            )
            .limit(1);

          if (!activeStay) {
            await tx
              .update(apartments)
              .set({
                operationalStatus: 'available',
                updatedAt: new Date(),
              })
              .where(eq(apartments.id, res.apartmentId));
          }
        }
      }

      // Record timeline
      const trimmedReason = reason?.trim();
      const description = trimmedReason
        ? `Reservation cancelled by ${actor.name}. Reason: ${trimmedReason}`
        : `Reservation cancelled by ${actor.name}. Inventory released.`;

      await tx.insert(reservationEvents).values({
        reservationId,
        actorId: validUserId ? validUserId : undefined,
        actorName: actor.name,
        eventType: 'cancelled',
        description,
        metadata: trimmedReason ? { reason: trimmedReason } : undefined,
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
