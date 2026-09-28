import { createPublicInvoiceToken } from '@/lib/public-invoice-token';
import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { db, propertyInvoices, reservations, transferProofs } from '@sena/database';
import { and, desc, eq, ne } from 'drizzle-orm';

async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reservation = await db.query.reservations.findFirst({ where: eq(reservations.id, id) });
    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    const pendingProof = await db
      .select({ id: transferProofs.id })
      .from(transferProofs)
      .where(and(eq(transferProofs.reservationId, id), eq(transferProofs.status, 'pending')))
      .limit(1);

    const invoices = await db
      .select({
        id: propertyInvoices.id,
        invoiceNumber: propertyInvoices.invoiceNumber,
        status: propertyInvoices.status,
      })
      .from(propertyInvoices)
      .where(and(eq(propertyInvoices.reservationId, id), ne(propertyInvoices.status, 'void')))
      .orderBy(desc(propertyInvoices.createdAt));

    return NextResponse.json({
      totalAmountMinorUnits: reservation.totalAmountMinorUnits,
      paidAmountMinorUnits: reservation.paidAmountMinorUnits,
      pendingTransferProof: pendingProof.length > 0,
      invoices: invoices.map((invoice) => {
        let publicToken = '';
        try {
          publicToken = createPublicInvoiceToken(invoice.id);
        } catch {
          publicToken = '';
        }
        return { ...invoice, publicToken };
      }),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');
