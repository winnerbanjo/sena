/** Customer-facing invoice shape. Internal reservation notes never belong here. */

export interface InvoiceDocumentProperty {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
}

export interface InvoiceDocumentReservation {
  reference: string;
  guestName: string;
  accommodation: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface InvoiceDocumentPayment {
  id?: string;
  paidAt: string;
  method: string;
  reference: string;
  amountMinorUnits: number;
  hasReceipt?: boolean;
}

export function presentInvoiceDocument(input: {
  property: { name?: string | null; address?: string | null; phone?: string | null; email?: string | null } | null;
  logoUrl?: string | null;
  reservation?: {
    reference?: string | null;
    guestName?: string | null;
    accommodation?: string | null;
    checkInDate?: string | null;
    checkOutDate?: string | null;
    specialRequests?: string | null;
    notes?: unknown;
  } | null;
  payments?: Array<{
    id: string;
    paidAt: string;
    method: string;
    reference: string;
    amountMinorUnits: number;
    hasReceipt: boolean;
    notes?: string | null;
    storageKey?: string | null;
  }>;
  audience: 'staff' | 'public';
}): {
  property: InvoiceDocumentProperty;
  reservation: InvoiceDocumentReservation | null;
  payments: InvoiceDocumentPayment[];
} {
  const reservation = input.reservation?.reference
    ? {
        reference: input.reservation.reference,
        guestName: input.reservation.guestName || '',
        accommodation: input.reservation.accommodation || '',
        checkInDate: input.reservation.checkInDate || '',
        checkOutDate: input.reservation.checkOutDate || '',
      }
    : null;
  const payments = (input.payments || []).map((payment) => {
    const line: InvoiceDocumentPayment = {
      paidAt: payment.paidAt,
      method: payment.method,
      reference: payment.reference,
      amountMinorUnits: payment.amountMinorUnits,
    };
    if (input.audience === 'staff') {
      line.id = payment.id;
      line.hasReceipt = payment.hasReceipt;
    }
    return line;
  });
  return {
    property: {
      name: input.property?.name || '',
      address: input.property?.address || '',
      phone: input.property?.phone || '',
      email: input.property?.email || '',
      logoUrl: input.logoUrl || null,
    },
    reservation,
    payments,
  };
}

export function invoiceStatusLabel(status: string, balanceMinorUnits: number) {
  if (status === 'void' || status === 'cancelled') return 'Void';
  if (status === 'draft') return 'Draft';
  if (status === 'paid' || balanceMinorUnits <= 0) return 'Paid';
  if (status === 'partially_paid') return 'Partially paid';
  if (status === 'overdue') return 'Overdue';
  return 'Issued';
}
