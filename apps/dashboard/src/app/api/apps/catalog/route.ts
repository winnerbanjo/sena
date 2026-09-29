import { NextRequest } from 'next/server';
import { buildMarketplaceCatalog } from '@/lib/integrations/platform/registry';
import { jsonNoStore, ownerOnly, resolveAppsTenant } from '@/lib/integrations/platform/access';

export async function GET(req: NextRequest) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;

  const category = req.nextUrl.searchParams.get('category') || 'all';
  const query = req.nextUrl.searchParams.get('q') || undefined;
  const canManage = ownerOnly(result.resolved.role);
  const apps = await buildMarketplaceCatalog({
    propertyId: result.resolved.propertyId,
    canManage,
    category,
    query,
  });

  return jsonNoStore({
    canManage,
    propertyId: result.resolved.propertyId,
    category,
    query: query || null,
    apps,
  });
}
