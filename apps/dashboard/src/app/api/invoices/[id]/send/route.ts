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

    const origin = process.env.SENA_PUBLIC_APP_ORIGIN || process.env.NEXTAUTH_URL || 'https://app.sena.ng';
    const publicInvoiceUrl = `${origin.replace(/\/$/, '')}/invoice/${invoice.id}`;
    const balanceMinorUnits = Math.max(0, invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits);
    const money = (amount: number) => `₦${(amount / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const items = (invoice.items as Array<{ description?: string; quantity?: number; totalMinorUnits?: number }>) || [];
    const summaryLines = items.slice(0, 6).map((item) => ({
      label: `${item.description || 'Item'}${item.quantity ? ` × ${item.quantity}` : ''}`,
      amount: money(item.totalMinorUnits || 0),
    }));
    if (res?.reference) summaryLines.unshift({ label: 'Reservation', amount: res.reference });

    let emailSent = false;
    let emailError: string | null = null;

    try {
      const emailResult = await sendSenaEmail(
        'payment.invoice_issued',
        {
          guestName: invoice.recipientName,
          invoiceNumber: invoice.invoiceNumber,
          propertyName: prop?.name || 'Your hotel',
          propertyAddress: prop?.address || undefined,
          propertyPhone: prop?.phone || undefined,
          propertyEmail: prop?.email || undefined,
          amountDueFormatted: money(balanceMinorUnits),
          dueDate: invoice.dueDate,
          summaryLines,
          invoiceUrl: publicInvoiceUrl,
        },
        {
          to: targetEmail,
          idempotencyKey: `invoice_issued_${invoice.id}_${invoice.updatedAt?.toISOString?.() || invoice.updatedAt}_${balanceMinorUnits}`,
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

    if (!emailSent) {
      return NextResponse.json({ success: false, emailSent: false, error: emailError || 'The invoice email could not be sent.', publicInvoiceUrl }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      emailSent,
      message: `Invoice ${invoice.invoiceNumber} sent to ${targetEmail}`,
      publicInvoiceUrl,
    });
  } catch (error: any) {
    console.error('[INVOICE SEND ROUTE ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const POST = withMerchant(handlePOST, 'invoices');
