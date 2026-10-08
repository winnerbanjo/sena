import { createPublicInvoiceToken } from '@/lib/public-invoice-token';
import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { db, propertyInvoices, reservations, transferProofs } from '@sena/database';
import { and, desc, eq, ne, or } from 'drizzle-orm';

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
      .where(
        and(
          reservation.bookingGroupId
            ? or(
                eq(propertyInvoices.bookingGroupId, reservation.bookingGroupId),
                eq(propertyInvoices.reservationId, id)
              )
            : eq(propertyInvoices.reservationId, id),
          ne(propertyInvoices.status, 'void')
        )
      )
      .orderBy(desc(propertyInvoices.createdAt));

    let totalAmountMinorUnits = reservation.totalAmountMinorUnits;
    let paidAmountMinorUnits = reservation.paidAmountMinorUnits;

    if (reservation.bookingGroupId) {
      const groupStays = await db
        .select({
          totalAmountMinorUnits: reservations.totalAmountMinorUnits,
          paidAmountMinorUnits: reservations.paidAmountMinorUnits,
        })
        .from(reservations)
        .where(
          and(
            eq(reservations.bookingGroupId, reservation.bookingGroupId),
            ne(reservations.status, 'cancelled'),
            ne(reservations.status, 'voided')
          )
        );
      if (groupStays.length > 0) {
        totalAmountMinorUnits = groupStays.reduce((sum, s) => sum + s.totalAmountMinorUnits, 0);
        paidAmountMinorUnits = groupStays.reduce((sum, s) => sum + s.paidAmountMinorUnits, 0);
      }
    }

    return NextResponse.json({
      totalAmountMinorUnits,
      paidAmountMinorUnits,
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
