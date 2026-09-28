INSERT INTO "integration_catalog" ("provider", "name", "category", "description", "availability", "auth_type")
VALUES ('flutterwave', 'Flutterwave', 'payments', 'Accept property payments using the hotel''s own Flutterwave account.', 'available', 'secret_key')
ON CONFLICT ("provider") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "preferred_online_provider" varchar(50);
