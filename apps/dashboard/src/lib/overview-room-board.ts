export type OverviewBoardStatus =
  | 'available'
  | 'occupied'
  | 'needs_cleaning'
  | 'cleaning'
  | 'out_of_service';

export type OverviewBoardRoom = {
  id: string;
  roomNumber?: string | null;
  number?: string | null;
  roomType?: { name?: string | null } | null;
  roomTypeName?: string | null;
  operational?: string | null;
  operationalStatus?: string | null;
  housekeeping?: string | null;
  housekeepingStatus?: string | null;
};

/** Display-only. Occupied still wins over housekeeping, matching the current Overview strip. */
export function overviewBoardStatus(room: OverviewBoardRoom): OverviewBoardStatus {
  const operational = room.operationalStatus || room.operational || '';
  const housekeeping = room.housekeepingStatus || room.housekeeping || '';
  if (operational === 'occupied') return 'occupied';
  if (operational === 'maintenance' || operational === 'blocked') return 'out_of_service';
  if (housekeeping === 'dirty') return 'needs_cleaning';
  if (housekeeping === 'cleaning') return 'cleaning';
  return 'available';
}

export function overviewRoomNumber(room: OverviewBoardRoom): string {
  return String(room.roomNumber || room.number || '').trim();
}

export function overviewRoomCategory(room: OverviewBoardRoom): string {
  return String(room.roomType?.name || room.roomTypeName || '').trim();
}

export function sortRoomsByNumber<T extends OverviewBoardRoom>(rooms: T[]): T[] {
  return [...rooms].sort((left, right) =>
    overviewRoomNumber(left).localeCompare(overviewRoomNumber(right), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );
}
