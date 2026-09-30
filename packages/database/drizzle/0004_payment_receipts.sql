CREATE TABLE IF NOT EXISTS "payment_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE cascade,
  "payment_id" uuid NOT NULL REFERENCES "payments"("id") ON DELETE cascade,
  "uploaded_by_user_id" uuid REFERENCES "users"("id"),
  "storage_key" text NOT NULL,
  "content_type" varchar(100) NOT NULL,
  "original_filename" varchar(255),
  "byte_size" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_receipts_payment_idx" ON "payment_receipts" USING btree ("payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_receipts_property_idx" ON "payment_receipts" USING btree ("property_id","created_at");
