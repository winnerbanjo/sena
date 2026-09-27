import { resolvePublicInvoiceToken } from '@/lib/public-invoice-token';
import { apiError } from '@/lib/api-error';
import { NextRequest, NextResponse } from 'next/server';
import {
  db,
  propertyInvoices,
  properties,
  reservations,
  eq,
} from '@sena/database';

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

    const prop = await db.query.properties.findFirst({
      where: eq(properties.id, invoice.propertyId),
    });

    let reservation = null;
    if (invoice.reservationId) {
      reservation = await db.query.reservations.findFirst({
        where: eq(reservations.id, invoice.reservationId),
      });
    }

    return NextResponse.json({
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
        bankDetails: invoice.bankDetails, paymentTerms: invoice.paymentTerms, notes: invoice.notes,
      },
      property: {
        name: prop?.name,
        address: prop?.address,
        phone: prop?.phone,
        email: prop?.email,
      },
      reservation: reservation
        ? {
            reference: reservation.reference,
            checkInDate: reservation.checkInDate,
            checkOutDate: reservation.checkOutDate,
            nights: reservation.nights,
          }
        : null,
    });
  } catch (error: any) {
    console.error('[PUBLIC INVOICE GET ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}
