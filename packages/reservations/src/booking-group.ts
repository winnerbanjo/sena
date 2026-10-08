import { calculateNights, getDatesBetween } from '@sena/config';
import {
  apartments,
  bookingGroups,
  db,
  guests,
  idempotencyKeys,
  properties,
  propertyInvoices,
  reservationEvents,
  reservations,
  rooms,
  roomTypes,
} from '@sena/database';
import { APARTMENT_BLOCKING_STATUSES, reserveInventoryInTransaction } from '@sena/inventory';
import { PaymentService } from '@sena/payments';
import { and, eq, inArray, ne, or, sql } from 'drizzle-orm';
import crypto from 'crypto';
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
        actorId: actor.id || null,
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

    // Create single consolidated group invoice covering all rooms
    const [property] = await tx
      .select({
        id: properties.id,
        organizationId: properties.organizationId,
        currency: properties.currency,
      })
      .from(properties)
      .where(eq(properties.id, input.propertyId))
      .limit(1);

    const [guestRecord] = await tx
      .select({
        id: guests.id,
        fullName: guests.fullName,
        email: guests.email,
        phone: guests.phone,
      })
      .from(guests)
      .where(eq(guests.id, guestId))
      .limit(1);

    const defaultBank = await PaymentService.primaryBankDetails(input.propertyId);
    const combinedTotalMinorUnits = created.reduce((sum, r) => sum + r.totalAmountMinorUnits, 0);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;

    const lineItems = created.map((item) => ({
      id: crypto.randomUUID(),
      description: `${item.roomTypeName} (Room ${item.roomNumber}) · ${item.nights} night stay (${item.checkInDate} to ${item.checkOutDate})`,
      category: 'room' as const,
      quantity: 1,
      unitPriceMinorUnits: item.totalAmountMinorUnits,
      totalMinorUnits: item.totalAmountMinorUnits,
    }));

    const [groupInvoice] = await tx
      .insert(propertyInvoices)
      .values({
        propertyId: input.propertyId,
        organizationId: property?.organizationId || '',
        reservationId: created[0]?.id || null,
        bookingGroupId: group.id,
        guestId,
        invoiceNumber,
        invoiceType: 'guest_folio',
        status: 'issued',
        recipientName: guestRecord?.fullName || input.guest?.fullName || 'Guest',
        recipientEmail: guestRecord?.email || input.guest?.email || null,
        recipientPhone: guestRecord?.phone || input.guest?.phone || null,
        issueDate: input.checkInDate,
        dueDate: input.checkOutDate,
        currency: property?.currency || 'NGN',
        subtotalMinorUnits: combinedTotalMinorUnits,
        taxVatMinorUnits: 0,
        taxConsumptionMinorUnits: 0,
        serviceChargeMinorUnits: 0,
        discountMinorUnits: 0,
        totalAmountMinorUnits: combinedTotalMinorUnits,
        paidAmountMinorUnits: 0,
        items: lineItems,
        bankDetails: defaultBank,
        paymentTerms: 'Due on Receipt',
        notes: `Booking Group ${group.reference} (${created.length} rooms)`,
      })
      .returning();

    const result = {
      bookingGroup: {
        id: group.id,
        reference: group.reference,
        checkInDate: group.checkInDate,
        checkOutDate: group.checkOutDate,
        roomCount: created.length,
        invoiceId: groupInvoice.id,
        invoiceNumber: groupInvoice.invoiceNumber,
      },
      reservations: created,
      combinedTotalMinorUnits,
      invoice: groupInvoice,
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

  const invoices = await db
    .select({
      id: propertyInvoices.id,
      invoiceNumber: propertyInvoices.invoiceNumber,
      status: propertyInvoices.status,
      totalAmountMinorUnits: propertyInvoices.totalAmountMinorUnits,
      paidAmountMinorUnits: propertyInvoices.paidAmountMinorUnits,
    })
    .from(propertyInvoices)
    .where(
      and(
        eq(propertyInvoices.bookingGroupId, bookingGroupId),
        ne(propertyInvoices.status, 'void')
      )
    );

  return {
    ...group,
    reservations: stays,
    invoices,
    invoice: invoices[0] || null,
    combinedTotalMinorUnits: stays.reduce((sum, stay) => sum + stay.totalAmountMinorUnits, 0),
    combinedPaidMinorUnits: stays.reduce((sum, stay) => sum + stay.paidAmountMinorUnits, 0),
  };
}

export type AddAccommodationInput = {
  propertyId: string;
  reservationId: string;
  accommodationType: 'room' | 'apartment';
  roomTypeId?: string | null;
  roomId?: string | null;
  apartmentId?: string | null;
  checkInDate?: string;
  checkOutDate?: string;
  numGuests?: number;
  customTotalAmountMinorUnits?: number | null;
  source?: string;
  specialRequests?: string;
};

export async function addAccommodationToBooking(
  input: AddAccommodationInput,
  actor = { id: '', name: 'Front Desk' },
) {
  return db.transaction(async (tx) => {
    const [parentRes] = await tx
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, input.reservationId), eq(reservations.propertyId, input.propertyId)))
      .limit(1)
      .for('update');
    if (!parentRes) throw new Error('Reservation not found');
    if (['cancelled', 'no_show', 'voided'].includes(parentRes.status)) {
      throw new Error('Cannot add accommodation to a cancelled or voided reservation.');
    }

    const checkInDate = input.checkInDate || parentRes.checkInDate;
    const checkOutDate = input.checkOutDate || parentRes.checkOutDate;
    if (checkOutDate <= checkInDate) throw new Error('Check-out must be after check-in.');
    const nights = calculateNights(checkInDate, checkOutDate);
    const stayDates = getDatesBetween(checkInDate, checkOutDate);
    const numGuests = Number(input.numGuests || 1);

    let bookingGroupId = parentRes.bookingGroupId;
    let groupReference: string;

    if (!bookingGroupId) {
      groupReference = referenceCode('GRP-');
      const [newGroup] = await tx
        .insert(bookingGroups)
        .values({
          propertyId: input.propertyId,
          guestId: parentRes.guestId,
          reference: groupReference,
          checkInDate: parentRes.checkInDate,
          checkOutDate: parentRes.checkOutDate,
        })
        .returning();
      bookingGroupId = newGroup.id;

      await tx
        .update(reservations)
        .set({ bookingGroupId: newGroup.id, updatedAt: new Date() })
        .where(eq(reservations.id, parentRes.id));

      await tx
        .update(propertyInvoices)
        .set({ bookingGroupId: newGroup.id, updatedAt: new Date() })
        .where(eq(propertyInvoices.reservationId, parentRes.id));
    } else {
      const [existingGroup] = await tx
        .select({ reference: bookingGroups.reference })
        .from(bookingGroups)
        .where(eq(bookingGroups.id, bookingGroupId))
        .limit(1);
      groupReference = existingGroup?.reference || 'Booking Group';
    }

    let targetRoomTypeId: string | null = null;
    let targetRoomId: string | null = null;
    let targetApartmentId: string | null = null;
    let targetLabel = '';
    let standardAmount = 0;

    if (input.accommodationType === 'apartment') {
      if (!input.apartmentId) throw new Error('Select an apartment.');
      const [apartment] = await tx
        .select()
        .from(apartments)
        .where(and(eq(apartments.id, input.apartmentId), eq(apartments.propertyId, input.propertyId)))
        .limit(1)
        .for('update');
      if (!apartment) throw new Error('Apartment not found.');
      if (apartment.archivedAt || apartment.operationalStatus === 'blocked' || apartment.operationalStatus === 'maintenance') {
        throw new Error('This apartment is out of service.');
      }
      const blocking = await tx
        .select({ reference: reservations.reference })
        .from(reservations)
        .where(
          and(
            eq(reservations.apartmentId, input.apartmentId),
            eq(reservations.propertyId, input.propertyId),
            inArray(reservations.status, [...APARTMENT_BLOCKING_STATUSES]),
            sql`${reservations.checkInDate} < ${checkOutDate}`,
            sql`${reservations.checkOutDate} > ${checkInDate}`,
          ),
        );
      if (blocking.length > 0) throw new Error(`Apartment is already booked for these dates (${blocking[0].reference}).`);

      standardAmount = apartment.basePriceMinorUnits * nights;
      targetRoomTypeId = null;
      targetRoomId = null;
      targetApartmentId = apartment.id;
      targetLabel = `${apartment.name} Apartment`;
    } else {
      if (!input.roomTypeId) throw new Error('Select a room category.');
      const [roomType] = await tx
        .select()
        .from(roomTypes)
        .where(and(eq(roomTypes.id, input.roomTypeId), eq(roomTypes.propertyId, input.propertyId)))
        .limit(1)
        .for('update');
      if (!roomType) throw new Error('Room category not found.');

      const category = await categoryNightsAvailable(tx, input.propertyId, input.roomTypeId, checkInDate, checkOutDate);
      if (category.minAvailable < 1) {
        throw new Error(categorySoldOutMessage(category.blockers));
      }
      await reserveInventoryInTransaction(tx, input.propertyId, input.roomTypeId, stayDates, 1);

      if (input.roomId) {
        await assertRoomEligible(
          tx,
          { propertyId: input.propertyId, roomTypeId: input.roomTypeId, checkInDate, checkOutDate, forCheckIn: false },
          input.roomId,
        );
        const [room] = await tx.select({ roomNumber: rooms.roomNumber }).from(rooms).where(eq(rooms.id, input.roomId)).limit(1);
        targetLabel = `Room ${room?.roomNumber || 'Assigned'} (${roomType.name})`;
      } else {
        targetLabel = `${roomType.name} (Unassigned)`;
      }

      standardAmount = roomType.basePriceMinorUnits * nights;
      targetRoomTypeId = roomType.id;
      targetRoomId = input.roomId || null;
      targetApartmentId = null;
    }

    const agreedTotal = input.customTotalAmountMinorUnits != null
      ? Math.max(0, input.customTotalAmountMinorUnits)
      : standardAmount;
    const discount = Math.max(0, standardAmount - agreedTotal);
    const newReference = referenceCode('SEN-');

    const [newRes] = await tx
      .insert(reservations)
      .values({
        reference: newReference,
        propertyId: input.propertyId,
        guestId: parentRes.guestId,
        bookingGroupId,
        roomTypeId: targetRoomTypeId,
        roomId: targetRoomId,
        apartmentId: targetApartmentId,
        checkInDate,
        checkOutDate,
        nights,
        numGuests,
        adults: numGuests,
        children: 0,
        source: input.source || parentRes.source || 'direct',
        status: 'confirmed',
        paymentStatus: 'pay_later',
        standardAmountMinorUnits: standardAmount,
        discountAmountMinorUnits: discount,
        totalAmountMinorUnits: agreedTotal,
        paidAmountMinorUnits: 0,
        specialRequests: input.specialRequests || null,
      })
      .returning();

    await tx.insert(reservationEvents).values({
      reservationId: parentRes.id,
      actorId: actor.id || null,
      actorName: actor.name,
      eventType: 'reservation_accommodation_added',
      description: `Additional accommodation (${targetLabel}, ${newReference}) added to booking ${groupReference}. Added by ${actor.name}.`,
      metadata: { addedReservationId: newRes.id, addedReference: newReference, bookingGroupId },
    });

    await tx.insert(reservationEvents).values({
      reservationId: newRes.id,
      actorId: actor.id || null,
      actorName: actor.name,
      eventType: 'reservation_created',
      description: `Reservation ${newReference} created as additional room in booking ${groupReference} (${targetLabel}). Added by ${actor.name}.`,
      metadata: { parentReservationId: parentRes.id, bookingGroupId },
    });

    // Update or create single consolidated group invoice
    const existingInvoices = await tx
      .select()
      .from(propertyInvoices)
      .where(
        and(
          or(
            eq(propertyInvoices.bookingGroupId, bookingGroupId),
            eq(propertyInvoices.reservationId, parentRes.id)
          ),
          ne(propertyInvoices.status, 'void')
        )
      )
      .orderBy(propertyInvoices.createdAt);

    const newItem = {
      id: crypto.randomUUID(),
      description: `${targetLabel} · ${nights} night stay (${checkInDate} to ${checkOutDate})`,
      category: 'room' as const,
      quantity: 1,
      unitPriceMinorUnits: agreedTotal,
      totalMinorUnits: agreedTotal,
    };

    let groupInvoice: any = null;
    if (existingInvoices.length > 0) {
      const existingInv = existingInvoices[0];
      const currentItems = Array.isArray(existingInv.items) ? existingInv.items : [];
      const updatedItems = [...currentItems, newItem];
      const newSubtotal = existingInv.subtotalMinorUnits + agreedTotal;
      const newTotal = existingInv.totalAmountMinorUnits + agreedTotal;

      const [updated] = await tx
        .update(propertyInvoices)
        .set({
          bookingGroupId,
          items: updatedItems,
          subtotalMinorUnits: newSubtotal,
          totalAmountMinorUnits: newTotal,
          updatedAt: new Date(),
        })
        .where(eq(propertyInvoices.id, existingInv.id))
        .returning();
      groupInvoice = updated;
    } else {
      const [prop] = await tx
        .select({ organizationId: properties.organizationId, currency: properties.currency })
        .from(properties)
        .where(eq(properties.id, input.propertyId))
        .limit(1);
      const [guest] = await tx
        .select({ fullName: guests.fullName, email: guests.email, phone: guests.phone })
        .from(guests)
        .where(eq(guests.id, parentRes.guestId))
        .limit(1);
      const defaultBank = await PaymentService.primaryBankDetails(input.propertyId);

      const parentItem = {
        id: crypto.randomUUID(),
        description: `Original accommodation · ${parentRes.nights} night stay (${parentRes.checkInDate} to ${parentRes.checkOutDate})`,
        category: 'room' as const,
        quantity: 1,
        unitPriceMinorUnits: parentRes.totalAmountMinorUnits,
        totalMinorUnits: parentRes.totalAmountMinorUnits,
      };
      const combinedTotal = parentRes.totalAmountMinorUnits + agreedTotal;

      const [createdInv] = await tx
        .insert(propertyInvoices)
        .values({
          propertyId: input.propertyId,
          organizationId: prop?.organizationId || '',
          reservationId: parentRes.id,
          bookingGroupId,
          guestId: parentRes.guestId,
          invoiceNumber: `INV-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
          invoiceType: 'guest_folio',
          status: 'issued',
          recipientName: guest?.fullName || 'Guest',
          recipientEmail: guest?.email || null,
          recipientPhone: guest?.phone || null,
          issueDate: parentRes.checkInDate,
          dueDate: checkOutDate > parentRes.checkOutDate ? checkOutDate : parentRes.checkOutDate,
          currency: prop?.currency || 'NGN',
          subtotalMinorUnits: combinedTotal,
          taxVatMinorUnits: 0,
          taxConsumptionMinorUnits: 0,
          serviceChargeMinorUnits: 0,
          discountMinorUnits: 0,
          totalAmountMinorUnits: combinedTotal,
          paidAmountMinorUnits: parentRes.paidAmountMinorUnits || 0,
          items: [parentItem, newItem],
          bankDetails: defaultBank,
          paymentTerms: 'Due on Receipt',
          notes: `Booking Group ${groupReference}`,
        })
        .returning();
      groupInvoice = createdInv;
    }

    return {
      bookingGroupId,
      bookingGroupReference: groupReference,
      reservation: newRes,
      invoice: groupInvoice,
    };
  });
}

