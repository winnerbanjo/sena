/**
 * Server-side invoice edits.
 * Totals are recalculated here. Browser totals are ignored.
 * Paid amounts and payment rows are never rewritten.
 * Reservation settlement is not touched.
 */

export const PAID_FINANCIAL_LOCK =
  'This invoice has already been paid. Financial amounts can no longer be edited.';
export const BELOW_PAID = 'Invoice total cannot be less than the amount already paid.';
export const CLOSED_INVOICE = 'This invoice can no longer be edited.';

const LINE_CATEGORIES = ['room', 'fb', 'laundry', 'transport', 'service', 'other'] as const;
type LineCategory = (typeof LINE_CATEGORIES)[number];

export interface InvoiceLineItem {
  id: string;
  description: string;
  category: LineCategory;
  quantity: number;
  unitPriceMinorUnits: number;
  totalMinorUnits: number;
}

export interface InvoiceBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode?: string;
  currency?: string;
}

export interface EditableInvoice {
  status: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
  companyTin: string | null;
  issueDate: string;
  dueDate: string;
  subtotalMinorUnits: number;
  taxVatMinorUnits: number;
  taxConsumptionMinorUnits: number;
  serviceChargeMinorUnits: number;
  discountMinorUnits: number;
  totalAmountMinorUnits: number;
  paidAmountMinorUnits: number;
  items: InvoiceLineItem[];
  bankDetails: InvoiceBankDetails | null;
  paymentTerms: string | null;
  notes: string | null;
}

export interface InvoiceEditInput {
  status?: unknown;
  recipientName?: unknown;
  recipientEmail?: unknown;
  recipientPhone?: unknown;
  recipientAddress?: unknown;
  companyTin?: unknown;
  issueDate?: unknown;
  dueDate?: unknown;
  items?: unknown;
  applyVat?: unknown;
  applyConsumptionTax?: unknown;
  applyServiceCharge?: unknown;
  discountMinorUnits?: unknown;
  paymentTerms?: unknown;
  notes?: unknown;
  bankDetails?: unknown;
}

export interface InvoiceEditChange {
  field: string;
  from: unknown;
  to: unknown;
}

export type InvoiceEditPlan =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      patch: Partial<EditableInvoice> & { updatedAt: Date };
      changes: InvoiceEditChange[];
    };

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, max);
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function invoiceIsFinanciallyPaid(invoice: Pick<EditableInvoice, 'status' | 'paidAmountMinorUnits' | 'totalAmountMinorUnits'>) {
  return invoice.status === 'paid' || (invoice.paidAmountMinorUnits > 0 && invoice.paidAmountMinorUnits >= invoice.totalAmountMinorUnits);
}

export function calculateInvoiceAmounts(input: {
  items: unknown;
  applyVat: boolean;
  applyConsumptionTax: boolean;
  applyServiceCharge: boolean;
  discountMinorUnits: number;
}): { ok: false; error: string } | {
  ok: true;
  items: InvoiceLineItem[];
  subtotalMinorUnits: number;
  taxVatMinorUnits: number;
  taxConsumptionMinorUnits: number;
  serviceChargeMinorUnits: number;
  discountMinorUnits: number;
  totalAmountMinorUnits: number;
} {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: 'At least one line item is required.' };
  }
  if (input.items.some((item) => {
    const row = item as { quantity?: unknown; unitPriceMinorUnits?: unknown };
    return !Number.isSafeInteger(Number(row.quantity))
      || Number(row.quantity) <= 0
      || !Number.isSafeInteger(Number(row.unitPriceMinorUnits))
      || Number(row.unitPriceMinorUnits) < 0;
  })) {
    return { ok: false, error: 'Enter a whole quantity and a valid price for each item.' };
  }

  let subtotalMinorUnits = 0;
  const items = input.items.map((item, index) => {
    const row = item as { id?: unknown; description?: unknown; category?: unknown; quantity?: unknown; unitPriceMinorUnits?: unknown };
    const quantity = Number(row.quantity);
    const unitPriceMinorUnits = Number(row.unitPriceMinorUnits);
    const totalMinorUnits = quantity * unitPriceMinorUnits;
    subtotalMinorUnits += totalMinorUnits;
    const category = LINE_CATEGORIES.includes(row.category as LineCategory) ? row.category as LineCategory : 'other';
    const description = typeof row.description === 'string' ? row.description.trim() : '';
    return {
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 80) : `item_${index + 1}`,
      description: description.slice(0, 500) || 'Service Charge',
      category,
      quantity,
      unitPriceMinorUnits,
      totalMinorUnits,
    };
  });

  if (!Number.isSafeInteger(input.discountMinorUnits) || input.discountMinorUnits < 0) {
    return { ok: false, error: 'Enter a valid discount.' };
  }
  const discountMinorUnits = Math.min(subtotalMinorUnits, input.discountMinorUnits);
  const taxVatMinorUnits = input.applyVat ? Math.round(subtotalMinorUnits * 0.075) : 0;
  const taxConsumptionMinorUnits = input.applyConsumptionTax ? Math.round(subtotalMinorUnits * 0.05) : 0;
  const serviceChargeMinorUnits = input.applyServiceCharge ? Math.round(subtotalMinorUnits * 0.1) : 0;
  const totalAmountMinorUnits = Math.max(
    0,
    subtotalMinorUnits + taxVatMinorUnits + taxConsumptionMinorUnits + serviceChargeMinorUnits - discountMinorUnits,
  );
  return {
    ok: true,
    items,
    subtotalMinorUnits,
    taxVatMinorUnits,
    taxConsumptionMinorUnits,
    serviceChargeMinorUnits,
    discountMinorUnits,
    totalAmountMinorUnits,
  };
}

function parseBankDetails(value: unknown): { ok: true; bankDetails: InvoiceBankDetails | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, bankDetails: null };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'Check the bank details and try again.' };
  const row = value as Record<string, unknown>;
  const bankName = cleanText(row.bankName, 255);
  const accountName = cleanText(row.accountName, 255);
  const accountNumber = cleanText(row.accountNumber, 50);
  if (!bankName && !accountName && !accountNumber) return { ok: true, bankDetails: null };
  if (!bankName || !accountName || !accountNumber) return { ok: false, error: 'Bank name, account name, and account number are required together.' };
  const bankDetails: InvoiceBankDetails = { bankName, accountName, accountNumber };
  const sortCode = cleanText(row.sortCode, 20);
  const currency = cleanText(row.currency, 10);
  if (sortCode) bankDetails.sortCode = sortCode;
  if (currency) bankDetails.currency = currency;
  return { ok: true, bankDetails };
}

function financialSnapshot(invoice: Pick<EditableInvoice, 'items' | 'subtotalMinorUnits' | 'taxVatMinorUnits' | 'taxConsumptionMinorUnits' | 'serviceChargeMinorUnits' | 'discountMinorUnits' | 'totalAmountMinorUnits'>) {
  return {
    items: invoice.items,
    subtotalMinorUnits: invoice.subtotalMinorUnits,
    taxVatMinorUnits: invoice.taxVatMinorUnits,
    taxConsumptionMinorUnits: invoice.taxConsumptionMinorUnits,
    serviceChargeMinorUnits: invoice.serviceChargeMinorUnits,
    discountMinorUnits: invoice.discountMinorUnits,
    totalAmountMinorUnits: invoice.totalAmountMinorUnits,
  };
}

function resolveStatus(invoice: EditableInvoice, dueDate: string, total: number, today: string) {
  const paid = invoice.paidAmountMinorUnits;
  if (invoice.status === 'draft') return 'draft';
  if (invoice.status === 'paid') return 'paid';
  if (paid > 0 && paid >= total) return 'paid';
  if (paid > 0) return 'partially_paid';
  if (invoice.status === 'overdue' && dueDate >= today) return 'issued';
  if (invoice.status === 'overdue') return 'overdue';
  return 'issued';
}

export function planInvoiceEdit(invoice: EditableInvoice, input: InvoiceEditInput, options?: { today?: string }): InvoiceEditPlan {
  if (invoice.status === 'void' || invoice.status === 'cancelled') {
    return { ok: false, status: 409, error: CLOSED_INVOICE };
  }
  if (input.status !== undefined && input.status !== invoice.status) {
    return { ok: false, status: 400, error: 'Invoice payment status changes only when a payment is recorded.' };
  }

  const today = options?.today || new Date().toISOString().slice(0, 10);
  const patch: Partial<EditableInvoice> = {};

  if (input.recipientName !== undefined) {
    const name = cleanText(input.recipientName, 255);
    if (!name) return { ok: false, status: 422, error: 'Customer name is required.' };
    patch.recipientName = name;
  }
  if (input.recipientEmail !== undefined) {
    const email = cleanText(input.recipientEmail, 255);
    patch.recipientEmail = email ? email.toLowerCase() : null;
  }
  if (input.recipientPhone !== undefined) patch.recipientPhone = cleanText(input.recipientPhone, 50);
  if (input.recipientAddress !== undefined) patch.recipientAddress = cleanText(input.recipientAddress, 2000);
  if (input.companyTin !== undefined) patch.companyTin = cleanText(input.companyTin, 100);
  if (input.issueDate !== undefined) {
    if (typeof input.issueDate !== 'string' || !isCalendarDate(input.issueDate)) {
      return { ok: false, status: 422, error: 'Enter a valid issue date.' };
    }
    patch.issueDate = input.issueDate;
  }
  if (input.dueDate !== undefined) {
    if (typeof input.dueDate !== 'string' || !isCalendarDate(input.dueDate)) {
      return { ok: false, status: 422, error: 'Enter a valid due date.' };
    }
    patch.dueDate = input.dueDate;
  }
  if (input.paymentTerms !== undefined) patch.paymentTerms = cleanText(input.paymentTerms, 2000);
  if (input.notes !== undefined) patch.notes = cleanText(input.notes, 4000);
  if (input.bankDetails !== undefined) {
    const bank = parseBankDetails(input.bankDetails);
    if (!bank.ok) return { ok: false, status: 422, error: bank.error };
    patch.bankDetails = bank.bankDetails;
  }

  const financialTouched = ['items', 'discountMinorUnits', 'applyVat', 'applyConsumptionTax', 'applyServiceCharge']
    .some((key) => key in input);
  let nextTotal = invoice.totalAmountMinorUnits;
  if (financialTouched) {
    const amounts = calculateInvoiceAmounts({
      items: input.items === undefined ? invoice.items : input.items,
      applyVat: input.applyVat === undefined ? invoice.taxVatMinorUnits > 0 : Boolean(input.applyVat),
      applyConsumptionTax: input.applyConsumptionTax === undefined ? invoice.taxConsumptionMinorUnits > 0 : Boolean(input.applyConsumptionTax),
      applyServiceCharge: input.applyServiceCharge === undefined ? invoice.serviceChargeMinorUnits > 0 : Boolean(input.applyServiceCharge),
      discountMinorUnits: input.discountMinorUnits === undefined
        ? invoice.discountMinorUnits
        : Number(input.discountMinorUnits),
    });
    if (!amounts.ok) return { ok: false, status: 422, error: amounts.error };
    const current = financialSnapshot(invoice);
    const next = financialSnapshot(amounts);
    if (invoiceIsFinanciallyPaid(invoice) && !sameJson(current, next)) {
      return { ok: false, status: 409, error: PAID_FINANCIAL_LOCK };
    }
    if (amounts.totalAmountMinorUnits < invoice.paidAmountMinorUnits) {
      return { ok: false, status: 409, error: BELOW_PAID };
    }
    if (!sameJson(current, next)) {
      patch.items = amounts.items;
      patch.subtotalMinorUnits = amounts.subtotalMinorUnits;
      patch.taxVatMinorUnits = amounts.taxVatMinorUnits;
      patch.taxConsumptionMinorUnits = amounts.taxConsumptionMinorUnits;
      patch.serviceChargeMinorUnits = amounts.serviceChargeMinorUnits;
      patch.discountMinorUnits = amounts.discountMinorUnits;
      patch.totalAmountMinorUnits = amounts.totalAmountMinorUnits;
      nextTotal = amounts.totalAmountMinorUnits;
    }
  }

  const dueDate = patch.dueDate || invoice.dueDate;
  const statusShouldMove = patch.totalAmountMinorUnits !== undefined || patch.dueDate !== undefined;
  if (statusShouldMove) {
    const status = resolveStatus(invoice, dueDate, nextTotal, today);
    if (status !== invoice.status) patch.status = status;
  }

  const changes: InvoiceEditChange[] = [];
  for (const [field, value] of Object.entries(patch) as Array<[keyof EditableInvoice, unknown]>) {
    const from = invoice[field];
    if (!sameJson(from, value)) changes.push({ field, from, to: value });
  }

  return { ok: true, patch: { ...patch, updatedAt: new Date() }, changes };
}
