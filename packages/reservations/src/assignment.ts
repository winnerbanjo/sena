import { db, reservations, rooms } from '@sena/database';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';

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
};

export type AssignmentScope = {
  propertyId: string;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  excludeReservationId?: string | null;
  forCheckIn?: boolean;
};

function staysOverlap(leftIn: string, leftOut: string, rightIn: string, rightOut: string) {
  return leftIn < rightOut && leftOut > rightIn;
}

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
        staysOverlap(stay.checkInDate, stay.checkOutDate, scope.checkInDate, scope.checkOutDate)
    );
    const reason = ineligibilityReason(room, conflicted, Boolean(scope.forCheckIn));
    return {
      ...room,
      eligible: !reason,
      reason,
      readinessLabel: readinessLabel(room.housekeepingStatus, room.operationalStatus),
    };
  });
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
