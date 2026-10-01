ALTER TABLE "apartments" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "apartments" ADD COLUMN IF NOT EXISTS "archived_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "apartments_property_archived_idx" ON "apartments" ("property_id", "archived_at");
