/** Connected Apps platform types — shared across registry, OAuth, sync, and UI. */

export const INTEGRATION_CATEGORIES = [
  'payments',
  'accounting',
  'communications',
  'calendar',
  'channel_management',
  'productivity',
  'crm',
  'storage',
  'analytics',
] as const;

export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

export const AUTHENTICATION_TYPES = ['api_key', 'oauth2', 'webhook', 'managed', 'hybrid', 'secret_key'] as const;
export type AuthenticationType = (typeof AUTHENTICATION_TYPES)[number];

/** Truthful connection lifecycle — never treat a row alone as connected. */
export const CONNECTION_STATUSES = [
  'disconnected',
  'connecting',
  'connected',
  'needs_attention',
  'paused',
  'error',
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const HEALTH_STATUSES = [
  'configured',
  'awaiting_authorization',
  'authorized',
  'syncing',
  'healthy',
  'degraded',
  'reauthorization_required',
  'webhook_unverified',
  'webhook_verified',
] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const SYNC_JOB_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
  'retrying',
  'dead_letter',
] as const;
export type SyncJobStatus = (typeof SYNC_JOB_STATUSES)[number];

export const SYNC_DIRECTIONS = ['outbound', 'inbound'] as const;
export type SyncDirection = (typeof SYNC_DIRECTIONS)[number];

export const SYNC_TRIGGERS = ['manual', 'webhook', 'scheduled', 'event'] as const;
export type SyncTrigger = (typeof SYNC_TRIGGERS)[number];

export const SENA_OBJECT_TYPES = [
  'guest',
  'invoice',
  'reservation',
  'calendar_event',
  'payment',
  'contact',
  'room',
  'rate_plan',
] as const;
export type SenaObjectType = (typeof SENA_OBJECT_TYPES)[number];

export const MESSAGE_CHANNELS = ['email', 'whatsapp', 'sms'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const MESSAGE_STATUSES = ['queued', 'sent', 'delivered', 'failed'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export type ProviderCapability =
  | 'online_payments'
  | 'invoice_payments'
  | 'direct_booking'
  | 'webhooks'
  | 'contact_sync'
  | 'invoice_export'
  | 'payment_sync'
  | 'calendar_sync'
  | 'reservation_events'
  | 'push_watch'
  | 'guest_whatsapp'
  | 'guest_email'
  | 'message_templates'
  | 'channel_management'
  | 'team_notifications'
  | 'file_storage';

export type ProviderDefinition = {
  provider: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  availability: 'available' | 'coming_soon' | 'beta';
  authenticationType: AuthenticationType;
  capabilities: ProviderCapability[];
  logoUrl?: string | null;
  docsUrl?: string | null;
  sortOrder: number;
};

export type SafeIntegrationView = {
  provider: string;
  name: string;
  category: IntegrationCategory | string;
  description: string;
  availability: string;
  authenticationType: string;
  capabilities: string[];
  logoUrl?: string | null;
  docsUrl?: string | null;
  connectionStatus: ConnectionStatus | 'coming_soon';
  healthStatus: HealthStatus | null;
  environment?: string | null;
  mode?: string | null;
  accountLabel?: string | null;
  connectedAt?: string | null;
  verifiedAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncAttemptAt?: string | null;
  lastErrorMessage?: string | null;
  webhookStatus?: string | null;
  canConnect: boolean;
  canManage: boolean;
  recommended?: boolean;
};
