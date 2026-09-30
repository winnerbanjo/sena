import { getDatesBetween } from '@sena/config';
import { apartments, bookingHolds, db, reservations } from '@sena/database';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';

export const APARTMENT_BLOCKING_STATUSES = ['pending', 'confirmed', 'checked_in'] as const;

export type ApartmentBoardStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'needs_cleaning'
  | 'blocked'
  | 'maintenance';

export function deriveApartmentBoardStatus(input: {
  operationalStatus: string;
  housekeepingStatus: string;
  inHouse: boolean;
  reservedToday: boolean;
}): ApartmentBoardStatus {
  if (input.operationalStatus === 'maintenance') return 'maintenance';
  if (input.operationalStatus === 'blocked') return 'blocked';
  if (input.inHouse || input.operationalStatus === 'occupied') return 'occupied';
  if (input.reservedToday) return 'reserved';
  if (input.housekeepingStatus === 'dirty' || input.housekeepingStatus === 'cleaning') return 'needs_cleaning';
  return 'available';
}

function datesOverlap(checkIn: string, checkOut: string, otherIn: string, otherOut: string) {
  return checkIn < otherOut && checkOut > otherIn;
}

async function overlappingStays(
  tx: { select: typeof db.select },
  propertyId: string,
  apartmentId: string,
  checkInDate: string,
  checkOutDate: string
) {
  return tx
    .select({ id: reservations.id, status: reservations.status, checkInDate: reservations.checkInDate, checkOutDate: reservations.checkOutDate })
    .from(reservations)
    .where(
      and(
        eq(reservations.propertyId, propertyId),
        eq(reservations.apartmentId, apartmentId),
        inArray(reservations.status, [...APARTMENT_BLOCKING_STATUSES]),
        sql`${reservations.checkInDate} < ${checkOutDate}`,
        sql`${reservations.checkOutDate} > ${checkInDate}`
      )
    );
}

export async function checkApartmentAvailability(
  propertyId: string,
  apartmentId: string,
  checkInDate: string,
  checkOutDate: string
): Promise<{ isAvailable: boolean; minAvailable: number }> {
  const stayDates = getDatesBetween(checkInDate, checkOutDate);
  if (stayDates.length === 0) return { isAvailable: false, minAvailable: 0 };

  const [apartment] = await db
    .select({
      id: apartments.id,
      operationalStatus: apartments.operationalStatus,
      bookingVisibility: apartments.bookingVisibility,
    })
    .from(apartments)
    .where(and(eq(apartments.id, apartmentId), eq(apartments.propertyId, propertyId)))
    .limit(1);

  if (!apartment || apartment.operationalStatus === 'blocked' || apartment.operationalStatus === 'maintenance') {
    return { isAvailable: false, minAvailable: 0 };
  }

  const stays = await overlappingStays(db, propertyId, apartmentId, checkInDate, checkOutDate);
  if (stays.length > 0) return { isAvailable: false, minAvailable: 0 };

  const holds = await db
    .select({ checkInDate: bookingHolds.checkInDate, checkOutDate: bookingHolds.checkOutDate })
    .from(bookingHolds)
    .where(
      and(
        eq(bookingHolds.propertyId, propertyId),
        eq(bookingHolds.apartmentId, apartmentId),
        eq(bookingHolds.status, 'active'),
        gt(bookingHolds.expiresAt, new Date())
      )
    );

  const held = holds.some((hold) => datesOverlap(checkInDate, checkOutDate, hold.checkInDate, hold.checkOutDate));
  return held ? { isAvailable: false, minAvailable: 0 } : { isAvailable: true, minAvailable: 1 };
}

export async function createApartmentHold(
  propertyId: string,
  apartmentId: string,
  checkInDate: string,
  checkOutDate: string,
  quantity = 1,
  guestInfo?: { name?: string; email?: string }
): Promise<{ holdId: string; expiresAt: Date; minAvailable: number }> {
  if (quantity !== 1) throw new Error('An apartment can only be held once.');
  const stayDates = getDatesBetween(checkInDate, checkOutDate);
  if (stayDates.length === 0) throw new Error('Invalid stay dates');

  return db.transaction(async (tx) => {
    const [apartment] = await tx
      .select()
      .from(apartments)
      .where(and(eq(apartments.id, apartmentId), eq(apartments.propertyId, propertyId)))
      .limit(1)
      .for('update');

    if (!apartment) throw new Error('Apartment not found');
    if (!apartment.bookingVisibility) throw new Error('This apartment is not available for online booking.');
    if (apartment.operationalStatus === 'blocked' || apartment.operationalStatus === 'maintenance') {
      throw new Error('This apartment is out of service.');
    }

    const stays = await overlappingStays(tx, propertyId, apartmentId, checkInDate, checkOutDate);
    if (stays.length > 0) throw new Error('This apartment is already booked for those dates.');

    const holds = await tx
      .select()
      .from(bookingHolds)
      .where(
        and(
          eq(bookingHolds.propertyId, propertyId),
          eq(bookingHolds.apartmentId, apartmentId),
          eq(bookingHolds.status, 'active'),
          gt(bookingHolds.expiresAt, new Date())
        )
      );
    if (holds.some((hold) => datesOverlap(checkInDate, checkOutDate, hold.checkInDate, hold.checkOutDate))) {
      throw new Error('This apartment is already booked for those dates.');
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const [hold] = await tx
      .insert(bookingHolds)
      .values({
        propertyId,
        roomTypeId: null,
        apartmentId,
        checkInDate,
        checkOutDate,
        quantity: 1,
        guestEmail: guestInfo?.email,
        guestName: guestInfo?.name,
        status: 'active',
        expiresAt,
      })
      .returning();

    return { holdId: hold.id, expiresAt: hold.expiresAt, minAvailable: 0 };
  });
}
