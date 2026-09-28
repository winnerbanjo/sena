import type { ReservationItem } from './mock-data';

export type EligiblePhysicalRoom = {
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

export function mapReservationItem(r: {
  id: string;
  reference: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  roomTypeName?: string;
  roomTypeId?: string;
  roomId?: string | null;
  roomNumber?: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  numGuests?: number;
  source?: ReservationItem['source'];
  status: ReservationItem['status'];
  paymentStatus: ReservationItem['paymentStatus'];
  totalAmountMinorUnits: number;
  paidAmountMinorUnits: number;
  pendingTransferProof?: boolean;
  timeline?: ReservationItem['timeline'];
}): ReservationItem {
  return {
    id: r.id,
    reference: r.reference,
    guestName: r.guestName || 'Unnamed Guest',
    guestEmail: r.guestEmail || '',
    guestPhone: r.guestPhone || '',
    roomType: r.roomTypeName || 'Room type unavailable',
    roomTypeId: r.roomTypeId,
    roomId: r.roomId || null,
    roomNumber: r.roomNumber || 'Unassigned',
    checkInDate: r.checkInDate,
    checkOutDate: r.checkOutDate,
    nights: r.nights,
    numGuests: r.numGuests || 1,
    source: r.source || 'direct',
    status: r.status,
    paymentStatus: r.paymentStatus,
    totalAmountMinorUnits: r.totalAmountMinorUnits,
    paidAmountMinorUnits: r.paidAmountMinorUnits,
    pendingTransferProof: Boolean(r.pendingTransferProof),
    timeline: r.timeline || [],
  };
}

export function isPhysicalRoomAssigned(reservation: Pick<ReservationItem, 'roomId' | 'roomNumber'>) {
  return Boolean(reservation.roomId) && reservation.roomNumber !== 'Unassigned';
}

export function formatAssignedRoom(roomNumber?: string | null) {
  if (!roomNumber || roomNumber === 'Unassigned') return 'Unassigned';
  return roomNumber.startsWith('Room ') ? roomNumber : `Room ${roomNumber}`;
}
