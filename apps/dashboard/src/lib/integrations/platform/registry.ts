import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db, integrationCatalog, integrations, integrationOauthTokens, integrationCredentials } from '@sena/database';
import type {
  ConnectionStatus,
  HealthStatus,
  ProviderCapability,
  ProviderDefinition,
  SafeIntegrationView,
} from './types';
import { deriveConnectionAndHealth } from './status';

const FALLBACK_REGISTRY: ProviderDefinition[] = [
  {
    provider: 'paystack',
    name: 'Paystack',
    category: 'payments',
    description: "Accept online payments directly into your hotel's Paystack account.",
    availability: 'available',
    authenticationType: 'secret_key',
    capabilities: ['online_payments', 'invoice_payments', 'direct_booking', 'webhooks'],
    docsUrl: 'https://paystack.com/docs',
    sortOrder: 10,
  },
  {
    provider: 'flutterwave',
    name: 'Flutterwave',
    category: 'payments',
    description: "Accept online payments directly into your hotel's Flutterwave account.",
    availability: 'available',
    authenticationType: 'secret_key',
    capabilities: ['online_payments', 'invoice_payments', 'direct_booking', 'webhooks'],
    docsUrl: 'https://developer.flutterwave.com',
    sortOrder: 20,
  },
  {
    provider: 'zoho_invoice',
    name: 'Zoho Invoice',
    category: 'accounting',
    description: 'Export guests, invoices, and verified payments to Zoho Invoice.',
    availability: 'available',
    authenticationType: 'oauth2',
    capabilities: ['contact_sync', 'invoice_export', 'payment_sync'],
    docsUrl: 'https://www.zoho.com/invoice/api/v3/',
    sortOrder: 30,
  },
  {
    provider: 'google_calendar',
    name: 'Google Calendar',
    category: 'calendar',
    description: 'Sync reservations to Google Calendar.',
    availability: 'available',
    authenticationType: 'oauth2',
    capabilities: ['calendar_sync', 'reservation_events', 'push_watch'],
    docsUrl: 'https://developers.google.com/calendar',
    sortOrder: 40,
  },
  {
    provider: 'whatsapp',
    name: 'WhatsApp Business',
    category: 'communications',
    description: 'Send guest messages through the official WhatsApp Business Platform.',
    availability: 'available',
    authenticationType: 'oauth2',
    capabilities: ['guest_whatsapp', 'message_templates'],
    docsUrl: 'https://developers.facebook.com/docs/whatsapp',
    sortOrder: 50,
  },
];

let schemaReady: Promise<void> | null = null;

/** Idempotent schema bootstrap for Connected Apps platform tables. */
export async function ensureConnectedAppsPlatformSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      // Additive, idempotent statements — safe on already-migrated databases.
      await db.execute(sql`ALTER TABLE integration_catalog ADD COLUMN IF NOT EXISTS logo_url text`);
      await db.execute(sql`ALTER TABLE integration_catalog ADD COLUMN IF NOT EXISTS docs_url text`);
      await db.execute(sql`ALTER TABLE integration_catalog ADD COLUMN IF NOT EXISTS capabilities jsonb DEFAULT '[]'::jsonb NOT NULL`);
      await db.execute(sql`ALTER TABLE integration_catalog ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 100 NOT NULL`);
      await db.execute(sql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS health_status varchar(40) DEFAULT 'configured' NOT NULL`);
      await db.execute(sql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS environment varchar(30)`);
      await db.execute(sql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS last_sync_at timestamptz`);
      await db.execute(sql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS last_sync_attempt_at timestamptz`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS integrations_health_idx ON integrations (provider, status, health_status)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS integration_oauth_states (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          state_hash varchar(64) NOT NULL,
          property_id uuid NOT NULL REFERENCES properties(id) ON DELETE cascade,
          provider varchar(50) NOT NULL REFERENCES integration_catalog(provider),
          actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
          code_verifier_encrypted text,
          redirect_uri text NOT NULL,
          scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
          metadata jsonb,
          expires_at timestamptz NOT NULL,
          consumed_at timestamptz,
          created_at timestamptz DEFAULT now() NOT NULL
        )`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS integration_oauth_state_hash_idx ON integration_oauth_states (state_hash)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS integration_oauth_tokens (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE cascade,
          access_token_encrypted text NOT NULL,
          refresh_token_encrypted text,
          token_type varchar(50) DEFAULT 'Bearer' NOT NULL,
          scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
          expires_at timestamptz,
          account_metadata jsonb,
          created_at timestamptz DEFAULT now() NOT NULL,
          rotated_at timestamptz
        )`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS integration_oauth_token_integration_idx ON integration_oauth_tokens (integration_id)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS integration_external_objects (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          property_id uuid NOT NULL REFERENCES properties(id) ON DELETE cascade,
          integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE cascade,
          provider varchar(50) NOT NULL,
          sena_object_type varchar(50) NOT NULL,
          sena_object_id uuid NOT NULL,
          external_object_type varchar(80) NOT NULL,
          external_object_id varchar(255) NOT NULL,
          sync_state varchar(30) DEFAULT 'synced' NOT NULL,
          last_synced_at timestamptz,
          metadata jsonb,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_at timestamptz DEFAULT now() NOT NULL
        )`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS integration_ext_local_idx ON integration_external_objects (integration_id, sena_object_type, sena_object_id)`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS integration_ext_remote_idx ON integration_external_objects (integration_id, external_object_type, external_object_id)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS integration_sync_jobs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          property_id uuid NOT NULL REFERENCES properties(id) ON DELETE cascade,
          integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE cascade,
          provider varchar(50) NOT NULL,
          direction varchar(20) NOT NULL,
          trigger varchar(20) NOT NULL,
          job_type varchar(80) NOT NULL,
          status varchar(30) DEFAULT 'queued' NOT NULL,
          attempt_count integer DEFAULT 0 NOT NULL,
          max_attempts integer DEFAULT 8 NOT NULL,
          cursor text,
          idempotency_key varchar(255),
          payload jsonb,
          last_error text,
          next_run_at timestamptz DEFAULT now() NOT NULL,
          started_at timestamptz,
          completed_at timestamptz,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_at timestamptz DEFAULT now() NOT NULL
        )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS integration_sync_jobs_queue_idx ON integration_sync_jobs (status, next_run_at)`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS integration_sync_jobs_idempotency_idx ON integration_sync_jobs (property_id, idempotency_key)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS guest_messages (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          property_id uuid NOT NULL REFERENCES properties(id) ON DELETE cascade,
          guest_id uuid REFERENCES guests(id) ON DELETE set null,
          reservation_id uuid REFERENCES reservations(id) ON DELETE set null,
          channel varchar(30) NOT NULL,
          provider varchar(50),
          template_key varchar(80),
          status varchar(30) DEFAULT 'queued' NOT NULL,
          to_address varchar(255),
          subject varchar(255),
          body_preview text,
          provider_message_id varchar(255),
          idempotency_key varchar(255),
          attempt_count integer DEFAULT 0 NOT NULL,
          last_error text,
          metadata jsonb,
          queued_at timestamptz DEFAULT now() NOT NULL,
          sent_at timestamptz,
          delivered_at timestamptz,
          failed_at timestamptz,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_at timestamptz DEFAULT now() NOT NULL
        )`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS guest_messages_idempotency_idx ON guest_messages (property_id, idempotency_key)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS guest_message_templates (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          property_id uuid REFERENCES properties(id) ON DELETE cascade,
          template_key varchar(80) NOT NULL,
          channel varchar(30) NOT NULL,
          name varchar(120) NOT NULL,
          subject varchar(255),
          body text NOT NULL,
          variables jsonb DEFAULT '[]'::jsonb NOT NULL,
          automation_enabled boolean DEFAULT false NOT NULL,
          is_system boolean DEFAULT false NOT NULL,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_at timestamptz DEFAULT now() NOT NULL
        )`);
      await db.execute(sql`
        INSERT INTO integration_catalog (provider, name, category, description, availability, auth_type, capabilities, sort_order, docs_url)
        VALUES
          ('zoho_invoice', 'Zoho Invoice', 'accounting', 'Export guests, invoices, and verified payments to Zoho Invoice. Sena remains the source of truth for settlement.', 'available', 'oauth2', '["contact_sync","invoice_export","payment_sync"]'::jsonb, 30, 'https://www.zoho.com/invoice/api/v3/'),
          ('google_calendar', 'Google Calendar', 'calendar', 'Sync reservations to Google Calendar with guest name, reference, dates, and room details.', 'available', 'oauth2', '["calendar_sync","reservation_events","push_watch"]'::jsonb, 40, 'https://developers.google.com/calendar'),
          ('whatsapp', 'WhatsApp Business', 'communications', 'Send guest lifecycle messages through the official WhatsApp Business Platform.', 'available', 'oauth2', '["guest_whatsapp","message_templates"]'::jsonb, 50, 'https://developers.facebook.com/docs/whatsapp'),
          ('zoho_books', 'Zoho Books', 'accounting', 'Sync accounting objects to Zoho Books.', 'coming_soon', 'oauth2', '["contact_sync","invoice_export"]'::jsonb, 110, NULL),
          ('quickbooks', 'QuickBooks Online', 'accounting', 'Sync accounting objects to QuickBooks Online.', 'coming_soon', 'oauth2', '["contact_sync","invoice_export"]'::jsonb, 120, NULL),
          ('xero', 'Xero', 'accounting', 'Sync accounting objects to Xero.', 'coming_soon', 'oauth2', '["contact_sync","invoice_export"]'::jsonb, 130, NULL),
          ('channex', 'Channex', 'channel_management', 'Distribute inventory across OTAs via Channex.', 'coming_soon', 'api_key', '["channel_management"]'::jsonb, 250, NULL),
          ('booking_com', 'Booking.com', 'channel_management', 'Connect Booking.com channel inventory.', 'coming_soon', 'managed', '["channel_management"]'::jsonb, 260, NULL),
          ('airbnb', 'Airbnb', 'channel_management', 'Connect Airbnb channel inventory.', 'coming_soon', 'managed', '["channel_management"]'::jsonb, 270, NULL),
          ('expedia', 'Expedia', 'channel_management', 'Connect Expedia channel inventory.', 'coming_soon', 'managed', '["channel_management"]'::jsonb, 280, NULL)
        ON CONFLICT (provider) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          availability = EXCLUDED.availability,
          auth_type = EXCLUDED.auth_type,
          capabilities = EXCLUDED.capabilities,
          sort_order = EXCLUDED.sort_order,
          updated_at = now()
      `);
      await db.execute(sql`UPDATE integration_catalog SET capabilities = '["online_payments","invoice_payments","direct_booking","webhooks"]'::jsonb, sort_order = 10 WHERE provider = 'paystack'`);
      await db.execute(sql`UPDATE integration_catalog SET capabilities = '["online_payments","invoice_payments","direct_booking","webhooks"]'::jsonb, sort_order = 20 WHERE provider = 'flutterwave'`);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function mapCatalogRow(row: typeof integrationCatalog.$inferSelect): ProviderDefinition {
  const capabilities = Array.isArray(row.capabilities) ? (row.capabilities as ProviderCapability[]) : [];
  return {
    provider: row.provider,
    name: row.name,
    category: row.category as ProviderDefinition['category'],
    description: row.description,
    availability: (row.availability as ProviderDefinition['availability']) || 'coming_soon',
    authenticationType: row.authType as ProviderDefinition['authenticationType'],
    capabilities,
    logoUrl: row.logoUrl,
    docsUrl: row.docsUrl,
    sortOrder: row.sortOrder ?? 100,
  };
}

export async function listProviderRegistry(): Promise<ProviderDefinition[]> {
  await ensureConnectedAppsPlatformSchema();
  try {
    const rows = await db.select().from(integrationCatalog).orderBy(asc(integrationCatalog.sortOrder), asc(integrationCatalog.name));
    if (rows.length) return rows.map(mapCatalogRow);
  } catch {
    // Fall through to in-memory registry when catalog columns are mid-migrate.
  }
  return FALLBACK_REGISTRY;
}

export async function getProviderDefinition(provider: string): Promise<ProviderDefinition | null> {
  const all = await listProviderRegistry();
  return all.find((entry) => entry.provider === provider) || null;
}

export async function getPropertyIntegration(propertyId: string, provider: string) {
  await ensureConnectedAppsPlatformSchema();
  return db.query.integrations.findFirst({
    where: and(eq(integrations.propertyId, propertyId), eq(integrations.provider, provider)),
  });
}

async function hasUsableAuth(integrationId: string, authType: string) {
  if (authType === 'oauth2') {
    const token = await db.query.integrationOauthTokens.findFirst({
      where: eq(integrationOauthTokens.integrationId, integrationId),
    });
    return Boolean(token?.accessTokenEncrypted);
  }
  const credential = await db.query.integrationCredentials.findFirst({
    where: eq(integrationCredentials.integrationId, integrationId),
  });
  return Boolean(credential?.encryptedValue);
}

export async function buildMarketplaceCatalog(input: {
  propertyId: string;
  canManage: boolean;
  category?: string;
  query?: string;
}): Promise<SafeIntegrationView[]> {
  const registry = await listProviderRegistry();
  const propertyIntegrations = await db
    .select()
    .from(integrations)
    .where(eq(integrations.propertyId, input.propertyId));
  const byProvider = new Map(propertyIntegrations.map((row) => [row.provider, row]));

  const views: SafeIntegrationView[] = [];
  for (const definition of registry) {
    if (input.category && input.category !== 'all' && input.category !== 'connected' && input.category !== 'recommended') {
      if (definition.category !== input.category) continue;
    }
    if (input.query) {
      const q = input.query.toLowerCase();
      if (![definition.name, definition.description, definition.provider, definition.category].some((v) => v.toLowerCase().includes(q))) {
        continue;
      }
    }

    const record = byProvider.get(definition.provider) || null;
    const authOk = record ? await hasUsableAuth(record.id, definition.authenticationType) : false;
    const derived = deriveConnectionAndHealth({
      availability: definition.availability,
      integration: record,
      hasCredentials: authOk,
      authType: definition.authenticationType,
    });

    if (input.category === 'connected' && derived.connectionStatus !== 'connected' && derived.connectionStatus !== 'needs_attention' && derived.connectionStatus !== 'paused') {
      continue;
    }
    if (input.category === 'recommended' && !['zoho_invoice', 'google_calendar', 'whatsapp', 'paystack', 'flutterwave'].includes(definition.provider)) {
      continue;
    }

    views.push({
      provider: definition.provider,
      name: definition.name,
      category: definition.category,
      description: definition.description,
      availability: definition.availability,
      authenticationType: definition.authenticationType,
      capabilities: definition.capabilities,
      logoUrl: definition.logoUrl,
      docsUrl: definition.docsUrl,
      connectionStatus: derived.connectionStatus,
      healthStatus: derived.healthStatus,
      environment: record?.environment || record?.mode || null,
      mode: record?.mode || null,
      accountLabel: record?.externalAccountId || null,
      connectedAt: record?.connectedAt?.toISOString() || null,
      verifiedAt: record?.verifiedAt?.toISOString() || null,
      lastSyncAt: record?.lastSyncAt?.toISOString() || null,
      lastSyncAttemptAt: record?.lastSyncAttemptAt?.toISOString() || null,
      lastErrorMessage: record?.status === 'disconnected' ? null : record?.lastErrorMessage || null,
      webhookStatus: record?.webhookStatus || null,
      canConnect: definition.availability === 'available' && input.canManage,
      canManage: input.canManage,
      recommended: ['zoho_invoice', 'google_calendar', 'whatsapp'].includes(definition.provider),
    });
  }

  return views;
}

export async function listAdminIntegrationHealth(filters: {
  provider?: string;
  status?: string;
  propertyId?: string;
  healthStatus?: string;
  limit?: number;
}) {
  await ensureConnectedAppsPlatformSchema();
  const rows = await db.select().from(integrations).limit(Math.min(filters.limit || 200, 500));
  return rows
    .filter((row) => !filters.provider || row.provider === filters.provider)
    .filter((row) => !filters.status || row.status === filters.status)
    .filter((row) => !filters.propertyId || row.propertyId === filters.propertyId)
    .filter((row) => !filters.healthStatus || row.healthStatus === filters.healthStatus)
    .map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      provider: row.provider,
      category: row.category,
      status: row.status as ConnectionStatus,
      healthStatus: row.healthStatus as HealthStatus,
      mode: row.mode,
      environment: row.environment,
      accountLabel: row.externalAccountId,
      webhookStatus: row.webhookStatus,
      lastSyncAt: row.lastSyncAt?.toISOString() || null,
      lastSyncAttemptAt: row.lastSyncAttemptAt?.toISOString() || null,
      lastErrorAt: row.lastErrorAt?.toISOString() || null,
      lastErrorMessage: row.lastErrorMessage,
      connectedAt: row.connectedAt?.toISOString() || null,
      updatedAt: row.updatedAt.toISOString(),
    }));
}

export async function providersByIds(providers: string[]) {
  if (!providers.length) return [];
  await ensureConnectedAppsPlatformSchema();
  return db.select().from(integrationCatalog).where(inArray(integrationCatalog.provider, providers));
}
