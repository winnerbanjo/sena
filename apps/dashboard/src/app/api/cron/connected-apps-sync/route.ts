import { NextRequest } from 'next/server';
import { processSyncQueue } from '@/lib/integrations/platform/sync';
import { jsonNoStore } from '@/lib/integrations/platform/access';
import { registerZohoSyncHandlers } from '@/lib/integrations/zoho/invoice';
import type { integrationSyncJobs } from '@sena/database';

type SyncJob = typeof integrationSyncJobs.$inferSelect;

registerZohoSyncHandlers();

/**
 * Cron/worker endpoint for Connected Apps sync jobs.
 * Protected by cron secret — never invoked during page SSR.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SENA_SYNC_CRON_SECRET || process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers.get('x-cron-secret') || '';
  if (!secret || token !== secret) {
    return jsonNoStore({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = typeof body.limit === 'number' ? Math.min(body.limit, 50) : 10;

  const results = await processSyncQueue(async (job) => {
    if (job.provider === 'paystack' || job.provider === 'flutterwave') {
      throw new Error('PAYMENT_SYNC_NOT_VIA_PLATFORM_QUEUE');
    }
    const handler = globalThis as typeof globalThis & {
      __senaSyncHandlers?: Record<string, (job: SyncJob) => Promise<{ cursor?: string | null } | void>>;
    };
    const registered = handler.__senaSyncHandlers?.[`${job.provider}:${job.jobType}`] || handler.__senaSyncHandlers?.[job.provider];
    if (!registered) {
      if (job.jobType === 'platform_ping') return {};
      throw new Error(`NO_HANDLER:${job.provider}:${job.jobType}`);
    }
    return registered(job);
  }, limit);

  return jsonNoStore({
    processed: results.length,
    statuses: results.map((row) => row?.status).filter(Boolean),
  });
}

export async function GET() {
  return jsonNoStore({ ok: true, note: 'POST with cron secret to process the Connected Apps sync queue.' });
}
