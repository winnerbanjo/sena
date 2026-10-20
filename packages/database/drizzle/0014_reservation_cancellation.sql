ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cancelled_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
