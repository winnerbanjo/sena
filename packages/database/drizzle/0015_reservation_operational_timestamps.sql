ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "actual_check_in_at" timestamp with time zone;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "actual_check_out_at" timestamp with time zone;
