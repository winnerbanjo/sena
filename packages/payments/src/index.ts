import crypto from 'crypto';
import {
  db,
  idempotencyKeys,
  payments,
  properties,
  propertyBankAccounts,
  propertyInvoices,
  reservationEvents,
  reservations,
  transferProofs,
} from '@sena/database';
import type { Payment } from '@sena/types';
import type { RecordPaymentInput } from '@sena/validation';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';

export function folioBalance(totalAmountMinorUnits: number, paidAmountMinorUnits: number) {
  return Math.max(0, Number(totalAmountMinorUnits || 0) - Number(paidAmountMinorUnits || 0));
}

export function financialState(status: string, totalAmountMinorUnits: number, paidAmountMinorUnits: number) {
  const balance = folioBalance(totalAmountMinorUnits, paidAmountMinorUnits);
  if (balance <= 0 && paidAmountMinorUnits > 0) return status === 'checked_out' ? 'settled' : 'paid';
  if (status === 'checked_out' && balance > 0) return 'outstanding';
  if (paidAmountMinorUnits > 0 && balance > 0) return 'partially_paid';
  return 'unpaid';
}

export function settlementLabel(status: string, totalAmountMinorUnits: number, paidAmountMinorUnits: number) {
  switch (financialState(status, totalAmountMinorUnits, paidAmountMinorUnits)) {
    case 'settled':
    case 'paid':
      return 'Settled';
    case 'partially_paid':
      return 'Partially Paid';
    case 'outstanding':
      return 'Outstanding';
    default:
      return 'Balance Due';
  }
}

export type PaymentPolicyErrorCode =
  | 'PAYMENT_REQUIRED_BEFORE_CHECK_IN'
  | 'OUTSTANDING_BALANCE_AUTHORIZATION_REQUIRED'
  | 'SETTLEMENT_REQUIRED_BEFORE_CHECKOUT';

export class PaymentPolicyError extends Error {
  code: PaymentPolicyErrorCode;
  outstandingBalanceMinorUnits: number;
  constructor(code: PaymentPolicyErrorCode, outstandingBalanceMinorUnits: number) {
    super(code);
    this.code = code;
    this.outstandingBalanceMinorUnits = outstandingBalanceMinorUnits;
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function applyPaymentToInvoices(
  tx: Tx,
  reservationId: string,
  amountMinorUnits: number,
  preferredInvoiceId?: string | null
) {
  const [res] = await tx
    .select({ bookingGroupId: reservations.bookingGroupId })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  const invoices = await tx
    .select()
    .from(propertyInvoices)
    .where(
      res?.bookingGroupId
        ? or(
            eq(propertyInvoices.bookingGroupId, res.bookingGroupId),
            eq(propertyInvoices.reservationId, reservationId)
          )
        : eq(propertyInvoices.reservationId, reservationId)
    )
    .for('update');

  const open = invoices.filter((invoice) => !['void', 'draft', 'cancelled'].includes(invoice.status));
  open.sort((a, b) => {
    if (preferredInvoiceId && a.id === preferredInvoiceId) return -1;
    if (preferredInvoiceId && b.id === preferredInvoiceId) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let remaining = amountMinorUnits;
  for (const invoice of open) {
    if (remaining <= 0) break;
    const outstanding = folioBalance(invoice.totalAmountMinorUnits, invoice.paidAmountMinorUnits);
    if (outstanding <= 0) continue;
    const apply = Math.min(remaining, outstanding);
    const paid = invoice.paidAmountMinorUnits + apply;
    await tx
      .update(propertyInvoices)
      .set({
        paidAmountMinorUnits: paid,
        status: paid >= invoice.totalAmountMinorUnits ? 'paid' : 'partially_paid',
        updatedAt: new Date(),
      })
      .where(eq(propertyInvoices.id, invoice.id));
    remaining -= apply;
  }
}

export class PaymentService {
  /**
   * Record a payment (Manual or Paystack) with idempotency protection.
   * Section 60 & 61 of PRD.
   */
  static async recordPayment(
    input: RecordPaymentInput & { invoiceId?: string },
    idempotencyKey?: string,
    actor = { id: '', name: 'Staff' }
  ): Promise<Payment> {
    if (!Number.isSafeInteger(input.amountMinorUnits) || input.amountMinorUnits <= 0) {
      throw new Error('Enter a valid payment amount.');
    }
    return await db.transaction(async (tx) => {
      return PaymentService.recordPaymentInTx(tx, input, idempotencyKey, actor);
    });
  }

  static async recordPaymentInTx(
    tx: Tx,
    input: RecordPaymentInput & { invoiceId?: string },
    idempotencyKey?: string,
    actor = { id: '', name: 'Staff' }
  ): Promise<Payment> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.reservationId}))`);

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

    const resList = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, input.reservationId))
      .limit(1)
      .for('update');

    if (resList.length === 0) {
      throw new Error('Reservation not found');
    }

    const res = resList[0];
    const outstanding = folioBalance(res.totalAmountMinorUnits, res.paidAmountMinorUnits);
    if (input.amountMinorUnits > outstanding) throw new Error('Amount is more than the outstanding balance.');

    const property = await tx.query.properties.findFirst({ where: eq(properties.id, res.propertyId) });
    if (!property) throw new Error('Property not found');
    if (input.invoiceId) {
      const [invoice] = await tx
        .select()
        .from(propertyInvoices)
        .where(eq(propertyInvoices.id, input.invoiceId))
        .limit(1);
      if (!invoice || invoice.propertyId !== res.propertyId) throw new Error('Invoice not found');
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        propertyId: res.propertyId,
        reservationId: input.reservationId,
        invoiceId: input.invoiceId,
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

    await applyPaymentToInvoices(tx, input.reservationId, input.amountMinorUnits, input.invoiceId);

    await tx.insert(reservationEvents).values({
      reservationId: input.reservationId,
      actorId: actor.id && actor.id !== 'system' ? actor.id : undefined,
      actorName: actor.name,
      eventType: 'payment_received',
      description: `Payment of ₦${(input.amountMinorUnits / 100).toLocaleString('en-NG')} received via ${input.method} (${input.provider}).`,
    });

    if (idempotencyKey) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await tx.insert(idempotencyKeys).values({
        key: idempotencyKey,
        action: 'record_payment',
        responsePayload: payment as any,
        expiresAt,
      });
    }

    return payment as unknown as Payment;
  }

  static async submitTransferProof(
    input: {
      propertyId: string;
      reservationId?: string;
      invoiceId?: string;
      amountMinorUnits: number;
      payerName?: string;
      transferReference?: string;
      proofUrl: string;
    },
    actor = { id: '', name: 'Guest' }
  ) {
    if (!Number.isSafeInteger(input.amountMinorUnits) || input.amountMinorUnits <= 0) {
      throw new Error('Enter a valid transfer amount.');
    }
    if (!input.proofUrl?.trim()) throw new Error('Upload proof of transfer.');
    if (!input.reservationId && !input.invoiceId) throw new Error('Choose a reservation or invoice.');

    return db.transaction(async (tx) => {
      const property = await tx.query.properties.findFirst({ where: eq(properties.id, input.propertyId) });
      if (!property) throw new Error('Property not found');

      let reservationId = input.reservationId;
      if (input.invoiceId) {
        const [invoice] = await tx
          .select()
          .from(propertyInvoices)
          .where(eq(propertyInvoices.id, input.invoiceId))
          .limit(1);
        if (!invoice || invoice.propertyId !== input.propertyId) throw new Error('Invoice not found');
        reservationId = reservationId || invoice.reservationId || undefined;
      }

      if (reservationId) {
        const [reservation] = await tx
          .select()
          .from(reservations)
          .where(eq(reservations.id, reservationId))
          .limit(1);
        if (!reservation || reservation.propertyId !== input.propertyId) throw new Error('Reservation not found');
      }

      const [proof] = await tx
        .insert(transferProofs)
        .values({
          propertyId: input.propertyId,
          reservationId,
          invoiceId: input.invoiceId,
          amountMinorUnits: input.amountMinorUnits,
          currency: property.currency,
          payerName: input.payerName?.trim() || null,
          transferReference: input.transferReference?.trim() || null,
          proofUrl: input.proofUrl.trim(),
          status: 'pending',
        })
        .returning();

      if (reservationId) {
        await tx.insert(reservationEvents).values({
          reservationId,
          actorId: actor.id && actor.id !== 'system' ? actor.id : undefined,
          actorName: actor.name,
          eventType: 'transfer_proof_submitted',
          description: `Transfer proof submitted for ₦${(input.amountMinorUnits / 100).toLocaleString('en-NG')}. Pending verification.`,
        });
      }

      return proof;
    });
  }

  static async verifyTransferProof(
    proofId: string,
    propertyId: string,
    actor = { id: '', name: 'Staff' }
  ): Promise<Payment> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`xfer:${proofId}`}))`);
      const [proof] = await tx
        .select()
        .from(transferProofs)
        .where(eq(transferProofs.id, proofId))
        .limit(1)
        .for('update');

      if (!proof || proof.propertyId !== propertyId) throw new Error('Transfer proof not found');
      if (proof.status === 'rejected') throw new Error('This transfer proof was rejected.');
      if (proof.status === 'verified' && proof.paymentId) {
        const [existing] = await tx.select().from(payments).where(eq(payments.id, proof.paymentId)).limit(1);
        if (existing) return existing as unknown as Payment;
      }
      if (!proof.reservationId) throw new Error('This transfer is not linked to a reservation.');

      const payment = await PaymentService.recordPaymentInTx(
        tx,
        {
          reservationId: proof.reservationId,
          invoiceId: proof.invoiceId || undefined,
          amountMinorUnits: proof.amountMinorUnits,
          method: 'bank_transfer',
          provider: 'manual',
          providerReference: `xfer:${proof.id}`,
          notes: proof.transferReference ? `Transfer ${proof.transferReference}` : 'Verified bank transfer',
        },
        `xfer-verify:${proof.id}`,
        actor
      );

      await tx
        .update(transferProofs)
        .set({
          status: 'verified',
          paymentId: payment.id,
          reviewedAt: new Date(),
          reviewedByUserId: actor.id && actor.id !== 'system' ? actor.id : undefined,
        })
        .where(eq(transferProofs.id, proof.id));

      await tx.insert(reservationEvents).values({
        reservationId: proof.reservationId,
        actorId: actor.id && actor.id !== 'system' ? actor.id : undefined,
        actorName: actor.name,
        eventType: 'transfer_verified',
        description: `Bank transfer of ₦${(proof.amountMinorUnits / 100).toLocaleString('en-NG')} verified.`,
      });

      return payment;
    });
  }

  static async rejectTransferProof(
    proofId: string,
    propertyId: string,
    actor = { id: '', name: 'Staff' },
    staffNote?: string
  ) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`xfer:${proofId}`}))`);
      const [proof] = await tx
        .select()
        .from(transferProofs)
        .where(eq(transferProofs.id, proofId))
        .limit(1)
        .for('update');

      if (!proof || proof.propertyId !== propertyId) throw new Error('Transfer proof not found');
      if (proof.status === 'verified') throw new Error('A verified transfer cannot be rejected.');
      if (proof.status === 'rejected') return proof;

      const [updated] = await tx
        .update(transferProofs)
        .set({
          status: 'rejected',
          staffNote: staffNote?.trim() || null,
          reviewedAt: new Date(),
          reviewedByUserId: actor.id && actor.id !== 'system' ? actor.id : undefined,
        })
        .where(eq(transferProofs.id, proof.id))
        .returning();

      if (proof.reservationId) {
        await tx.insert(reservationEvents).values({
          reservationId: proof.reservationId,
          actorId: actor.id && actor.id !== 'system' ? actor.id : undefined,
          actorName: actor.name,
          eventType: 'transfer_rejected',
          description: 'Bank transfer proof was rejected. Balance is unchanged.',
        });
      }

      return updated;
    });
  }

  static async listBankAccounts(propertyId: string) {
    return db
      .select()
      .from(propertyBankAccounts)
      .where(eq(propertyBankAccounts.propertyId, propertyId))
      .orderBy(desc(propertyBankAccounts.isPrimary), propertyBankAccounts.createdAt);
  }

  static async listPublicBankAccounts(propertyId: string) {
    const accounts = await PaymentService.listBankAccounts(propertyId);
    return accounts.map((account) => ({
      accountName: account.accountName,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      currency: account.currency,
      isPrimary: account.isPrimary,
    }));
  }

  static async createBankAccount(
    propertyId: string,
    input: { accountName: string; bankName: string; accountNumber: string; currency: string; isPrimary?: boolean }
  ) {
    const accountName = input.accountName.trim();
    const bankName = input.bankName.trim();
    const accountNumber = input.accountNumber.replace(/\s+/g, '');
    const currency = input.currency.trim().toUpperCase();
    if (!accountName || !bankName || !accountNumber || !/^[A-Z]{3}$/.test(currency)) {
      throw new Error('Enter account name, bank, account number, and a 3-letter currency.');
    }

    return db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(propertyBankAccounts)
        .where(eq(propertyBankAccounts.propertyId, propertyId));
      const isPrimary = input.isPrimary === true || existing.length === 0;
      if (isPrimary) {
        await tx
          .update(propertyBankAccounts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(propertyBankAccounts.propertyId, propertyId));
      }
      const [account] = await tx
        .insert(propertyBankAccounts)
        .values({
          propertyId,
          accountName,
          bankName,
          accountNumber,
          currency,
          isPrimary,
        })
        .returning();
      return account;
    });
  }

  static async updateBankAccount(
    propertyId: string,
    accountId: string,
    input: { accountName?: string; bankName?: string; accountNumber?: string; currency?: string; isPrimary?: boolean }
  ) {
    return db.transaction(async (tx) => {
      const [account] = await tx
        .select()
        .from(propertyBankAccounts)
        .where(and(eq(propertyBankAccounts.id, accountId), eq(propertyBankAccounts.propertyId, propertyId)))
        .limit(1)
        .for('update');
      if (!account) throw new Error('Bank account not found');

      if (input.isPrimary) {
        await tx
          .update(propertyBankAccounts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(and(eq(propertyBankAccounts.propertyId, propertyId), ne(propertyBankAccounts.id, accountId)));
      }

      const [updated] = await tx
        .update(propertyBankAccounts)
        .set({
          accountName: input.accountName?.trim() || account.accountName,
          bankName: input.bankName?.trim() || account.bankName,
          accountNumber: input.accountNumber ? input.accountNumber.replace(/\s+/g, '') : account.accountNumber,
          currency: input.currency ? input.currency.trim().toUpperCase() : account.currency,
          isPrimary: input.isPrimary === undefined ? account.isPrimary : input.isPrimary,
          updatedAt: new Date(),
        })
        .where(eq(propertyBankAccounts.id, accountId))
        .returning();
      return updated;
    });
  }

  static async deleteBankAccount(propertyId: string, accountId: string) {
    return db.transaction(async (tx) => {
      const [account] = await tx
        .select()
        .from(propertyBankAccounts)
        .where(and(eq(propertyBankAccounts.id, accountId), eq(propertyBankAccounts.propertyId, propertyId)))
        .limit(1);
      if (!account) throw new Error('Bank account not found');
      await tx.delete(propertyBankAccounts).where(eq(propertyBankAccounts.id, accountId));
      if (account.isPrimary) {
        const [next] = await tx
          .select()
          .from(propertyBankAccounts)
          .where(eq(propertyBankAccounts.propertyId, propertyId))
          .orderBy(propertyBankAccounts.createdAt)
          .limit(1);
        if (next) {
          await tx
            .update(propertyBankAccounts)
            .set({ isPrimary: true, updatedAt: new Date() })
            .where(eq(propertyBankAccounts.id, next.id));
        }
      }
    });
  }

  static async primaryBankDetails(propertyId: string) {
    const accounts = await PaymentService.listBankAccounts(propertyId);
    const primary = accounts.find((account) => account.isPrimary) || accounts[0];
    if (!primary) return null;
    return {
      bankName: primary.bankName,
      accountName: primary.accountName,
      accountNumber: primary.accountNumber,
      currency: primary.currency,
    };
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
