import { NextRequest } from 'next/server';
import { processSyncQueue } from '@/lib/integrations/platform/sync';
import { jsonNoStore } from '@/lib/integrations/platform/access';
import { registerZohoSyncHandlers } from '@/lib/integrations/zoho/invoice';
import { registerGoogleCalendarSyncHandlers } from '@/lib/integrations/google/calendar';
import type { integrationSyncJobs } from '@sena/database';

type SyncJob = typeof integrationSyncJobs.$inferSelect;

registerZohoSyncHandlers();
registerGoogleCalendarSyncHandlers();

function authorizeCron(req: NextRequest) {
  const secret = process.env.SENA_SYNC_CRON_SECRET || process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers.get('x-cron-secret') || '';
  if (!secret || token !== secret) {
    return jsonNoStore({ error: 'Unauthorized.' }, { status: 401 });
  }
  return null;
}

async function runSyncQueue(req: NextRequest) {
  const unauthorized = authorizeCron(req);
  if (unauthorized) return unauthorized;

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const limit = typeof (body as { limit?: unknown }).limit === 'number'
    ? Math.min((body as { limit: number }).limit, 50)
    : 10;

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

/**
 * Cron/worker endpoint for Connected Apps sync jobs.
 * Protected by cron secret — never invoked during page SSR.
 * Vercel Cron invokes GET with Authorization: Bearer $CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  return runSyncQueue(req);
}

export async function GET(req: NextRequest) {
  return runSyncQueue(req);
}
