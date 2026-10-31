import { apiError } from '@/lib/api-error';
import { planInvoiceEdit } from '@/lib/invoice-edit';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { activityLogs, db, eq, propertyInvoices } from '@sena/database';

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const merchant = getMerchantRequest(req);
    const body = merchant?.body ?? (await req.json().catch(() => ({})));

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { error: 'A detailed justification (at least 5 characters) is required to amend an invoice.' },
        { status: 400 }
      );
    }

    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.id, invoiceId),
    });

    if (!invoice || !merchant || invoice.propertyId !== merchant.tenant.propertyId) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    const planned = planInvoiceEdit(invoice, body);
    if (!planned.ok) {
      return NextResponse.json({ error: planned.error }, { status: planned.status });
    }

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(propertyInvoices)
        .set(planned.patch)
        .where(eq(propertyInvoices.id, invoiceId))
        .returning();

      await tx.insert(activityLogs).values({
        organizationId: invoice.organizationId,
        propertyId: invoice.propertyId,
        actorId: merchant.tenant.userId,
        actorName: merchant.tenant.user.fullName || 'Administrator',
        action: 'invoice.amended',
        resource: 'invoice',
        resourceId: invoice.id,
        previousValue: Object.fromEntries(planned.changes.map((change) => [change.field, change.from])),
        newValue: {
          ...Object.fromEntries(planned.changes.map((change) => [change.field, change.to])),
          reason,
        },
      });

      return [row];
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice amended successfully.',
      invoice: updated,
    });
  } catch (error: any) {
    console.error('[INVOICE AMEND ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'invoice-amend');
