CREATE TABLE IF NOT EXISTS "reservation_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE cascade,
  "reservation_id" uuid NOT NULL REFERENCES "reservations"("id") ON DELETE cascade,
  "author_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "reservation_notes_res_idx" ON "reservation_notes" USING btree ("property_id","reservation_id","created_at");
