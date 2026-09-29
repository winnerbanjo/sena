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

const LOCATION_ACCOUNTS: Record<string, string> = {
  us: 'https://accounts.zoho.com',
  eu: 'https://accounts.zoho.eu',
  in: 'https://accounts.zoho.in',
  au: 'https://accounts.zoho.com.au',
  jp: 'https://accounts.zoho.jp',
  ca: 'https://accounts.zohocloud.ca',
  cn: 'https://accounts.zoho.com.cn',
  sa: 'https://accounts.zoho.sa',
};

const LOCATION_INVOICE_APP: Record<string, string> = {
  us: 'https://invoice.zoho.com',
  eu: 'https://invoice.zoho.eu',
  in: 'https://invoice.zoho.in',
  au: 'https://invoice.zoho.com.au',
  jp: 'https://invoice.zoho.jp',
  ca: 'https://invoice.zohocloud.ca',
  cn: 'https://invoice.zoho.com.cn',
  sa: 'https://invoice.zoho.sa',
};

function defaultAccountsBase() {
  return (process.env.SENA_ZOHO_ACCOUNTS_BASE || process.env.ZOHO_ACCOUNTS_BASE || 'https://accounts.zoho.com').replace(
    /\/$/,
    ''
  );
}

/** Resolve Zoho accounts host for token exchange from callback `location` (user DC). */
export function accountsBaseForLocation(location?: string | null) {
  const loc = typeof location === 'string' ? location.toLowerCase().trim() : '';
  if (loc && LOCATION_ACCOUNTS[loc]) return LOCATION_ACCOUNTS[loc];
  return defaultAccountsBase();
}

/** Build Zoho authorization_code token request body (never log this — contains secrets). */
export function buildZohoAuthorizationCodeTokenBody(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  codeVerifier?: string;
}) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  // Authorize may include PKCE code_challenge; Zoho then requires matching code_verifier.
  if (input.codeVerifier) body.set('code_verifier', input.codeVerifier);
  return body;
}

export function accountsBaseFromMetadata(metadata: unknown) {
  const record = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  if (typeof record.accountsDomain === 'string' && record.accountsDomain.startsWith('https://')) {
    return record.accountsDomain.replace(/\/$/, '');
  }
  const location = typeof record.location === 'string' ? record.location.toLowerCase() : '';
  if (location && LOCATION_ACCOUNTS[location]) return LOCATION_ACCOUNTS[location];
  return defaultAccountsBase();
}

function clientCredentials() {
  const clientId =
    process.env.SENA_ZOHO_INVOICE_CLIENT_ID || process.env.ZOHO_INVOICE_CLIENT_ID || process.env.SENA_ZOHO_CLIENT_ID;
  const clientSecret =
    process.env.SENA_ZOHO_INVOICE_CLIENT_SECRET ||
    process.env.ZOHO_INVOICE_CLIENT_SECRET ||
    process.env.SENA_ZOHO_CLIENT_SECRET;
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

export function zohoInvoiceAppUrl(metadata: unknown, zohoInvoiceId: string) {
  const record = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const location = typeof record.location === 'string' ? record.location.toLowerCase() : 'us';
  const appBase = LOCATION_INVOICE_APP[location] || LOCATION_INVOICE_APP.us;
  return `${appBase}/app#/invoices/${encodeURIComponent(zohoInvoiceId)}`;
}

function readIntegrationMeta(integration: { metadata: unknown; environment?: string | null }) {
  return {
    ...(integration.metadata && typeof integration.metadata === 'object' ? (integration.metadata as object) : {}),
    environment: integration.environment,
  };
}

export function isZohoSyncEnabled(integration: { metadata: unknown; status: string } | null | undefined) {
  if (!integration || integration.status !== 'connected') return false;
  const meta = integration.metadata && typeof integration.metadata === 'object' ? (integration.metadata as Record<string, unknown>) : {};
  if (!meta.organizationId) return false;
  // Default ON after org selection unless explicitly disabled.
  return meta.syncEnabled !== false;
}

export function getZohoOrganization(integration: { metadata: unknown } | null | undefined) {
  const meta = integration?.metadata && typeof integration.metadata === 'object' ? (integration.metadata as Record<string, unknown>) : {};
  return {
    organizationId: typeof meta.organizationId === 'string' ? meta.organizationId : null,
    organizationName: typeof meta.organizationName === 'string' ? meta.organizationName : null,
    syncEnabled: meta.syncEnabled !== false && Boolean(meta.organizationId),
  };
}

async function refreshZohoAccessToken(refreshToken: string, accountsBase: string) {
  const { clientId, clientSecret } = clientCredentials();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const response = await fetch(`${accountsBase}/oauth/v2/token`, {
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
    apiDomain: typeof json.api_domain === 'string' ? json.api_domain : null,
  };
}

export async function getZohoAccessContext(propertyId: string) {
  await ensureConnectedAppsPlatformSchema();
  const integration = await getPropertyIntegration(propertyId, 'zoho_invoice');
  if (!integration || integration.status !== 'connected') throw new Error('ZOHO_NOT_CONNECTED');
  let tokens = await readOAuthTokens(integration.id);
  if (!tokens?.accessToken) throw new Error('ZOHO_NOT_CONNECTED');
  const meta = readIntegrationMeta(integration);
  const accountsBase = accountsBaseFromMetadata({
    ...meta,
    ...(tokens.accountMetadata && typeof tokens.accountMetadata === 'object' ? tokens.accountMetadata : {}),
  });
  if (tokens.needsRefresh) {
    if (!tokens.refreshToken) throw new Error('ZOHO_REAUTH_REQUIRED');
    const refreshed = await refreshZohoAccessToken(tokens.refreshToken, accountsBase);
    await upsertOAuthTokens({
      integrationId: integration.id,
      accessToken: refreshed.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: refreshed.expiresAt,
      scopes: tokens.scopes,
      accountMetadata: {
        ...(tokens.accountMetadata && typeof tokens.accountMetadata === 'object' ? (tokens.accountMetadata as object) : {}),
        ...(refreshed.apiDomain ? { apiDomain: refreshed.apiDomain } : {}),
      },
    });
    if (refreshed.apiDomain) {
      await db
        .update(integrations)
        .set({
          environment: refreshed.apiDomain,
          metadata: { ...meta, apiDomain: refreshed.apiDomain },
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, integration.id));
    }
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
    apiBase: zohoApiBaseFromMetadata(meta),
    organizationId: organizationId || null,
    syncEnabled: isZohoSyncEnabled(integration),
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
    if (response.status === 429) throw new Error('ZOHO_RATE_LIMIT');
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

/** Manage-panel snapshot. Never throws ZOHO_NOT_CONNECTED — disconnected is a valid UI state. */
export async function getZohoManageState(propertyId: string) {
  await ensureConnectedAppsPlatformSchema();
  const integration = await getPropertyIntegration(propertyId, 'zoho_invoice');
  if (!integration || integration.status !== 'connected') {
    return {
      organizations: [] as Array<{ organizationId: string; name: string; currency: string | null }>,
      selectedOrganizationId: null as string | null,
      selectedOrganizationName: null as string | null,
      syncEnabled: false,
      connectionStatus: integration?.status || 'disconnected',
      healthStatus: integration?.healthStatus || null,
      lastSyncAt: integration?.lastSyncAt?.toISOString() || null,
      lastErrorMessage: integration?.lastErrorMessage || null,
    };
  }

  const org = getZohoOrganization(integration);
  let organizations: Array<{ organizationId: string; name: string; currency: string | null }> = [];
  try {
    organizations = await listZohoOrganizations(propertyId);
  } catch (error: any) {
    if (error?.message === 'ZOHO_REAUTH_REQUIRED') throw error;
    // Connected but org list failed — still return selection so UI can render.
  }

  return {
    organizations,
    selectedOrganizationId: org.organizationId,
    selectedOrganizationName: org.organizationName,
    syncEnabled: isZohoSyncEnabled(integration),
    connectionStatus: integration.status,
    healthStatus: integration.healthStatus || null,
    lastSyncAt: integration.lastSyncAt?.toISOString() || null,
    lastErrorMessage: integration.lastErrorMessage || null,
  };
}

export async function selectZohoOrganization(
  propertyId: string,
  actorUserId: string,
  organizationId: string,
  organizationName?: string
) {
  const integration = await getPropertyIntegration(propertyId, 'zoho_invoice');
  if (!integration || integration.status !== 'connected') throw new Error('ZOHO_NOT_CONNECTED');
  const metadata = {
    ...(integration.metadata && typeof integration.metadata === 'object' ? (integration.metadata as object) : {}),
    organizationId,
    organizationName: organizationName || null,
    // Selecting an organization enables outbound sync for NEW documents only.
    syncEnabled: true,
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
    details: { organizationId, syncEnabled: true },
  });
  return metadata;
}

export async function setZohoSyncEnabled(propertyId: string, actorUserId: string, enabled: boolean) {
  const integration = await getPropertyIntegration(propertyId, 'zoho_invoice');
  if (!integration || integration.status !== 'connected') throw new Error('ZOHO_NOT_CONNECTED');
  const meta = integration.metadata && typeof integration.metadata === 'object' ? (integration.metadata as Record<string, unknown>) : {};
  if (enabled && !meta.organizationId) throw new Error('ZOHO_ORG_REQUIRED');
  const metadata = { ...meta, syncEnabled: enabled };
  await db
    .update(integrations)
    .set({ metadata, updatedAt: new Date() })
    .where(eq(integrations.id, integration.id));
  await writeIntegrationAudit({
    propertyId,
    integrationId: integration.id,
    actorUserId,
    action: enabled ? 'zoho_invoice.sync_enabled' : 'zoho_invoice.sync_disabled',
    details: { syncEnabled: enabled },
  });
  return metadata;
}

export async function syncZohoContact(propertyId: string, guestId: string) {
  const [guest] = await db
    .select()
    .from(guests)
    .where(and(eq(guests.id, guestId), eq(guests.propertyId, propertyId)))
    .limit(1);
  if (!guest) throw new Error('GUEST_NOT_FOUND');
  const ctx = await getZohoAccessContext(propertyId);
  if (!ctx.organizationId) throw new Error('ZOHO_ORG_REQUIRED');

  const existing = await findMappingBySenaObject({
    integrationId: ctx.integration.id,
    senaObjectType: 'guest',
    senaObjectId: guest.id,
  });

  const contactPayload: Record<string, unknown> = {
    contact_name: guest.fullName,
    contact_type: 'customer',
  };
  if (guest.email) contactPayload.email = guest.email;
  if (guest.phone) contactPayload.phone = guest.phone;

  let externalId = existing?.externalObjectId;
  if (externalId) {
    await zohoFetch(propertyId, `/contacts/${externalId}`, { method: 'PUT', body: JSON.stringify(contactPayload) });
  } else {
    // Match by email before create — mapping becomes authoritative after first sync.
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

  const lineItems =
    Array.isArray(invoice.items) && invoice.items.length
      ? invoice.items.map((item) => ({
          name: item.description || 'Stay charge',
          rate: (item.unitPriceMinorUnits || item.totalMinorUnits || 0) / 100,
          quantity: item.quantity || 1,
        }))
      : [{ name: `Invoice ${invoice.invoiceNumber}`, rate: (invoice.totalAmountMinorUnits || 0) / 100, quantity: 1 }];

  // Surface Sena tax/surcharge totals as descriptive lines when present (Zoho tax IDs are org-specific).
  if ((invoice.taxVatMinorUnits || 0) > 0) {
    lineItems.push({ name: 'VAT', rate: invoice.taxVatMinorUnits / 100, quantity: 1 });
  }
  if ((invoice.taxConsumptionMinorUnits || 0) > 0) {
    lineItems.push({ name: 'Consumption tax', rate: invoice.taxConsumptionMinorUnits / 100, quantity: 1 });
  }
  if ((invoice.serviceChargeMinorUnits || 0) > 0) {
    lineItems.push({ name: 'Service charge', rate: invoice.serviceChargeMinorUnits / 100, quantity: 1 });
  }
  if ((invoice.discountMinorUnits || 0) > 0) {
    lineItems.push({ name: 'Discount', rate: -(invoice.discountMinorUnits / 100), quantity: 1 });
  }

  const payload: Record<string, unknown> = {
    customer_id: contactId,
    reference_number: invoice.invoiceNumber,
    date: invoice.issueDate || new Date().toISOString().slice(0, 10),
    due_date: invoice.dueDate || invoice.issueDate || new Date().toISOString().slice(0, 10),
    line_items: lineItems,
    notes:
      invoice.notes ||
      'Synced from Sena. Sena remains the source of truth for payment settlement.',
  };
  if (invoice.currency) payload.currency_code = invoice.currency;

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

  const invoiceUrl = zohoInvoiceAppUrl(readIntegrationMeta(ctx.integration), externalId);
  await upsertExternalObjectMapping({
    propertyId,
    integrationId: ctx.integration.id,
    provider: 'zoho_invoice',
    senaObjectType: 'invoice',
    senaObjectId: invoice.id,
    externalObjectType: 'invoice',
    externalObjectId: externalId,
    metadata: { invoiceNumber: invoice.invoiceNumber, invoiceUrl },
  });

  return { invoiceId: externalId, contactId, invoiceUrl };
}

/**
 * Represent a verified Sena payment in Zoho when an invoice mapping exists.
 * Zoho never authorizes Sena settlement — this is outbound bookkeeping only.
 */
export async function syncZohoPayment(propertyId: string, paymentId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.propertyId, propertyId)))
    .limit(1);
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

  let customerId: string | undefined;
  const [invoice] = await db
    .select()
    .from(propertyInvoices)
    .where(eq(propertyInvoices.id, payment.invoiceId))
    .limit(1);
  if (invoice?.guestId) {
    const contact = await syncZohoContact(propertyId, invoice.guestId);
    customerId = contact.contactId;
  }

  const payload = {
    customer_id: customerId,
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
  if (!isZohoSyncEnabled(integration)) throw new Error('ZOHO_SYNC_DISABLED');
  return enqueueSyncJob({
    propertyId,
    integrationId: integration.id,
    provider: 'zoho_invoice',
    direction: 'outbound',
    trigger: 'manual',
    jobType: 'platform_ping',
    idempotencyKey: `zoho:ping:${propertyId}:${Date.now()}`,
    payload: { actorUserId: actorUserId || null },
  });
}

/**
 * Queue outbound invoice export for NEW invoices after enablement.
 * Never dumps historical invoices — callers must target a specific invoice ID.
 * Fire-and-forget safe: never throws into hotel workflows.
 */
export async function maybeQueueZohoInvoiceExport(propertyId: string, invoiceId: string) {
  try {
    await ensureConnectedAppsPlatformSchema();
    const integration = await getPropertyIntegration(propertyId, 'zoho_invoice');
    if (!isZohoSyncEnabled(integration)) return null;
    return enqueueSyncJob({
      propertyId,
      integrationId: integration!.id,
      provider: 'zoho_invoice',
      direction: 'outbound',
      trigger: 'event',
      jobType: 'invoice_export',
      idempotencyKey: `zoho:invoice:${invoiceId}`,
      payload: { invoiceId },
    });
  } catch {
    return null;
  }
}

export async function maybeQueueZohoPaymentSync(propertyId: string, paymentId: string) {
  try {
    await ensureConnectedAppsPlatformSchema();
    const integration = await getPropertyIntegration(propertyId, 'zoho_invoice');
    if (!isZohoSyncEnabled(integration)) return null;
    return enqueueSyncJob({
      propertyId,
      integrationId: integration!.id,
      provider: 'zoho_invoice',
      direction: 'outbound',
      trigger: 'event',
      jobType: 'payment_sync',
      idempotencyKey: `zoho:payment:${paymentId}`,
      payload: { paymentId },
    });
  } catch {
    return null;
  }
}

export async function retryZohoInvoiceSync(propertyId: string, invoiceId: string, actorUserId?: string) {
  const integration = await getPropertyIntegration(propertyId, 'zoho_invoice');
  if (!integration || integration.status !== 'connected') throw new Error('ZOHO_NOT_CONNECTED');
  if (!getZohoOrganization(integration).organizationId) throw new Error('ZOHO_ORG_REQUIRED');
  // Manual retry is allowed even when sync is disabled — operator explicit action.
  return enqueueSyncJob({
    propertyId,
    integrationId: integration.id,
    provider: 'zoho_invoice',
    direction: 'outbound',
    trigger: 'manual',
    jobType: 'invoice_export',
    idempotencyKey: `zoho:invoice:retry:${invoiceId}:${Math.floor(Date.now() / 60_000)}`,
    payload: { invoiceId, actorUserId: actorUserId || null },
  });
}

export async function getZohoInvoiceSyncStatus(propertyId: string, invoiceId: string) {
  await ensureConnectedAppsPlatformSchema();
  const integration = await getPropertyIntegration(propertyId, 'zoho_invoice');
  if (!integration || integration.status === 'disconnected') {
    return { status: 'not_connected' as const, invoiceUrl: null, externalInvoiceId: null };
  }
  const mapping = await findMappingBySenaObject({
    integrationId: integration.id,
    senaObjectType: 'invoice',
    senaObjectId: invoiceId,
  });
  if (mapping?.externalObjectId) {
    const meta = mapping.metadata && typeof mapping.metadata === 'object' ? (mapping.metadata as Record<string, unknown>) : {};
    const invoiceUrl =
      typeof meta.invoiceUrl === 'string'
        ? meta.invoiceUrl
        : zohoInvoiceAppUrl(readIntegrationMeta(integration), mapping.externalObjectId);
    return {
      status: 'synced' as const,
      invoiceUrl,
      externalInvoiceId: mapping.externalObjectId,
    };
  }

  const { integrationSyncJobs } = await import('@sena/database');
  const { desc } = await import('drizzle-orm');
  const recent = await db
    .select()
    .from(integrationSyncJobs)
    .where(and(eq(integrationSyncJobs.propertyId, propertyId), eq(integrationSyncJobs.provider, 'zoho_invoice')))
    .orderBy(desc(integrationSyncJobs.createdAt))
    .limit(40);
  const invoiceJobs = recent.filter((job) => {
    const payload = job.payload && typeof job.payload === 'object' ? (job.payload as Record<string, unknown>) : {};
    return job.jobType === 'invoice_export' && payload.invoiceId === invoiceId;
  });
  const active = invoiceJobs.find((job) => ['queued', 'processing', 'retrying'].includes(job.status));
  if (active) return { status: 'syncing' as const, invoiceUrl: null, externalInvoiceId: null };
  const failed = invoiceJobs.find((job) => job.status === 'dead_letter');
  if (failed) {
    return { status: 'failed' as const, invoiceUrl: null, externalInvoiceId: null, lastError: failed.lastError };
  }
  return { status: 'not_synced' as const, invoiceUrl: null, externalInvoiceId: null };
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
    // full_sync deliberately does NOT dump historical invoices.
    // Historical export is an explicit future operator action.
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
  root.__senaSyncHandlers['zoho_invoice:platform_ping'] = async (job) => handleZohoSyncJob(job);
  root.__senaSyncHandlers['zoho_invoice:contact_sync'] = async (job) => handleZohoSyncJob(job);
  root.__senaSyncHandlers['zoho_invoice:invoice_export'] = async (job) => handleZohoSyncJob(job);
  root.__senaSyncHandlers['zoho_invoice:payment_sync'] = async (job) => handleZohoSyncJob(job);
}

// Keep encrypt helpers referenced so accidental plaintext logging is harder to introduce silently.
void encryptIntegrationSecret;
void decryptIntegrationSecret;
