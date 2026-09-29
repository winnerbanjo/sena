import { desc, eq } from 'drizzle-orm';
import { db, integrationAuditLogs } from '@sena/database';
import { ensureConnectedAppsPlatformSchema } from './registry';

const SECRET_KEYS = /secret|token|password|authorization|apikey|api_key|refresh|access_token|client_secret/i;

/** Strip secrets from audit detail payloads before persistence or response. */
export function scrubAuditDetails(details: unknown): Record<string, unknown> | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (SECRET_KEYS.test(key)) {
      output[key] = '[redacted]';
      continue;
    }
    if (typeof value === 'string' && /sk_(live|test)_|whsec_|Bearer\s+/i.test(value)) {
      output[key] = '[redacted]';
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = scrubAuditDetails(value);
      continue;
    }
    output[key] = value;
  }
  return output;
}

export async function writeIntegrationAudit(input: {
  propertyId: string;
  integrationId?: string | null;
  actorUserId?: string | null;
  action: string;
  mode?: string | null;
  details?: Record<string, unknown>;
}) {
  await ensureConnectedAppsPlatformSchema();
  const [row] = await db
    .insert(integrationAuditLogs)
    .values({
      propertyId: input.propertyId,
      integrationId: input.integrationId || null,
      actorUserId: input.actorUserId || null,
      action: input.action,
      mode: input.mode || null,
      details: scrubAuditDetails(input.details || {}),
    })
    .returning();
  return row;
}

export async function listIntegrationAudit(propertyId: string, limit = 50) {
  await ensureConnectedAppsPlatformSchema();
  const rows = await db
    .select()
    .from(integrationAuditLogs)
    .where(eq(integrationAuditLogs.propertyId, propertyId))
    .orderBy(desc(integrationAuditLogs.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    integrationId: row.integrationId,
    action: row.action,
    mode: row.mode,
    details: scrubAuditDetails(row.details),
    createdAt: row.createdAt.toISOString(),
    actorUserId: row.actorUserId,
  }));
}

export function assertNoSecretsInPayload(payload: unknown) {
  const serialized = JSON.stringify(payload || {});
  if (/sk_(live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|"access_token"\s*:\s*"[^"]{12,}"/i.test(serialized)) {
    throw new Error('SECRET_LEAK_BLOCKED');
  }
}
