export interface ReservationItem {
  id: string;
  reference: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomType: string;
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
}

export interface RoomItem {
  id: string;
  number: string;
  type: string;
  floor: string;
  operational: 'available' | 'occupied' | 'maintenance';
  housekeeping: 'clean' | 'cleaning' | 'dirty' | 'inspection';
  imageUrl?: string;
}
