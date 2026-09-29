import { NextRequest } from 'next/server';
import { getProviderDefinition, buildMarketplaceCatalog, getPropertyIntegration } from '@/lib/integrations/platform/registry';
import { listMappingsForProperty } from '@/lib/integrations/platform/mapping';
import { enqueueSyncJob, listSyncJobsForProperty } from '@/lib/integrations/platform/sync';
import { listIntegrationAudit } from '@/lib/integrations/platform/audit';
import { jsonNoStore, ownerOnly, resolveAppsTenant } from '@/lib/integrations/platform/access';
import { disconnectOAuthIntegration } from '@/lib/integrations/platform/oauth';

type Params = { params: Promise<{ provider: string }> };

export async function GET(req: NextRequest, context: Params) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  const { provider } = await context.params;
  const canManage = ownerOnly(result.resolved.role);
  const definition = await getProviderDefinition(provider);
  if (!definition) return jsonNoStore({ error: 'Provider not found.' }, { status: 404 });

  const apps = await buildMarketplaceCatalog({
    propertyId: result.resolved.propertyId,
    canManage,
  });
  const app = apps.find((entry) => entry.provider === provider);
  if (!app) return jsonNoStore({ error: 'Provider not found.' }, { status: 404 });

  if (!canManage) {
    return jsonNoStore({
      canManage: false,
      app: {
        provider: app.provider,
        name: app.name,
        category: app.category,
        description: app.description,
        availability: app.availability,
        connectionStatus: app.connectionStatus,
        healthStatus: app.healthStatus,
        capabilities: app.capabilities,
      },
    });
  }

  const [activity, syncJobs, mappings] = await Promise.all([
    listIntegrationAudit(result.resolved.propertyId, 30).then((rows) =>
      rows.filter((row) => row.action.startsWith(`${provider}.`) || row.details?.provider === provider)
    ),
    listSyncJobsForProperty(result.resolved.propertyId, provider, 30),
    listMappingsForProperty(result.resolved.propertyId, provider, 50),
  ]);

  return jsonNoStore({
    canManage: true,
    app,
    activity,
    syncJobs,
    mappings,
    property: {
      id: result.resolved.propertyId,
      name: result.resolved.property.name,
      slug: result.resolved.property.slug,
    },
  });
}

export async function POST(req: NextRequest, context: Params) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) {
    return jsonNoStore({ error: 'Only a property owner can manage Connected Apps.' }, { status: 403 });
  }

  const { provider } = await context.params;
  const definition = await getProviderDefinition(provider);
  if (!definition) return jsonNoStore({ error: 'Provider not found.' }, { status: 404 });
  if (definition.availability === 'coming_soon') {
    return jsonNoStore({ error: 'This app is coming soon and cannot be connected yet.' }, { status: 422 });
  }

  // Payment providers keep dedicated routes — do not accept generic connect here.
  if (provider === 'paystack' || provider === 'flutterwave') {
    return jsonNoStore({ error: 'Use the dedicated payment connection panel for this provider.' }, { status: 422 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === 'sync_now') {
    const integration = await getPropertyIntegration(result.resolved.propertyId, provider);
    if (!integration || integration.status !== 'connected') {
      return jsonNoStore({ error: 'Connect this app before syncing.' }, { status: 422 });
    }
    const job = await enqueueSyncJob({
      propertyId: result.resolved.propertyId,
      integrationId: integration.id,
      provider,
      direction: 'outbound',
      trigger: 'manual',
      jobType: typeof body.jobType === 'string' ? body.jobType : 'full_sync',
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : `manual:${provider}:${Date.now()}`,
      payload: { requestedBy: result.resolved.userId },
    });
    return jsonNoStore({ job: { id: job.id, status: job.status, jobType: job.jobType } }, { status: 202 });
  }

  return jsonNoStore({ error: 'Invalid action. OAuth providers start from /api/apps/oauth/start.' }, { status: 422 });
}

export async function DELETE(req: NextRequest, context: Params) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) {
    return jsonNoStore({ error: 'Only a property owner can manage Connected Apps.' }, { status: 403 });
  }
  const { provider } = await context.params;
  if (provider === 'paystack' || provider === 'flutterwave') {
    return jsonNoStore({ error: 'Use the dedicated payment connection panel to disconnect.' }, { status: 422 });
  }

  const outcome = await disconnectOAuthIntegration({
    propertyId: result.resolved.propertyId,
    provider,
    actorUserId: result.resolved.userId,
  });

  return jsonNoStore({
    disconnected: outcome.disconnected,
    consequences: [
      'Sync jobs for this provider will stop.',
      'OAuth tokens and secrets were removed.',
      'External object mappings and audit history are preserved.',
      'Sena guests, invoices, reservations, and payment records were not deleted.',
    ],
  });
}
