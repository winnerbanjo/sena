import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// 1. Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  avatarUrl: text('avatar_url'),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  locale: varchar('locale', { length: 16 }).notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 1b. Auth.js Accounts & Sessions
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar('type', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: varchar('token_type', { length: 255 }),
    scope: varchar('scope', { length: 255 }),
    idToken: text('id_token'),
    sessionState: varchar('session_state', { length: 255 }),
  },
  (t) => [
    uniqueIndex('account_provider_idx').on(t.provider, t.providerAccountId),
  ]
);

export const sessions = pgTable('sessions', {
  sessionToken: varchar('session_token', { length: 255 }).notNull().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

// 1c. Verification Tokens / Email OTP
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('verification_tokens_identifier_token_idx').on(t.identifier, t.token),
  ]
);

// 2. Organizations (multi-property parent)
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Organization Members
export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 50 }).notNull(), // 'owner', 'manager', etc.
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('org_user_idx').on(t.organizationId, t.userId),
  ]
);

// 4. Properties (Hotels / Serviced Apartments)
export const properties = pgTable('properties', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }),
  code: varchar('code', { length: 20 }).notNull(),
  propertyType: varchar('property_type', { length: 50 }).notNull().default('hotel'),
  country: varchar('country', { length: 100 }).notNull().default('Nigeria'),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  timezone: varchar('timezone', { length: 100 }).notNull().default('Africa/Lagos'),
  currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
  checkInTime: varchar('check_in_time', { length: 10 }).notNull().default('14:00'),
  checkOutTime: varchar('check_out_time', { length: 10 }).notNull().default('11:00'),
  checkInPaymentPolicy: varchar('check_in_payment_policy', { length: 40 }).notNull().default('allow_outstanding'),
  checkOutPaymentPolicy: varchar('check_out_payment_policy', { length: 40 }).notNull().default('allow_outstanding'),
  directBookingPayAtProperty: boolean('direct_booking_pay_at_property').notNull().default(true),
  directBookingBankTransfer: boolean('direct_booking_bank_transfer').notNull().default(true),
  preferredOnlineProvider: varchar('preferred_online_provider', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. Property Members
export const propertyMembers = pgTable(
  'property_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    permissions: jsonb('permissions').$type<string[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('prop_user_idx').on(t.propertyId, t.userId),
  ]
);

// 6. Room Types
export const roomTypes = pgTable('room_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id')
    .references(() => properties.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  capacity: integer('capacity').notNull().default(2),
  bedType: varchar('bed_type', { length: 100 }).notNull(),
  basePriceMinorUnits: integer('base_price_minor_units').notNull(), // Kobo
  amenities: jsonb('amenities').$type<string[]>().default([]).notNull(),
  images: jsonb('images').$type<string[]>().default([]).notNull(),
  totalInventory: integer('total_inventory').notNull().default(1),
  websiteVisibility: boolean('website_visibility').default(true).notNull(),
  bookingVisibility: boolean('booking_visibility').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. Rooms
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    roomTypeId: uuid('room_type_id')
      .references(() => roomTypes.id, { onDelete: 'cascade' })
      .notNull(),
    roomNumber: varchar('room_number', { length: 50 }).notNull(),
    floor: varchar('floor', { length: 50 }),
    operationalStatus: varchar('operational_status', { length: 50 })
      .default('available')
      .notNull(), // 'available', 'occupied', 'blocked', 'maintenance'
    housekeepingStatus: varchar('housekeeping_status', { length: 50 })
      .default('clean')
      .notNull(), // 'clean', 'dirty', 'cleaning', 'inspection'
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('prop_room_num_idx').on(t.propertyId, t.roomNumber),
    index('rooms_prop_idx').on(t.propertyId),
  ]
);

/**
 * Standalone bookable apartments (serviced apartments, shortlets).
 * One row is one unit. This is not a room category.
 * Properties are not locked to hotels or apartments; both can exist together.
 */
export const apartments = pgTable(
  'apartments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    apartmentType: varchar('apartment_type', { length: 50 }).notNull(),
    apartmentTypeCustom: varchar('apartment_type_custom', { length: 100 }),
    bedrooms: integer('bedrooms').notNull().default(1),
    bathrooms: integer('bathrooms').notNull().default(1),
    bedConfiguration: varchar('bed_configuration', { length: 100 }).notNull(),
    maxGuests: integer('max_guests').notNull().default(2),
    basePriceMinorUnits: integer('base_price_minor_units').notNull(),
    amenities: jsonb('amenities').$type<string[]>().default([]).notNull(),
    usePropertyAddress: boolean('use_property_address').notNull().default(true),
    address: text('address'),
    area: varchar('area', { length: 120 }),
    city: varchar('city', { length: 120 }),
    state: varchar('state', { length: 120 }),
    country: varchar('country', { length: 100 }),
    operationalStatus: varchar('operational_status', { length: 50 }).notNull().default('available'),
    housekeepingStatus: varchar('housekeeping_status', { length: 50 }).notNull().default('clean'),
    websiteVisibility: boolean('website_visibility').notNull().default(true),
    bookingVisibility: boolean('booking_visibility').notNull().default(true),
    notes: text('notes'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    archivedBy: uuid('archived_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('apartments_property_name_idx').on(t.propertyId, t.name),
    index('apartments_property_idx').on(t.propertyId),
    index('apartments_property_archived_idx').on(t.propertyId, t.archivedAt),
  ]
);

/** Gallery photos for a room category, one physical room, or one apartment. */
export const roomImages = pgTable(
  'room_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    roomTypeId: uuid('room_type_id').references(() => roomTypes.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }),
    apartmentId: uuid('apartment_id').references(() => apartments.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    url: text('url').notNull(),
    originalFilename: varchar('original_filename', { length: 255 }),
    contentType: varchar('content_type', { length: 100 }).notNull(),
    byteSize: integer('byte_size').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    isCover: boolean('is_cover').notNull().default(false),
    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('room_images_type_idx').on(t.roomTypeId, t.sortOrder),
    index('room_images_room_idx').on(t.roomId, t.sortOrder),
    index('room_images_apartment_idx').on(t.apartmentId, t.sortOrder),
    index('room_images_property_idx').on(t.propertyId),
  ]
);

// 8. Inventory Model (Per Property + Room Type + Date)
// Crucial for sub-100ms availability queries & concurrency locks
export const inventory = pgTable(
  'inventory',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    roomTypeId: uuid('room_type_id')
      .references(() => roomTypes.id, { onDelete: 'cascade' })
      .notNull(),
    date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
    totalInventory: integer('total_inventory').notNull().default(0),
    reservedInventory: integer('reserved_inventory').notNull().default(0),
    blockedInventory: integer('blocked_inventory').notNull().default(0),
  },
  (t) => [
    uniqueIndex('prop_room_date_idx').on(t.propertyId, t.roomTypeId, t.date),
    index('inv_prop_date_idx').on(t.propertyId, t.date),
  ]
);

// 8b. Booking Holds (10-minute temporary inventory holds during guest checkout)
export const bookingHolds = pgTable(
  'booking_holds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    roomTypeId: uuid('room_type_id').references(() => roomTypes.id, { onDelete: 'cascade' }),
    apartmentId: uuid('apartment_id').references(() => apartments.id, { onDelete: 'cascade' }),
    checkInDate: varchar('check_in_date', { length: 10 }).notNull(), // YYYY-MM-DD
    checkOutDate: varchar('check_out_date', { length: 10 }).notNull(), // YYYY-MM-DD
    quantity: integer('quantity').notNull().default(1),
    guestEmail: varchar('guest_email', { length: 255 }),
    guestName: varchar('guest_name', { length: 255 }),
    status: varchar('status', { length: 30 }).notNull().default('active'), // 'active', 'converted', 'released', 'expired'
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('holds_prop_rt_status_idx').on(t.propertyId, t.roomTypeId, t.status, t.expiresAt),
    index('holds_apartment_status_idx').on(t.propertyId, t.apartmentId, t.status, t.expiresAt),
  ]
);

// 9. Guests
export const guests = pgTable(
  'guests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }).notNull(),
    identificationType: varchar('identification_type', { length: 50 }),
    identificationNumber: varchar('identification_number', { length: 100 }),
    preferences: jsonb('preferences').$type<string[]>().default([]).notNull(),
    notes: text('notes'),
    totalStays: integer('total_stays').default(0).notNull(),
    totalNights: integer('total_nights').default(0).notNull(),
    lifetimeBookingValueMinorUnits: integer('lifetime_booking_value_minor_units')
      .default(0)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('guests_prop_email_idx').on(t.propertyId, t.email),
    index('guests_prop_phone_idx').on(t.propertyId, t.phone),
  ]
);

// 9b. Booking groups — one guest intent spanning several one-room reservations.
export const bookingGroups = pgTable(
  'booking_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    guestId: uuid('guest_id')
      .references(() => guests.id, { onDelete: 'cascade' })
      .notNull(),
    reference: varchar('reference', { length: 50 }).notNull().unique(),
    checkInDate: varchar('check_in_date', { length: 10 }).notNull(),
    checkOutDate: varchar('check_out_date', { length: 10 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('booking_groups_property_idx').on(t.propertyId)]
);

// 10. Reservations
export const reservations = pgTable(
  'reservations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reference: varchar('reference', { length: 50 }).notNull().unique(), // e.g. SEN-84K2JQ
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    guestId: uuid('guest_id')
      .references(() => guests.id, { onDelete: 'cascade' })
      .notNull(),
    roomTypeId: uuid('room_type_id').references(() => roomTypes.id, { onDelete: 'cascade' }),
    apartmentId: uuid('apartment_id').references(() => apartments.id, { onDelete: 'restrict' }),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    bookingGroupId: uuid('booking_group_id').references(() => bookingGroups.id, { onDelete: 'set null' }),
    checkInDate: varchar('check_in_date', { length: 10 }).notNull(), // YYYY-MM-DD
    checkOutDate: varchar('check_out_date', { length: 10 }).notNull(), // YYYY-MM-DD
    nights: integer('nights').notNull(),
    numGuests: integer('num_guests').notNull().default(1),
    adults: integer('adults').notNull().default(1),
    children: integer('children').notNull().default(0),
    source: varchar('source', { length: 50 }).notNull().default('direct'),
    status: varchar('status', { length: 50 }).notNull().default('confirmed'),
    paymentStatus: varchar('payment_status', { length: 50 }).notNull().default('pay_later'),
    totalAmountMinorUnits: integer('total_amount_minor_units').notNull(),
    paidAmountMinorUnits: integer('paid_amount_minor_units').notNull().default(0),
    specialRequests: text('special_requests'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('res_prop_status_idx').on(t.propertyId, t.status),
    index('res_prop_dates_idx').on(t.propertyId, t.checkInDate, t.checkOutDate),
    index('res_guest_idx').on(t.guestId),
    index('res_apartment_dates_idx').on(t.apartmentId, t.checkInDate, t.checkOutDate),
    index('res_booking_group_idx').on(t.bookingGroupId),
  ]
);

// 11. Reservation Events (Timeline)
export const reservationEvents = pgTable(
  'reservation_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reservationId: uuid('reservation_id')
      .references(() => reservations.id, { onDelete: 'cascade' })
      .notNull(),
    actorId: uuid('actor_id'),
    actorName: varchar('actor_name', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    description: text('description').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('res_events_res_idx').on(t.reservationId),
  ]
);

/** Internal staff notes on a reservation. Append-only. Never shown to guests. */
export const reservationNotes = pgTable(
  'reservation_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    reservationId: uuid('reservation_id')
      .references(() => reservations.id, { onDelete: 'cascade' })
      .notNull(),
    authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('reservation_notes_res_idx').on(t.propertyId, t.reservationId, t.createdAt),
  ]
);

// 12. Payments
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    reservationId: uuid('reservation_id').references(() => reservations.id, { onDelete: 'set null' }),
    invoiceId: uuid('invoice_id').references((): AnyPgColumn => propertyInvoices.id, { onDelete: 'set null' }),
    integrationId: uuid('integration_id').references((): AnyPgColumn => integrations.id, { onDelete: 'restrict' }),
    internalReference: varchar('internal_reference', { length: 255 }),
    amountMinorUnits: integer('amount_minor_units').notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
    provider: varchar('provider', { length: 50 }).notNull().default('manual'), // 'paystack', 'flutterwave', 'manual'
    providerReference: varchar('provider_reference', { length: 255 }),
    providerTransactionId: varchar('provider_transaction_id', { length: 255 }),
    method: varchar('method', { length: 50 }).notNull().default('cash'),
    status: varchar('status', { length: 50 }).notNull().default('successful'),
    source: varchar('source', { length: 50 }).notNull().default('front_desk'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('payments_res_idx').on(t.reservationId),
    index('payments_prop_idx').on(t.propertyId),
    uniqueIndex('payments_provider_ref_idx').on(t.provider, t.providerReference),
  ]
);

/** Supporting proof for a recorded payment. Immutable after create. Not ledger truth. */
export const paymentReceipts = pgTable(
  'payment_receipts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    paymentId: uuid('payment_id')
      .references(() => payments.id, { onDelete: 'cascade' })
      .notNull(),
    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id),
    storageKey: text('storage_key').notNull(),
    contentType: varchar('content_type', { length: 100 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }),
    byteSize: integer('byte_size').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('payment_receipts_payment_idx').on(t.paymentId),
    index('payment_receipts_property_idx').on(t.propertyId, t.createdAt),
  ]
);

export const integrationCatalog = pgTable('integration_catalog', {
  provider: varchar('provider', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  description: text('description').notNull(),
  availability: varchar('availability', { length: 30 }).notNull().default('coming_soon'),
  authType: varchar('auth_type', { length: 30 }).notNull(),
  logoUrl: text('logo_url'),
  docsUrl: text('docs_url'),
  capabilities: jsonb('capabilities').$type<string[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(100),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const integrations = pgTable('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar('provider', { length: 50 }).references(() => integrationCatalog.provider).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('disconnected'),
  healthStatus: varchar('health_status', { length: 40 }).notNull().default('configured'),
  mode: varchar('mode', { length: 10 }),
  environment: varchar('environment', { length: 30 }),
  externalAccountId: varchar('external_account_id', { length: 255 }),
  webhookTokenHash: varchar('webhook_token_hash', { length: 64 }).notNull(),
  webhookTokenEncrypted: text('webhook_token_encrypted').notNull(),
  webhookStatus: varchar('webhook_status', { length: 30 }).notNull().default('not_configured'),
  connectedAt: timestamp('connected_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  webhookVerifiedAt: timestamp('webhook_verified_at', { withTimezone: true }),
  disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastSyncAttemptAt: timestamp('last_sync_attempt_at', { withTimezone: true }),
  lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  lastErrorMessage: text('last_error_message'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('integrations_property_provider_idx').on(t.propertyId, t.provider), uniqueIndex('integrations_webhook_token_idx').on(t.webhookTokenHash), index('integrations_health_idx').on(t.provider, t.status, t.healthStatus)]);

export const integrationCredentials = pgTable('integration_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),
  integrationId: uuid('integration_id').references(() => integrations.id, { onDelete: 'cascade' }).notNull(),
  credentialType: varchar('credential_type', { length: 50 }).notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  maskedSuffix: varchar('masked_suffix', { length: 16 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  rotatedAt: timestamp('rotated_at', { withTimezone: true }),
}, (t) => [uniqueIndex('integration_credentials_type_idx').on(t.integrationId, t.credentialType)]);

export const integrationOauthStates = pgTable('integration_oauth_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  stateHash: varchar('state_hash', { length: 64 }).notNull(),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar('provider', { length: 50 }).references(() => integrationCatalog.provider).notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  codeVerifierEncrypted: text('code_verifier_encrypted'),
  redirectUri: text('redirect_uri').notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  metadata: jsonb('metadata'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('integration_oauth_state_hash_idx').on(t.stateHash), index('integration_oauth_state_expiry_idx').on(t.expiresAt)]);

export const integrationOauthTokens = pgTable('integration_oauth_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  integrationId: uuid('integration_id').references(() => integrations.id, { onDelete: 'cascade' }).notNull(),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  tokenType: varchar('token_type', { length: 50 }).notNull().default('Bearer'),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  accountMetadata: jsonb('account_metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  rotatedAt: timestamp('rotated_at', { withTimezone: true }),
}, (t) => [uniqueIndex('integration_oauth_token_integration_idx').on(t.integrationId)]);

export const integrationExternalObjects = pgTable('integration_external_objects', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  integrationId: uuid('integration_id').references(() => integrations.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  senaObjectType: varchar('sena_object_type', { length: 50 }).notNull(),
  senaObjectId: uuid('sena_object_id').notNull(),
  externalObjectType: varchar('external_object_type', { length: 80 }).notNull(),
  externalObjectId: varchar('external_object_id', { length: 255 }).notNull(),
  syncState: varchar('sync_state', { length: 30 }).notNull().default('synced'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('integration_ext_local_idx').on(t.integrationId, t.senaObjectType, t.senaObjectId),
  uniqueIndex('integration_ext_remote_idx').on(t.integrationId, t.externalObjectType, t.externalObjectId),
  index('integration_ext_property_idx').on(t.propertyId, t.provider, t.senaObjectType),
]);

export const integrationSyncJobs = pgTable('integration_sync_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  integrationId: uuid('integration_id').references(() => integrations.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  direction: varchar('direction', { length: 20 }).notNull(),
  trigger: varchar('trigger', { length: 20 }).notNull(),
  jobType: varchar('job_type', { length: 80 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('queued'),
  attemptCount: integer('attempt_count').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(8),
  cursor: text('cursor'),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  payload: jsonb('payload'),
  lastError: text('last_error'),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('integration_sync_jobs_queue_idx').on(t.status, t.nextRunAt),
  index('integration_sync_jobs_property_idx').on(t.propertyId, t.provider, t.createdAt),
  uniqueIndex('integration_sync_jobs_idempotency_idx').on(t.propertyId, t.idempotencyKey),
]);

export const guestMessages = pgTable('guest_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'set null' }),
  reservationId: uuid('reservation_id').references(() => reservations.id, { onDelete: 'set null' }),
  channel: varchar('channel', { length: 30 }).notNull(),
  provider: varchar('provider', { length: 50 }),
  templateKey: varchar('template_key', { length: 80 }),
  status: varchar('status', { length: 30 }).notNull().default('queued'),
  toAddress: varchar('to_address', { length: 255 }),
  subject: varchar('subject', { length: 255 }),
  bodyPreview: text('body_preview'),
  providerMessageId: varchar('provider_message_id', { length: 255 }),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  attemptCount: integer('attempt_count').notNull().default(0),
  lastError: text('last_error'),
  metadata: jsonb('metadata'),
  queuedAt: timestamp('queued_at', { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('guest_messages_property_idx').on(t.propertyId, t.createdAt),
  uniqueIndex('guest_messages_idempotency_idx').on(t.propertyId, t.idempotencyKey),
]);

export const guestMessageTemplates = pgTable('guest_message_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'cascade' }),
  templateKey: varchar('template_key', { length: 80 }).notNull(),
  channel: varchar('channel', { length: 30 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  subject: varchar('subject', { length: 255 }),
  body: text('body').notNull(),
  variables: jsonb('variables').$type<string[]>().notNull().default([]),
  automationEnabled: boolean('automation_enabled').notNull().default(false),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('guest_message_templates_key_idx').on(t.propertyId, t.templateKey, t.channel),
]);

export const paymentAttempts = pgTable('payment_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'restrict' }).notNull(),
  integrationId: uuid('integration_id').references(() => integrations.id, { onDelete: 'restrict' }).notNull(),
  invoiceId: uuid('invoice_id').references((): AnyPgColumn => propertyInvoices.id, { onDelete: 'restrict' }),
  reservationId: uuid('reservation_id').references(() => reservations.id, { onDelete: 'restrict' }),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  internalReference: varchar('internal_reference', { length: 255 }).notNull().unique(),
  providerReference: varchar('provider_reference', { length: 255 }).unique(),
  amountMinorUnits: integer('amount_minor_units').notNull(),
  currency: varchar('currency', { length: 10 }).notNull(),
  source: varchar('source', { length: 50 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  initializedAt: timestamp('initialized_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('payment_attempt_property_idx').on(t.propertyId), index('payment_attempt_provider_ref_idx').on(t.providerReference), uniqueIndex('payment_attempt_idempotency_idx').on(t.propertyId, t.idempotencyKey)]);

export const integrationAuditLogs = pgTable('integration_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  integrationId: uuid('integration_id').references(() => integrations.id, { onDelete: 'set null' }),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'restrict' }).notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  mode: varchar('mode', { length: 10 }),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('integration_audit_property_idx').on(t.propertyId, t.createdAt)]);

export const integrationWebhookEvents = pgTable('integration_webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  integrationId: uuid('integration_id').references(() => integrations.id, { onDelete: 'restrict' }).notNull(),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'restrict' }).notNull(),
  providerEventId: varchar('provider_event_id', { length: 255 }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  paymentReference: varchar('payment_reference', { length: 255 }),
  status: varchar('status', { length: 30 }).notNull().default('received'),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
}, (t) => [uniqueIndex('integration_webhook_event_idx').on(t.integrationId, t.providerEventId), index('integration_webhook_received_idx').on(t.integrationId, t.receivedAt)]);

// 13. Idempotency Keys (Section 61 of PRD)
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 255 }).notNull().unique(),
    action: varchar('action', { length: 100 }).notNull(),
    responsePayload: jsonb('response_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('idempotency_key_idx').on(t.key),
  ]
);

// 14. Housekeeping Tasks
export const housekeepingTasks = pgTable(
  'housekeeping_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }),
    apartmentId: uuid('apartment_id').references(() => apartments.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull().default('dirty'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
    notes: text('notes'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('hk_prop_room_idx').on(t.propertyId, t.roomId),
  ]
);

// 15. Activity Logs (Section 89 of PRD)
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    actorId: uuid('actor_id'),
    actorName: varchar('actor_name', { length: 255 }).notNull(),
    action: varchar('action', { length: 255 }).notNull(),
    resource: varchar('resource', { length: 100 }).notNull(),
    resourceId: varchar('resource_id', { length: 100 }).notNull(),
    previousValue: jsonb('previous_value'),
    newValue: jsonb('new_value'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('activity_prop_idx').on(t.propertyId, t.createdAt),
  ]
);

// 16. Email Delivery Logs (Transactional Email System Audit)
export const emailLogs = pgTable(
  'email_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
    recipient: varchar('recipient', { length: 255 }).notNull(),
    emailType: varchar('email_type', { length: 100 }).notNull(),
    subject: text('subject').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    resendMessageId: varchar('resend_message_id', { length: 255 }),
    status: varchar('status', { length: 50 }).notNull().default('sent'), // 'sent' | 'failed' | 'suppressed'
    relatedEntity: varchar('related_entity', { length: 50 }),
    relatedId: varchar('related_id', { length: 255 }),
    error: text('error'),
    metadata: jsonb('metadata'),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('email_log_recipient_idx').on(t.recipient),
    index('email_log_type_idx').on(t.emailType),
    index('email_log_property_idx').on(t.propertyId),
    index('email_log_idempotency_idx').on(t.idempotencyKey),
  ]
);

// 17. Email Preferences
export const emailPreferences = pgTable(
  'email_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    marketingUnsubscribed: boolean('marketing_unsubscribed').default(false).notNull(),
    operationalDisabled: boolean('operational_disabled').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('email_pref_email_idx').on(t.email),
    index('email_pref_user_idx').on(t.userId),
  ]
);

// 18. Subscriptions (SaaS Billing & 3-Day Free Trial)
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
    plan: varchar('plan', { length: 50 }).notNull().default('growth'), // 'essential' | 'growth' | 'pro'
    billingCycle: varchar('billing_cycle', { length: 20 }).notNull().default('monthly'), // 'monthly' | 'yearly'
    status: varchar('status', { length: 50 }).notNull().default('trialing'), // 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
    trialStartDate: timestamp('trial_start_date', { withTimezone: true }).defaultNow().notNull(),
    trialEndDate: timestamp('trial_end_date', { withTimezone: true }).notNull(), // exactly 3 days after start
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).defaultNow().notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    paystackSubscriptionCode: varchar('paystack_subscription_code', { length: 255 }),
    paystackCustomerCode: varchar('paystack_customer_code', { length: 255 }),
    paystackPlanCode: varchar('paystack_plan_code', { length: 255 }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    roomLimit: integer('room_limit').notNull().default(30),
    amountMinorUnits: integer('amount_minor_units').notNull().default(5000000), // ₦50,000 in kobo
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('sub_org_idx').on(t.organizationId),
    index('sub_status_idx').on(t.status),
  ]
);

// 19. Subscription Invoices
export const subscriptionInvoices = pgTable(
  'subscription_invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subscriptionId: uuid('subscription_id')
      .references(() => subscriptions.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    invoiceNumber: varchar('invoice_number', { length: 100 }).notNull().unique(),
    amountMinorUnits: integer('amount_minor_units').notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
    status: varchar('status', { length: 50 }).notNull().default('paid'), // 'paid' | 'pending' | 'failed'
    plan: varchar('plan', { length: 50 }).notNull(),
    billingPeriod: varchar('billing_period', { length: 100 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 100 }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    pdfUrl: text('pdf_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('sub_inv_org_idx').on(t.organizationId),
    index('sub_inv_num_idx').on(t.invoiceNumber),
  ]
);

// 20. Website Configurations (Hospitality Website CMS & Brand Editor)
export const websiteConfigs = pgTable(
  'website_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    theme: varchar('theme', { length: 50 }).notNull().default('sena_one'), // 'sena_one' | 'sena_two' | 'sena_three'
    brandColors: jsonb('brand_colors').$type<{
      primaryColor?: string;
      accentColor?: string;
      bgStyle?: string;
      textDark?: string;
      navStyle?: 'transparent' | 'solid_light' | 'solid_dark';
    }>().default({
      primaryColor: '#71382D',
      accentColor: '#B85C3E',
      navStyle: 'transparent',
    }).notNull(),
    typography: jsonb('typography').$type<{
      headingFont?: string;
      bodyFont?: string;
    }>().default({
      headingFont: 'serif',
      bodyFont: 'sans',
    }).notNull(),
    buttonStyle: varchar('button_style', { length: 30 }).notNull().default('soft'), // 'square' | 'soft' | 'rounded'
    logoUrl: text('logo_url'),
    faviconUrl: text('favicon_url'),
    heroHeadline: text('hero_headline'),
    heroSubheading: text('hero_subheading'),
    heroImageUrl: text('hero_image_url'),
    heroCtaLabel: varchar('hero_cta_label', { length: 100 }).default('Reserve Your Stay'),
    welcomeEyebrow: varchar('welcome_eyebrow', { length: 100 }),
    welcomeTitle: text('welcome_title'),
    welcomeBody: text('welcome_body'),
    welcomeImageUrl: text('welcome_image_url'),
    highlights: jsonb('highlights').$type<Array<{
      title: string;
      description: string;
      icon?: string;
    }>>().default([]).notNull(),
    aboutStory: text('about_story'),
    aboutImageUrl: text('about_image_url'),
    galleryImages: jsonb('gallery_images').$type<Array<{
      url: string;
      caption?: string;
      category?: string;
    }>>().default([]).notNull(),
    nearbyPlaces: jsonb('nearby_places').$type<Array<{
      place: string;
      distance: string;
      category?: string;
    }>>().default([]).notNull(),
    amenities: jsonb('amenities').$type<Array<{
      name: string;
      category?: string;
      icon?: string;
      featured?: boolean;
    }>>().default([]).notNull(),
    policies: jsonb('policies').$type<{
      checkInTime?: string;
      checkOutTime?: string;
      cancellation?: string;
      children?: string;
      pets?: string;
      smoking?: string;
      payment?: string;
    }>().default({}).notNull(),
    contactPhone: varchar('contact_phone', { length: 50 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactWhatsapp: varchar('contact_whatsapp', { length: 50 }),
    whatsappEnabled: boolean('whatsapp_enabled').default(false).notNull(),
    socialLinks: jsonb('social_links').$type<{
      instagram?: string;
      facebook?: string;
      twitter?: string;
      linkedin?: string;
    }>().default({}).notNull(),
    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: text('seo_description'),
    seoOgImage: text('seo_og_image'),
    enabledSections: jsonb('enabled_sections').$type<{
      hero?: boolean;
      booking?: boolean;
      intro?: boolean;
      rooms?: boolean;
      highlights?: boolean;
      gallery?: boolean;
      amenities?: boolean;
      reviews?: boolean;
      location?: boolean;
      contact?: boolean;
    }>().default({
      hero: true,
      booking: true,
      intro: true,
      rooms: true,
      highlights: true,
      gallery: true,
      amenities: true,
      reviews: true,
      location: true,
      contact: true,
    }).notNull(),
    sectionOrder: jsonb('section_order').$type<string[]>().default([
      'hero',
      'booking',
      'intro',
      'rooms',
      'highlights',
      'gallery',
      'amenities',
      'reviews',
      'location',
      'contact',
    ]).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    draftConfig: jsonb('draft_config'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('web_cfg_prop_idx').on(t.propertyId),
  ]
);

// 21. Website Domains (Subdomain & Future Custom Domain Mapping)
export const websiteDomains = pgTable(
  'website_domains',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    domain: varchar('domain', { length: 255 }).notNull().unique(), // e.g. 'stayconnect.sena.ng' or 'stayconnectglobal.com'
    type: varchar('type', { length: 50 }).notNull().default('sena_subdomain'), // 'sena_subdomain' | 'custom_domain'
    status: varchar('status', { length: 50 }).notNull().default('active'), // 'pending' | 'active' | 'failed'
    isPrimary: boolean('is_primary').default(true).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('web_dom_prop_idx').on(t.propertyId),
    uniqueIndex('web_dom_domain_idx').on(t.domain),
  ]
);

// 22. Guest Reviews
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    reservationId: uuid('reservation_id').references(() => reservations.id, { onDelete: 'set null' }),
    guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'set null' }),
    guestName: varchar('guest_name', { length: 255 }).notNull(),
    rating: integer('rating').notNull(), // 1 to 5
    title: varchar('title', { length: 255 }),
    body: text('body').notNull(),
    source: varchar('source', { length: 50 }).notNull().default('sena'), // 'sena' | 'google' | 'booking_com' | 'manual'
    status: varchar('status', { length: 50 }).notNull().default('published'), // 'pending' | 'published' | 'hidden_for_policy' | 'reported'
    isVerifiedStay: boolean('is_verified_stay').default(false).notNull(),
    response: text('response'),
    responseAt: timestamp('response_at', { withTimezone: true }),
    hiddenReason: varchar('hidden_reason', { length: 255 }), // 'spam' | 'abuse' | 'personal_information' | 'irrelevant' | 'policy_violation'
    moderatedBy: varchar('moderated_by', { length: 255 }),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('reviews_prop_status_idx').on(t.propertyId, t.status),
    index('reviews_res_idx').on(t.reservationId),
  ]
);

// 23. Review Invitation Tokens (Secured one-time tokens for verified stay reviews)
export const reviewTokens = pgTable(
  'review_tokens',
  {
    token: varchar('token', { length: 100 }).primaryKey(),
    reservationId: uuid('reservation_id')
      .references(() => reservations.id, { onDelete: 'cascade' })
      .notNull(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    guestEmail: varchar('guest_email', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('rev_token_prop_idx').on(t.propertyId),
    index('rev_token_res_idx').on(t.reservationId),
  ]
);

// 24. Property Invoices & Guest Folios
export interface InvoiceLineItem {
  id: string;
  description: string;
  category: 'room' | 'fb' | 'laundry' | 'transport' | 'service' | 'other';
  quantity: number;
  unitPriceMinorUnits: number;
  totalMinorUnits: number;
}

export interface InvoiceBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode?: string;
  currency?: string;
}

export const propertyInvoices = pgTable(
  'property_invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    reservationId: uuid('reservation_id')
      .references(() => reservations.id, { onDelete: 'set null' }),
    guestId: uuid('guest_id')
      .references(() => guests.id, { onDelete: 'set null' }),
    invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(), // e.g. INV-2026-0042
    invoiceType: varchar('invoice_type', { length: 50 }).notNull().default('guest_folio'), // 'guest_folio' | 'corporate' | 'walk_in' | 'event_banquet' | 'proforma'
    status: varchar('status', { length: 50 }).notNull().default('issued'), // 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'void'
    recipientName: varchar('recipient_name', { length: 255 }).notNull(),
    recipientEmail: varchar('recipient_email', { length: 255 }),
    recipientPhone: varchar('recipient_phone', { length: 50 }),
    recipientAddress: text('recipient_address'),
    companyTin: varchar('company_tin', { length: 100 }),
    issueDate: varchar('issue_date', { length: 10 }).notNull(), // YYYY-MM-DD
    dueDate: varchar('due_date', { length: 10 }).notNull(), // YYYY-MM-DD
    currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
    subtotalMinorUnits: integer('subtotal_minor_units').notNull().default(0),
    taxVatMinorUnits: integer('tax_vat_minor_units').notNull().default(0),
    taxConsumptionMinorUnits: integer('tax_consumption_minor_units').notNull().default(0),
    serviceChargeMinorUnits: integer('service_charge_minor_units').notNull().default(0),
    discountMinorUnits: integer('discount_minor_units').notNull().default(0),
    totalAmountMinorUnits: integer('total_amount_minor_units').notNull().default(0),
    paidAmountMinorUnits: integer('paid_amount_minor_units').notNull().default(0),
    items: jsonb('items').$type<InvoiceLineItem[]>().notNull().default([]),
    bankDetails: jsonb('bank_details').$type<InvoiceBankDetails>(),
    paymentTerms: text('payment_terms'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('prop_inv_prop_idx').on(t.propertyId),
    index('prop_inv_num_idx').on(t.invoiceNumber),
    index('prop_inv_res_idx').on(t.reservationId),
    index('prop_inv_status_idx').on(t.status),
  ]
);

// 25. Sena Connect API Keys
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(), // e.g. "Production Website", "Next.js Hotel Portal"
    keyType: varchar('key_type', { length: 50 }).notNull(), // 'publishable' | 'secret'
    keyPrefix: varchar('key_prefix', { length: 20 }).notNull(), // 'pk_live_' | 'sk_live_'
    displayKey: varchar('display_key', { length: 60 }).notNull(), // 'pk_live_xxxx' or 'sk_live_••••••83A2'
    keyHash: varchar('key_hash', { length: 255 }).notNull().unique(), // SHA-256 hash of secret key, or token for publishable
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]), // ['availability:read', 'rooms:read', 'reservations:create', ...]
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    isRevoked: boolean('is_revoked').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('api_keys_prop_idx').on(t.propertyId),
    index('api_keys_hash_idx').on(t.keyHash),
  ]
);

// 26. Webhook Endpoints
export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    url: text('url').notNull(),
    description: varchar('description', { length: 255 }),
    signingSecret: varchar('signing_secret', { length: 255 }).notNull(), // e.g. whsec_...
    events: jsonb('events').$type<string[]>().notNull().default([]), // ['reservation.created', 'reservation.confirmed', ...]
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('webhook_end_prop_idx').on(t.propertyId),
  ]
);

// 27. Webhook Deliveries
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    webhookEndpointId: uuid('webhook_endpoint_id')
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' })
      .notNull(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    eventId: varchar('event_id', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'), // 'success' | 'failed' | 'pending'
    httpStatus: integer('http_status'),
    attemptCount: integer('attempt_count').notNull().default(1),
    responseBody: text('response_body'),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }).defaultNow().notNull(),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('webhook_del_prop_idx').on(t.propertyId),
    index('webhook_del_end_idx').on(t.webhookEndpointId),
    index('webhook_del_status_idx').on(t.status),
  ]
);

// 28. API Request Logs
export const apiRequestLogs = pgTable(
  'api_request_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
    keyName: varchar('key_name', { length: 255 }).notNull().default('Public / Anonymous'),
    method: varchar('method', { length: 10 }).notNull(),
    endpoint: varchar('endpoint', { length: 255 }).notNull(),
    statusCode: integer('status_code').notNull(),
    latencyMs: integer('latency_ms').notNull().default(0),
    ipAddress: varchar('ip_address', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('api_logs_prop_idx').on(t.propertyId),
    index('api_logs_created_idx').on(t.createdAt),
  ]
);

// 30. Internal Admin Users (Named identities with role-based access)
export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull().default('operations'), // 'super_admin' | 'operations' | 'support' | 'finance'
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  }
);

// 31. Admin Audit Logs (Audit trail for sensitive control plane actions)
export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adminId: uuid('admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    adminEmail: varchar('admin_email', { length: 255 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(), // 'property.suspend', 'subscription.upgrade', etc.
    targetType: varchar('target_type', { length: 50 }).notNull(), // 'property', 'user', 'subscription'
    targetId: varchar('target_id', { length: 255 }).notNull(),
    details: jsonb('details'),
    ipAddress: varchar('ip_address', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('admin_audit_action_idx').on(t.action),
    index('admin_audit_target_idx').on(t.targetType, t.targetId),
  ]
);

export const operationalNotifications = pgTable(
  'operational_notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
    dedupeKey: varchar('dedupe_key', { length: 200 }).notNull(),
    kind: varchar('kind', { length: 40 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    body: text('body').notNull(),
    href: varchar('href', { length: 300 }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('operational_notifications_dedupe_idx').on(t.propertyId, t.dedupeKey),
    index('operational_notifications_prop_idx').on(t.propertyId, t.createdAt),
  ]
);

export const propertyBankAccounts = pgTable(
  'property_bank_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    accountName: varchar('account_name', { length: 255 }).notNull(),
    bankName: varchar('bank_name', { length: 255 }).notNull(),
    accountNumber: varchar('account_number', { length: 50 }).notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('prop_bank_accounts_prop_idx').on(t.propertyId),
    uniqueIndex('prop_bank_accounts_number_idx').on(t.propertyId, t.accountNumber, t.currency),
  ]
);

export const transferProofs = pgTable(
  'transfer_proofs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    reservationId: uuid('reservation_id').references(() => reservations.id, { onDelete: 'set null' }),
    invoiceId: uuid('invoice_id').references(() => propertyInvoices.id, { onDelete: 'set null' }),
    amountMinorUnits: integer('amount_minor_units').notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
    payerName: varchar('payer_name', { length: 255 }),
    transferReference: varchar('transfer_reference', { length: 255 }),
    proofUrl: text('proof_url').notNull(),
    status: varchar('status', { length: 30 }).notNull().default('pending'),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    staffNote: text('staff_note'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id),
  },
  (t) => [
    index('transfer_proofs_prop_idx').on(t.propertyId, t.status, t.submittedAt),
    index('transfer_proofs_res_idx').on(t.reservationId),
    index('transfer_proofs_inv_idx').on(t.invoiceId),
  ]
);
