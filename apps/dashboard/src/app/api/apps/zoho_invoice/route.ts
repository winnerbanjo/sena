import { NextRequest } from 'next/server';
import { jsonNoStore, ownerOnly, resolveAppsTenant } from '@/lib/integrations/platform/access';
import { listZohoOrganizations, selectZohoOrganization, queueZohoFullSync, syncZohoContact, syncZohoInvoice, syncZohoPayment } from '@/lib/integrations/zoho/invoice';

export async function GET(req: NextRequest) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return jsonNoStore({ error: 'Only a property owner can manage Zoho Invoice.' }, { status: 403 });
  try {
    const organizations = await listZohoOrganizations(result.resolved.propertyId);
    return jsonNoStore({ organizations });
  } catch (error: any) {
    const message = error?.message === 'ZOHO_NOT_CONNECTED' ? 'Connect Zoho Invoice first.' : error?.message === 'OAUTH_CLIENT_MISSING' ? 'Zoho OAuth client is not configured.' : 'Could not load Zoho organizations.';
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
      const metadata = await selectZohoOrganization(result.resolved.propertyId, result.resolved.userId, body.organizationId, body.organizationName);
      return jsonNoStore({ organization: metadata });
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
    if (body.action === 'sync_payment' && typeof body.paymentId === 'string') {
      const synced = await syncZohoPayment(result.resolved.propertyId, body.paymentId);
      return jsonNoStore({ synced });
    }
    return jsonNoStore({ error: 'Invalid action.' }, { status: 422 });
  } catch (error: any) {
    return jsonNoStore({ error: error?.message || 'Zoho action failed.' }, { status: 422 });
  }
}
