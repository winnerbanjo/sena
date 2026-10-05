export interface PropertyInvoice {
  publicToken?: string;
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  status: string;
  recipientName: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;
  companyTin?: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalMinorUnits: number;
  taxVatMinorUnits: number;
  taxConsumptionMinorUnits: number;
  serviceChargeMinorUnits: number;
  discountMinorUnits: number;
  totalAmountMinorUnits: number;
  paidAmountMinorUnits: number;
  items: Array<{
    id: string;
    description: string;
    category: string;
    quantity: number;
    unitPriceMinorUnits: number;
    totalMinorUnits: number;
  }>;
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    sortCode?: string;
    currency?: string;
  } | null;
  paymentTerms?: string | null;
  notes?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedByUserId?: string | null;
  bookingGroupId?: string | null;
  createdAt: string;
}
