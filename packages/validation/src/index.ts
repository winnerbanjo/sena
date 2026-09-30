import { z } from 'zod';

/**
 * Zod Validation Schemas for Sena V1
 * Ensures strict runtime correctness across client and server
 */

// Onboarding & Property
export const propertyOnboardingSchema = z.object({
  propertyName: z.string().min(2, 'Property name is required'),
  propertyType: z.enum(['hotel', 'serviced_apartment', 'boutique', 'resort']),
  country: z.string().default('Nigeria'),
  address: z.string().min(5, 'Address is required'),
  phone: z.string().min(7, 'Phone number is required'),
  email: z.string().email('Invalid email address'),
  timezone: z.string().default('Africa/Lagos'),
  currency: z.enum(['NGN', 'USD', 'EUR', 'GBP']).default('NGN'),
  checkInTime: z.string().default('14:00'),
  checkOutTime: z.string().default('11:00'),
});

export type PropertyOnboardingInput = z.infer<typeof propertyOnboardingSchema>;

// Room Type
export const createRoomTypeSchema = z.object({
  name: z.string().min(2, 'Room type name is required'),
  description: z.string().optional(),
  capacity: z.coerce.number().min(1, 'Capacity must be at least 1'),
  bedType: z.string().min(2, 'Bed type is required'),
  basePriceMinorUnits: z.coerce.number().min(100, 'Price must be valid'),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  totalInventory: z.coerce.number().min(1, 'Must have at least 1 room'),
  websiteVisibility: z.boolean().default(true),
  bookingVisibility: z.boolean().default(true),
});

export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;

// Room
export const createRoomSchema = z.object({
  roomTypeId: z.string().uuid('Invalid room type ID'),
  roomNumber: z.string().min(1, 'Room number is required'),
  floor: z.string().optional(),
  operationalStatus: z
    .enum(['available', 'occupied', 'blocked', 'maintenance'])
    .default('available'),
  housekeepingStatus: z
    .enum(['clean', 'dirty', 'cleaning', 'inspection'])
    .default('clean'),
  notes: z.string().optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const APARTMENT_TYPES = [
  'studio',
  'one_bedroom',
  'two_bedroom',
  'three_bedroom',
  'four_plus',
  'penthouse',
  'duplex',
  'villa',
  'other',
] as const;

export const apartmentInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter the apartment name.').max(255),
    description: z.string().trim().max(4000).optional().nullable(),
    apartmentType: z.enum(APARTMENT_TYPES),
    apartmentTypeCustom: z.string().trim().max(100).optional().nullable(),
    bedrooms: z.coerce.number().int().min(0).max(30),
    bathrooms: z.coerce.number().int().min(0).max(30),
    bedConfiguration: z.string().trim().min(2, 'Enter the bed configuration.').max(100),
    maxGuests: z.coerce.number().int().min(1).max(50),
    basePriceMinorUnits: z.coerce.number().int().min(100, 'Enter a nightly rate.'),
    amenities: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
    usePropertyAddress: z.boolean().default(true),
    address: z.string().trim().max(500).optional().nullable(),
    area: z.string().trim().max(120).optional().nullable(),
    city: z.string().trim().max(120).optional().nullable(),
    state: z.string().trim().max(120).optional().nullable(),
    country: z.string().trim().max(100).optional().nullable(),
    websiteVisibility: z.boolean().default(true),
    bookingVisibility: z.boolean().default(true),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.apartmentType === 'other' && !data.apartmentTypeCustom?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Enter the apartment type.', path: ['apartmentTypeCustom'] });
    }
    if (!data.usePropertyAddress) {
      if (!data.address || data.address.trim().length < 5) {
        ctx.addIssue({ code: 'custom', message: 'Enter the apartment address.', path: ['address'] });
      }
      if (!data.city?.trim()) ctx.addIssue({ code: 'custom', message: 'Enter the city.', path: ['city'] });
      if (!data.country?.trim()) ctx.addIssue({ code: 'custom', message: 'Enter the country.', path: ['country'] });
    }
  });

export type ApartmentInput = z.infer<typeof apartmentInputSchema>;

// Guest
export const createGuestSchema = z.object({
  fullName: z.string().min(2, 'Guest full name is required'),
  email: z.string().email('Valid email address is required'),
  phone: z.string().min(7, 'Phone number is required'),
  identificationType: z.enum(['nin', 'passport', 'drivers_license']).optional(),
  identificationNumber: z.string().optional(),
  preferences: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type CreateGuestInput = z.infer<typeof createGuestSchema>;

// Reservation
export const createReservationSchema = z.object({
  propertyId: z.string().uuid(),
  roomTypeId: z.string().uuid().optional(),
  apartmentId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  numGuests: z.coerce.number().min(1).default(1),
  adults: z.coerce.number().min(1).default(1),
  children: z.coerce.number().min(0).default(0),
  source: z.enum([
    'direct',
    'walk_in',
    'phone',
    'whatsapp',
    'booking_com',
    'airbnb',
    'other',
  ]),
  paymentStatus: z
    .enum(['paid', 'part_payment', 'pay_later', 'refunded'])
    .default('pay_later'),
  paidAmountMinorUnits: z.coerce.number().min(0).default(0),
  specialRequests: z.string().optional(),
  // Embedded or linked guest
  guestId: z.string().uuid().optional(),
  guest: createGuestSchema.optional(),
}).refine(
  (data) => data.checkOutDate > data.checkInDate,
  {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  }
).refine(
  (data) => Boolean(data.roomTypeId) !== Boolean(data.apartmentId),
  { message: 'Choose a room or an apartment.', path: ['roomTypeId'] }
).refine(
  (data) => Boolean(data.guestId || data.guest),
  {
    message: 'Either an existing guest ID or new guest details must be provided',
    path: ['guestId'],
  }
);

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

// Payment Record
export const recordPaymentSchema = z.object({
  reservationId: z.string().uuid(),
  amountMinorUnits: z.coerce.number().min(1, 'Amount must be greater than zero'),
  method: z.enum(['card', 'bank_transfer', 'cash', 'pos']),
  provider: z.enum(['paystack', 'manual']).default('manual'),
  providerReference: z.string().optional(),
  notes: z.string().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

// Housekeeping Update
export const updateHousekeepingStatusSchema = z.object({
  roomId: z.string().uuid(),
  status: z.enum(['clean', 'dirty', 'cleaning', 'inspection']),
  notes: z.string().optional(),
});

export type UpdateHousekeepingStatusInput = z.infer<
  typeof updateHousekeepingStatusSchema
>;
