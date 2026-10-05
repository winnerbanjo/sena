ALTER TABLE "property_invoices" ADD COLUMN IF NOT EXISTS "booking_group_id" uuid REFERENCES "booking_groups"("id") ON DELETE SET NULL;
ALTER TABLE "property_invoices" ADD COLUMN IF NOT EXISTS "void_reason" text;
ALTER TABLE "property_invoices" ADD COLUMN IF NOT EXISTS "voided_at" timestamp with time zone;
ALTER TABLE "property_invoices" ADD COLUMN IF NOT EXISTS "voided_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "invoices_booking_group_idx" ON "property_invoices" ("booking_group_id");

ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "standard_amount_minor_units" integer DEFAULT 0 NOT NULL;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "discount_amount_minor_units" integer DEFAULT 0 NOT NULL;

UPDATE "reservations" SET "standard_amount_minor_units" = "total_amount_minor_units" WHERE "standard_amount_minor_units" = 0 AND "total_amount_minor_units" > 0;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "booking_group_id" uuid REFERENCES "booking_groups"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "payments_booking_group_idx" ON "payments" ("booking_group_id");
