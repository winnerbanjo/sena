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

export const INITIAL_RESERVATIONS: ReservationItem[] = [
  {
    id: 'res-1',
    reference: 'SEN-84K2JQ',
    guestName: 'Ada James',
    guestEmail: 'ada.james@example.com',
    guestPhone: '+234 802 345 6789',
    roomType: 'Executive Room',
    roomNumber: '204',
    checkInDate: '2026-09-23',
    checkOutDate: '2026-09-26',
    nights: 3,
    numGuests: 2,
    source: 'direct',
    status: 'confirmed',
    paymentStatus: 'paid',
    totalAmountMinorUnits: 36000000, // ₦360,000
    paidAmountMinorUnits: 36000000,
    timeline: [
      { time: '23 Sep, 10:42', text: 'Reservation created via Direct Website', actor: 'Guest' },
      { time: '23 Sep, 10:43', text: 'Payment of ₦360,000 received via Paystack', actor: 'Paystack' },
    ],
  },
  {
    id: 'res-2',
    reference: 'SEN-39LM8R',
    guestName: 'Tobi Ade',
    guestEmail: 'tobi.ade@example.com',
    guestPhone: '+234 813 987 6543',
    roomType: 'Saffron Suite',
    roomNumber: '301',
    checkInDate: '2026-09-23',
    checkOutDate: '2026-09-25',
    nights: 2,
    numGuests: 2,
    source: 'airbnb',
    status: 'confirmed',
    paymentStatus: 'paid',
    totalAmountMinorUnits: 36000000,
    paidAmountMinorUnits: 36000000,
    timeline: [
      { time: '22 Sep, 16:15', text: 'Reservation imported via Airbnb', actor: 'Airbnb' },
      { time: '22 Sep, 16:16', text: 'Prepaid by channel', actor: 'Airbnb' },
    ],
  },
  {
    id: 'res-3',
    reference: 'SEN-55PQ2W',
    guestName: 'Tolu Martins',
    guestEmail: 'tolu.martins@example.com',
    guestPhone: '+234 905 111 2233',
    roomType: 'Deluxe Room',
    roomNumber: '105',
    checkInDate: '2026-09-23',
    checkOutDate: '2026-09-24',
    nights: 1,
    numGuests: 1,
    source: 'phone',
    status: 'confirmed',
    paymentStatus: 'pay_later',
    totalAmountMinorUnits: 8000000, // ₦80,000
    paidAmountMinorUnits: 0,
    timeline: [
      { time: '23 Sep, 08:30', text: 'Phone reservation created by Samuel', actor: 'Samuel' },
    ],
  },
  {
    id: 'res-4',
    reference: 'SEN-71NX9A',
    guestName: 'David Okoro',
    guestEmail: 'david.okoro@example.com',
    guestPhone: '+234 701 444 5566',
    roomType: 'Executive Room',
    roomNumber: '205',
    checkInDate: '2026-09-22',
    checkOutDate: '2026-09-26',
    nights: 4,
    numGuests: 2,
    source: 'booking_com',
    status: 'checked_in',
    paymentStatus: 'paid',
    totalAmountMinorUnits: 48000000,
    paidAmountMinorUnits: 48000000,
    timeline: [
      { time: '22 Sep, 14:10', text: 'Checked in by Samuel to Room 205', actor: 'Samuel' },
    ],
  },
  {
    id: 'res-5',
    reference: 'SEN-92ZT4K',
    guestName: 'Sarah Bello',
    guestEmail: 'sarah.bello@example.com',
    guestPhone: '+234 809 777 8899',
    roomType: 'Deluxe Room',
    roomNumber: '106',
    checkInDate: '2026-09-21',
    checkOutDate: '2026-09-23',
    nights: 2,
    numGuests: 1,
    source: 'walk_in',
    status: 'checked_in',
    paymentStatus: 'part_payment',
    totalAmountMinorUnits: 16000000,
    paidAmountMinorUnits: 12000000, // ₦40,000 balance
    timeline: [
      { time: '21 Sep, 15:00', text: 'Walk-in check-in by Amara', actor: 'Amara' },
      { time: '21 Sep, 15:05', text: 'Part payment of ₦120,000 recorded', actor: 'Amara' },
    ],
  },
];

export const INITIAL_ROOMS = [
  { id: 'rm-101', number: '101', type: 'Deluxe Room', floor: 'Floor 1', operational: 'available', housekeeping: 'clean' },
  { id: 'rm-102', number: '102', type: 'Deluxe Room', floor: 'Floor 1', operational: 'available', housekeeping: 'dirty' },
  { id: 'rm-103', number: '103', type: 'Deluxe Room', floor: 'Floor 1', operational: 'available', housekeeping: 'cleaning' },
  { id: 'rm-104', number: '104', type: 'Deluxe Room', floor: 'Floor 1', operational: 'available', housekeeping: 'clean' },
  { id: 'rm-105', number: '105', type: 'Deluxe Room', floor: 'Floor 1', operational: 'available', housekeeping: 'clean' },
  { id: 'rm-106', number: '106', type: 'Deluxe Room', floor: 'Floor 1', operational: 'occupied', housekeeping: 'clean' },
  { id: 'rm-201', number: '201', type: 'Executive Room', floor: 'Floor 2', operational: 'available', housekeeping: 'dirty' },
  { id: 'rm-202', number: '202', type: 'Executive Room', floor: 'Floor 2', operational: 'available', housekeeping: 'clean' },
  { id: 'rm-203', number: '203', type: 'Executive Room', floor: 'Floor 2', operational: 'available', housekeeping: 'clean' },
  { id: 'rm-204', number: '204', type: 'Executive Room', floor: 'Floor 2', operational: 'available', housekeeping: 'dirty' },
  { id: 'rm-205', number: '205', type: 'Executive Room', floor: 'Floor 2', operational: 'occupied', housekeeping: 'clean' },
  { id: 'rm-301', number: '301', type: 'Saffron Suite', floor: 'Floor 3', operational: 'available', housekeeping: 'clean' },
  { id: 'rm-302', number: '302', type: 'Saffron Suite', floor: 'Floor 3', operational: 'maintenance', housekeeping: 'inspection' },
];

export const INITIAL_ACTIVITY = [
  { id: 'act-1', text: 'Ada James direct booking confirmed for Executive 204', time: '2 min ago' },
  { id: 'act-2', text: 'Samuel recorded ₦120,000 payment for Sarah Bello', time: '8 min ago' },
  { id: 'act-3', text: 'Room 103 marked cleaning by Fatimah', time: '14 min ago' },
  { id: 'act-4', text: 'David Okoro checked into Room 205', time: '1 hour ago' },
];
