import { resolvePublicInvoiceToken } from '@/lib/public-invoice-token';
import { NextRequest, NextResponse } from 'next/server';
import {
  db,
  propertyInvoices,
  eq,
} from '@sena/database';
import { initializePropertyPaystack } from '@/lib/paystack-payments';

export async function POST(
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

    if (!invoice.recipientEmail || ['void', 'draft', 'cancelled'].includes(invoice.status)) return NextResponse.json({ error: 'Contact the property to arrange payment.' }, { status: 400 });

    const balanceMinorUnits = Math.max(0, invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits);
    if (balanceMinorUnits <= 0 || invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already settled in full' }, { status: 400 });
    }

    const host = req.headers.get('host') || 'app.sena.ng';
    const proto = host.includes('localhost') ? 'http' : 'https';
    const callbackUrl = `${proto}://${host}/invoice/${number}?payment=confirming`;

    const initialized = await initializePropertyPaystack({ propertyId: invoice.propertyId, invoiceId: invoice.id, reservationId: invoice.reservationId, email: invoice.recipientEmail, amountMinorUnits: balanceMinorUnits, currency: invoice.currency, source: 'invoice', callbackUrl, idempotencyKey: req.headers.get('idempotency-key') || undefined });

    return NextResponse.json({
      success: true,
      authorizationUrl: initialized.authorizationUrl,
      reference: initialized.reference,
    });
  } catch (error: any) {
    const paused = error?.message === 'PAYSTACK_NOT_CONNECTED' || error?.message === 'PAYSTACK_PAYMENTS_DISABLED';
    const unavailable = paused ? 'Online payments are unavailable. Contact the property.' : error?.message === 'PROVIDER_UNAVAILABLE' ? 'Paystack is temporarily unavailable. Try again shortly.' : "We couldn't start the payment. No charge has been made. Try again.";
    return NextResponse.json({ error: unavailable }, { status: paused ? 503 : 502 });
  }
}
