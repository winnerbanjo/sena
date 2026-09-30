CREATE TABLE IF NOT EXISTS "room_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "room_type_id" uuid REFERENCES "room_types"("id") ON DELETE CASCADE,
  "room_id" uuid REFERENCES "rooms"("id") ON DELETE CASCADE,
  "storage_key" text NOT NULL,
  "url" text NOT NULL,
  "original_filename" varchar(255),
  "content_type" varchar(100) NOT NULL,
  "byte_size" integer DEFAULT 0 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_cover" boolean DEFAULT false NOT NULL,
  "uploaded_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "room_images_one_target" CHECK (
    ("room_type_id" IS NOT NULL AND "room_id" IS NULL)
    OR ("room_type_id" IS NULL AND "room_id" IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS "room_images_type_idx" ON "room_images" ("room_type_id", "sort_order");
CREATE INDEX IF NOT EXISTS "room_images_room_idx" ON "room_images" ("room_id", "sort_order");
CREATE INDEX IF NOT EXISTS "room_images_property_idx" ON "room_images" ("property_id");
CREATE UNIQUE INDEX IF NOT EXISTS "room_images_type_cover_idx" ON "room_images" ("room_type_id") WHERE "is_cover" = true AND "room_type_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "room_images_room_cover_idx" ON "room_images" ("room_id") WHERE "is_cover" = true AND "room_id" IS NOT NULL;

-- Copy existing category photos into the gallery. The original images list stays in place.
INSERT INTO "room_images" ("property_id", "room_type_id", "storage_key", "url", "content_type", "byte_size", "sort_order", "is_cover")
SELECT
  rt."property_id",
  rt."id",
  img.url,
  img.url,
  'image/jpeg',
  0,
  (img.ord - 1)::int,
  img.ord = 1
FROM "room_types" rt
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(rt."images", '[]'::jsonb)) WITH ORDINALITY AS img(url, ord)
WHERE length(trim(img.url)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM "room_images" existing WHERE existing."room_type_id" = rt."id"
  );
