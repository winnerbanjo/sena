import { stayNightsOverlap } from '@sena/config';
import { db, reservations, rooms, roomTypes } from '@sena/database';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { categoryNightsAvailable, categorySoldOutMessage } from './category-availability';

export const READY_HOUSEKEEPING = ['clean', 'inspected', 'inspection'] as const;
export const BLOCKED_OPERATIONAL = ['blocked', 'maintenance'] as const;
export const ACTIVE_STAY_STATUSES = ['confirmed', 'checked_in'] as const;

export type EligibleRoom = {
  id: string;
  roomNumber: string;
  floor: string | null;
  roomTypeId: string;
  operationalStatus: string;
  housekeepingStatus: string;
  eligible: boolean;
  reason?: string;
  readinessLabel: string;
  roomTypeName?: string;
  nightlyRateMinorUnits?: number;
};

export type AssignmentScope = {
  propertyId: string;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  excludeReservationId?: string | null;
  forCheckIn?: boolean;
};

export function readinessLabel(housekeepingStatus: string, operationalStatus: string) {
  if (BLOCKED_OPERATIONAL.includes(operationalStatus as (typeof BLOCKED_OPERATIONAL)[number])) {
    return operationalStatus === 'maintenance' ? 'Maintenance' : 'Out of service';
  }
  if (operationalStatus === 'occupied') return 'Occupied';
  if (housekeepingStatus === 'dirty') return 'Dirty';
  if (housekeepingStatus === 'cleaning') return 'Cleaning';
  if (housekeepingStatus === 'inspected' || housekeepingStatus === 'inspection') return 'Inspected · Ready';
  if (housekeepingStatus === 'clean') return 'Clean · Ready';
  return housekeepingStatus;
}

function ineligibilityReason(
  room: { roomNumber: string; operationalStatus: string; housekeepingStatus: string },
  conflicted: boolean,
  forCheckIn: boolean
) {
  if (BLOCKED_OPERATIONAL.includes(room.operationalStatus as (typeof BLOCKED_OPERATIONAL)[number])) {
    return `Room ${room.roomNumber} is out of service.`;
  }
  if (conflicted || (forCheckIn && room.operationalStatus === 'occupied')) {
    return `Room ${room.roomNumber} is no longer available. Choose another room.`;
  }
  if (forCheckIn && !READY_HOUSEKEEPING.includes(room.housekeepingStatus as (typeof READY_HOUSEKEEPING)[number])) {
    return `Room ${room.roomNumber} is not clean and ready for check-in.`;
  }
  return undefined;
}

export async function listEligibleRooms(scope: AssignmentScope): Promise<EligibleRoom[]> {
  const propertyRooms = await db
    .select({
      id: rooms.id,
      roomNumber: rooms.roomNumber,
      floor: rooms.floor,
      roomTypeId: rooms.roomTypeId,
      operationalStatus: rooms.operationalStatus,
      housekeepingStatus: rooms.housekeepingStatus,
    })
    .from(rooms)
    .where(and(eq(rooms.propertyId, scope.propertyId), eq(rooms.roomTypeId, scope.roomTypeId)))
    .orderBy(rooms.roomNumber);

  const [roomType] = await db
    .select({ name: roomTypes.name, basePriceMinorUnits: roomTypes.basePriceMinorUnits })
    .from(roomTypes)
    .where(and(eq(roomTypes.id, scope.roomTypeId), eq(roomTypes.propertyId, scope.propertyId)))
    .limit(1);

  const category = await categoryNightsAvailable(
    db,
    scope.propertyId,
    scope.roomTypeId,
    scope.checkInDate,
    scope.checkOutDate,
    scope.excludeReservationId,
  );
  const categoryReason = category.minAvailable < 1 ? categorySoldOutMessage(category.blockers) : undefined;

  const assigned = await db
    .select({
      id: reservations.id,
      roomId: reservations.roomId,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.propertyId, scope.propertyId),
        inArray(reservations.status, [...ACTIVE_STAY_STATUSES]),
        sql`${reservations.roomId} is not null`
      )
    );

  return propertyRooms.map((room) => {
    const conflicted = assigned.some(
      (stay) =>
        stay.roomId === room.id &&
        stay.id !== scope.excludeReservationId &&
        stayNightsOverlap(stay.checkInDate, stay.checkOutDate, scope.checkInDate, scope.checkOutDate)
    );
    const reason = ineligibilityReason(room, conflicted, Boolean(scope.forCheckIn)) || categoryReason;
    return {
      ...room,
      eligible: !reason,
      reason,
      readinessLabel: readinessLabel(room.housekeepingStatus, room.operationalStatus),
      roomTypeName: roomType?.name,
      nightlyRateMinorUnits: roomType?.basePriceMinorUnits,
    };
  });
}

export async function listStayEligibleRooms(
  propertyId: string,
  checkInDate: string,
  checkOutDate: string,
  excludeReservationId?: string | null,
): Promise<EligibleRoom[]> {
  const types = await db
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .where(eq(roomTypes.propertyId, propertyId));
  const lists = await Promise.all(
    types.map((roomType) =>
      listEligibleRooms({
        propertyId,
        roomTypeId: roomType.id,
        checkInDate,
        checkOutDate,
        excludeReservationId,
      }),
    ),
  );
  return lists.flat().sort((left, right) => left.roomNumber.localeCompare(right.roomNumber, undefined, { numeric: true }));
}

export async function assertRoomEligible(
  tx: any,
  scope: AssignmentScope,
  roomId: string | null | undefined
) {
  if (!roomId) {
    throw new Error('ROOM_ASSIGNMENT_REQUIRED');
  }

  const [room] = await tx
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1)
    .for('update');

  if (!room || room.propertyId !== scope.propertyId) {
    throw new Error('This room is not available in your property.');
  }
  if (room.roomTypeId !== scope.roomTypeId) {
    throw new Error('Choose a room in this room type.');
  }
  if (BLOCKED_OPERATIONAL.includes(room.operationalStatus as (typeof BLOCKED_OPERATIONAL)[number])) {
    throw new Error(`Room ${room.roomNumber} is no longer available. Choose another room.`);
  }

  const conflicts = await tx
    .select({ id: reservations.id, roomId: reservations.roomId })
    .from(reservations)
    .where(
      and(
        eq(reservations.roomId, roomId),
        eq(reservations.propertyId, scope.propertyId),
        inArray(reservations.status, [...ACTIVE_STAY_STATUSES]),
        sql`${reservations.checkInDate} < ${scope.checkOutDate}`,
        sql`${reservations.checkOutDate} > ${scope.checkInDate}`,
        scope.excludeReservationId ? ne(reservations.id, scope.excludeReservationId) : sql`true`
      )
    )
    .limit(1)
    .for('update');

  if (conflicts.length > 0) {
    throw new Error(`Room ${room.roomNumber} is no longer available. Choose another room.`);
  }

  if (scope.forCheckIn && room.operationalStatus === 'occupied') {
    throw new Error(`Room ${room.roomNumber} is no longer available. Choose another room.`);
  }

  if (scope.forCheckIn && !READY_HOUSEKEEPING.includes(room.housekeepingStatus as (typeof READY_HOUSEKEEPING)[number])) {
    throw new Error('Choose an available, clean room of the booked room type.');
  }

  return room;
}
