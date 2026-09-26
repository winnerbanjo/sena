import crypto from 'crypto';
import {
  db,
  idempotencyKeys,
  payments,
  reservationEvents,
  reservations,
  properties,
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
    if (!Number.isSafeInteger(input.amountMinorUnits) || input.amountMinorUnits <= 0) throw new Error('Enter a valid payment amount.');
    return await db.transaction(async (tx) => {
      // Serialize retries and concurrent payments before reading either balance or receipt.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.reservationId}))`);
      // 1. Idempotency Check
      if (idempotencyKey) {
        const existingKey = await tx
          .select()
          .from(idempotencyKeys)
          .where(eq(idempotencyKeys.key, idempotencyKey))
          .limit(1);

        if (existingKey.length > 0) {
          const prior = existingKey[0].responsePayload as unknown as Payment;
          if (prior.reservationId !== input.reservationId) throw new Error('Payment reference already used.');
          return prior;
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

      const property = await tx.query.properties.findFirst({ where: eq(properties.id, res.propertyId) });
      if (!property) throw new Error('Property not found');

      // 3. Insert Payment
      const [payment] = await tx
        .insert(payments)
        .values({
          propertyId: res.propertyId,
          reservationId: input.reservationId,
          amountMinorUnits: input.amountMinorUnits,
          currency: property.currency,
          provider: input.provider,
          providerReference: input.providerReference,
          method: input.method,
          status: 'successful',
          recordedByUserId: actor.id && actor.id !== 'system' ? actor.id : undefined,
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
        actorId: actor.id && actor.id !== 'system' ? actor.id : undefined,
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
    if (!secretKey || !/^[a-f0-9]{128}$/i.test(signature)) return false;
    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(rawPayload)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(signature, 'hex'));
  }
}
