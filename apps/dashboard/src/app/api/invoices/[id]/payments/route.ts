import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  propertyInvoices,
  payments,
  reservations,
  eq,
} from '@sena/database';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = await req.json();

    const {
      amountMinorUnits,
      method = 'pos', // 'cash' | 'pos' | 'bank_transfer' | 'card'
      provider = 'manual', // 'manual' | 'paystack'
      providerReference,
      notes = '',
    } = body;

    const parsedAmount = Math.round(Number(amountMinorUnits) || 0);
    if (parsedAmount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }

    // 1. Fetch Invoice
    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.id, id),
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const newPaidMinorUnits = invoice.paidAmountMinorUnits + parsedAmount;
    const newStatus =
      newPaidMinorUnits >= invoice.totalAmountMinorUnits
        ? 'paid'
        : 'partially_paid';

    // 2. Update Invoice
    const [updatedInvoice] = await db
      .update(propertyInvoices)
      .set({
        paidAmountMinorUnits: newPaidMinorUnits,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(propertyInvoices.id, id))
      .returning();

    // 3. Record in Payments Table (for unified PMS financial tracking)
    const paymentRef = providerReference || `PAY-INV-${invoice.invoiceNumber}-${Date.now().toString().slice(-4)}`;
    
    if (invoice.reservationId) {
      await db.insert(payments).values({
        propertyId: invoice.propertyId,
        reservationId: invoice.reservationId,
        amountMinorUnits: parsedAmount,
        currency: invoice.currency || 'NGN',
        provider,
        providerReference: paymentRef,
        method,
        status: 'successful',
        notes: `Settlement for ${invoice.invoiceNumber}: ${notes}`.trim(),
      });

      // Update reservation paid balance
      const res = await db.query.reservations.findFirst({
        where: eq(reservations.id, invoice.reservationId),
      });

      if (res) {
        const resPaid = res.paidAmountMinorUnits + parsedAmount;
        const resPaymentStatus = resPaid >= res.totalAmountMinorUnits ? 'paid' : 'partial';
        await db
          .update(reservations)
          .set({
            paidAmountMinorUnits: resPaid,
            paymentStatus: resPaymentStatus,
            updatedAt: new Date(),
          })
          .where(eq(reservations.id, res.id));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Payment of ₦${(parsedAmount / 100).toLocaleString('en-NG')} recorded successfully`,
      invoice: updatedInvoice,
    });
  } catch (error: any) {
    console.error('[INVOICE PAYMENT POST ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
