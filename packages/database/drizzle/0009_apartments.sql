CREATE TABLE IF NOT EXISTS "apartments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "apartment_type" varchar(50) NOT NULL,
  "apartment_type_custom" varchar(100),
  "bedrooms" integer DEFAULT 1 NOT NULL,
  "bathrooms" integer DEFAULT 1 NOT NULL,
  "bed_configuration" varchar(100) NOT NULL,
  "max_guests" integer DEFAULT 2 NOT NULL,
  "base_price_minor_units" integer NOT NULL,
  "amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "use_property_address" boolean DEFAULT true NOT NULL,
  "address" text,
  "area" varchar(120),
  "city" varchar(120),
  "state" varchar(120),
  "country" varchar(100),
  "operational_status" varchar(50) DEFAULT 'available' NOT NULL,
  "housekeeping_status" varchar(50) DEFAULT 'clean' NOT NULL,
  "website_visibility" boolean DEFAULT true NOT NULL,
  "booking_visibility" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "apartments_property_name_idx" ON "apartments" ("property_id", "name");
CREATE INDEX IF NOT EXISTS "apartments_property_idx" ON "apartments" ("property_id");

ALTER TABLE "room_images" ADD COLUMN IF NOT EXISTS "apartment_id" uuid REFERENCES "apartments"("id") ON DELETE CASCADE;
ALTER TABLE "room_images" DROP CONSTRAINT IF EXISTS "room_images_one_target";
ALTER TABLE "room_images" ADD CONSTRAINT "room_images_one_target" CHECK (
  ("room_type_id" IS NOT NULL AND "room_id" IS NULL AND "apartment_id" IS NULL)
  OR ("room_type_id" IS NULL AND "room_id" IS NOT NULL AND "apartment_id" IS NULL)
  OR ("room_type_id" IS NULL AND "room_id" IS NULL AND "apartment_id" IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS "room_images_apartment_idx" ON "room_images" ("apartment_id", "sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "room_images_apartment_cover_idx" ON "room_images" ("apartment_id") WHERE "is_cover" = true AND "apartment_id" IS NOT NULL;

ALTER TABLE "booking_holds" ALTER COLUMN "room_type_id" DROP NOT NULL;
ALTER TABLE "booking_holds" ADD COLUMN IF NOT EXISTS "apartment_id" uuid REFERENCES "apartments"("id") ON DELETE CASCADE;
ALTER TABLE "booking_holds" DROP CONSTRAINT IF EXISTS "booking_holds_one_inventory";
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_one_inventory" CHECK (
  ("room_type_id" IS NOT NULL AND "apartment_id" IS NULL)
  OR ("apartment_id" IS NOT NULL AND "room_type_id" IS NULL)
);
CREATE INDEX IF NOT EXISTS "holds_apartment_status_idx" ON "booking_holds" ("property_id", "apartment_id", "status", "expires_at");

ALTER TABLE "reservations" ALTER COLUMN "room_type_id" DROP NOT NULL;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "apartment_id" uuid REFERENCES "apartments"("id") ON DELETE RESTRICT;
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_one_inventory";
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_one_inventory" CHECK (
  ("room_type_id" IS NOT NULL AND "apartment_id" IS NULL)
  OR ("apartment_id" IS NOT NULL AND "room_type_id" IS NULL AND "room_id" IS NULL)
);
CREATE INDEX IF NOT EXISTS "res_apartment_dates_idx" ON "reservations" ("apartment_id", "check_in_date", "check_out_date");

ALTER TABLE "housekeeping_tasks" ALTER COLUMN "room_id" DROP NOT NULL;
ALTER TABLE "housekeeping_tasks" ADD COLUMN IF NOT EXISTS "apartment_id" uuid REFERENCES "apartments"("id") ON DELETE CASCADE;
ALTER TABLE "housekeeping_tasks" DROP CONSTRAINT IF EXISTS "housekeeping_tasks_one_unit";
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_one_unit" CHECK (
  ("room_id" IS NOT NULL AND "apartment_id" IS NULL)
  OR ("room_id" IS NULL AND "apartment_id" IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS "hk_prop_apartment_idx" ON "housekeeping_tasks" ("property_id", "apartment_id");

CREATE OR REPLACE FUNCTION reject_apartment_reservation_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.apartment_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('cancelled', 'no_show', 'checked_out') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM reservations existing
    WHERE existing.apartment_id = NEW.apartment_id
      AND existing.id IS DISTINCT FROM NEW.id
      AND existing.status IN ('pending', 'confirmed', 'checked_in')
      AND existing.check_in_date < NEW.check_out_date
      AND existing.check_out_date > NEW.check_in_date
  ) THEN
    RAISE EXCEPTION 'This apartment is already booked for those dates.'
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservations_apartment_overlap ON reservations;
CREATE TRIGGER reservations_apartment_overlap
BEFORE INSERT OR UPDATE OF apartment_id, check_in_date, check_out_date, status
ON reservations
FOR EACH ROW
EXECUTE FUNCTION reject_apartment_reservation_overlap();
