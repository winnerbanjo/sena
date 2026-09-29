/**
 * Accounting adapter contracts for Zoho Books, QuickBooks Online, and Xero.
 * Real connectors must use official APIs. Until credentials + certification land,
 * adapters remain Coming Soon and must never report Connected.
 */

export type AccountingObjectType = 'contact' | 'invoice' | 'payment';

export type AccountingAdapterCapability = 'contact_sync' | 'invoice_export' | 'payment_sync';

export type AccountingAdapterContext = {
  propertyId: string;
  integrationId: string;
  accessToken: string;
  refreshToken?: string | null;
  realmId?: string | null;
  organizationId?: string | null;
  apiBase?: string | null;
};

export type AccountingContactInput = {
  senaGuestId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type AccountingInvoiceInput = {
  senaInvoiceId: string;
  number: string;
  contactExternalId?: string | null;
  issueDate: string;
  currency: string;
  lineItems: Array<{ name: string; quantity: number; rate: number }>;
  total: number;
};

export type AccountingPaymentInput = {
  senaPaymentId: string;
  invoiceExternalId: string;
  amount: number;
  currency: string;
  paidAt: string;
  reference?: string | null;
};

export interface AccountingAdapter {
  provider: 'zoho_books' | 'quickbooks' | 'xero';
  name: string;
  availability: 'available' | 'coming_soon';
  capabilities: AccountingAdapterCapability[];
  authenticate?(ctx: AccountingAdapterContext): Promise<void>;
  upsertContact(ctx: AccountingAdapterContext, input: AccountingContactInput): Promise<{ externalId: string }>;
  upsertInvoice(ctx: AccountingAdapterContext, input: AccountingInvoiceInput): Promise<{ externalId: string }>;
  recordPayment?(ctx: AccountingAdapterContext, input: AccountingPaymentInput): Promise<{ externalId: string }>;
}

function comingSoonAdapter(provider: AccountingAdapter['provider'], name: string): AccountingAdapter {
  const blocked = async () => {
    throw new Error(`${provider.toUpperCase()}_COMING_SOON`);
  };
  return {
    provider,
    name,
    availability: 'coming_soon',
    capabilities: ['contact_sync', 'invoice_export'],
    authenticate: blocked,
    upsertContact: blocked as AccountingAdapter['upsertContact'],
    upsertInvoice: blocked as AccountingAdapter['upsertInvoice'],
    recordPayment: blocked as AccountingAdapter['recordPayment'],
  };
}

export const zohoBooksAdapter = comingSoonAdapter('zoho_books', 'Zoho Books');
export const quickbooksAdapter = comingSoonAdapter('quickbooks', 'QuickBooks Online');
export const xeroAdapter = comingSoonAdapter('xero', 'Xero');

export const ACCOUNTING_ADAPTERS: AccountingAdapter[] = [zohoBooksAdapter, quickbooksAdapter, xeroAdapter];

export function getAccountingAdapter(provider: string) {
  return ACCOUNTING_ADAPTERS.find((adapter) => adapter.provider === provider) || null;
}

export function accountingMarketplaceState(provider: string) {
  const adapter = getAccountingAdapter(provider);
  if (!adapter) return null;
  return {
    provider: adapter.provider,
    name: adapter.name,
    availability: adapter.availability,
    connectionStatus: 'coming_soon' as const,
    capabilities: adapter.capabilities,
    canConnect: false,
  };
}
