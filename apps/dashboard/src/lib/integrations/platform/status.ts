import type { ConnectionStatus, HealthStatus } from './types';

type IntegrationLike = {
  status: string;
  healthStatus?: string | null;
  webhookStatus?: string | null;
  lastErrorMessage?: string | null;
  disconnectedAt?: Date | null;
  connectedAt?: Date | null;
  verifiedAt?: Date | null;
} | null;

/**
 * Derive truthful connection + health. A catalog/integration row alone is never "connected".
 */
export function deriveConnectionAndHealth(input: {
  availability: string;
  integration: IntegrationLike;
  hasCredentials: boolean;
  authType: string;
}): { connectionStatus: ConnectionStatus | 'coming_soon'; healthStatus: HealthStatus | null } {
  if (input.availability === 'coming_soon') {
    return { connectionStatus: 'coming_soon', healthStatus: null };
  }

  const row = input.integration;
  if (!row || row.status === 'disconnected' || !input.hasCredentials) {
    return { connectionStatus: 'disconnected', healthStatus: null };
  }

  if (row.status === 'connecting') {
    return { connectionStatus: 'connecting', healthStatus: 'awaiting_authorization' };
  }

  if (row.status === 'paused') {
    return { connectionStatus: 'paused', healthStatus: (row.healthStatus as HealthStatus) || 'configured' };
  }

  if (row.status === 'error') {
    return { connectionStatus: 'error', healthStatus: 'degraded' };
  }

  if (row.status === 'needs_attention') {
    const health =
      row.healthStatus === 'reauthorization_required'
        ? 'reauthorization_required'
        : row.webhookStatus === 'needs_attention'
          ? 'webhook_unverified'
          : 'degraded';
    return { connectionStatus: 'needs_attention', healthStatus: health };
  }

  if (row.status !== 'connected') {
    return { connectionStatus: 'disconnected', healthStatus: null };
  }

  // Connected requires usable credentials (checked above) plus verified auth where applicable.
  if (input.authType === 'oauth2' && !row.verifiedAt && !row.connectedAt) {
    return { connectionStatus: 'connecting', healthStatus: 'awaiting_authorization' };
  }

  let health: HealthStatus = (row.healthStatus as HealthStatus) || 'healthy';
  if (row.webhookStatus === 'active' || row.webhookStatus === 'verified') health = 'webhook_verified';
  else if (row.webhookStatus === 'configured') health = health === 'healthy' ? 'webhook_unverified' : health;
  else if (row.webhookStatus === 'needs_attention') health = 'webhook_unverified';

  if (row.lastErrorMessage && health === 'healthy') health = 'degraded';

  return { connectionStatus: 'connected', healthStatus: health };
}

export function assertNeverConnectedWithoutAuth(hasCredentials: boolean, status: string) {
  if (!hasCredentials && status === 'connected') {
    throw new Error('INVALID_CONNECTION_STATE');
  }
}
