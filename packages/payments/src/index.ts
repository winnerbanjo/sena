import crypto from 'crypto';
import {
  db,
  idempotencyKeys,
  payments,
  reservationEvents,
  reservations,
} from '@sena/database';
import type { Payment } from '@sena/types';
import type { RecordPaymentInput } from '@sena/validation';
import { eq, sql } from 'drizzle-orm';

export class PaymentService {
  /**
   * Record a payment (Manual or Paystack) with idempotency protection.
   * Section 60 & 61 of PRD.
   */
  static async recordPayment(
    input: RecordPaymentInput,
    idempotencyKey?: string,
    actor = { id: '', name: 'Staff' }
  ): Promise<Payment> {
    return await db.transaction(async (tx) => {
      // 1. Idempotency Check
      if (idempotencyKey) {
        const existingKey = await tx
          .select()
          .from(idempotencyKeys)
          .where(eq(idempotencyKeys.key, idempotencyKey))
          .limit(1);

        if (existingKey.length > 0) {
          return existingKey[0].responsePayload as unknown as Payment;
        }
      }

      // 2. Fetch Reservation
      const resList = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, input.reservationId))
        .limit(1);

      if (resList.length === 0) {
        throw new Error('Reservation not found');
      }

      const res = resList[0];

      // 3. Insert Payment
      const [payment] = await tx
        .insert(payments)
        .values({
          propertyId: res.propertyId,
          reservationId: input.reservationId,
          amountMinorUnits: input.amountMinorUnits,
          currency: 'NGN',
          provider: input.provider,
          providerReference: input.providerReference,
          method: input.method,
          status: 'successful',
          recordedByUserId: actor.id || undefined,
          notes: input.notes,
        })
        .returning();

      // 4. Update Reservation Paid Amount & Payment Status
      const newPaidAmount = res.paidAmountMinorUnits + input.amountMinorUnits;
      const newPaymentStatus =
        newPaidAmount >= res.totalAmountMinorUnits
          ? 'paid'
          : newPaidAmount > 0
          ? 'part_payment'
          : 'pay_later';

      await tx
        .update(reservations)
        .set({
          paidAmountMinorUnits: newPaidAmount,
          paymentStatus: newPaymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, input.reservationId));

      // 5. Audit Timeline Event
      await tx.insert(reservationEvents).values({
        reservationId: input.reservationId,
        actorId: actor.id || undefined,
        actorName: actor.name,
        eventType: 'payment_received',
        description: `Payment of ₦${(input.amountMinorUnits / 100).toLocaleString('en-NG')} received via ${input.method} (${input.provider}).`,
      });

      // 6. Record Idempotency Key
      if (idempotencyKey) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await tx.insert(idempotencyKeys).values({
          key: idempotencyKey,
          action: 'record_payment',
          responsePayload: payment as any,
          expiresAt,
        });
      }

      return payment as unknown as Payment;
    });
  }

  /**
   * Verify Paystack Webhook Signature
   */
  static verifyWebhookSignature(
    signature: string,
    rawPayload: string,
    secretKey: string
  ): boolean {
    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(rawPayload)
      .digest('hex');
    return hash === signature;
  }
}
