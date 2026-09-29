import crypto from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import {
  db,
  integrationOauthStates,
  integrationOauthTokens,
  integrations,
  integrationAuditLogs,
} from '@sena/database';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '../crypto';
import { ensureConnectedAppsPlatformSchema, getProviderDefinition } from './registry';

const STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthProviderAdapter = {
  provider: string;
  authorizationUrl: (input: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: string[];
    codeChallenge?: string;
    extra?: Record<string, string>;
  }) => string;
  exchangeCode: (input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
    clientId: string;
    clientSecret: string;
  }) => Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
    scopes?: string[];
    accountMetadata?: Record<string, unknown>;
  }>;
  refreshAccessToken?: (input: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }) => Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
    scopes?: string[];
  }>;
  revoke?: (input: { accessToken?: string; refreshToken?: string; clientId: string; clientSecret: string }) => Promise<void>;
};

function hashState(state: string) {
  return crypto.createHash('sha256').update(state).digest('hex');
}

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Create CSRF-bound OAuth state locked to property + provider + actor. */
export async function createOAuthState(input: {
  propertyId: string;
  provider: string;
  actorUserId: string;
  redirectUri: string;
  scopes: string[];
  metadata?: Record<string, unknown>;
  usePkce?: boolean;
}) {
  await ensureConnectedAppsPlatformSchema();
  const definition = await getProviderDefinition(input.provider);
  if (!definition || definition.availability === 'coming_soon') throw new Error('PROVIDER_UNAVAILABLE');
  if (definition.authenticationType !== 'oauth2' && definition.authenticationType !== 'hybrid') {
    throw new Error('PROVIDER_NOT_OAUTH');
  }

  const state = crypto.randomBytes(32).toString('base64url');
  const pkce = input.usePkce === false ? null : pkcePair();
  const expiresAt = new Date(Date.now() + STATE_TTL_MS);

  await db.insert(integrationOauthStates).values({
    stateHash: hashState(state),
    propertyId: input.propertyId,
    provider: input.provider,
    actorUserId: input.actorUserId,
    codeVerifierEncrypted: pkce ? encryptIntegrationSecret(pkce.verifier) : null,
    redirectUri: input.redirectUri,
    scopes: input.scopes,
    metadata: input.metadata || {},
    expiresAt,
  });

  return {
    state,
    codeChallenge: pkce?.challenge,
    codeChallengeMethod: pkce ? 'S256' : undefined,
    expiresAt,
  };
}

/**
 * Consume OAuth state exactly once. Rejects property/provider/user mismatches
 * so Account A can never attach to Property B.
 */
export async function consumeOAuthState(input: {
  state: string;
  propertyId: string;
  provider: string;
  actorUserId: string;
}) {
  await ensureConnectedAppsPlatformSchema();
  const stateHash = hashState(input.state);
  const row = await db.query.integrationOauthStates.findFirst({
    where: and(eq(integrationOauthStates.stateHash, stateHash), isNull(integrationOauthStates.consumedAt)),
  });
  if (!row) throw new Error('OAUTH_STATE_INVALID');
  if (row.expiresAt.getTime() < Date.now()) throw new Error('OAUTH_STATE_EXPIRED');
  if (row.propertyId !== input.propertyId) throw new Error('OAUTH_PROPERTY_MISMATCH');
  if (row.provider !== input.provider) throw new Error('OAUTH_PROVIDER_MISMATCH');
  if (row.actorUserId !== input.actorUserId) throw new Error('OAUTH_ACTOR_MISMATCH');

  const [consumed] = await db
    .update(integrationOauthStates)
    .set({ consumedAt: new Date() })
    .where(and(eq(integrationOauthStates.id, row.id), isNull(integrationOauthStates.consumedAt)))
    .returning();
  if (!consumed) throw new Error('OAUTH_STATE_INVALID');

  return {
    propertyId: consumed.propertyId,
    provider: consumed.provider,
    actorUserId: consumed.actorUserId,
    redirectUri: consumed.redirectUri,
    scopes: (consumed.scopes || []) as string[],
    metadata: (consumed.metadata && typeof consumed.metadata === 'object' ? consumed.metadata : {}) as Record<string, unknown>,
    codeVerifier: consumed.codeVerifierEncrypted ? decryptIntegrationSecret(consumed.codeVerifierEncrypted) : undefined,
  };
}

export async function purgeExpiredOAuthStates() {
  await ensureConnectedAppsPlatformSchema();
  await db.delete(integrationOauthStates).where(lt(integrationOauthStates.expiresAt, new Date()));
}

export async function upsertOAuthTokens(input: {
  integrationId: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string;
  scopes?: string[];
  expiresAt?: Date | null;
  accountMetadata?: Record<string, unknown> | null;
}) {
  await ensureConnectedAppsPlatformSchema();
  const existing = await db.query.integrationOauthTokens.findFirst({
    where: eq(integrationOauthTokens.integrationId, input.integrationId),
  });
  const accessTokenEncrypted = encryptIntegrationSecret(input.accessToken);
  const refreshTokenEncrypted = input.refreshToken ? encryptIntegrationSecret(input.refreshToken) : existing?.refreshTokenEncrypted || null;
  const now = new Date();
  if (existing) {
    const [updated] = await db
      .update(integrationOauthTokens)
      .set({
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenType: input.tokenType || existing.tokenType || 'Bearer',
        scopes: input.scopes || existing.scopes || [],
        expiresAt: input.expiresAt === undefined ? existing.expiresAt : input.expiresAt,
        accountMetadata: input.accountMetadata === undefined ? existing.accountMetadata : input.accountMetadata,
        rotatedAt: now,
      })
      .where(eq(integrationOauthTokens.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(integrationOauthTokens)
    .values({
      integrationId: input.integrationId,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenType: input.tokenType || 'Bearer',
      scopes: input.scopes || [],
      expiresAt: input.expiresAt || null,
      accountMetadata: input.accountMetadata || null,
    })
    .returning();
  return created;
}

export async function readOAuthTokens(integrationId: string) {
  await ensureConnectedAppsPlatformSchema();
  const row = await db.query.integrationOauthTokens.findFirst({
    where: eq(integrationOauthTokens.integrationId, integrationId),
  });
  if (!row) return null;
  return {
    accessToken: decryptIntegrationSecret(row.accessTokenEncrypted),
    refreshToken: row.refreshTokenEncrypted ? decryptIntegrationSecret(row.refreshTokenEncrypted) : null,
    tokenType: row.tokenType,
    scopes: (row.scopes || []) as string[],
    expiresAt: row.expiresAt,
    accountMetadata: row.accountMetadata,
    needsRefresh: Boolean(row.expiresAt && row.expiresAt.getTime() < Date.now() + 60_000),
  };
}

export async function clearOAuthTokens(integrationId: string) {
  await ensureConnectedAppsPlatformSchema();
  await db.delete(integrationOauthTokens).where(eq(integrationOauthTokens.integrationId, integrationId));
}

export async function markIntegrationAuthorized(input: {
  propertyId: string;
  provider: string;
  category: string;
  actorUserId: string;
  accountLabel?: string | null;
  environment?: string | null;
  accountMetadata?: Record<string, unknown>;
  mode?: string | null;
}) {
  await ensureConnectedAppsPlatformSchema();
  const webhookToken = crypto.randomBytes(32).toString('base64url');
  const webhookTokenHash = crypto.createHash('sha256').update(webhookToken).digest('hex');
  const webhookTokenEncrypted = encryptIntegrationSecret(webhookToken);
  const now = new Date();

  return db.transaction(async (tx) => {
    const current = await tx.query.integrations.findFirst({
      where: and(eq(integrations.propertyId, input.propertyId), eq(integrations.provider, input.provider)),
    });
    const metadata = {
      ...(current?.metadata && typeof current.metadata === 'object' ? (current.metadata as object) : {}),
      ...(input.accountMetadata || {}),
    };
    const [integration] = current
      ? await tx
          .update(integrations)
          .set({
            status: 'connected',
            healthStatus: 'authorized',
            mode: input.mode || current.mode,
            environment: input.environment || current.environment,
            externalAccountId: input.accountLabel || current.externalAccountId,
            connectedAt: current.connectedAt || now,
            verifiedAt: now,
            disconnectedAt: null,
            lastErrorAt: null,
            lastErrorMessage: null,
            metadata,
            updatedAt: now,
          })
          .where(eq(integrations.id, current.id))
          .returning()
      : await tx
          .insert(integrations)
          .values({
            propertyId: input.propertyId,
            provider: input.provider,
            category: input.category,
            status: 'connected',
            healthStatus: 'authorized',
            mode: input.mode || null,
            environment: input.environment || null,
            externalAccountId: input.accountLabel || null,
            webhookTokenHash,
            webhookTokenEncrypted,
            webhookStatus: 'not_configured',
            connectedAt: now,
            verifiedAt: now,
            metadata,
          })
          .returning();

    await tx.insert(integrationAuditLogs).values({
      integrationId: integration.id,
      propertyId: input.propertyId,
      actorUserId: input.actorUserId,
      action: `${input.provider}.oauth_connected`,
      mode: input.mode || null,
      details: { account: input.accountLabel || null },
    });

    return integration;
  });
}

export async function disconnectOAuthIntegration(input: {
  propertyId: string;
  provider: string;
  actorUserId: string;
  revoke?: () => Promise<void>;
}) {
  await ensureConnectedAppsPlatformSchema();
  const record = await db.query.integrations.findFirst({
    where: and(eq(integrations.propertyId, input.propertyId), eq(integrations.provider, input.provider)),
  });
  if (!record || record.status === 'disconnected') return { disconnected: false as const };

  try {
    if (input.revoke) await input.revoke();
  } catch {
    // Revoke is best-effort; local secrets are still cleared.
  }

  await clearOAuthTokens(record.id);
  const now = new Date();
  await db
    .update(integrations)
    .set({
      status: 'disconnected',
      healthStatus: 'configured',
      disconnectedAt: now,
      lastErrorAt: null,
      lastErrorMessage: null,
      updatedAt: now,
    })
    .where(eq(integrations.id, record.id));

  await db.insert(integrationAuditLogs).values({
    integrationId: record.id,
    propertyId: input.propertyId,
    actorUserId: input.actorUserId,
    action: `${input.provider}.disconnected`,
    details: { preservedMappings: true, secretsRemoved: true },
  });

  return { disconnected: true as const, integrationId: record.id };
}
