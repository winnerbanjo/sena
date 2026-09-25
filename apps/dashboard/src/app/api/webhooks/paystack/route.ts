import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@sena/payments';
import { db, idempotencyKeys, reservations, guests, properties, subscriptions, subscriptionInvoices, eq } from '@sena/database';
import { sendPaymentReceiptEmail, sendSenaEmail } from '@sena/email';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing x-paystack-signature' }, { status: 401 });
    }

    // 1. Verify HMAC SHA512 signature
    const isValid = PaymentService.verifyWebhookSignature(
      signature,
      rawBody,
      PAYSTACK_SECRET_KEY
    );

    if (!isValid) {
      console.error('[PAYSTACK WEBHOOK] Invalid signature');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const eventReference = event.data?.reference || `evt_${Date.now()}`;
    const idempotencyKey = `paystack_webhook_${eventReference}`;

    // 2. Check idempotency
    const existing = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, idempotencyKey))
      .limit(1);

    if (existing.length > 0) {
      console.log('[PAYSTACK WEBHOOK] Already processed event:', idempotencyKey);
      return NextResponse.json({ status: 'already_processed' }, { status: 200 });
    }

    // 3. Process charge.success
    if (eventType === 'charge.success') {
      const data = event.data;
      const reservationId = data.metadata?.reservationId;
      const amountMinorUnits = data.amount; // Paystack gives kobo directly

      if (reservationId) {
        await PaymentService.recordPayment(
          {
            reservationId,
            amountMinorUnits,
            provider: 'paystack',
            providerReference: data.reference,
            method: 'card',
            notes: `Paystack online payment. Channel: ${data.channel}. Paid at: ${data.paid_at}`,
          },
          idempotencyKey,
          { id: 'system', name: 'Paystack Webhook' }
        );

        // Send payment receipt to guest
        try {
          const [resRecord] = await db
            .select({
              reference: reservations.reference,
              guestName: guests.fullName,
              guestEmail: guests.email,
              propertyName: properties.name,
              propertyPhone: properties.phone,
              propertyEmail: properties.email,
            })
            .from(reservations)
            .innerJoin(guests, eq(reservations.guestId, guests.id))
            .innerJoin(properties, eq(reservations.propertyId, properties.id))
            .where(eq(reservations.id, reservationId))
            .limit(1);

          if (resRecord?.guestEmail) {
            await sendPaymentReceiptEmail({
              guestEmail: resRecord.guestEmail,
              guestName: resRecord.guestName,
              reference: resRecord.reference,
              paymentReference: data.reference,
              propertyName: resRecord.propertyName,
              amountFormatted: `₦${(amountMinorUnits / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
              paymentMethod: `Card (Paystack · ${data.channel || 'online'})`,
              paidAt: new Date(data.paid_at || Date.now()).toLocaleString('en-NG'),
            });
          }
        } catch (receiptErr) {
          console.warn('[PAYSTACK RECEIPT EMAIL ERROR]', receiptErr);
        }
      }

      // Handle SaaS Subscription Upgrade/Payment
      if (data.metadata?.type === 'subscription_upgrade') {
        const metadata = data.metadata;
        const plan = metadata.plan || 'growth';
        const billingCycle = metadata.billingCycle || 'monthly';
        const orgId = metadata.organizationId;

        if (orgId) {
          const roomLimits: Record<string, number> = { essential: 10, growth: 30, pro: 100 };
          const roomLimit = roomLimits[plan] || 30;
          const now = new Date();
          const periodEnd = new Date(now.getTime() + (billingCycle === 'yearly' ? 365 : 30) * 86400000);

          const existingSub = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.organizationId, orgId))
            .limit(1);

          let subId: string;
          if (existingSub.length > 0) {
            await db
              .update(subscriptions)
              .set({
                plan,
                billingCycle,
                status: 'active',
                trialEndDate: now,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                roomLimit,
                amountMinorUnits,
                paystackCustomerCode: data.customer?.customer_code || null,
                updatedAt: now,
              })
              .where(eq(subscriptions.id, existingSub[0].id));
            subId = existingSub[0].id;
          } else {
            const [created] = await db
              .insert(subscriptions)
              .values({
                organizationId: orgId,
                plan,
                billingCycle,
                status: 'active',
                trialStartDate: now,
                trialEndDate: now,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                roomLimit,
                amountMinorUnits,
                paystackCustomerCode: data.customer?.customer_code || null,
              })
              .returning();
            subId = created.id;
          }

          // Record Invoice
          const invoiceNumber = `INV-${data.reference}`;
          await db
            .insert(subscriptionInvoices)
            .values({
              subscriptionId: subId,
              organizationId: orgId,
              invoiceNumber,
              amountMinorUnits,
              currency: 'NGN',
              status: 'paid',
              plan,
              billingPeriod: `${billingCycle === 'yearly' ? 'Annual' : 'Monthly'} Subscription (${now.toLocaleDateString('en-NG')} – ${periodEnd.toLocaleDateString('en-NG')})`,
              paymentMethod: `Card (Paystack · ${data.channel || 'online'})`,
              paidAt: new Date(data.paid_at || now),
            })
            .onConflictDoNothing();
        }
      }
    }

    // Record idempotency record
    await db
      .insert(idempotencyKeys)
      .values({
        key: idempotencyKey,
        action: 'paystack_webhook',
        responsePayload: { status: 'success', event: eventType },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .onConflictDoNothing();

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('[PAYSTACK WEBHOOK ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
