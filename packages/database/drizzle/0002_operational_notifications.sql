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
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('id', 'uuid', true), ('property_id', 'uuid', true),
      ('dedupe_key', 'character varying(200)', true), ('kind', 'character varying(40)', true),
      ('title', 'character varying(160)', true), ('body', 'text', true),
      ('href', 'character varying(300)', false), ('read_at', 'timestamp with time zone', false),
      ('created_at', 'timestamp with time zone', true)
    ) expected(name, type_name, required)
    LEFT JOIN pg_attribute a ON a.attrelid = 'public.operational_notifications'::regclass AND a.attname = expected.name AND NOT a.attisdropped
    WHERE a.attnum IS NULL OR format_type(a.atttypid, a.atttypmod) <> expected.type_name OR a.attnotnull <> expected.required
  ) THEN
    RAISE EXCEPTION 'Unexpected operational notification columns; migration stopped';
  END IF;
END $$;
--> statement-breakpoint
-- A partially applied migration may already have this constraint. Validate its
-- definition before accepting it; never swallow a conflicting schema definition.
DO $$
DECLARE existing_constraint record;
BEGIN
  SELECT * INTO existing_constraint FROM pg_constraint
  WHERE conrelid = 'public.operational_notifications'::regclass
    AND conname = 'operational_notifications_property_id_properties_id_fk';
  IF FOUND THEN
    IF existing_constraint.contype <> 'f'
      OR existing_constraint.confrelid <> 'public.properties'::regclass
      OR existing_constraint.conkey <> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.operational_notifications'::regclass AND attname = 'property_id')]::smallint[]
      OR existing_constraint.confkey <> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.properties'::regclass AND attname = 'id')]::smallint[]
      OR existing_constraint.confdeltype <> 'c'
      OR existing_constraint.confupdtype <> 'a'
      OR NOT existing_constraint.convalidated
      OR existing_constraint.condeferrable THEN
      RAISE EXCEPTION 'Unexpected operational notification foreign key definition; migration stopped';
    END IF;
  ELSE
    ALTER TABLE "public"."operational_notifications" ADD CONSTRAINT "operational_notifications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operational_notifications_dedupe_idx" ON "operational_notifications" USING btree ("property_id","dedupe_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operational_notifications_prop_idx" ON "operational_notifications" USING btree ("property_id","created_at");

--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'operational_notifications'
      AND indexname = 'operational_notifications_dedupe_idx'
      AND indexdef = 'CREATE UNIQUE INDEX operational_notifications_dedupe_idx ON public.operational_notifications USING btree (property_id, dedupe_key)'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'operational_notifications'
      AND indexname = 'operational_notifications_prop_idx'
      AND indexdef = 'CREATE INDEX operational_notifications_prop_idx ON public.operational_notifications USING btree (property_id, created_at)'
  ) THEN
    RAISE EXCEPTION 'Unexpected operational notification index definition; migration stopped';
  END IF;
END $$;
