/**
 * Sena Domain & Contract Types
 * Strict domain models for Sena Hospitality Operating System
 */

// Money: Stored strictly in integer minor units (e.g. Kobo for NGN)
export type MinorUnits = number; // e.g. 12000000 = ₦120,000.00
export type CurrencyCode = 'NGN' | 'USD' | 'EUR' | 'GBP';

// Organizations & Properties
export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Property {
  id: string;
  organizationId: string;
  name: string;
  code: string; // e.g. 'SC-LEK'
  propertyType: 'hotel' | 'serviced_apartment' | 'boutique' | 'resort';
  country: string;
  address: string;
  phone: string;
  email: string;
  timezone: string; // e.g. 'Africa/Lagos'
  currency: CurrencyCode;
  checkInTime: string; // '14:00'
  checkOutTime: string; // '11:00'
  createdAt: Date;
  updatedAt: Date;
}

// User & Role-Based Access Control
export type Role =
  | 'owner'
  | 'manager'
  | 'front_desk'
  | 'housekeeping'
  | 'accountant'
  | 'marketing';

export type Permission =
  | 'reservation.read'
  | 'reservation.create'
  | 'reservation.edit'
  | 'reservation.cancel'
  | 'guest.read'
  | 'guest.edit'
  | 'room.read'
  | 'room.edit'
  | 'housekeeping.update'
  | 'payment.read'
  | 'payment.record'
  | 'payment.refund'
  | 'analytics.read'
  | 'website.edit'
  | 'website.publish'
  | 'staff.invite'
  | 'billing.manage';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PropertyMember {
  id: string;
  propertyId: string;
  userId: string;
  role: Role;
  permissions?: Permission[];
  createdAt: Date;
}

// Room Types & Rooms
export interface RoomType {
  id: string;
  propertyId: string;
  name: string; // e.g. 'Executive Room'
  description?: string;
  capacity: number; // max guests
  bedType: string; // 'King bed', 'Queen bed'
  basePriceMinorUnits: MinorUnits;
  amenities: string[];
  images: string[];
  totalInventory: number;
  websiteVisibility: boolean;
  bookingVisibility: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Two separate states per PRD Section 48
export type RoomOperationalStatus =
  | 'available'
  | 'occupied'
  | 'blocked'
  | 'maintenance';

export type HousekeepingStatus =
  | 'clean'
  | 'dirty'
  | 'cleaning'
  | 'inspection';

export interface Room {
  id: string;
  propertyId: string;
  roomTypeId: string;
  roomNumber: string; // e.g. '204'
  floor?: string; // 'Floor 2'
  operationalStatus: RoomOperationalStatus;
  housekeepingStatus: HousekeepingStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Inventory Model (Per Property + Room Type + Date)
export interface InventoryRecord {
  id: string;
  propertyId: string;
  roomTypeId: string;
  date: string; // YYYY-MM-DD (property-local calendar date)
  totalInventory: number;
  reservedInventory: number;
  blockedInventory: number;
  availableInventory: number; // derived: total - reserved - blocked
}

// Guests
export interface Guest {
  id: string;
  organizationId: string;
  propertyId: string;
  fullName: string;
  email: string;
  phone: string;
  identificationType?: 'nin' | 'passport' | 'drivers_license';
  identificationNumber?: string;
  preferences: string[];
  notes?: string;
  totalStays: number;
  totalNights: number;
  lifetimeBookingValueMinorUnits: MinorUnits;
  createdAt: Date;
  updatedAt: Date;
}

// Reservations
export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type BookingSource =
  | 'direct'
  | 'walk_in'
  | 'phone'
  | 'whatsapp'
  | 'booking_com'
  | 'airbnb'
  | 'other';

export type PaymentStatus =
  | 'paid'
  | 'part_payment'
  | 'pay_later'
  | 'refunded';

export interface Reservation {
  id: string;
  reference: string; // e.g. 'SEN-84K2JQ'
  propertyId: string;
  guestId: string;
  roomTypeId: string;
  roomId?: string; // assigned room (optional before check-in)
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  nights: number;
  numGuests: number;
  adults: number;
  children: number;
  source: BookingSource;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  totalAmountMinorUnits: MinorUnits;
  paidAmountMinorUnits: MinorUnits;
  balanceMinorUnits: MinorUnits; // total - paid
  specialRequests?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReservationEvent {
  id: string;
  reservationId: string;
  actorId?: string;
  actorName: string;
  eventType:
    | 'reservation_created'
    | 'payment_received'
    | 'checked_in'
    | 'checked_out'
    | 'room_assigned'
    | 'status_changed'
    | 'cancelled';
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Payments & Paystack
export type PaymentProvider = 'paystack' | 'manual';
export type PaymentMethod = 'card' | 'bank_transfer' | 'cash' | 'pos';
export type PaymentRecordStatus = 'pending' | 'successful' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  propertyId: string;
  reservationId: string;
  amountMinorUnits: MinorUnits;
  currency: CurrencyCode;
  provider: PaymentProvider;
  providerReference?: string;
  method: PaymentMethod;
  status: PaymentRecordStatus;
  recordedByUserId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Housekeeping
export interface HousekeepingTask {
  id: string;
  propertyId: string;
  roomId: string;
  status: HousekeepingStatus;
  assignedToUserId?: string;
  assignedToName?: string;
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Offers & Promotions
export interface Offer {
  id: string;
  propertyId: string;
  name: string;
  promoCode: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number; // percentage (e.g. 20) or minor units
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
  applicableRoomTypeIds: string[];
  minimumStayNights: number;
  maximumUses?: number;
  currentUses: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Audit Activity Logs
export interface ActivityLog {
  id: string;
  organizationId: string;
  propertyId: string;
  actorId?: string;
  actorName: string;
  action: string;
  resource: string;
  resourceId: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  createdAt: Date;
}

// Dashboard Overview Metrics
export interface DashboardMetrics {
  arrivalsCount: number;
  arrivalsCheckedIn: number;
  departuresCount: number;
  inHouseCount: number;
  occupancyPercentage: number;
  occupiedRooms: number;
  totalRooms: number;
  availableRooms: number;
  roomsToCleanCount: number;
  roomsCleaningCount: number;
  monthBookingValueMinorUnits: MinorUnits;
  outstandingPaymentsMinorUnits: MinorUnits;
}
