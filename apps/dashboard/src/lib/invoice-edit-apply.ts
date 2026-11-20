import { activityLogs, and, db, eq, propertyInvoices } from '@sena/database';
import { BELOW_PAID, planInvoiceEdit, type EditableInvoice, type InvoiceEditInput } from './invoice-edit';

export interface InvoiceEditActor {
  userId: string;
  fullName: string;
}

export type InvoiceEditResult =
  | { ok: false; status: number; error: string }
  | { ok: true; invoice: typeof propertyInvoices.$inferSelect };

/**
 * Apply a staff invoice edit inside one transaction.
 *
 * The invoice row is locked (scoped by property) before the edit is planned, so
 * the paid-amount floor and the status decision are made against the same
 * version of the row that is written. A concurrent payment can no longer move
 * `paidAmountMinorUnits` between the check and the update.
 */
export async function applyInvoiceEdit(input: {
  propertyId: string;
  invoiceId: string;
  body: InvoiceEditInput;
  actor: InvoiceEditActor;
}): Promise<InvoiceEditResult> {
  return db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(propertyInvoices)
      .where(and(eq(propertyInvoices.id, input.invoiceId), eq(propertyInvoices.propertyId, input.propertyId)))
      .for('update');

    if (!invoice) {
      return { ok: false as const, status: 404, error: 'Invoice not found' };
    }

    const planned = planInvoiceEdit(invoice as unknown as EditableInvoice, input.body);
    if (!planned.ok) return planned;

    // Re-check the commercial floor against the locked row. planInvoiceEdit
    // already compares against the row it read, and that row is this one.
    const nextTotal = planned.patch.totalAmountMinorUnits;
    if (nextTotal !== undefined && nextTotal < invoice.paidAmountMinorUnits) {
      return { ok: false as const, status: 409, error: BELOW_PAID };
    }

    const [updated] = await tx
      .update(propertyInvoices)
      .set(planned.patch)
      .where(and(eq(propertyInvoices.id, input.invoiceId), eq(propertyInvoices.propertyId, input.propertyId)))
      .returning();

    if (planned.changes.length) {
      await tx.insert(activityLogs).values({
        organizationId: invoice.organizationId,
        propertyId: invoice.propertyId,
        actorId: input.actor.userId,
        actorName: input.actor.fullName || 'Staff',
        action: 'invoice.updated',
        resource: 'invoice',
        resourceId: invoice.id,
        previousValue: Object.fromEntries(planned.changes.map((change) => [change.field, change.from])),
        newValue: Object.fromEntries(planned.changes.map((change) => [change.field, change.to])),
      });
    }

    return { ok: true as const, invoice: updated };
  });
}
