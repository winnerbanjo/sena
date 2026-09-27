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

export type PaystackPaymentControls = {
  acceptOnlinePayments: boolean;
  directBooking: boolean;
  invoices: boolean;
};

export function paystackPaymentControls(metadata: unknown): PaystackPaymentControls {
  const record = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};
  return {
    acceptOnlinePayments: record.acceptOnlinePayments !== false,
    directBooking: record.directBooking !== false,
    invoices: record.invoices !== false,
  };
}

export function paystackDisplayStatus(record: Awaited<ReturnType<typeof getPropertyPaystack>>) {
  if (!record?.credential || record.integration.status === 'disconnected') return 'disconnected' as const;
  if (record.integration.status === 'needs_attention') return 'needs_attention' as const;
  if (!paystackPaymentControls(record.integration.metadata).acceptOnlinePayments) return 'disabled' as const;
  return 'connected' as const;
}

export function assertPaystackPayable(integration: { status: string; metadata: unknown }, source: 'invoice' | 'direct_booking' | 'api_booking') {
  if (integration.status !== 'connected') throw new Error('PAYSTACK_NOT_CONNECTED');
  const controls = paystackPaymentControls(integration.metadata);
  if (!controls.acceptOnlinePayments) throw new Error('PAYSTACK_PAYMENTS_DISABLED');
  if (source === 'direct_booking' && !controls.directBooking) throw new Error('PAYSTACK_PAYMENTS_DISABLED');
  if (source === 'invoice' && !controls.invoices) throw new Error('PAYSTACK_PAYMENTS_DISABLED');
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
    const previous = paystackPaymentControls(current?.metadata);
    const metadata = { ...(current?.metadata && typeof current.metadata === 'object' ? current.metadata : {}), currencies: verified.currencies, ...previous };
    const [integration] = current
      ? await tx.update(integrations).set({ status: 'connected', mode: verified.mode, externalAccountId: verified.accountLabel, connectedAt: current.connectedAt || now, verifiedAt: now, disconnectedAt: null, lastErrorAt: null, lastErrorMessage: null, metadata, updatedAt: now }).where(eq(integrations.id, current.id)).returning()
      : await tx.insert(integrations).values({ propertyId, provider: 'paystack', category: 'payments', status: 'connected', mode: verified.mode, externalAccountId: verified.accountLabel, webhookTokenHash, webhookTokenEncrypted, connectedAt: now, verifiedAt: now, metadata: { currencies: verified.currencies, acceptOnlinePayments: true, directBooking: true, invoices: true } }).returning();
    const existingCredential = await tx.query.integrationCredentials.findFirst({ where: and(eq(integrationCredentials.integrationId, integration.id), eq(integrationCredentials.credentialType, 'secret_key')) });
    if (existingCredential) await tx.update(integrationCredentials).set({ encryptedValue, maskedSuffix: suffix, rotatedAt: now }).where(eq(integrationCredentials.id, existingCredential.id));
    else await tx.insert(integrationCredentials).values({ integrationId: integration.id, credentialType: 'secret_key', encryptedValue, maskedSuffix: suffix });
    await tx.insert(integrationAuditLogs).values({ integrationId: integration.id, propertyId, actorUserId, action: replace ? 'paystack.key_replaced' : 'paystack.connected', mode: verified.mode, details: { account: verified.accountLabel } });
    return { integration, webhookToken: current ? decryptIntegrationSecret(current.webhookTokenEncrypted) : webhookToken, maskedSecret: maskSecret(suffix) };
  });
}

async function credentialForVerification(propertyId: string) {
  const record = await getPropertyPaystack(propertyId);
  if (!record?.credential || record.integration.status === 'disconnected') throw new Error('PAYSTACK_NOT_CONNECTED');
  return { record, secret: decryptIntegrationSecret(record.credential.encryptedValue) };
}

export async function testPaystackConnection(propertyId: string, fetcher: typeof fetch = fetch) {
  const { record, secret } = await credentialForVerification(propertyId);
  try {
    const verified = await verifyPaystackSecret(secret, fetcher);
    await db.update(integrations).set({ status: 'connected', verifiedAt: new Date(), lastErrorAt: null, lastErrorMessage: null, externalAccountId: verified.accountLabel, mode: verified.mode, updatedAt: new Date() }).where(eq(integrations.id, record.integration.id));
    return verified;
  } catch (error) {
    await db.update(integrations).set({ status: 'needs_attention', lastErrorAt: new Date(), lastErrorMessage: 'Connection verification failed.', updatedAt: new Date() }).where(eq(integrations.id, record.integration.id));
    throw error;
  }
}

export async function updatePaystackPaymentControls(propertyId: string, actorUserId: string, patch: Partial<PaystackPaymentControls>) {
  const record = await getPropertyPaystack(propertyId);
  if (!record?.credential || record.integration.status === 'disconnected') throw new Error('PAYSTACK_NOT_CONNECTED');
  const next = { ...paystackPaymentControls(record.integration.metadata) };
  for (const key of ['acceptOnlinePayments', 'directBooking', 'invoices'] as const) {
    if (typeof patch[key] === 'boolean') next[key] = patch[key];
  }
  const metadata = { ...(record.integration.metadata && typeof record.integration.metadata === 'object' ? record.integration.metadata : {}), ...next };
  await db.transaction(async (tx) => {
    await tx.update(integrations).set({ metadata, updatedAt: new Date() }).where(eq(integrations.id, record.integration.id));
    await tx.insert(integrationAuditLogs).values({ integrationId: record.integration.id, propertyId, actorUserId, action: 'paystack.payments_updated', mode: record.integration.mode, details: next });
  });
  return next;
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

export function safePaystackState(record: Awaited<ReturnType<typeof getPropertyPaystack>>, origin: string, lastWebhookAt?: Date | null) {
  if (!record || record.integration.status === 'disconnected' || !record.credential) return { status: 'disconnected' as const, displayStatus: 'disconnected' as const };
  const token = decryptIntegrationSecret(record.integration.webhookTokenEncrypted);
  const controls = paystackPaymentControls(record.integration.metadata);
  const displayStatus = paystackDisplayStatus(record);
  return {
    status: record.integration.status,
    displayStatus,
    mode: record.integration.mode,
    account: record.integration.externalAccountId,
    connectedAt: record.integration.connectedAt,
    verifiedAt: record.integration.verifiedAt,
    webhookStatus: record.integration.webhookStatus,
    webhookVerifiedAt: record.integration.webhookVerifiedAt,
    lastWebhookAt: lastWebhookAt || null,
    webhookUrl: `${origin.replace(/\/$/, '')}/api/webhooks/paystack/${token}`,
    secret: maskSecret(record.credential.maskedSuffix),
    ...controls,
  };
}
