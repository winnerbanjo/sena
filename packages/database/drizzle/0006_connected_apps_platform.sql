ALTER TABLE "integration_catalog" ADD COLUMN IF NOT EXISTS "logo_url" text;
--> statement-breakpoint
ALTER TABLE "integration_catalog" ADD COLUMN IF NOT EXISTS "docs_url" text;
--> statement-breakpoint
ALTER TABLE "integration_catalog" ADD COLUMN IF NOT EXISTS "capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "integration_catalog" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 100 NOT NULL;
--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "health_status" varchar(40) DEFAULT 'configured' NOT NULL;
--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "environment" varchar(30);
--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "last_sync_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "last_sync_attempt_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integrations_health_idx" ON "integrations" ("provider", "status", "health_status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" varchar(64) NOT NULL,
	"property_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"code_verifier_encrypted" text,
	"redirect_uri" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_oauth_state_hash_idx" ON "integration_oauth_states" ("state_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_oauth_state_expiry_idx" ON "integration_oauth_states" ("expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"token_type" varchar(50) DEFAULT 'Bearer' NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"account_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_oauth_token_integration_idx" ON "integration_oauth_tokens" ("integration_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_external_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"sena_object_type" varchar(50) NOT NULL,
	"sena_object_id" uuid NOT NULL,
	"external_object_type" varchar(80) NOT NULL,
	"external_object_id" varchar(255) NOT NULL,
	"sync_state" varchar(30) DEFAULT 'synced' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_ext_local_idx" ON "integration_external_objects" ("integration_id", "sena_object_type", "sena_object_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_ext_remote_idx" ON "integration_external_objects" ("integration_id", "external_object_type", "external_object_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_ext_property_idx" ON "integration_external_objects" ("property_id", "provider", "sena_object_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"direction" varchar(20) NOT NULL,
	"trigger" varchar(20) NOT NULL,
	"job_type" varchar(80) NOT NULL,
	"status" varchar(30) DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"cursor" text,
	"idempotency_key" varchar(255),
	"payload" jsonb,
	"last_error" text,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_sync_jobs_queue_idx" ON "integration_sync_jobs" ("status", "next_run_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_sync_jobs_property_idx" ON "integration_sync_jobs" ("property_id", "provider", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_sync_jobs_idempotency_idx" ON "integration_sync_jobs" ("property_id", "idempotency_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guest_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"guest_id" uuid,
	"reservation_id" uuid,
	"channel" varchar(30) NOT NULL,
	"provider" varchar(50),
	"template_key" varchar(80),
	"status" varchar(30) DEFAULT 'queued' NOT NULL,
	"to_address" varchar(255),
	"subject" varchar(255),
	"body_preview" text,
	"provider_message_id" varchar(255),
	"idempotency_key" varchar(255),
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"metadata" jsonb,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guest_messages_property_idx" ON "guest_messages" ("property_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guest_messages_idempotency_idx" ON "guest_messages" ("property_id", "idempotency_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guest_message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"template_key" varchar(80) NOT NULL,
	"channel" varchar(30) NOT NULL,
	"name" varchar(120) NOT NULL,
	"subject" varchar(255),
	"body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"automation_enabled" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guest_message_templates_key_idx" ON "guest_message_templates" ("property_id", "template_key", "channel");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_oauth_states" ADD CONSTRAINT "integration_oauth_states_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_oauth_states" ADD CONSTRAINT "integration_oauth_states_provider_integration_catalog_provider_fk" FOREIGN KEY ("provider") REFERENCES "public"."integration_catalog"("provider") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_oauth_states" ADD CONSTRAINT "integration_oauth_states_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_oauth_tokens" ADD CONSTRAINT "integration_oauth_tokens_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_external_objects" ADD CONSTRAINT "integration_external_objects_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_external_objects" ADD CONSTRAINT "integration_external_objects_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guest_messages" ADD CONSTRAINT "guest_messages_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guest_messages" ADD CONSTRAINT "guest_messages_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guest_messages" ADD CONSTRAINT "guest_messages_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guest_message_templates" ADD CONSTRAINT "guest_message_templates_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
UPDATE "integration_catalog" SET "capabilities" = '["online_payments","invoice_payments","direct_booking","webhooks"]'::jsonb, "sort_order" = 10, "docs_url" = 'https://paystack.com/docs' WHERE "provider" = 'paystack';
--> statement-breakpoint
UPDATE "integration_catalog" SET "capabilities" = '["online_payments","invoice_payments","direct_booking","webhooks"]'::jsonb, "sort_order" = 20, "docs_url" = 'https://developer.flutterwave.com' WHERE "provider" = 'flutterwave';
--> statement-breakpoint
INSERT INTO "integration_catalog" ("provider", "name", "category", "description", "availability", "auth_type", "capabilities", "sort_order", "docs_url")
VALUES
  ('zoho_invoice', 'Zoho Invoice', 'accounting', 'Export guests, invoices, and verified payments to Zoho Invoice. Sena remains the source of truth for settlement.', 'available', 'oauth2', '["contact_sync","invoice_export","payment_sync"]'::jsonb, 30, 'https://www.zoho.com/invoice/api/v3/'),
  ('google_calendar', 'Google Calendar', 'calendar', 'Sync reservations to Google Calendar with guest name, reference, dates, and room details.', 'available', 'oauth2', '["calendar_sync","reservation_events","push_watch"]'::jsonb, 40, 'https://developers.google.com/calendar'),
  ('whatsapp', 'WhatsApp Business', 'communications', 'Send guest lifecycle messages through the official WhatsApp Business Platform.', 'available', 'oauth2', '["guest_whatsapp","message_templates"]'::jsonb, 50, 'https://developers.facebook.com/docs/whatsapp'),
  ('zoho_books', 'Zoho Books', 'accounting', 'Sync accounting objects to Zoho Books.', 'coming_soon', 'oauth2', '["contact_sync","invoice_export"]'::jsonb, 110, NULL),
  ('quickbooks', 'QuickBooks Online', 'accounting', 'Sync accounting objects to QuickBooks Online.', 'coming_soon', 'oauth2', '["contact_sync","invoice_export"]'::jsonb, 120, NULL),
  ('xero', 'Xero', 'accounting', 'Sync accounting objects to Xero.', 'coming_soon', 'oauth2', '["contact_sync","invoice_export"]'::jsonb, 130, NULL),
  ('outlook_calendar', 'Outlook Calendar', 'calendar', 'Sync reservations to Microsoft Outlook Calendar.', 'coming_soon', 'oauth2', '["calendar_sync"]'::jsonb, 140, NULL),
  ('gmail', 'Gmail', 'communications', 'Send guest email through connected Gmail accounts.', 'coming_soon', 'oauth2', '["guest_email"]'::jsonb, 150, NULL),
  ('outlook_mail', 'Outlook Mail', 'communications', 'Send guest email through Microsoft 365.', 'coming_soon', 'oauth2', '["guest_email"]'::jsonb, 160, NULL),
  ('slack', 'Slack', 'productivity', 'Notify your team in Slack about operational events.', 'coming_soon', 'oauth2', '["team_notifications"]'::jsonb, 170, NULL),
  ('microsoft_teams', 'Microsoft Teams', 'productivity', 'Notify your team in Microsoft Teams.', 'coming_soon', 'oauth2', '["team_notifications"]'::jsonb, 180, NULL),
  ('hubspot', 'HubSpot', 'crm', 'Sync guest contacts to HubSpot CRM.', 'coming_soon', 'oauth2', '["contact_sync"]'::jsonb, 190, NULL),
  ('mailchimp', 'Mailchimp', 'crm', 'Sync marketing audiences to Mailchimp.', 'coming_soon', 'oauth2', '["contact_sync"]'::jsonb, 200, NULL),
  ('brevo', 'Brevo', 'communications', 'Send transactional guest email with Brevo.', 'coming_soon', 'api_key', '["guest_email"]'::jsonb, 210, NULL),
  ('google_drive', 'Google Drive', 'storage', 'Store property documents in Google Drive.', 'coming_soon', 'oauth2', '["file_storage"]'::jsonb, 220, NULL),
  ('dropbox', 'Dropbox', 'storage', 'Store property documents in Dropbox.', 'coming_soon', 'oauth2', '["file_storage"]'::jsonb, 230, NULL),
  ('stripe', 'Stripe', 'payments', 'Accept payments with Stripe.', 'coming_soon', 'oauth2', '["online_payments"]'::jsonb, 240, NULL),
  ('channex', 'Channex', 'channel_management', 'Distribute inventory across OTAs via Channex.', 'coming_soon', 'api_key', '["channel_management"]'::jsonb, 250, NULL),
  ('booking_com', 'Booking.com', 'channel_management', 'Connect Booking.com channel inventory.', 'coming_soon', 'managed', '["channel_management"]'::jsonb, 260, NULL),
  ('airbnb', 'Airbnb', 'channel_management', 'Connect Airbnb channel inventory.', 'coming_soon', 'managed', '["channel_management"]'::jsonb, 270, NULL),
  ('expedia', 'Expedia', 'channel_management', 'Connect Expedia channel inventory.', 'coming_soon', 'managed', '["channel_management"]'::jsonb, 280, NULL)
ON CONFLICT ("provider") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "availability" = EXCLUDED."availability",
  "auth_type" = EXCLUDED."auth_type",
  "capabilities" = EXCLUDED."capabilities",
  "sort_order" = EXCLUDED."sort_order",
  "docs_url" = COALESCE(EXCLUDED."docs_url", "integration_catalog"."docs_url"),
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "guest_message_templates" ("property_id", "template_key", "channel", "name", "subject", "body", "variables", "automation_enabled", "is_system")
SELECT NULL, v.template_key, v.channel, v.name, v.subject, v.body, v.variables::jsonb, false, true
FROM (VALUES
  ('booking_confirmation', 'email', 'Booking confirmation', 'Your stay at {{propertyName}} is confirmed', 'Hi {{guestName}}, your reservation {{reservationRef}} from {{checkIn}} to {{checkOut}} is confirmed.', '["guestName","propertyName","reservationRef","checkIn","checkOut"]'),
  ('pre_arrival', 'email', 'Pre-arrival', 'Looking forward to welcoming you', 'Hi {{guestName}}, we look forward to your arrival on {{checkIn}}.', '["guestName","checkIn","propertyName"]'),
  ('check_in', 'whatsapp', 'Check-in day', NULL, 'Hi {{guestName}}, welcome to {{propertyName}}. Your room is ready for check-in.', '["guestName","propertyName"]'),
  ('check_out', 'email', 'Check-out thank you', 'Thank you for staying with us', 'Hi {{guestName}}, thank you for staying at {{propertyName}}.', '["guestName","propertyName"]'),
  ('payment_receipt', 'email', 'Payment receipt', 'Payment received for {{reservationRef}}', 'Hi {{guestName}}, we received your payment for {{reservationRef}}.', '["guestName","reservationRef","amount"]')
) AS v(template_key, channel, name, subject, body, variables)
WHERE NOT EXISTS (
  SELECT 1 FROM "guest_message_templates" t
  WHERE t.property_id IS NULL AND t.template_key = v.template_key AND t.channel = v.channel
);
