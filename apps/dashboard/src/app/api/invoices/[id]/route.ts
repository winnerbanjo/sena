import { createPublicInvoiceToken } from '@/lib/public-invoice-token';
import { apiError } from '@/lib/api-error';
import { planInvoiceEdit } from '@/lib/invoice-edit';
import { loadInvoicePresentation } from '@/lib/invoice-presentation';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import {
  activityLogs,
  db,
  eq,
  propertyInvoices,
  properties,
  reservations,
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

    const document = await loadInvoicePresentation(invoice.id, 'staff');

    return NextResponse.json({
      invoice: { ...invoice, publicToken: createPublicInvoiceToken(invoice.id) },
      property: prop,
      reservation,
      document: document
        ? {
            property: document.property,
            reservation: document.reservation,
            payments: document.payments,
          }
        : null,
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
    const merchant = getMerchantRequest(req);
    const body = merchant?.body ?? {};

    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.id, id),
    });

    if (!invoice || !merchant || invoice.propertyId !== merchant.tenant.propertyId) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const planned = planInvoiceEdit(invoice, body);
    if (!planned.ok) {
      return NextResponse.json({ error: planned.error }, { status: planned.status });
    }

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(propertyInvoices)
        .set(planned.patch)
        .where(eq(propertyInvoices.id, id))
        .returning();
      if (planned.changes.length) {
        await tx.insert(activityLogs).values({
          organizationId: invoice.organizationId,
          propertyId: invoice.propertyId,
          actorId: merchant.tenant.userId,
          actorName: merchant.tenant.user.fullName || 'Staff',
          action: 'invoice.updated',
          resource: 'invoice',
          resourceId: invoice.id,
          previousValue: Object.fromEntries(planned.changes.map((change) => [change.field, change.from])),
          newValue: Object.fromEntries(planned.changes.map((change) => [change.field, change.to])),
        });
      }
      return [row];
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: { ...updated, publicToken: createPublicInvoiceToken(updated.id) },
    });
  } catch (error: any) {
    console.error('[INVOICE PATCH ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handleDELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const merchant = getMerchantRequest(req);
    if (!merchant?.tenant.propertyId) {
      return NextResponse.json({ error: 'Property not found for user session' }, { status: 403 });
    }

    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.id, id),
    });

    if (!invoice || invoice.propertyId !== merchant.tenant.propertyId) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft invoices can be deleted. Void issued or overdue invoices instead.' },
        { status: 400 },
      );
    }

    if (invoice.paidAmountMinorUnits > 0) {
      return NextResponse.json(
        { error: 'Cannot delete an invoice with recorded payments.' },
        { status: 409 },
      );
    }

    await db.transaction(async (tx) => {
      await tx.delete(propertyInvoices).where(eq(propertyInvoices.id, id));

      await tx.insert(activityLogs).values({
        organizationId: invoice.organizationId,
        propertyId: invoice.propertyId,
        actorId: merchant.tenant.userId,
        actorName: merchant.tenant.user.fullName || 'Staff',
        action: 'invoice.deleted',
        resource: 'invoice',
        resourceId: invoice.id,
        previousValue: {
          invoiceNumber: invoice.invoiceNumber,
          totalAmountMinorUnits: invoice.totalAmountMinorUnits,
          status: invoice.status,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Draft invoice ${invoice.invoiceNumber} deleted successfully`,
    });
  } catch (error: any) {
    console.error('[INVOICE DELETE ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'invoices');

export const PATCH = withMerchant(handlePATCH, 'invoices');

export const DELETE = withMerchant(handleDELETE, 'invoice-delete');
