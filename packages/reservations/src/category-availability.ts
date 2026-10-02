import { categoryAvailability } from '@sena/inventory';
import { reservations, rooms } from '@sena/database';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';

export type StayBlocker = {
  id: string;
  reference: string;
  roomNumber: string | null;
  checkInDate: string;
  checkOutDate: string;
};

export function categorySoldOutMessage(blockers: StayBlocker[]) {
  if (blockers.length === 0) return 'This category is fully booked for these dates.';
  const details = blockers.map((blocker) => {
    const place = blocker.roomNumber ? `room ${blocker.roomNumber}` : 'not assigned to a room';
    return `${blocker.reference} (${place}, ${blocker.checkInDate} to ${blocker.checkOutDate})`;
  });
  return `This category is fully booked for part of these dates. ${details.join('; ')}.`;
}

export function roomUnavailableForStay(roomNumber: string, detail: string) {
  return `Room ${roomNumber} is unavailable for part of the new stay. ${detail}`;
}

/**
 * Category capacity comes from eligible physical rooms and is consumed by live
 * reservations and live holds. This is a thin adapter over the shared
 * inventory engine so staff booking, multi-room booking and Direct Booking can
 * never disagree about the same dates.
 */
export async function categoryNightsAvailable(
  tx: { select: any },
  propertyId: string,
  roomTypeId: string,
  checkInDate: string,
  checkOutDate: string,
  excludeReservationId?: string | null,
): Promise<{ minAvailable: number; blockers: StayBlocker[] }> {
  const availability = await categoryAvailability(tx, {
    propertyId,
    roomTypeId,
    checkInDate,
    checkOutDate,
    excludeReservationId,
  });
  if (!availability) return { minAvailable: 0, blockers: [] };

  const blockers = await tx
    .select({
      id: reservations.id,
      reference: reservations.reference,
      roomNumber: rooms.roomNumber,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
    })
    .from(reservations)
    .leftJoin(rooms, eq(reservations.roomId, rooms.id))
    .where(
      and(
        eq(reservations.propertyId, propertyId),
        eq(reservations.roomTypeId, roomTypeId),
        inArray(reservations.status, ['confirmed', 'checked_in']),
        sql`${reservations.checkInDate} < ${checkOutDate}`,
        sql`${reservations.checkOutDate} > ${checkInDate}`,
        excludeReservationId ? ne(reservations.id, excludeReservationId) : sql`true`,
      ),
    );

  return { minAvailable: Math.max(0, availability.minAvailable), blockers: blockers as StayBlocker[] };
}