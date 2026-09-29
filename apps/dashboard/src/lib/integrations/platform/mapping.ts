import { and, eq } from 'drizzle-orm';
import { db, integrationExternalObjects } from '@sena/database';
import type { SenaObjectType } from './types';
import { ensureConnectedAppsPlatformSchema } from './registry';

export async function upsertExternalObjectMapping(input: {
  propertyId: string;
  integrationId: string;
  provider: string;
  senaObjectType: SenaObjectType | string;
  senaObjectId: string;
  externalObjectType: string;
  externalObjectId: string;
  syncState?: string;
  metadata?: Record<string, unknown>;
}) {
  await ensureConnectedAppsPlatformSchema();
  if (!input.externalObjectId || !input.senaObjectId) throw new Error('MAPPING_IDS_REQUIRED');

  const existingLocal = await db.query.integrationExternalObjects.findFirst({
    where: and(
      eq(integrationExternalObjects.integrationId, input.integrationId),
      eq(integrationExternalObjects.senaObjectType, input.senaObjectType),
      eq(integrationExternalObjects.senaObjectId, input.senaObjectId)
    ),
  });

  const now = new Date();
  if (existingLocal) {
    if (
      existingLocal.externalObjectId !== input.externalObjectId ||
      existingLocal.externalObjectType !== input.externalObjectType
    ) {
      // Mapping is authoritative after first sync — refuse silent remaps that could cross wires.
      throw new Error('MAPPING_CONFLICT');
    }
    const [updated] = await db
      .update(integrationExternalObjects)
      .set({
        syncState: input.syncState || 'synced',
        lastSyncedAt: now,
        metadata: input.metadata || existingLocal.metadata,
        updatedAt: now,
      })
      .where(eq(integrationExternalObjects.id, existingLocal.id))
      .returning();
    return updated;
  }

  const existingRemote = await db.query.integrationExternalObjects.findFirst({
    where: and(
      eq(integrationExternalObjects.integrationId, input.integrationId),
      eq(integrationExternalObjects.externalObjectType, input.externalObjectType),
      eq(integrationExternalObjects.externalObjectId, input.externalObjectId)
    ),
  });
  if (existingRemote && existingRemote.senaObjectId !== input.senaObjectId) {
    throw new Error('MAPPING_CONFLICT');
  }

  const [created] = await db
    .insert(integrationExternalObjects)
    .values({
      propertyId: input.propertyId,
      integrationId: input.integrationId,
      provider: input.provider,
      senaObjectType: input.senaObjectType,
      senaObjectId: input.senaObjectId,
      externalObjectType: input.externalObjectType,
      externalObjectId: input.externalObjectId,
      syncState: input.syncState || 'synced',
      lastSyncedAt: now,
      metadata: input.metadata || {},
    })
    .returning();
  return created;
}

export async function findMappingBySenaObject(input: {
  integrationId: string;
  senaObjectType: string;
  senaObjectId: string;
}) {
  await ensureConnectedAppsPlatformSchema();
  return db.query.integrationExternalObjects.findFirst({
    where: and(
      eq(integrationExternalObjects.integrationId, input.integrationId),
      eq(integrationExternalObjects.senaObjectType, input.senaObjectType),
      eq(integrationExternalObjects.senaObjectId, input.senaObjectId)
    ),
  });
}

export async function findMappingByExternalObject(input: {
  integrationId: string;
  externalObjectType: string;
  externalObjectId: string;
}) {
  await ensureConnectedAppsPlatformSchema();
  return db.query.integrationExternalObjects.findFirst({
    where: and(
      eq(integrationExternalObjects.integrationId, input.integrationId),
      eq(integrationExternalObjects.externalObjectType, input.externalObjectType),
      eq(integrationExternalObjects.externalObjectId, input.externalObjectId)
    ),
  });
}

export async function listMappingsForProperty(propertyId: string, provider?: string, limit = 100) {
  await ensureConnectedAppsPlatformSchema();
  const rows = await db.query.integrationExternalObjects.findMany({
    where: provider
      ? and(eq(integrationExternalObjects.propertyId, propertyId), eq(integrationExternalObjects.provider, provider))
      : eq(integrationExternalObjects.propertyId, propertyId),
    limit,
  });
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    senaObjectType: row.senaObjectType,
    senaObjectId: row.senaObjectId,
    externalObjectType: row.externalObjectType,
    externalObjectId: row.externalObjectId,
    syncState: row.syncState,
    lastSyncedAt: row.lastSyncedAt?.toISOString() || null,
  }));
}
