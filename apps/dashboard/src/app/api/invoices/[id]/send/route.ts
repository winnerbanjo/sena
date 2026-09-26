import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  propertyInvoices,
  properties,
  reservations,
  eq,
} from '@sena/database';
import { sendSenaEmail } from '@sena/email';

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const recipientOverride = body.email;

    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.id, id),
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const targetEmail = (recipientOverride || invoice.recipientEmail)?.toLowerCase().trim();
    if (!targetEmail) {
      return NextResponse.json({ error: 'No recipient email available' }, { status: 400 });
    }

    const prop = await db.query.properties.findFirst({
      where: eq(properties.id, invoice.propertyId),
    });

    let res = null;
    if (invoice.reservationId) {
      res = await db.query.reservations.findFirst({
        where: eq(reservations.id, invoice.reservationId),
      });
    }

    const appUrl = process.env.NEXTAUTH_URL || 'https://app.sena.ng';
    const publicInvoiceUrl = `${appUrl}/invoice/${invoice.id}`;

    const items = (invoice.items as any[]) || [];
    const formattedLines = items.map((item) => ({
      label: `${item.description} (x${item.quantity})`,
      amount: `₦${((item.totalMinorUnits || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
    }));

    if (invoice.taxVatMinorUnits > 0) {
      formattedLines.push({
        label: 'Value Added Tax (VAT 7.5%)',
        amount: `₦${(invoice.taxVatMinorUnits / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
      });
    }
    if (invoice.taxConsumptionMinorUnits > 0) {
      formattedLines.push({
        label: 'State Consumption Tax (5%)',
        amount: `₦${(invoice.taxConsumptionMinorUnits / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
      });
    }
    if (invoice.serviceChargeMinorUnits > 0) {
      formattedLines.push({
        label: 'Hospitality Service Charge (10%)',
        amount: `₦${(invoice.serviceChargeMinorUnits / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
      });
    }

    const totalFormatted = `₦${(invoice.totalAmountMinorUnits / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

    let emailSent = false;
    let emailError: string | null = null;

    try {
      const emailResult = await sendSenaEmail(
        'stay.stay_receipt',
        {
          guestName: invoice.recipientName,
          reference: res?.reference || invoice.invoiceNumber,
          folioNumber: invoice.invoiceNumber,
          propertyName: prop?.name || 'Sena Property',
          propertyAddress: prop?.address || 'Victoria Island, Lagos',
          propertyPhone: prop?.phone || '+234 1 234 5678',
          propertyEmail: prop?.email || 'reservations@sena.ng',
          checkInDate: res?.checkInDate || invoice.issueDate,
          checkOutDate: res?.checkOutDate || invoice.dueDate,
          folioItems: formattedLines,
          totalAmountFormatted: totalFormatted,
          downloadUrl: publicInvoiceUrl,
        },
        {
          to: targetEmail,
          idempotencyKey: `inv_email_${invoice.invoiceNumber}_${Date.now()}`,
          propertyId: prop?.id,
          relatedEntity: 'invoice',
          relatedId: invoice.id,
        }
      );

      if (emailResult.success) {
        emailSent = true;
      } else {
        emailError = emailResult.error || 'Failed to dispatch email';
      }
    } catch (e: any) {
      console.error('[INVOICE EMAIL SEND ERROR]', e);
      emailError = e.message;
    }

    return NextResponse.json({
      success: true,
      emailSent,
      emailError,
      message: emailSent
        ? `Invoice ${invoice.invoiceNumber} delivered to ${targetEmail}`
        : `Invoice saved. Email status: ${emailError || 'Pending delivery'}`,
      publicInvoiceUrl,
    });
  } catch (error: any) {
    console.error('[INVOICE SEND ROUTE ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const POST = withMerchant(handlePOST, 'invoices');
