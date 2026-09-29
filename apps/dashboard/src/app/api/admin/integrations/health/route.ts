import { NextRequest } from 'next/server';
import { listAdminIntegrationHealth } from '@/lib/integrations/platform/registry';
import { jsonNoStore } from '@/lib/integrations/platform/access';

/**
 * Cross-property Connected Apps health for internal admin.
 * Never returns credentials or tokens.
 */
export async function GET(req: NextRequest) {
  // Lightweight gate: require admin session cookie pattern used by admin app,
  // or an internal bearer for ops. Merchant sessions are rejected.
  const adminSecret = process.env.SENA_ADMIN_OBSERVABILITY_TOKEN;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const cookie = req.cookies.get('sena_admin_session')?.value;
  if (!cookie && (!adminSecret || token !== adminSecret)) {
    return jsonNoStore({ error: 'Admin authorization required.' }, { status: 401 });
  }

  const provider = req.nextUrl.searchParams.get('provider') || undefined;
  const status = req.nextUrl.searchParams.get('status') || undefined;
  const propertyId = req.nextUrl.searchParams.get('propertyId') || undefined;
  const healthStatus = req.nextUrl.searchParams.get('healthStatus') || undefined;

  const rows = await listAdminIntegrationHealth({ provider, status, propertyId, healthStatus });
  return jsonNoStore({
    count: rows.length,
    integrations: rows,
  });
}
