import { getDatesBetween, stayNightsOverlap } from '@sena/config';
import { bookingHolds, reservations, roomTypes, rooms } from '@sena/database';
import { and, eq, gt, inArray, ne, notInArray, sql } from 'drizzle-orm';

/**
 * A room is sellable stock unless it is explicitly out of service. `occupied`
 * is still sellable for future dates, and housekeeping state never removes a
 * room from capacity - it only gates check-in.
 */
export const NON_SELLABLE_OPERATIONAL_STATUSES = ['blocked', 'maintenance'] as const;

/** Reservation states that hold a unit of stock for their nights. */
export const BLOCKING_STAY_STATUSES = ['confirmed', 'checked_in'] as const;

export type CapacitySource = 'physical-rooms' | 'legacy-declared';

export type CategoryCapacity = {
  physicalRoomCount: number;
  declaredTotalInventory: number;
  authoritativeCapacity: number;
  source: CapacitySource;
};

export type CategoryNight = {
  date: string;
  capacity: number;
  consumedByReservations: number;
  held: number;
  available: number;
};

export type CategoryAvailability = CategoryCapacity & {
  isAvailable: boolean;
  minAvailable: number;
  nights: CategoryNight[];
};

type Executor = {
  select: any;
};

/** Eligible physical rooms are the authoritative capacity for a category. */
export function sellableRoomFilter(propertyId: string) {
  return and(
    eq(rooms.propertyId, propertyId),
    notInArray(rooms.operationalStatus, [...NON_SELLABLE_OPERATIONAL_STATUSES]),
  );
}

/**
 * Derives category capacity. Physical rooms win whenever the category has
 * any, so `room_types.total_inventory` can never contradict real inventory.
 * Declared inventory is only consulted for categories that have no physical
 * room records at all - the pre-physical-room legacy shape.
 */
export async function categoryCapacity(
  exec: Executor,
  propertyId: string,
  roomTypeId: string,
): Promise<CategoryCapacity | null> {
  const [roomType] = await exec
    .select({ declaredTotalInventory: roomTypes.totalInventory })
    .from(roomTypes)
    .where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.propertyId, propertyId)))
    .limit(1);
  if (!roomType) return null;

  const physical = await exec
    .select({ count: sql<number>`count(*)::int` })
    .from(rooms)
    .where(and(sellableRoomFilter(propertyId), eq(rooms.roomTypeId, roomTypeId)));

  const physicalRoomCount = Number(physical[0]?.count || 0);
  const declaredTotalInventory = Number(roomType.declaredTotalInventory || 0);

  if (physicalRoomCount > 0) {
    return {
      physicalRoomCount,
      declaredTotalInventory,
      authoritativeCapacity: physicalRoomCount,
      source: 'physical-rooms',
    };
  }
  return {
    physicalRoomCount,
    declaredTotalInventory,
    authoritativeCapacity: declaredTotalInventory,
    source: 'legacy-declared',
  };
}

/** Nights a stay occupies: check-in night inclusive, check-out night exclusive. */
function reservationNights(checkInDate: string, checkOutDate: string) {
  return getDatesBetween(checkInDate, checkOutDate);
}

/**
 * Reconciles capacity against what is actually consuming it:
 * blocking reservations (assigned rooms and roomless bookings alike, each
 * consuming exactly one unit) plus live, unexpired holds.
 */
export async function categoryAvailability(
  exec: Executor,
  input: {
    propertyId: string;
    roomTypeId: string;
    checkInDate: string;
    checkOutDate: string;
    excludeReservationId?: string | null;
  },
): Promise<CategoryAvailability | null> {
  const stayDates = reservationNights(input.checkInDate, input.checkOutDate);
  const capacity = await categoryCapacity(exec, input.propertyId, input.roomTypeId);
  if (!capacity) return null;
  if (stayDates.length === 0) {
    return { ...capacity, isAvailable: false, minAvailable: 0, nights: [] };
  }

  const blocking = await exec
    .select({
      id: reservations.id,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.propertyId, input.propertyId),
        eq(reservations.roomTypeId, input.roomTypeId),
        inArray(reservations.status, [...BLOCKING_STAY_STATUSES]),
        sql`${reservations.checkInDate} < ${input.checkOutDate}`,
        sql`${reservations.checkOutDate} > ${input.checkInDate}`,
        input.excludeReservationId ? ne(reservations.id, input.excludeReservationId) : sql`true`,
      ),
    );

  const holds = await exec
    .select({
      checkInDate: bookingHolds.checkInDate,
      checkOutDate: bookingHolds.checkOutDate,
      quantity: bookingHolds.quantity,
    })
    .from(bookingHolds)
    .where(
      and(
        eq(bookingHolds.propertyId, input.propertyId),
        eq(bookingHolds.roomTypeId, input.roomTypeId),
        eq(bookingHolds.status, 'active'),
        gt(bookingHolds.expiresAt, new Date()),
      ),
    );

  const nights: CategoryNight[] = stayDates.map((date) => {
    const consumedByReservations = blocking.filter((stay: any) =>
      reservationNights(stay.checkInDate, stay.checkOutDate).includes(date),
    ).length;
    const held = holds
      .filter((hold: any) => date >= hold.checkInDate && date < hold.checkOutDate)
      .reduce((sum: number, hold: any) => sum + Number(hold.quantity || 0), 0);
    return {
      date,
      capacity: capacity.authoritativeCapacity,
      consumedByReservations,
      held,
      available: capacity.authoritativeCapacity - consumedByReservations - held,
    };
  });

  const minAvailable = nights.reduce(
    (lowest, night) => (night.available < lowest ? night.available : lowest),
    capacity.authoritativeCapacity,
  );

  return {
    ...capacity,
    isAvailable: minAvailable > 0,
    minAvailable,
    nights,
  };
}

export { getDatesBetween, stayNightsOverlap };