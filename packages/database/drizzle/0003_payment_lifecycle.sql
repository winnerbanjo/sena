ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "check_in_payment_policy" varchar(40) NOT NULL DEFAULT 'allow_outstanding';
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "check_out_payment_policy" varchar(40) NOT NULL DEFAULT 'allow_outstanding';
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "direct_booking_pay_at_property" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "direct_booking_bank_transfer" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_bank_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE cascade,
  "account_name" varchar(255) NOT NULL,
  "bank_name" varchar(255) NOT NULL,
  "account_number" varchar(50) NOT NULL,
  "currency" varchar(10) NOT NULL DEFAULT 'NGN',
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prop_bank_accounts_prop_idx" ON "property_bank_accounts" USING btree ("property_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prop_bank_accounts_number_idx" ON "property_bank_accounts" USING btree ("property_id","account_number","currency");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transfer_proofs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE cascade,
  "reservation_id" uuid REFERENCES "reservations"("id") ON DELETE set null,
  "invoice_id" uuid REFERENCES "property_invoices"("id") ON DELETE set null,
  "amount_minor_units" integer NOT NULL,
  "currency" varchar(10) NOT NULL DEFAULT 'NGN',
  "payer_name" varchar(255),
  "transfer_reference" varchar(255),
  "proof_url" text NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'pending',
  "payment_id" uuid REFERENCES "payments"("id") ON DELETE set null,
  "staff_note" text,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by_user_id" uuid REFERENCES "users"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_proofs_prop_idx" ON "transfer_proofs" USING btree ("property_id","status","submitted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_proofs_res_idx" ON "transfer_proofs" USING btree ("reservation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_proofs_inv_idx" ON "transfer_proofs" USING btree ("invoice_id");
