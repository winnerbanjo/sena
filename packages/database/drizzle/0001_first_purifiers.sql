CREATE TABLE "integration_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid,
	"property_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"mode" varchar(10),
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_catalog" (
	"provider" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"availability" varchar(30) DEFAULT 'coming_soon' NOT NULL,
	"auth_type" varchar(30) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "integration_catalog" ("provider", "name", "category", "description", "availability", "auth_type") VALUES ('paystack', 'Paystack', 'payments', 'Accept property payments using the hotel''s own Paystack account.', 'available', 'secret_key');
--> statement-breakpoint
CREATE TABLE "integration_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"credential_type" varchar(50) NOT NULL,
	"encrypted_value" text NOT NULL,
	"masked_suffix" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integration_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"provider_event_id" varchar(255),
	"event_type" varchar(100) NOT NULL,
	"payment_reference" varchar(255),
	"status" varchar(30) DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"category" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'disconnected' NOT NULL,
	"mode" varchar(10),
	"external_account_id" varchar(255),
	"webhook_token_hash" varchar(64) NOT NULL,
	"webhook_token_encrypted" text NOT NULL,
	"webhook_status" varchar(30) DEFAULT 'not_configured' NOT NULL,
	"connected_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"webhook_verified_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"invoice_id" uuid,
	"reservation_id" uuid,
	"idempotency_key" varchar(255),
	"internal_reference" varchar(255) NOT NULL,
	"provider_reference" varchar(255),
	"amount_minor_units" integer NOT NULL,
	"currency" varchar(10) NOT NULL,
	"source" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"initialized_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_internal_reference_unique" UNIQUE("internal_reference"),
	CONSTRAINT "payment_attempts_provider_reference_unique" UNIQUE("provider_reference")
);
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_reservation_id_reservations_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "reservation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "integration_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "internal_reference" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_transaction_id" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "source" varchar(50) DEFAULT 'front_desk' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhook_events" ADD CONSTRAINT "integration_webhook_events_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhook_events" ADD CONSTRAINT "integration_webhook_events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_provider_integration_catalog_provider_fk" FOREIGN KEY ("provider") REFERENCES "public"."integration_catalog"("provider") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoice_id_property_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."property_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_audit_property_idx" ON "integration_audit_logs" USING btree ("property_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_credentials_type_idx" ON "integration_credentials" USING btree ("integration_id","credential_type");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_webhook_event_idx" ON "integration_webhook_events" USING btree ("integration_id","provider_event_id");--> statement-breakpoint
CREATE INDEX "integration_webhook_received_idx" ON "integration_webhook_events" USING btree ("integration_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_property_provider_idx" ON "integrations" USING btree ("property_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_webhook_token_idx" ON "integrations" USING btree ("webhook_token_hash");--> statement-breakpoint
CREATE INDEX "payment_attempt_property_idx" ON "payment_attempts" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "payment_attempt_provider_ref_idx" ON "payment_attempts" USING btree ("provider_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempt_idempotency_idx" ON "payment_attempts" USING btree ("property_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_property_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."property_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_idx" ON "payments" USING btree ("provider","provider_reference");
