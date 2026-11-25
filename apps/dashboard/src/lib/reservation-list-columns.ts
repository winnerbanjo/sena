import { reservations, guests, rooms, roomTypes, apartments, reservationNotes, transferProofs } from '@sena/database';
import { sql } from 'drizzle-orm';

/**
 * Columns shared by the reservations list and the operational boards.
 *
 * The per-row note count and pending-proof flag are correlated subqueries so the
 * list never has to load timelines or proof rows. They stay scoped to the
 * caller's property.
 */
export function reservationListColumns(propertyId: string) {
  return {
    id: reservations.id,
    reference: reservations.reference,
    status: reservations.status,
    paymentStatus: reservations.paymentStatus,
    checkInDate: reservations.checkInDate,
    checkOutDate: reservations.checkOutDate,
    nights: reservations.nights,
    numGuests: reservations.numGuests,
    source: reservations.source,
    totalAmountMinorUnits: reservations.totalAmountMinorUnits,
    paidAmountMinorUnits: reservations.paidAmountMinorUnits,
    createdAt: reservations.createdAt,
    cursorCreatedAt: sql<string>`to_char(${reservations.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    guestId: reservations.guestId,
    guestName: guests.fullName,
    guestEmail: guests.email,
    guestPhone: guests.phone,
    roomId: reservations.roomId,
    roomNumber: rooms.roomNumber,
    bookingGroupId: reservations.bookingGroupId,
    roomTypeId: reservations.roomTypeId,
    roomTypeName: roomTypes.name,
    apartmentId: reservations.apartmentId,
    apartmentName: apartments.name,
    noteCount: sql<number>`(select count(*)::int from ${reservationNotes} where ${reservationNotes.reservationId} = ${reservations.id})`,
    pendingTransferProof: sql<boolean>`exists (select 1 from ${transferProofs} where ${transferProofs.reservationId} = ${reservations.id} and ${transferProofs.propertyId} = ${propertyId} and ${transferProofs.status} = 'pending')`,
  };
}
