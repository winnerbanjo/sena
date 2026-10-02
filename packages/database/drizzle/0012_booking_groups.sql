CREATE TABLE IF NOT EXISTS "booking_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "guest_id" uuid NOT NULL REFERENCES "guests"("id") ON DELETE CASCADE,
  "reference" varchar(50) NOT NULL UNIQUE,
  "check_in_date" varchar(10) NOT NULL,
  "check_out_date" varchar(10) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "booking_groups_property_idx" ON "booking_groups" ("property_id");

ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "booking_group_id" uuid REFERENCES "booking_groups"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "res_booking_group_idx" ON "reservations" ("booking_group_id");
