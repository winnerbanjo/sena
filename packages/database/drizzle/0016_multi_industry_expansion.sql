-- Sena OS: Multi-Industry Expansion (Hotels, Gyms, Restaurants)
-- 1. Property Industry Discriminator
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "industry" varchar(50) NOT NULL DEFAULT 'hotel';

-- 2. Gym Schema
CREATE TABLE IF NOT EXISTS "gym_membership_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "duration_months" integer NOT NULL DEFAULT 1,
  "price_minor_units" bigint NOT NULL,
  "registration_fee_minor_units" bigint NOT NULL DEFAULT 0,
  "access_hours" varchar(100) NOT NULL DEFAULT 'all_hours',
  "max_class_credits_per_month" integer NOT NULL DEFAULT 0,
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "gym_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "member_number" varchar(50) NOT NULL,
  "full_name" varchar(255) NOT NULL,
  "email" varchar(255),
  "phone" varchar(50) NOT NULL,
  "emergency_contact_name" varchar(255),
  "emergency_contact_phone" varchar(50),
  "medical_notes" text,
  "profile_photo_url" text,
  "qr_code_token" varchar(100) NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "gym_members_property_member_num_unique" UNIQUE ("property_id", "member_number"),
  CONSTRAINT "gym_members_qr_code_unique" UNIQUE ("qr_code_token")
);

CREATE TABLE IF NOT EXISTS "gym_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "member_id" uuid NOT NULL REFERENCES "gym_members"("id") ON DELETE CASCADE,
  "plan_id" uuid NOT NULL REFERENCES "gym_membership_plans"("id") ON DELETE RESTRICT,
  "start_date" varchar(10) NOT NULL,
  "end_date" varchar(10) NOT NULL,
  "auto_renew" boolean NOT NULL DEFAULT false,
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "total_amount_minor_units" bigint NOT NULL,
  "paid_amount_minor_units" bigint NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "gym_checkins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "member_id" uuid NOT NULL REFERENCES "gym_members"("id") ON DELETE CASCADE,
  "check_in_at" timestamp with time zone DEFAULT now() NOT NULL,
  "check_out_at" timestamp with time zone,
  "access_point" varchar(100) NOT NULL DEFAULT 'main_entrance',
  "verified_by" varchar(255),
  "access_result" varchar(50) NOT NULL DEFAULT 'granted',
  "denial_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "gym_trainers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "full_name" varchar(255) NOT NULL,
  "email" varchar(255),
  "phone" varchar(50) NOT NULL,
  "specializations" text[] DEFAULT '{}'::text[],
  "hourly_rate_minor_units" bigint NOT NULL DEFAULT 0,
  "bio" text,
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "gym_classes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "trainer_id" uuid REFERENCES "gym_trainers"("id") ON DELETE SET NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "day_of_week" integer NOT NULL,
  "start_time" varchar(10) NOT NULL,
  "duration_minutes" integer NOT NULL DEFAULT 60,
  "capacity" integer NOT NULL DEFAULT 20,
  "location_room" varchar(100),
  "price_minor_units" bigint NOT NULL DEFAULT 0,
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "gym_class_bookings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "gym_classes"("id") ON DELETE CASCADE,
  "member_id" uuid NOT NULL REFERENCES "gym_members"("id") ON DELETE CASCADE,
  "booking_date" varchar(10) NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'booked',
  "checked_in_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Restaurant Schema
CREATE TABLE IF NOT EXISTS "restaurant_tables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "table_number" varchar(50) NOT NULL,
  "capacity" integer NOT NULL DEFAULT 4,
  "section" varchar(100) NOT NULL DEFAULT 'indoor',
  "status" varchar(50) NOT NULL DEFAULT 'available',
  "current_order_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurant_tables_property_table_unique" UNIQUE ("property_id", "table_number")
);

CREATE TABLE IF NOT EXISTS "restaurant_menu_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "display_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "restaurant_menu_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "category_id" uuid NOT NULL REFERENCES "restaurant_menu_categories"("id") ON DELETE RESTRICT,
  "name" varchar(255) NOT NULL,
  "description" text,
  "price_minor_units" bigint NOT NULL,
  "cost_minor_units" bigint NOT NULL DEFAULT 0,
  "image_url" text,
  "is_available" boolean NOT NULL DEFAULT true,
  "preparation_time_minutes" integer NOT NULL DEFAULT 15,
  "preparation_station" varchar(50) NOT NULL DEFAULT 'kitchen',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "restaurant_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "order_number" varchar(50) NOT NULL,
  "order_type" varchar(50) NOT NULL DEFAULT 'dine_in',
  "table_id" uuid REFERENCES "restaurant_tables"("id") ON DELETE SET NULL,
  "guest_id" uuid REFERENCES "guests"("id") ON DELETE SET NULL,
  "reservation_id" uuid REFERENCES "reservations"("id") ON DELETE SET NULL,
  "waiter_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "status" varchar(50) NOT NULL DEFAULT 'open',
  "subtotal_minor_units" bigint NOT NULL DEFAULT 0,
  "tax_minor_units" bigint NOT NULL DEFAULT 0,
  "service_charge_minor_units" bigint NOT NULL DEFAULT 0,
  "discount_minor_units" bigint NOT NULL DEFAULT 0,
  "total_amount_minor_units" bigint NOT NULL DEFAULT 0,
  "paid_amount_minor_units" bigint NOT NULL DEFAULT 0,
  "notes" text,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurant_orders_property_order_num_unique" UNIQUE ("property_id", "order_number")
);

CREATE TABLE IF NOT EXISTS "restaurant_order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL REFERENCES "restaurant_orders"("id") ON DELETE CASCADE,
  "menu_item_id" uuid NOT NULL REFERENCES "restaurant_menu_items"("id") ON DELETE RESTRICT,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_price_minor_units" bigint NOT NULL,
  "total_amount_minor_units" bigint NOT NULL,
  "notes" text,
  "preparation_station" varchar(50) NOT NULL DEFAULT 'kitchen',
  "kds_status" varchar(50) NOT NULL DEFAULT 'pending',
  "sent_to_kds_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "restaurant_ingredients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "unit_of_measure" varchar(50) NOT NULL DEFAULT 'unit',
  "current_stock" numeric(12, 3) NOT NULL DEFAULT 0,
  "minimum_stock_alert" numeric(12, 3) NOT NULL DEFAULT 0,
  "cost_per_unit_minor_units" bigint NOT NULL DEFAULT 0,
  "supplier_name" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "restaurant_recipes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "menu_item_id" uuid NOT NULL REFERENCES "restaurant_menu_items"("id") ON DELETE CASCADE,
  "ingredient_id" uuid NOT NULL REFERENCES "restaurant_ingredients"("id") ON DELETE CASCADE,
  "quantity_required" numeric(12, 3) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurant_recipes_item_ingredient_unique" UNIQUE ("menu_item_id", "ingredient_id")
);
