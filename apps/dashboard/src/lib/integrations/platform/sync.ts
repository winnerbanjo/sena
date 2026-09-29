import { and, asc, eq, lte, or, sql } from 'drizzle-orm';
import { db, integrationSyncJobs, integrations } from '@sena/database';
import type { SyncDirection, SyncJobStatus, SyncTrigger } from './types';
import { ensureConnectedAppsPlatformSchema } from './registry';

const BACKOFF_SECONDS = [30, 60, 120, 300, 900, 1800, 3600, 7200];

export function nextBackoffDate(attemptCount: number, from = new Date()) {
  const seconds = BACKOFF_SECONDS[Math.min(attemptCount, BACKOFF_SECONDS.length - 1)] || 7200;
  return new Date(from.getTime() + seconds * 1000);
}

export async function enqueueSyncJob(input: {
  propertyId: string;
  integrationId: string;
  provider: string;
  direction: SyncDirection;
  trigger: SyncTrigger;
  jobType: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  cursor?: string | null;
  maxAttempts?: number;
}) {
  await ensureConnectedAppsPlatformSchema();

  if (input.idempotencyKey) {
    const existing = await db.query.integrationSyncJobs.findFirst({
      where: and(
        eq(integrationSyncJobs.propertyId, input.propertyId),
        eq(integrationSyncJobs.idempotencyKey, input.idempotencyKey)
      ),
    });
    if (existing && ['queued', 'processing', 'retrying', 'completed'].includes(existing.status)) {
      return existing;
    }
  }

  const [job] = await db
    .insert(integrationSyncJobs)
    .values({
      propertyId: input.propertyId,
      integrationId: input.integrationId,
      provider: input.provider,
      direction: input.direction,
      trigger: input.trigger,
      jobType: input.jobType,
      status: 'queued',
      payload: input.payload || {},
      idempotencyKey: input.idempotencyKey || null,
      cursor: input.cursor || null,
      maxAttempts: input.maxAttempts || 8,
      nextRunAt: new Date(),
    })
    .returning();

  await db
    .update(integrations)
    .set({ lastSyncAttemptAt: new Date(), healthStatus: 'syncing', updatedAt: new Date() })
    .where(eq(integrations.id, input.integrationId));

  return job;
}

export async function claimNextSyncJobs(limit = 10) {
  await ensureConnectedAppsPlatformSchema();
  const now = new Date();
  const candidates = await db
    .select()
    .from(integrationSyncJobs)
    .where(
      and(
        or(eq(integrationSyncJobs.status, 'queued'), eq(integrationSyncJobs.status, 'retrying')),
        lte(integrationSyncJobs.nextRunAt, now)
      )
    )
    .orderBy(asc(integrationSyncJobs.nextRunAt))
    .limit(limit);

  const claimed = [];
  for (const job of candidates) {
    const [updated] = await db
      .update(integrationSyncJobs)
      .set({
        status: 'processing',
        attemptCount: job.attemptCount + 1,
        startedAt: now,
        updatedAt: now,
      })
      .where(and(eq(integrationSyncJobs.id, job.id), or(eq(integrationSyncJobs.status, 'queued'), eq(integrationSyncJobs.status, 'retrying'))))
      .returning();
    if (updated) claimed.push(updated);
  }
  return claimed;
}

export async function completeSyncJob(jobId: string, cursor?: string | null) {
  const now = new Date();
  const [job] = await db
    .update(integrationSyncJobs)
    .set({
      status: 'completed' satisfies SyncJobStatus,
      completedAt: now,
      lastError: null,
      cursor: cursor === undefined ? undefined : cursor,
      updatedAt: now,
    })
    .where(eq(integrationSyncJobs.id, jobId))
    .returning();

  if (job) {
    await db
      .update(integrations)
      .set({
        lastSyncAt: now,
        lastSyncAttemptAt: now,
        healthStatus: 'healthy',
        lastErrorAt: null,
        lastErrorMessage: null,
        updatedAt: now,
      })
      .where(eq(integrations.id, job.integrationId));
  }
  return job;
}

export async function failSyncJob(jobId: string, errorMessage: string) {
  const job = await db.query.integrationSyncJobs.findFirst({ where: eq(integrationSyncJobs.id, jobId) });
  if (!job) return null;
  const now = new Date();
  const exhausted = job.attemptCount >= job.maxAttempts;
  const status: SyncJobStatus = exhausted ? 'dead_letter' : 'retrying';
  const [updated] = await db
    .update(integrationSyncJobs)
    .set({
      status,
      lastError: errorMessage.slice(0, 2000),
      nextRunAt: exhausted ? job.nextRunAt : nextBackoffDate(job.attemptCount, now),
      updatedAt: now,
      completedAt: exhausted ? now : null,
    })
    .where(eq(integrationSyncJobs.id, jobId))
    .returning();

  await db
    .update(integrations)
    .set({
      lastSyncAttemptAt: now,
      lastErrorAt: now,
      lastErrorMessage: errorMessage.slice(0, 500),
      healthStatus: exhausted ? 'degraded' : 'syncing',
      ...(exhausted ? { status: 'needs_attention' as const } : {}),
      updatedAt: now,
    })
    .where(eq(integrations.id, job.integrationId));

  return updated;
}

export async function listSyncJobsForProperty(propertyId: string, provider?: string, limit = 50) {
  await ensureConnectedAppsPlatformSchema();
  const rows = await db
    .select()
    .from(integrationSyncJobs)
    .where(
      provider
        ? and(eq(integrationSyncJobs.propertyId, propertyId), eq(integrationSyncJobs.provider, provider))
        : eq(integrationSyncJobs.propertyId, propertyId)
    )
    .orderBy(sql`${integrationSyncJobs.createdAt} desc`)
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    direction: row.direction,
    trigger: row.trigger,
    jobType: row.jobType,
    status: row.status,
    attemptCount: row.attemptCount,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() || null,
    nextRunAt: row.nextRunAt.toISOString(),
  }));
}

/** Process claimed jobs with a provider-specific handler. Never call during SSR page render. */
export async function processSyncQueue(
  handler: (job: typeof integrationSyncJobs.$inferSelect) => Promise<{ cursor?: string | null } | void>,
  limit = 10
) {
  const jobs = await claimNextSyncJobs(limit);
  const results = [];
  for (const job of jobs) {
    try {
      const result = await handler(job);
      results.push(await completeSyncJob(job.id, result?.cursor));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SYNC_FAILED';
      results.push(await failSyncJob(job.id, message));
    }
  }
  return results;
}
