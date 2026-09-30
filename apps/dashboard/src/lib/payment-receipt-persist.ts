import { activityLogs, and, db, eq, paymentReceipts } from '@sena/database';
import { deleteMediaFromSpaces, uploadMediaToSpaces } from '@sena/integrations';
import { storePaymentReceipt, type ReceiptFileInput } from './payment-receipt-file';

/** One private Spaces object per payment receipt. Evidence only; callers record the payment first. */
export async function persistPaymentReceipt(args: {
  propertyId: string;
  paymentId: string;
  userId: string;
  actorName: string;
  organizationId: string;
  file: ReceiptFileInput;
}) {
  return storePaymentReceipt({
    propertyId: args.propertyId,
    paymentId: args.paymentId,
    receiptId: crypto.randomUUID(),
    userId: args.userId,
    actorName: args.actorName,
    file: args.file,
    alreadyAttached: async () => Boolean(await db.query.paymentReceipts.findFirst({
      where: and(eq(paymentReceipts.paymentId, args.paymentId), eq(paymentReceipts.propertyId, args.propertyId)),
    })),
    upload: async (storageKey, bytes, contentType) => uploadMediaToSpaces({
      key: storageKey,
      body: Buffer.from(bytes),
      contentType,
      acl: 'private',
    }),
    remove: async (storageKey) => {
      await deleteMediaFromSpaces(storageKey);
    },
    insert: async (row) => {
      await db.insert(paymentReceipts).values(row);
    },
    audit: async (row) => {
      await db.insert(activityLogs).values({
        organizationId: args.organizationId,
        propertyId: args.propertyId,
        actorId: row.actorId,
        actorName: row.actorName,
        action: 'payment_receipt_attached',
        resource: 'payment',
        resourceId: row.paymentId,
        newValue: { receiptId: row.receiptId, filename: row.filename },
      });
    },
  });
}
