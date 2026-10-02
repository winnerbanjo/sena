import { calculateNights, getDatesBetween } from '@sena/config';
import {
  bookingGroups,
  db,
  guests,
  idempotencyKeys,
  properties,
  reservationEvents,
  reservations,
  rooms,
  roomTypes,
} from '@sena/database';
import { reserveInventoryInTransaction } from '@sena/inventory';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { ACTIVE_STAY_STATUSES, assertRoomEligible } from './assignment';
import { categoryNightsAvailable, categorySoldOutMessage } from './category-availability';

export type BookingGroupInput = {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  roomIds: string[];
  numGuests: number;
  source: string;
  guestId?: string;
  guest?: {
    fullName: string;
    email: string;
    phone: string;
    identificationType?: string;
    identificationNumber?: string;
    preferences?: string[];
    notes?: string;
  };
  specialRequests?: string;
};

function referenceCode(prefix: string) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${prefix}${code}`;
}

function groupFailure(roomNumbers: string[], detail?: string) {
  const label = roomNumbers.length === 1 ? `Room ${roomNumbers[0]}` : `Rooms ${roomNumbers.join(', ')}`;
  const reason = detail ? ` ${detail}` : '';
  return new Error(`${label} ${roomNumbers.length === 1 ? 'is' : 'are'} unavailable for these dates.${reason} No rooms were booked.`);
}

async function resolveGuest(tx: any, input: BookingGroupInput) {
  if (input.guestId) {
    const guest = await tx.query.guests.findFirst({
      where: and(eq(guests.id, input.guestId), eq(guests.propertyId, input.propertyId)),
    });
    if (!guest) throw new Error('Guest not found in this property.');
    return guest.id as string;
  }
  if (!input.guest?.fullName?.trim()) throw new Error('Enter the guest name.');
  const email = input.guest.email?.trim().toLowerCase() || '';
  if (email) {
    const existing = await tx
      .select({ id: guests.id })
      .from(guests)
      .where(and(eq(guests.propertyId, input.propertyId), eq(guests.email, email)))
      .limit(1);
    if (existing.length > 0) return existing[0].id as string;
  }
  const [property] = await tx
    .select({ organizationId: properties.organizationId })
    .from(properties)
    .where(eq(properties.id, input.propertyId))
    .limit(1);
  if (!property?.organizationId) throw new Error('Property has no parent organization');
  const [created] = await tx
    .insert(guests)
    .values({
      organizationId: property.organizationId,
      propertyId: input.propertyId,
      fullName: input.guest.fullName.trim(),
      email,
      phone: input.guest.phone?.trim() || '',
      identificationType: input.guest.identificationType,
      identificationNumber: input.guest.identificationNumber,
      preferences: input.guest.preferences || [],
      notes: input.guest.notes,
    })
    .returning();
  return created.id as string;
}

export async function createBookingGroup(
  input: BookingGroupInput,
  actor = { id: '', name: 'Front Desk' },
  requestKey?: string,
) {
  const roomIds = [...new Set(input.roomIds.filter(Boolean))];
  if (roomIds.length < 2) throw new Error('Select at least two rooms.');
  if (roomIds.length > 20) throw new Error('Select 20 rooms or fewer.');
  if (!Number.isInteger(input.numGuests) || input.numGuests < 1) throw new Error('Enter the number of guests.');
  const nights = calculateNights(input.checkInDate, input.checkOutDate);
  const stayDates = getDatesBetween(input.checkInDate, input.checkOutDate);

  return db.transaction(async (tx) => {
    const key = requestKey ? `booking-group:${input.propertyId}:${requestKey}` : undefined;
    if (key) {
      if (key.length > 255) throw new Error('Invalid request reference.');
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
      const previous = await tx.query.idempotencyKeys.findFirst({ where: eq(idempotencyKeys.key, key) });
      if (previous) return previous.responsePayload;
    }

    const selected = await tx
      .select()
      .from(rooms)
      .where(and(eq(rooms.propertyId, input.propertyId), inArray(rooms.id, roomIds)))
      .orderBy(rooms.id)
      .for('update');
    if (selected.length !== roomIds.length) throw new Error('One of the selected rooms is not in this property. No rooms were booked.');

    const blocked = selected.filter((room) => room.operationalStatus === 'blocked' || room.operationalStatus === 'maintenance');
    if (blocked.length) throw groupFailure(blocked.map((room) => room.roomNumber), 'The room is out of service.');

    const overlapping = await tx
      .select({ roomId: reservations.roomId, roomNumber: rooms.roomNumber })
      .from(reservations)
      .innerJoin(rooms, eq(rooms.id, reservations.roomId))
      .where(
        and(
          eq(reservations.propertyId, input.propertyId),
          inArray(reservations.roomId, roomIds),
          inArray(reservations.status, [...ACTIVE_STAY_STATUSES]),
          sql`${reservations.checkInDate} < ${input.checkOutDate}`,
          sql`${reservations.checkOutDate} > ${input.checkInDate}`,
        ),
      );
    if (overlapping.length) {
      throw groupFailure([...new Set(overlapping.map((row) => row.roomNumber))]);
    }

    const byType = new Map<string, typeof selected>();
    for (const room of selected) {
      const list = byType.get(room.roomTypeId) || [];
      list.push(room);
      byType.set(room.roomTypeId, list);
    }

    const typeIds = [...byType.keys()].sort();
    for (const roomTypeId of typeIds) {
      const roomsForType = byType.get(roomTypeId) || [];
      await tx.select().from(roomTypes).where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.propertyId, input.propertyId))).for('update');
      const category = await categoryNightsAvailable(tx, input.propertyId, roomTypeId, input.checkInDate, input.checkOutDate);
      if (category.minAvailable < roomsForType.length) {
        throw groupFailure(
          roomsForType.map((room) => room.roomNumber),
          categorySoldOutMessage(category.blockers),
        );
      }
      try {
        await reserveInventoryInTransaction(tx, input.propertyId, roomTypeId, stayDates, roomsForType.length);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/no longer available for date/i.test(message)) {
          throw groupFailure(roomsForType.map((room) => room.roomNumber), categorySoldOutMessage(category.blockers));
        }
        throw error;
      }
    }

    for (const room of [...selected].sort((left, right) => left.id.localeCompare(right.id))) {
      await assertRoomEligible(
        tx,
        {
          propertyId: input.propertyId,
          roomTypeId: room.roomTypeId,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          forCheckIn: false,
        },
        room.id,
      );
    }

    const guestId = await resolveGuest(tx, input);
    const [group] = await tx
      .insert(bookingGroups)
      .values({
        propertyId: input.propertyId,
        guestId,
        reference: referenceCode('GRP-'),
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
      })
      .returning();

    const created = [];
    for (const room of selected) {
      const [roomType] = await tx
        .select({ name: roomTypes.name, basePriceMinorUnits: roomTypes.basePriceMinorUnits, capacity: roomTypes.capacity })
        .from(roomTypes)
        .where(eq(roomTypes.id, room.roomTypeId))
        .limit(1);
      if (!roomType) throw new Error('Room type not found');
      if (input.numGuests > roomType.capacity) throw new Error(`Room ${room.roomNumber} cannot take that many guests. No rooms were booked.`);
      const reference = referenceCode('SEN-');
      const totalAmountMinorUnits = roomType.basePriceMinorUnits * nights;
      const [reservation] = await tx
        .insert(reservations)
        .values({
          reference,
          propertyId: input.propertyId,
          guestId,
          roomTypeId: room.roomTypeId,
          roomId: room.id,
          bookingGroupId: group.id,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          nights,
          numGuests: input.numGuests,
          adults: input.numGuests,
          children: 0,
          source: input.source,
          status: 'confirmed',
          paymentStatus: 'pay_later',
          totalAmountMinorUnits,
          paidAmountMinorUnits: 0,
          specialRequests: input.specialRequests,
        })
        .returning();
      await tx.insert(reservationEvents).values({
        reservationId: reservation.id,
        actorId: actor.id || undefined,
        actorName: actor.name,
        eventType: 'reservation_created',
        description: `Reservation ${reference} created in booking ${group.reference} for room ${room.roomNumber} (${roomType.name}).`,
        metadata: { bookingGroupId: group.id, roomNumber: room.roomNumber },
      });
      created.push({
        id: reservation.id,
        reference: reservation.reference,
        roomId: room.id,
        roomNumber: room.roomNumber,
        roomTypeId: room.roomTypeId,
        roomTypeName: roomType.name,
        status: reservation.status,
        totalAmountMinorUnits,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        nights,
      });
    }

    const result = {
      bookingGroup: {
        id: group.id,
        reference: group.reference,
        checkInDate: group.checkInDate,
        checkOutDate: group.checkOutDate,
        roomCount: created.length,
      },
      reservations: created,
      combinedTotalMinorUnits: created.reduce((sum, reservation) => sum + reservation.totalAmountMinorUnits, 0),
    };
    if (key) {
      await tx.insert(idempotencyKeys).values({
        key,
        action: 'create_booking_group',
        responsePayload: result as any,
        expiresAt: new Date(Date.now() + 86400000),
      });
    }
    return result;
  });
}

export async function getBookingGroup(propertyId: string, bookingGroupId: string) {
  const [group] = await db
    .select({
      id: bookingGroups.id,
      reference: bookingGroups.reference,
      guestId: bookingGroups.guestId,
      guestName: guests.fullName,
      checkInDate: bookingGroups.checkInDate,
      checkOutDate: bookingGroups.checkOutDate,
    })
    .from(bookingGroups)
    .innerJoin(guests, eq(guests.id, bookingGroups.guestId))
    .where(and(eq(bookingGroups.id, bookingGroupId), eq(bookingGroups.propertyId, propertyId)))
    .limit(1);
  if (!group) return null;

  const stays = await db
    .select({
      id: reservations.id,
      reference: reservations.reference,
      status: reservations.status,
      roomId: reservations.roomId,
      roomNumber: rooms.roomNumber,
      roomTypeName: roomTypes.name,
      totalAmountMinorUnits: reservations.totalAmountMinorUnits,
      paidAmountMinorUnits: reservations.paidAmountMinorUnits,
      paymentStatus: reservations.paymentStatus,
    })
    .from(reservations)
    .leftJoin(rooms, eq(rooms.id, reservations.roomId))
    .leftJoin(roomTypes, eq(roomTypes.id, reservations.roomTypeId))
    .where(and(eq(reservations.bookingGroupId, bookingGroupId), eq(reservations.propertyId, propertyId)));

  return {
    ...group,
    reservations: stays,
    combinedTotalMinorUnits: stays.reduce((sum, stay) => sum + stay.totalAmountMinorUnits, 0),
    combinedPaidMinorUnits: stays.reduce((sum, stay) => sum + stay.paidAmountMinorUnits, 0),
  };
}
