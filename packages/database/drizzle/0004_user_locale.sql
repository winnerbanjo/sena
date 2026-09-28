ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" varchar(16) NOT NULL DEFAULT 'en';
--> statement-breakpoint
UPDATE "users" SET "locale" = 'en' WHERE "locale" IS NULL OR "locale" = '';
