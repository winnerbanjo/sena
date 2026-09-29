import { and, eq } from 'drizzle-orm';
import { db, guests, propertyInvoices, payments, integrations } from '@sena/database';
import {
  ensureConnectedAppsPlatformSchema,
  getPropertyIntegration,
  readOAuthTokens,
  upsertOAuthTokens,
  enqueueSyncJob,
  upsertExternalObjectMapping,
  findMappingBySenaObject,
  writeIntegrationAudit,
} from '../platform';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '../crypto';

type ZohoTokens = NonNullable<Awaited<ReturnType<typeof readOAuthTokens>>>;

function accountsBase() {
  return (process.env.SENA_ZOHO_ACCOUNTS_BASE || process.env.ZOHO_ACCOUNTS_BASE || 'https://accounts.zoho.com').replace(/\/$/, '');
}

function clientCredentials() {
  const clientId = process.env.SENA_ZOHO_INVOICE_CLIENT_ID || process.env.ZOHO_INVOICE_CLIENT_ID || process.env.SENA_ZOHO_CLIENT_ID;
  const clientSecret = process.env.SENA_ZOHO_INVOICE_CLIENT_SECRET || process.env.ZOHO_INVOICE_CLIENT_SECRET || process.env.SENA_ZOHO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('OAUTH_CLIENT_MISSING');
  return { clientId, clientSecret };
}

export function zohoApiBaseFromMetadata(metadata: unknown) {
  const record = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const fromAccount =
    typeof record.apiDomain === 'string'
      ? record.apiDomain
      : typeof record.environment === 'string'
        ? record.environment
        : null;
  const configured = process.env.SENA_ZOHO_API_BASE || process.env.ZOHO_API_BASE;
  const base = (fromAccount || configured || 'https://www.zohoapis.com').replace(/\/$/, '');
  return `${base}/invoice/v3`;
}

async function refreshZohoAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = clientCredentials();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const response = await fetch(`${accountsBase()}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const json = (await response.json().catch(() => null)) as any;
  if (!response.ok || !json?.access_token) throw new Error('ZOHO_REFRESH_FAILED');
  return {
    accessToken: String(json.access_token),
    expiresAt: typeof json.expires_in === 'number' ? new Date(Date.now() + json.expires_in * 1000) : null,
  };
}

export async function getZohoAccessContext(propertyId: string) {
  await ensureConnectedAppsPlatformSchema();
  const integration = await getPropertyIntegration(propertyId, 'zoho_invoice');
  if (!integration || integration.status !== 'connected') throw new Error('ZOHO_NOT_CONNECTED');
  let tokens = await readOAuthTokens(integration.id);
  if (!tokens?.accessToken) throw new Error('ZOHO_NOT_CONNECTED');
  if (tokens.needsRefresh) {
    if (!tokens.refreshToken) throw new Error('ZOHO_REAUTH_REQUIRED');
    const refreshed = await refreshZohoAccessToken(tokens.refreshToken);
    await upsertOAuthTokens({
      integrationId: integration.id,
      accessToken: refreshed.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: refreshed.expiresAt,
      scopes: tokens.scopes,
      accountMetadata: tokens.accountMetadata as Record<string, unknown> | null,
    });
    tokens = await readOAuthTokens(integration.id);
    if (!tokens) throw new Error('ZOHO_NOT_CONNECTED');
  }
  const organizationId =
    integration.metadata && typeof integration.metadata === 'object'
      ? String((integration.metadata as Record<string, unknown>).organizationId || '')
      : '';
  return {
    integration,
    tokens: tokens as ZohoTokens,
    apiBase: zohoApiBaseFromMetadata({
      ...(integration.metadata && typeof integration.metadata === 'object' ? (integration.metadata as object) : {}),
      environment: integration.environment,
    }),
    organizationId: organizationId || null,
  };
}

async function zohoFetch(propertyId: string, path: string, init?: RequestInit) {
  const ctx = await getZohoAccessContext(propertyId);
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Zoho-oauthtoken ${ctx.tokens.accessToken}`);
  headers.set('Content-Type', 'application/json');
  if (ctx.organizationId) headers.set('X-com-zoho-invoice-organizationid', ctx.organizationId);
  const response = await fetch(`${ctx.apiBase}${path}`, { ...init, headers, cache: 'no-store' });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const code = json?.code || response.status;
    if (response.status === 401) throw new Error('ZOHO_REAUTH_REQUIRED');
    throw new Error(`ZOHO_API_${code}`);
  }
  return { ctx, json };
}

export async function listZohoOrganizations(propertyId: string) {
  const { json } = await zohoFetch(propertyId, '/organizations');
  const orgs = Array.isArray(json?.organizations) ? json.organizations : [];
  return orgs.map((org: any) => ({
    organizationId: String(org.organization_id),
    name: String(org.name || org.organization_id),
    currency: org.currency_code || null,
  }));
}

export async function selectZohoOrganization(propertyId: string, actorUserId: string, organizationId: string, organizationName?: string) {
  const integration = await getPropertyIntegration(propertyId, 'zoho_invoice');
  if (!integration || integration.status !== 'connected') throw new Error('ZOHO_NOT_CONNECTED');
  const metadata = {
    ...(integration.metadata && typeof integration.metadata === 'object' ? (integration.metadata as object) : {}),
    organizationId,
    organizationName: organizationName || null,
  };
  await db
    .update(integrations)
    .set({
      metadata,
      externalAccountId: organizationName || organizationId,
      healthStatus: 'healthy',
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integration.id));
  await writeIntegrationAudit({
    propertyId,
    integrationId: integration.id,
    actorUserId,
    action: 'zoho_invoice.organization_selected',
    details: { organizationId },
  });
  return metadata;
}

export async function syncZohoContact(propertyId: string, guestId: string) {
  const [guest] = await db.select().from(guests).where(and(eq(guests.id, guestId), eq(guests.propertyId, propertyId))).limit(1);
  if (!guest) throw new Error('GUEST_NOT_FOUND');
  const ctx = await getZohoAccessContext(propertyId);
  if (!ctx.organizationId) throw new Error('ZOHO_ORG_REQUIRED');

  const existing = await findMappingBySenaObject({
    integrationId: ctx.integration.id,
    senaObjectType: 'guest',
    senaObjectId: guest.id,
  });

  const contactPayload = {
    contact_name: guest.fullName,
    contact_type: 'customer',
    email: guest.email || undefined,
    phone: guest.phone || undefined,
  };

  let externalId = existing?.externalObjectId;
  if (externalId) {
    await zohoFetch(propertyId, `/contacts/${externalId}`, { method: 'PUT', body: JSON.stringify(contactPayload) });
  } else {
    // Careful match assist by email before create — mapping becomes authoritative after first sync.
    if (guest.email) {
      const search = await zohoFetch(propertyId, `/contacts?email=${encodeURIComponent(guest.email)}`);
      const found = Array.isArray(search.json?.contacts) ? search.json.contacts[0] : null;
      if (found?.contact_id) externalId = String(found.contact_id);
    }
    if (!externalId) {
      const created = await zohoFetch(propertyId, '/contacts', { method: 'POST', body: JSON.stringify(contactPayload) });
      externalId = String(created.json?.contact?.contact_id || '');
    }
    if (!externalId) throw new Error('ZOHO_CONTACT_CREATE_FAILED');
  }

  await upsertExternalObjectMapping({
    propertyId,
    integrationId: ctx.integration.id,
    provider: 'zoho_invoice',
    senaObjectType: 'guest',
    senaObjectId: guest.id,
    externalObjectType: 'contact',
    externalObjectId: externalId,
    metadata: { email: guest.email || null, phone: guest.phone || null },
  });

  return { contactId: externalId };
}

export async function syncZohoInvoice(propertyId: string, invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(propertyInvoices)
    .where(and(eq(propertyInvoices.id, invoiceId), eq(propertyInvoices.propertyId, propertyId)))
    .limit(1);
  if (!invoice) throw new Error('INVOICE_NOT_FOUND');
  const ctx = await getZohoAccessContext(propertyId);
  if (!ctx.organizationId) throw new Error('ZOHO_ORG_REQUIRED');

  let contactId: string | undefined;
  if (invoice.guestId) {
    const contact = await syncZohoContact(propertyId, invoice.guestId);
    contactId = contact.contactId;
  }

  const lineItems = Array.isArray(invoice.items) && invoice.items.length
    ? invoice.items.map((item) => ({
        name: item.description || 'Stay charge',
        rate: (item.unitPriceMinorUnits || item.totalMinorUnits || 0) / 100,
        quantity: item.quantity || 1,
      }))
    : [{ name: `Invoice ${invoice.invoiceNumber}`, rate: (invoice.totalAmountMinorUnits || 0) / 100, quantity: 1 }];

  const payload: Record<string, unknown> = {
    customer_id: contactId,
    reference_number: invoice.invoiceNumber,
    date: invoice.issueDate || new Date().toISOString().slice(0, 10),
    line_items: lineItems,
    notes: 'Synced from Sena. Sena remains the source of truth for payment settlement.',
  };

  const existing = await findMappingBySenaObject({
    integrationId: ctx.integration.id,
    senaObjectType: 'invoice',
    senaObjectId: invoice.id,
  });

  let externalId = existing?.externalObjectId;
  if (externalId) {
    await zohoFetch(propertyId, `/invoices/${externalId}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    const created = await zohoFetch(propertyId, '/invoices', { method: 'POST', body: JSON.stringify(payload) });
    externalId = String(created.json?.invoice?.invoice_id || '');
    if (!externalId) throw new Error('ZOHO_INVOICE_CREATE_FAILED');
  }

  await upsertExternalObjectMapping({
    propertyId,
    integrationId: ctx.integration.id,
    provider: 'zoho_invoice',
    senaObjectType: 'invoice',
    senaObjectId: invoice.id,
    externalObjectType: 'invoice',
    externalObjectId: externalId,
    metadata: { invoiceNumber: invoice.invoiceNumber },
  });

  return { invoiceId: externalId, contactId };
}

/**
 * Represent a verified Sena payment in Zoho when an invoice mapping exists.
 * Zoho never authorizes Sena settlement — this is outbound bookkeeping only.
 */
export async function syncZohoPayment(propertyId: string, paymentId: string) {
  const [payment] = await db.select().from(payments).where(and(eq(payments.id, paymentId), eq(payments.propertyId, propertyId))).limit(1);
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  if (payment.status && !['completed', 'succeeded', 'paid', 'successful'].includes(payment.status)) {
    throw new Error('PAYMENT_NOT_VERIFIED');
  }
  const ctx = await getZohoAccessContext(propertyId);
  if (!ctx.organizationId) throw new Error('ZOHO_ORG_REQUIRED');
  if (!payment.invoiceId) throw new Error('PAYMENT_INVOICE_REQUIRED');

  const invoiceMapping = await findMappingBySenaObject({
    integrationId: ctx.integration.id,
    senaObjectType: 'invoice',
    senaObjectId: payment.invoiceId,
  });
  if (!invoiceMapping) {
    await syncZohoInvoice(propertyId, payment.invoiceId);
  }
  const mappedInvoice = await findMappingBySenaObject({
    integrationId: ctx.integration.id,
    senaObjectType: 'invoice',
    senaObjectId: payment.invoiceId,
  });
  if (!mappedInvoice) throw new Error('ZOHO_INVOICE_MAPPING_REQUIRED');

  const existing = await findMappingBySenaObject({
    integrationId: ctx.integration.id,
    senaObjectType: 'payment',
    senaObjectId: payment.id,
  });
  if (existing) return { paymentId: existing.externalObjectId, duplicate: true };

  const payload = {
    customer_id: undefined as string | undefined,
    payment_mode: 'others',
    amount: (payment.amountMinorUnits || 0) / 100,
    date: (payment.paidAt || payment.createdAt || new Date()).toISOString().slice(0, 10),
    reference_number: payment.providerReference || payment.internalReference || payment.id,
    invoices: [{ invoice_id: mappedInvoice.externalObjectId, amount_applied: (payment.amountMinorUnits || 0) / 100 }],
    notes: 'Verified payment synced from Sena. Settlement authority remains in Sena.',
  };

  const created = await zohoFetch(propertyId, '/customerpayments', { method: 'POST', body: JSON.stringify(payload) });
  const externalId = String(created.json?.payment?.payment_id || created.json?.customerpayment?.payment_id || '');
  if (!externalId) throw new Error('ZOHO_PAYMENT_CREATE_FAILED');

  await upsertExternalObjectMapping({
    propertyId,
    integrationId: ctx.integration.id,
    provider: 'zoho_invoice',
    senaObjectType: 'payment',
    senaObjectId: payment.id,
    externalObjectType: 'customerpayment',
    externalObjectId: externalId,
    metadata: { senaProvider: payment.provider, amountMinorUnits: payment.amountMinorUnits },
  });

  return { paymentId: externalId, duplicate: false };
}

export async function queueZohoFullSync(propertyId: string, actorUserId?: string) {
  const integration = await getPropertyIntegration(propertyId, 'zoho_invoice');
  if (!integration || integration.status !== 'connected') throw new Error('ZOHO_NOT_CONNECTED');
  return enqueueSyncJob({
    propertyId,
    integrationId: integration.id,
    provider: 'zoho_invoice',
    direction: 'outbound',
    trigger: 'manual',
    jobType: 'full_sync',
    idempotencyKey: `zoho:full:${propertyId}:${Date.now()}`,
    payload: { actorUserId: actorUserId || null },
  });
}

export async function handleZohoSyncJob(job: {
  propertyId: string;
  jobType: string;
  payload: unknown;
}) {
  const payload = job.payload && typeof job.payload === 'object' ? (job.payload as Record<string, unknown>) : {};
  if (job.jobType === 'contact_sync' && typeof payload.guestId === 'string') {
    return syncZohoContact(job.propertyId, payload.guestId);
  }
  if (job.jobType === 'invoice_export' && typeof payload.invoiceId === 'string') {
    return syncZohoInvoice(job.propertyId, payload.invoiceId);
  }
  if (job.jobType === 'payment_sync' && typeof payload.paymentId === 'string') {
    return syncZohoPayment(job.propertyId, payload.paymentId);
  }
  if (job.jobType === 'full_sync' || job.jobType === 'platform_ping') {
    // Full sync is driven by explicit object IDs in later jobs; ping proves handler wiring.
    return {};
  }
  throw new Error(`NO_HANDLER:zoho_invoice:${job.jobType}`);
}

/** Register Zoho handlers on the shared sync worker global. */
export function registerZohoSyncHandlers() {
  const root = globalThis as typeof globalThis & {
    __senaSyncHandlers?: Record<string, (job: any) => Promise<any>>;
  };
  root.__senaSyncHandlers = root.__senaSyncHandlers || {};
  root.__senaSyncHandlers.zoho_invoice = async (job) => handleZohoSyncJob(job);
  root.__senaSyncHandlers['zoho_invoice:full_sync'] = async (job) => handleZohoSyncJob(job);
  root.__senaSyncHandlers['zoho_invoice:contact_sync'] = async (job) => handleZohoSyncJob(job);
  root.__senaSyncHandlers['zoho_invoice:invoice_export'] = async (job) => handleZohoSyncJob(job);
  root.__senaSyncHandlers['zoho_invoice:payment_sync'] = async (job) => handleZohoSyncJob(job);
}

// Keep encrypt helpers referenced so accidental plaintext logging is harder to introduce silently.
void encryptIntegrationSecret;
void decryptIntegrationSecret;
