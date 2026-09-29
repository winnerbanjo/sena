import { NextRequest } from 'next/server';
import { jsonNoStore, ownerOnly, resolveAppsTenant } from '@/lib/integrations/platform/access';
import {
  listZohoOrganizations,
  selectZohoOrganization,
  queueZohoFullSync,
  syncZohoContact,
  syncZohoInvoice,
  syncZohoPayment,
  setZohoSyncEnabled,
  retryZohoInvoiceSync,
  getZohoManageState,
  getZohoInvoiceSyncStatus,
} from '@/lib/integrations/zoho/invoice';

/**
 * Zoho-specific manage actions live under /api/apps/zoho_invoice/manage so they do not
 * shadow GET /api/apps/zoho_invoice (Connected App detail / disconnect via [provider]).
 */
export async function GET(req: NextRequest) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return jsonNoStore({ error: 'Only a property owner can manage Zoho Invoice.' }, { status: 403 });

  const invoiceId = req.nextUrl.searchParams.get('invoiceId');
  if (invoiceId) {
    try {
      const sync = await getZohoInvoiceSyncStatus(result.resolved.propertyId, invoiceId);
      return jsonNoStore({ sync });
    } catch {
      return jsonNoStore({ sync: { status: 'not_synced', invoiceUrl: null, externalInvoiceId: null } });
    }
  }

  try {
    const state = await getZohoManageState(result.resolved.propertyId);
    return jsonNoStore(state);
  } catch (error: any) {
    const message =
      error?.message === 'OAUTH_CLIENT_MISSING'
        ? 'Zoho OAuth client is not configured.'
        : 'Could not load Zoho organizations.';
    return jsonNoStore({ error: message }, { status: 422 });
  }
}

export async function POST(req: NextRequest) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return jsonNoStore({ error: 'Only a property owner can manage Zoho Invoice.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === 'select_organization' && typeof body.organizationId === 'string') {
      const metadata = await selectZohoOrganization(
        result.resolved.propertyId,
        result.resolved.userId,
        body.organizationId,
        body.organizationName
      );
      return jsonNoStore({ organization: metadata });
    }
    if (body.action === 'set_sync_enabled' && typeof body.enabled === 'boolean') {
      const metadata = await setZohoSyncEnabled(result.resolved.propertyId, result.resolved.userId, body.enabled);
      return jsonNoStore({ syncEnabled: metadata.syncEnabled === true });
    }
    if (body.action === 'sync_now') {
      const job = await queueZohoFullSync(result.resolved.propertyId, result.resolved.userId);
      return jsonNoStore({ job: { id: job.id, status: job.status } }, { status: 202 });
    }
    if (body.action === 'sync_contact' && typeof body.guestId === 'string') {
      const synced = await syncZohoContact(result.resolved.propertyId, body.guestId);
      return jsonNoStore({ synced });
    }
    if (body.action === 'sync_invoice' && typeof body.invoiceId === 'string') {
      const synced = await syncZohoInvoice(result.resolved.propertyId, body.invoiceId);
      return jsonNoStore({ synced });
    }
    if (body.action === 'retry_invoice' && typeof body.invoiceId === 'string') {
      const job = await retryZohoInvoiceSync(result.resolved.propertyId, body.invoiceId, result.resolved.userId);
      return jsonNoStore({ job: { id: job.id, status: job.status } }, { status: 202 });
    }
    if (body.action === 'sync_payment' && typeof body.paymentId === 'string') {
      const synced = await syncZohoPayment(result.resolved.propertyId, body.paymentId);
      return jsonNoStore({ synced });
    }
    return jsonNoStore({ error: 'Invalid action.' }, { status: 422 });
  } catch (error: any) {
    const code = error?.message || '';
    const friendly =
      code === 'ZOHO_ORG_REQUIRED'
        ? 'Select a Zoho organization before enabling sync.'
        : code === 'ZOHO_SYNC_DISABLED'
          ? 'Turn on invoice sync to queue new synchronization.'
          : code === 'ZOHO_NOT_CONNECTED'
            ? 'Connect Zoho Invoice first.'
            : code === 'ZOHO_REAUTH_REQUIRED'
              ? 'Reconnect Zoho Invoice — authorization expired.'
              : 'Zoho action failed.';
    return jsonNoStore({ error: friendly, code }, { status: 422 });
  }
}
