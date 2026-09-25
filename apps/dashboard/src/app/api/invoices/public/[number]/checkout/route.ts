import { NextRequest, NextResponse } from 'next/server';
import {
  db,
  propertyInvoices,
  properties,
  eq,
} from '@sena/database';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    const { number } = await params;

    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.invoiceNumber, number),
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const balanceMinorUnits = Math.max(0, invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits);
    if (balanceMinorUnits <= 0 || invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already settled in full' }, { status: 400 });
    }

    const prop = await db.query.properties.findFirst({
      where: eq(properties.id, invoice.propertyId),
    });

    const host = req.headers.get('host') || 'app.sena.ng';
    const proto = host.includes('localhost') ? 'http' : 'https';
    const callbackUrl = `${proto}://${host}/invoice/${invoice.invoiceNumber}?payment=success`;

    const reference = `INV-${invoice.invoiceNumber}-${Date.now().toString().slice(-4)}`;

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: invoice.recipientEmail || 'guest@sena.ng',
        amount: balanceMinorUnits,
        currency: 'NGN',
        reference,
        callback_url: callbackUrl,
        metadata: {
          type: 'invoice_settlement',
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          propertyId: prop?.id,
          reservationId: invoice.reservationId,
          custom_fields: [
            {
              display_name: 'Invoice Number',
              variable_name: 'invoice_number',
              value: invoice.invoiceNumber,
            },
            {
              display_name: 'Recipient',
              variable_name: 'recipient_name',
              value: invoice.recipientName,
            },
            {
              display_name: 'Property',
              variable_name: 'property_name',
              value: prop?.name || 'Sena Property',
            },
          ],
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      console.error('[PAYSTACK INVOICE INIT ERROR]', paystackData);
      return NextResponse.json(
        { error: paystackData.message || 'Failed to initialize Paystack checkout' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      authorizationUrl: paystackData.data.authorization_url,
      accessCode: paystackData.data.access_code,
      reference: paystackData.data.reference,
    });
  } catch (error: any) {
    console.error('[INVOICE PAYSTACK CHECKOUT ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
