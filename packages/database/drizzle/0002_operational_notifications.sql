CREATE TABLE IF NOT EXISTS "operational_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "dedupe_key" varchar(200) NOT NULL,
  "kind" varchar(40) NOT NULL,
  "title" varchar(160) NOT NULL,
  "body" text NOT NULL,
  "href" varchar(300),
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operational_notifications" ADD CONSTRAINT "operational_notifications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operational_notifications_dedupe_idx" ON "operational_notifications" USING btree ("property_id","dedupe_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operational_notifications_prop_idx" ON "operational_notifications" USING btree ("property_id","created_at");
