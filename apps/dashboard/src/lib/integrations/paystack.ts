import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db, integrationAuditLogs, integrationCredentials, integrations } from '@sena/database';
import { decryptIntegrationSecret, encryptIntegrationSecret, maskSecret } from './crypto';

export type PaystackMode = 'test' | 'live';

function detectMode(secret: string): PaystackMode {
  if (secret.startsWith('sk_test_')) return 'test';
  if (secret.startsWith('sk_live_')) return 'live';
  throw new Error('INVALID_CREDENTIAL');
}

export async function verifyPaystackSecret(secret: string, fetcher: typeof fetch = fetch) {
  const mode = detectMode(secret);
  const response = await fetcher('https://api.paystack.co/balance', {
    headers: { Authorization: `Bearer ${secret}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(response.status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'INVALID_CREDENTIAL');
  const result = await response.json().catch(() => null) as any;
  if (!result?.status) throw new Error('INVALID_CREDENTIAL');
  const currencies = Array.isArray(result.data) ? result.data.map((entry: any) => entry.currency).filter(Boolean) : [];
  return { mode, accountLabel: 'Verified Paystack account', currencies };
}

export async function getPropertyPaystack(propertyId: string) {
  const integration = await db.query.integrations.findFirst({
    where: and(eq(integrations.propertyId, propertyId), eq(integrations.provider, 'paystack')),
  });
  if (!integration) return null;
  const credential = await db.query.integrationCredentials.findFirst({
    where: and(eq(integrationCredentials.integrationId, integration.id), eq(integrationCredentials.credentialType, 'secret_key')),
  });
  return { integration, credential };
}

export async function requireConnectedPaystack(propertyId: string) {
  const record = await getPropertyPaystack(propertyId);
  if (!record || record.integration.status !== 'connected' || !record.credential) throw new Error('PAYSTACK_NOT_CONNECTED');
  return { integration: record.integration, secret: decryptIntegrationSecret(record.credential.encryptedValue) };
}

export async function connectPaystack(propertyId: string, actorUserId: string, secret: string, replace = false, fetcher: typeof fetch = fetch) {
  const verified = await verifyPaystackSecret(secret.trim(), fetcher);
  const encryptedValue = encryptIntegrationSecret(secret.trim());
  const suffix = secret.trim().slice(-4);
  const webhookToken = crypto.randomBytes(32).toString('base64url');
  const webhookTokenHash = crypto.createHash('sha256').update(webhookToken).digest('hex');
  const webhookTokenEncrypted = encryptIntegrationSecret(webhookToken);
  return db.transaction(async (tx) => {
    const current = await tx.query.integrations.findFirst({ where: and(eq(integrations.propertyId, propertyId), eq(integrations.provider, 'paystack')) });
    const now = new Date();
    const [integration] = current
      ? await tx.update(integrations).set({ status: 'connected', mode: verified.mode, externalAccountId: verified.accountLabel, connectedAt: current.connectedAt || now, verifiedAt: now, disconnectedAt: null, lastErrorAt: null, lastErrorMessage: null, metadata: { currencies: verified.currencies }, updatedAt: now }).where(eq(integrations.id, current.id)).returning()
      : await tx.insert(integrations).values({ propertyId, provider: 'paystack', category: 'payments', status: 'connected', mode: verified.mode, externalAccountId: verified.accountLabel, webhookTokenHash, webhookTokenEncrypted, connectedAt: now, verifiedAt: now, metadata: { currencies: verified.currencies } }).returning();
    const existingCredential = await tx.query.integrationCredentials.findFirst({ where: and(eq(integrationCredentials.integrationId, integration.id), eq(integrationCredentials.credentialType, 'secret_key')) });
    if (existingCredential) await tx.update(integrationCredentials).set({ encryptedValue, maskedSuffix: suffix, rotatedAt: now }).where(eq(integrationCredentials.id, existingCredential.id));
    else await tx.insert(integrationCredentials).values({ integrationId: integration.id, credentialType: 'secret_key', encryptedValue, maskedSuffix: suffix });
    await tx.insert(integrationAuditLogs).values({ integrationId: integration.id, propertyId, actorUserId, action: replace ? 'paystack.key_replaced' : 'paystack.connected', mode: verified.mode, details: { account: verified.accountLabel } });
    return { integration, webhookToken: current ? decryptIntegrationSecret(current.webhookTokenEncrypted) : webhookToken, maskedSecret: maskSecret(suffix) };
  });
}

export async function testPaystackConnection(propertyId: string, fetcher: typeof fetch = fetch) {
  const record = await requireConnectedPaystack(propertyId);
  try {
    const verified = await verifyPaystackSecret(record.secret, fetcher);
    await db.update(integrations).set({ status: 'connected', verifiedAt: new Date(), lastErrorAt: null, lastErrorMessage: null, updatedAt: new Date() }).where(eq(integrations.id, record.integration.id));
    return verified;
  } catch (error) {
    await db.update(integrations).set({ status: 'needs_attention', lastErrorAt: new Date(), lastErrorMessage: 'Connection verification failed.', updatedAt: new Date() }).where(eq(integrations.id, record.integration.id));
    throw error;
  }
}

export async function disconnectPaystack(propertyId: string, actorUserId: string) {
  const record = await getPropertyPaystack(propertyId);
  if (!record) return;
  await db.transaction(async (tx) => {
    await tx.delete(integrationCredentials).where(eq(integrationCredentials.integrationId, record.integration.id));
    await tx.update(integrations).set({ status: 'disconnected', disconnectedAt: new Date(), updatedAt: new Date() }).where(eq(integrations.id, record.integration.id));
    await tx.insert(integrationAuditLogs).values({ integrationId: record.integration.id, propertyId, actorUserId, action: 'paystack.disconnected', mode: record.integration.mode });
  });
}

export function safePaystackState(record: Awaited<ReturnType<typeof getPropertyPaystack>>, origin: string) {
  if (!record) return { status: 'disconnected' as const };
  const token = decryptIntegrationSecret(record.integration.webhookTokenEncrypted);
  return {
    id: record.integration.id,
    status: record.integration.status,
    mode: record.integration.mode,
    account: record.integration.externalAccountId,
    verifiedAt: record.integration.verifiedAt,
    webhookStatus: record.integration.webhookStatus,
    webhookUrl: `${origin}/api/webhooks/paystack/${token}`,
    secret: record.credential ? maskSecret(record.credential.maskedSuffix) : null,
  };
}
