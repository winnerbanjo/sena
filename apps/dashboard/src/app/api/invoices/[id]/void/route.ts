import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { activityLogs, db, eq, propertyInvoices } from '@sena/database';
import { createPublicInvoiceToken } from '@/lib/public-invoice-token';

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const merchant = getMerchantRequest(req);
    if (!merchant?.tenant.propertyId) {
      return NextResponse.json({ error: 'Property not found for user session' }, { status: 403 });
    }

    const body = merchant.body || {};
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length < 3) {
      return NextResponse.json(
        { error: 'A void reason is required (at least 3 characters).' },
        { status: 422 },
      );
    }

    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.id, id),
    });

    if (!invoice || invoice.propertyId !== merchant.tenant.propertyId) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'void') {
      return NextResponse.json({ error: 'This invoice has already been voided.' }, { status: 400 });
    }

    if (invoice.paidAmountMinorUnits > 0 || invoice.status === 'paid' || invoice.status === 'partially_paid') {
      return NextResponse.json(
        { error: 'Cannot void an invoice with recorded payments. Process a refund or settlement adjustment first.' },
        { status: 409 },
      );
    }

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(propertyInvoices)
        .set({
          status: 'void',
          voidReason: reason,
          voidedAt: new Date(),
          voidedByUserId: merchant.tenant.userId,
          updatedAt: new Date(),
        })
        .where(eq(propertyInvoices.id, id))
        .returning();

      await tx.insert(activityLogs).values({
        organizationId: invoice.organizationId,
        propertyId: invoice.propertyId,
        actorId: merchant.tenant.userId,
        actorName: merchant.tenant.user.fullName || 'Staff',
        action: 'invoice.voided',
        resource: 'invoice',
        resourceId: invoice.id,
        previousValue: { status: invoice.status },
        newValue: { status: 'void', voidReason: reason },
      });

      return [row];
    });

    return NextResponse.json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} voided successfully`,
      invoice: {
        ...updated,
        publicToken: createPublicInvoiceToken(updated.id),
      },
    });
  } catch (error: any) {
    console.error('[INVOICE VOID ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const POST = withMerchant(handlePOST, 'invoice-void');
