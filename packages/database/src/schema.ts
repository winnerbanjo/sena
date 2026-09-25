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
    roomTypeId: uuid('room_type_id')
      .references(() => roomTypes.id, { onDelete: 'cascade' })
      .notNull(),
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
    roomTypeId: uuid('room_type_id')
      .references(() => roomTypes.id, { onDelete: 'cascade' })
      .notNull(),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
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

// 12. Payments
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    propertyId: uuid('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    reservationId: uuid('reservation_id')
      .references(() => reservations.id, { onDelete: 'cascade' })
      .notNull(),
    amountMinorUnits: integer('amount_minor_units').notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
    provider: varchar('provider', { length: 50 }).notNull().default('manual'), // 'paystack', 'manual'
    providerReference: varchar('provider_reference', { length: 255 }),
    method: varchar('method', { length: 50 }).notNull().default('cash'),
    status: varchar('status', { length: 50 }).notNull().default('successful'),
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('payments_res_idx').on(t.reservationId),
    index('payments_prop_idx').on(t.propertyId),
  ]
);

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
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
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



