import { resolvePublicInvoiceToken } from '@/lib/public-invoice-token';
import { apiError } from '@/lib/api-error';
import { NextRequest, NextResponse } from 'next/server';
import {
  db,
  propertyInvoices,
  properties,
  reservations,
  transferProofs,
  desc,
  eq,
} from '@sena/database';
import { loadInvoicePresentation } from '@/lib/invoice-presentation';
import { onlinePaymentAvailable } from '@/lib/online-provider';
import { PaymentService } from '@sena/payments';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    const { number } = await params;

    const invoiceId = resolvePublicInvoiceToken(number);
    if (!invoiceId) return NextResponse.json({ error: 'Please ask the property for a fresh invoice link.' }, { status: 404 });

    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.id, invoiceId),
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const canPayOnline = await onlinePaymentAvailable(invoice.propertyId, 'invoice');
    const bankAccounts = await PaymentService.listPublicBankAccounts(invoice.propertyId);
    const bankDetails = invoice.bankDetails || bankAccounts[0] || null;

    const prop = await db.query.properties.findFirst({
      where: eq(properties.id, invoice.propertyId),
    });

    let reservation = null;
    if (invoice.reservationId) {
      reservation = await db.query.reservations.findFirst({
        where: eq(reservations.id, invoice.reservationId),
      });
    }

    const [latestProof] = await db
      .select({ status: transferProofs.status })
      .from(transferProofs)
      .where(eq(transferProofs.invoiceId, invoice.id))
      .orderBy(desc(transferProofs.submittedAt))
      .limit(1);

    const presentation = await loadInvoicePresentation(invoice.id, 'public');

    return NextResponse.json({
      onlinePaymentAvailable: canPayOnline,
      bankTransferAvailable: bankAccounts.length > 0,
      bankAccounts,
      transferProofStatus: latestProof?.status || null,
      invoice: {
        invoiceNumber: invoice.invoiceNumber, invoiceType: invoice.invoiceType,
        status: invoice.status, recipientName: invoice.recipientName,
        recipientEmail: invoice.recipientEmail, recipientPhone: invoice.recipientPhone,
        recipientAddress: invoice.recipientAddress, companyTin: invoice.companyTin,
        issueDate: invoice.issueDate, dueDate: invoice.dueDate, currency: invoice.currency,
        subtotalMinorUnits: invoice.subtotalMinorUnits, taxVatMinorUnits: invoice.taxVatMinorUnits,
        taxConsumptionMinorUnits: invoice.taxConsumptionMinorUnits, serviceChargeMinorUnits: invoice.serviceChargeMinorUnits,
        discountMinorUnits: invoice.discountMinorUnits, totalAmountMinorUnits: invoice.totalAmountMinorUnits,
        paidAmountMinorUnits: invoice.paidAmountMinorUnits, items: invoice.items,
        bankDetails, paymentTerms: invoice.paymentTerms, notes: invoice.notes,
      },
      property: presentation?.property || {
        name: prop?.name,
        address: prop?.address,
        phone: prop?.phone,
        email: prop?.email,
        logoUrl: null,
      },
      reservation: presentation?.reservation || (reservation
        ? {
            reference: reservation.reference,
            guestName: invoice.recipientName,
            accommodation: '',
            checkInDate: reservation.checkInDate,
            checkOutDate: reservation.checkOutDate,
          }
        : null),
      payments: presentation?.payments || [],
    });
  } catch (error: any) {
    console.error('[PUBLIC INVOICE GET ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}
