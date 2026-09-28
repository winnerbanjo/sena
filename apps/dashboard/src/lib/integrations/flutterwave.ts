import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db, integrationAuditLogs, integrationCatalog, integrationCredentials, integrations, properties } from '@sena/database';
import { decryptIntegrationSecret, encryptIntegrationSecret, maskSecret, readIntegrationSecret } from './crypto';

export type FlutterwaveMode = 'test' | 'live';

let flutterwaveSchemaReady = false;

export async function ensureFlutterwaveSchema() {
  if (flutterwaveSchemaReady) return;
  await db.execute(sql`
    INSERT INTO integration_catalog (provider, name, category, description, availability, auth_type)
    VALUES ('flutterwave', 'Flutterwave', 'payments', 'Accept property payments using the hotel''s own Flutterwave account.', 'available', 'secret_key')
    ON CONFLICT (provider) DO NOTHING
  `);
  await db.execute(sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS preferred_online_provider varchar(50)`);
  flutterwaveSchemaReady = true;
}

export function detectFlutterwaveMode(secret: string): FlutterwaveMode {
  const value = secret.trim();
  if (value.startsWith('FLWSECK_TEST-')) return 'test';
  if (value.startsWith('FLWSECK-') && !value.includes('_TEST')) return 'live';
  throw new Error('INVALID_CREDENTIAL');
}

export async function verifyFlutterwaveSecret(secret: string, fetcher: typeof fetch = fetch) {
  const mode = detectFlutterwaveMode(secret);
  const response = await fetcher('https://api.flutterwave.com/v3/balances', {
    headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(response.status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'INVALID_CREDENTIAL');
  const result = await response.json().catch(() => null) as any;
  if (result?.status !== 'success') throw new Error('INVALID_CREDENTIAL');
  const currencies = Array.isArray(result.data)
    ? result.data.map((entry: any) => entry.currency).filter(Boolean)
    : [];
  return { mode, accountLabel: 'Verified Flutterwave account', currencies };
}

export function verifyFlutterwaveWebhookHash(secretHash: string, header: string | null | undefined) {
  if (!secretHash || !header) return false;
  const expected = Buffer.from(secretHash);
  const received = Buffer.from(header);
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

/** Official Flutterwave v4 header, using the same dashboard secret hash as v3 `verif-hash`. */
export function verifyFlutterwaveSignatureHeader(secretHash: string, rawBody: string, header: string | null | undefined) {
  if (!secretHash || !header) return false;
  const expected = crypto.createHmac('sha256', secretHash).update(rawBody).digest('base64');
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(header);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export function flutterwaveWebhookAuthentic(secretHash: string, rawBody: string, headers: { verifHash?: string | null; signature?: string | null }) {
  const hashOk = verifyFlutterwaveWebhookHash(secretHash, headers.verifHash || null);
  const signatureOk = verifyFlutterwaveSignatureHeader(secretHash, rawBody, headers.signature || null);
  return hashOk || signatureOk;
}

export async function getPropertyFlutterwave(propertyId: string) {
  const integration = await db.query.integrations.findFirst({
    where: and(eq(integrations.propertyId, propertyId), eq(integrations.provider, 'flutterwave')),
  });
  if (!integration) return null;
  const credential = await db.query.integrationCredentials.findFirst({
    where: and(eq(integrationCredentials.integrationId, integration.id), eq(integrationCredentials.credentialType, 'secret_key')),
  });
  const webhookSecret = await db.query.integrationCredentials.findFirst({
    where: and(eq(integrationCredentials.integrationId, integration.id), eq(integrationCredentials.credentialType, 'webhook_secret')),
  });
  return { integration, credential, webhookSecret };
}

export type FlutterwavePaymentControls = {
  enabled: boolean;
  acceptOnlinePayments: boolean;
  directBooking: boolean;
  invoices: boolean;
};

export function flutterwavePaymentControls(metadata: unknown): FlutterwavePaymentControls {
  const record = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};
  const enabled =
    record.enabled !== undefined
      ? record.enabled === true
      : record.acceptOnlinePayments !== false;
  return {
    enabled,
    acceptOnlinePayments: record.acceptOnlinePayments !== false,
    directBooking: record.directBooking !== false,
    invoices: record.invoices !== false,
  };
}

export function flutterwaveDisplayStatus(record: Awaited<ReturnType<typeof getPropertyFlutterwave>>) {
  if (!record?.credential || record.integration.status === 'disconnected') return 'disconnected' as const;
  if (record.integration.status === 'needs_attention') return 'needs_attention' as const;
  const controls = flutterwavePaymentControls(record.integration.metadata);
  if (!controls.enabled || !controls.acceptOnlinePayments) return 'disabled' as const;
  return 'connected' as const;
}

export function assertFlutterwavePayable(integration: { status: string; metadata: unknown }, source: 'invoice' | 'direct_booking' | 'api_booking') {
  if (integration.status !== 'connected') throw new Error('FLUTTERWAVE_NOT_CONNECTED');
  const controls = flutterwavePaymentControls(integration.metadata);
  if (!controls.enabled) throw new Error('FLUTTERWAVE_PAYMENTS_DISABLED');
  if (!controls.acceptOnlinePayments) throw new Error('FLUTTERWAVE_PAYMENTS_DISABLED');
  if (source === 'direct_booking' && !controls.directBooking) throw new Error('FLUTTERWAVE_PAYMENTS_DISABLED');
  if (source === 'invoice' && !controls.invoices) throw new Error('FLUTTERWAVE_PAYMENTS_DISABLED');
}

export async function requireConnectedFlutterwave(propertyId: string) {
  const record = await getPropertyFlutterwave(propertyId);
  if (!record || record.integration.status !== 'connected' || !record.credential) throw new Error('FLUTTERWAVE_NOT_CONNECTED');
  return {
    integration: record.integration,
    secret: decryptIntegrationSecret(record.credential.encryptedValue),
    webhookSecret: record.webhookSecret ? decryptIntegrationSecret(record.webhookSecret.encryptedValue) : '',
  };
}

export async function connectFlutterwave(propertyId: string, actorUserId: string, secret: string, replace = false, fetcher: typeof fetch = fetch) {
  await ensureFlutterwaveSchema();
  const catalog = await db.query.integrationCatalog.findFirst({ where: eq(integrationCatalog.provider, 'flutterwave') });
  if (!catalog) throw new Error('PROVIDER_UNAVAILABLE');
  const verified = await verifyFlutterwaveSecret(secret.trim(), fetcher);
  const encryptedValue = encryptIntegrationSecret(secret.trim());
  const suffix = secret.trim().slice(-4);
  const webhookToken = crypto.randomBytes(32).toString('base64url');
  const webhookTokenHash = crypto.createHash('sha256').update(webhookToken).digest('hex');
  const webhookTokenEncrypted = encryptIntegrationSecret(webhookToken);
  const webhookSecretValue = crypto.randomBytes(32).toString('hex');
  const webhookSecretEncrypted = encryptIntegrationSecret(webhookSecretValue);
  const webhookSuffix = webhookSecretValue.slice(-4);
  return db.transaction(async (tx) => {
    const current = await tx.query.integrations.findFirst({ where: and(eq(integrations.propertyId, propertyId), eq(integrations.provider, 'flutterwave')) });
    const now = new Date();
    const previous = flutterwavePaymentControls(current?.metadata);
    const metadata = { ...(current?.metadata && typeof current.metadata === 'object' ? current.metadata : {}), currencies: verified.currencies, ...previous };
    const existingToken = current ? readIntegrationSecret(current.webhookTokenEncrypted) : null;
    const replaceUnreadToken = Boolean(current && !existingToken);
    const webhookConfigured = {
      webhookStatus: current?.webhookStatus === 'active' && !replaceUnreadToken ? 'active' : 'configured',
      ...(current?.webhookStatus === 'active' && !replaceUnreadToken ? {} : { webhookVerifiedAt: null as Date | null }),
    };
    const [integration] = current
      ? await tx.update(integrations).set({ status: 'connected', mode: verified.mode, externalAccountId: verified.accountLabel, connectedAt: current.connectedAt || now, verifiedAt: now, disconnectedAt: null, lastErrorAt: null, lastErrorMessage: null, metadata, updatedAt: now, ...webhookConfigured, ...(replaceUnreadToken ? { webhookTokenHash, webhookTokenEncrypted } : {}) }).where(eq(integrations.id, current.id)).returning()
      : await tx.insert(integrations).values({ propertyId, provider: 'flutterwave', category: 'payments', status: 'connected', mode: verified.mode, externalAccountId: verified.accountLabel, webhookTokenHash, webhookTokenEncrypted, webhookStatus: 'configured', connectedAt: now, verifiedAt: now, metadata: { currencies: verified.currencies, enabled: true, acceptOnlinePayments: true, directBooking: true, invoices: true } }).returning();
    const existingCredential = await tx.query.integrationCredentials.findFirst({ where: and(eq(integrationCredentials.integrationId, integration.id), eq(integrationCredentials.credentialType, 'secret_key')) });
    if (existingCredential) await tx.update(integrationCredentials).set({ encryptedValue, maskedSuffix: suffix, rotatedAt: now }).where(eq(integrationCredentials.id, existingCredential.id));
    else await tx.insert(integrationCredentials).values({ integrationId: integration.id, credentialType: 'secret_key', encryptedValue, maskedSuffix: suffix });
    const existingHash = await tx.query.integrationCredentials.findFirst({ where: and(eq(integrationCredentials.integrationId, integration.id), eq(integrationCredentials.credentialType, 'webhook_secret')) });
    let revealedWebhookSecret: string | undefined;
    if (!existingHash) {
      await tx.insert(integrationCredentials).values({ integrationId: integration.id, credentialType: 'webhook_secret', encryptedValue: webhookSecretEncrypted, maskedSuffix: webhookSuffix });
      revealedWebhookSecret = webhookSecretValue;
    } else if (!readIntegrationSecret(existingHash.encryptedValue)) {
      await tx.update(integrationCredentials).set({ encryptedValue: webhookSecretEncrypted, maskedSuffix: webhookSuffix, rotatedAt: now }).where(eq(integrationCredentials.id, existingHash.id));
      revealedWebhookSecret = webhookSecretValue;
    }
    await tx.insert(integrationAuditLogs).values({ integrationId: integration.id, propertyId, actorUserId, action: replace ? 'flutterwave.key_replaced' : 'flutterwave.connected', mode: verified.mode, details: { account: verified.accountLabel } });
    return {
      integration,
      webhookToken: existingToken || webhookToken,
      maskedSecret: maskSecret(suffix),
      webhookSecret: revealedWebhookSecret,
    };
  });
}

export async function rotateFlutterwaveWebhookSecret(propertyId: string, actorUserId: string) {
  const record = await getPropertyFlutterwave(propertyId);
  if (!record?.credential || record.integration.status === 'disconnected') throw new Error('FLUTTERWAVE_NOT_CONNECTED');
  const webhookSecretValue = crypto.randomBytes(32).toString('hex');
  const webhookSecretEncrypted = encryptIntegrationSecret(webhookSecretValue);
  const webhookSuffix = webhookSecretValue.slice(-4);
  const now = new Date();
  await db.transaction(async (tx) => {
    if (record.webhookSecret) {
      await tx.update(integrationCredentials).set({ encryptedValue: webhookSecretEncrypted, maskedSuffix: webhookSuffix, rotatedAt: now }).where(eq(integrationCredentials.id, record.webhookSecret.id));
    } else {
      await tx.insert(integrationCredentials).values({ integrationId: record.integration.id, credentialType: 'webhook_secret', encryptedValue: webhookSecretEncrypted, maskedSuffix: webhookSuffix });
    }
    await tx.update(integrations).set({ webhookStatus: 'configured', webhookVerifiedAt: null, updatedAt: now }).where(eq(integrations.id, record.integration.id));
    await tx.insert(integrationAuditLogs).values({ integrationId: record.integration.id, propertyId, actorUserId, action: 'flutterwave.webhook_secret_rotated', mode: record.integration.mode });
  });
  return webhookSecretValue;
}

export async function testFlutterwaveConnection(propertyId: string, fetcher: typeof fetch = fetch) {
  const { integration, secret } = await requireConnectedFlutterwave(propertyId);
  try {
    const verified = await verifyFlutterwaveSecret(secret, fetcher);
    await db.update(integrations).set({ status: 'connected', verifiedAt: new Date(), lastErrorAt: null, lastErrorMessage: null, externalAccountId: verified.accountLabel, mode: verified.mode, updatedAt: new Date() }).where(eq(integrations.id, integration.id));
    return verified;
  } catch (error) {
    await db.update(integrations).set({ status: 'needs_attention', lastErrorAt: new Date(), lastErrorMessage: 'Connection verification failed.', updatedAt: new Date() }).where(eq(integrations.id, integration.id));
    throw error;
  }
}

export async function updateFlutterwavePaymentControls(propertyId: string, actorUserId: string, patch: Partial<FlutterwavePaymentControls>) {
  const record = await getPropertyFlutterwave(propertyId);
  if (!record?.credential || record.integration.status === 'disconnected') throw new Error('FLUTTERWAVE_NOT_CONNECTED');
  const current = flutterwavePaymentControls(record.integration.metadata);
  const next: FlutterwavePaymentControls = { ...current };
  if (typeof patch.enabled === 'boolean') {
    next.enabled = patch.enabled;
    next.acceptOnlinePayments = patch.enabled;
  } else if (typeof patch.acceptOnlinePayments === 'boolean') {
    next.acceptOnlinePayments = patch.acceptOnlinePayments;
    next.enabled = patch.acceptOnlinePayments;
  }
  if (typeof patch.directBooking === 'boolean') next.directBooking = patch.directBooking;
  if (typeof patch.invoices === 'boolean') next.invoices = patch.invoices;
  const metadata = { ...(record.integration.metadata && typeof record.integration.metadata === 'object' ? record.integration.metadata : {}), ...next };
  const auditAction = typeof patch.enabled === 'boolean'
    ? (patch.enabled ? 'flutterwave.enabled' : 'flutterwave.disabled')
    : 'flutterwave.payments_updated';
  await db.transaction(async (tx) => {
    await tx.update(integrations).set({ metadata, updatedAt: new Date() }).where(eq(integrations.id, record.integration.id));
    await tx.insert(integrationAuditLogs).values({ integrationId: record.integration.id, propertyId, actorUserId, action: auditAction, mode: record.integration.mode, details: next });
  });
  return next;
}

export async function disconnectFlutterwave(propertyId: string, actorUserId: string) {
  const record = await getPropertyFlutterwave(propertyId);
  if (!record) return;
  await db.transaction(async (tx) => {
    await tx.delete(integrationCredentials).where(eq(integrationCredentials.integrationId, record.integration.id));
    await tx.update(integrations).set({ status: 'disconnected', disconnectedAt: new Date(), updatedAt: new Date() }).where(eq(integrations.id, record.integration.id));
    const property = await tx.query.properties.findFirst({ where: eq(properties.id, propertyId) });
    if (property?.preferredOnlineProvider === 'flutterwave') {
      await tx.update(properties).set({ preferredOnlineProvider: null, updatedAt: new Date() }).where(eq(properties.id, propertyId));
    }
    await tx.insert(integrationAuditLogs).values({ integrationId: record.integration.id, propertyId, actorUserId, action: 'flutterwave.disconnected', mode: record.integration.mode });
  });
}

/** Sena-owned webhook readiness. Flutterwave dashboard paste is external; VERIFIED only after an authentic provider webhook settles. */
export function flutterwaveWebhookReadiness(webhookStatus: string | null | undefined, hasWebhookUrl: boolean) {
  if (webhookStatus === 'active') return 'verified' as const;
  if (webhookStatus === 'needs_attention') return 'needs_attention' as const;
  if (hasWebhookUrl || webhookStatus === 'configured' || webhookStatus === 'not_configured') return 'configured_unverified' as const;
  return 'not_configured' as const;
}

export function safeFlutterwaveState(record: Awaited<ReturnType<typeof getPropertyFlutterwave>>, origin: string, lastWebhookAt?: Date | null, webhookSecretOnce?: string) {
  if (!record || record.integration.status === 'disconnected' || !record.credential) return { status: 'disconnected' as const, displayStatus: 'disconnected' as const, enabled: false };
  const token = decryptIntegrationSecret(record.integration.webhookTokenEncrypted);
  const controls = flutterwavePaymentControls(record.integration.metadata);
  const displayStatus = flutterwaveDisplayStatus(record);
  const webhookUrl = `${origin.replace(/\/$/, '')}/api/webhooks/flutterwave/${token}`;
  return {
    status: record.integration.status,
    displayStatus,
    mode: record.integration.mode,
    account: record.integration.externalAccountId,
    connectedAt: record.integration.connectedAt,
    verifiedAt: record.integration.verifiedAt,
    webhookStatus: record.integration.webhookStatus,
    webhookReadiness: flutterwaveWebhookReadiness(record.integration.webhookStatus, Boolean(webhookUrl)),
    webhookVerifiedAt: record.integration.webhookVerifiedAt,
    lastWebhookAt: lastWebhookAt || null,
    webhookUrl,
    secret: maskSecret(record.credential.maskedSuffix),
    webhookSecret: webhookSecretOnce || (record.webhookSecret ? maskSecret(record.webhookSecret.maskedSuffix) : null),
    webhookSecretRevealed: Boolean(webhookSecretOnce),
    ...controls,
  };
}
