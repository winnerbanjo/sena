import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  propertyInvoices,
  properties,
  reservations,
  guests,
  eq,
} from '@sena/database';

async function handleGET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.id, id),
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
      invoice,
      property: prop,
      reservation,
    });
  } catch (error: any) {
    console.error('[INVOICE DETAIL GET ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.id, id),
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const updates: Partial<typeof propertyInvoices.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.status !== undefined && body.status !== invoice.status) {
      return NextResponse.json({ error: 'Invoice payment status changes only when a payment is recorded.' }, { status: 400 });
    }
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.paymentTerms !== undefined) updates.paymentTerms = body.paymentTerms;
    if (body.dueDate) updates.dueDate = body.dueDate;

    const [updated] = await db
      .update(propertyInvoices)
      .set(updates)
      .where(eq(propertyInvoices.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: updated,
    });
  } catch (error: any) {
    console.error('[INVOICE PATCH ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'invoices');

export const PATCH = withMerchant(handlePATCH, 'invoices');
