export interface ReservationItem {
  id: string;
  reference: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomType: string;
  roomTypeId?: string;
  apartmentId?: string | null;
  apartmentName?: string | null;
  roomId?: string | null;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  numGuests: number;
  source: 'direct' | 'walk_in' | 'booking_com' | 'airbnb' | 'phone' | 'whatsapp';
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  paymentStatus: 'paid' | 'part_payment' | 'pay_later';
  totalAmountMinorUnits: number;
  paidAmountMinorUnits: number;
  pendingTransferProof?: boolean;
  noteCount?: number;
  timeline: { time: string; text: string; actor: string }[];
}

export interface RoomCategory {
  id: string;
  name: string;
  code: string;
  baseRateMinorUnits: number;
  maxGuests: number;
  bedType: string;
  description: string;
  amenities: string[];
  imageUrl?: string;
  images?: string[];
  gallery?: { id: string; url: string; isCover: boolean; sortOrder: number; file?: File }[];
}

export interface RoomItem {
  id: string;
  number: string;
  type: string;
  roomTypeId?: string;
  floor: string;
  operational: 'available' | 'occupied' | 'maintenance' | 'blocked';
  housekeeping: 'clean' | 'cleaning' | 'dirty' | 'inspection';
  housekeepingAssignee?: string | null;
  description?: string;
  imageUrl?: string;
  images?: string[];
  gallery?: { id: string; url: string; isCover: boolean; sortOrder: number; file?: File }[];
}
