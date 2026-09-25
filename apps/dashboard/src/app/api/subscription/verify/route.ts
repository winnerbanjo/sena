import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, subscriptions, subscriptionInvoices, organizations, properties, eq, desc } from '@sena/database';
import { sendSenaEmail } from '@sena/email';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'Transaction reference is required' }, { status: 400 });
    }

    // 1. Verify transaction with Paystack API
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const verifyData = await paystackRes.json();

    if (!paystackRes.ok || !verifyData.status || verifyData.data?.status !== 'success') {
      return NextResponse.json(
        { error: verifyData.data?.gateway_response || verifyData.message || 'Payment verification failed' },
        { status: 400 }
      );
    }

    const txData = verifyData.data;
    const metadata = txData.metadata || {};
    const plan = metadata.plan || 'growth';
    const billingCycle = metadata.billingCycle || 'monthly';
    const amountMinorUnits = txData.amount; // Kobo

    // 2. Resolve Organization & Property
    let orgId = metadata.organizationId;
    if (!orgId) {
      const firstOrg = await db.query.organizations.findFirst();
      orgId = firstOrg?.id;
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    const prop = await db.query.properties.findFirst();

    const roomLimits: Record<string, number> = {
      essential: 10,
      growth: 30,
      pro: 100,
    };
    const roomLimit = roomLimits[plan] || 30;

    const now = new Date();
    const periodEnd = new Date(now.getTime() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);

    // 3. Update or Insert Subscription in DB
    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId))
      .limit(1);

    let savedSub;

    if (existing.length > 0) {
      const [updated] = await db
        .update(subscriptions)
        .set({
          plan,
          billingCycle,
          status: 'active',
          trialEndDate: now, // Trial finished, now officially paid active
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          roomLimit,
          amountMinorUnits,
          paystackCustomerCode: txData.customer?.customer_code || null,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing[0].id))
        .returning();
      savedSub = updated;
    } else {
      const [created] = await db
        .insert(subscriptions)
        .values({
          organizationId: orgId,
          propertyId: prop?.id || null,
          plan,
          billingCycle,
          status: 'active',
          trialStartDate: now,
          trialEndDate: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          roomLimit,
          amountMinorUnits,
          paystackCustomerCode: txData.customer?.customer_code || null,
        })
        .returning();
      savedSub = created;
    }

    // 4. Record Subscription Invoice
    const invoiceNumber = `INV-${reference}`;
    const existingInvoice = await db.query.subscriptionInvoices.findFirst({
      where: eq(subscriptionInvoices.invoiceNumber, invoiceNumber),
    });

    if (!existingInvoice) {
      await db.insert(subscriptionInvoices).values({
        subscriptionId: savedSub.id,
        organizationId: orgId,
        invoiceNumber,
        amountMinorUnits,
        currency: 'NGN',
        status: 'paid',
        plan,
        billingPeriod: `${billingCycle === 'yearly' ? 'Annual' : 'Monthly'} Subscription (${now.toLocaleDateString('en-NG')} – ${periodEnd.toLocaleDateString('en-NG')})`,
        paymentMethod: `Card (Paystack · ${txData.channel || 'online'})`,
        paidAt: new Date(txData.paid_at || now),
      });
    }

    // 5. Trigger Transactional Email
    const userEmail = txData.customer?.email || metadata.userEmail || 'owner@sena.ng';
    const planDisplayNames: Record<string, string> = {
      essential: 'Essential',
      growth: 'Growth',
      pro: 'Pro',
    };

    try {
      await sendSenaEmail(
        'subscription.upgraded',
        {
          userName: org?.name || 'Property Owner',
          organizationName: org?.name || 'Your Hospitality Group',
          previousPlan: existing[0]?.plan || 'Trial',
          newPlan: `${planDisplayNames[plan] || 'Growth'} (${billingCycle === 'yearly' ? 'Annual' : 'Monthly'})`,
          effectiveDate: now.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }),
          newAmountFormatted: `₦${(amountMinorUnits / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
        },
        {
          to: userEmail,
          organizationId: orgId,
          idempotencyKey: `sub_upgraded_${reference}`,
        }
      );
    } catch (emailErr) {
      console.warn('[SUBSCRIPTION EMAIL ERROR]', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${plan.toUpperCase()} tier!`,
      subscription: savedSub,
    });
  } catch (error: any) {
    console.error('Subscription verification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
