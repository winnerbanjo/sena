import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, subscriptions, subscriptionInvoices, organizations, properties, rooms, propertyMembers, organizationMembers, eq, desc } from '@sena/database';
import { sendSenaEmail } from '@sena/email';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    // Find first organization for user/system
    const org = await db.query.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ subscription: null, trialDaysLeft: 3 });
    }

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, org.id))
      .limit(1);

    const roomCount = await db
      .select()
      .from(rooms)
      .then((res) => res.length)
      .catch(() => 0);

    const invoices = await db
      .select()
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.organizationId, org.id))
      .orderBy(desc(subscriptionInvoices.createdAt))
      .limit(10);

    if (!sub) {
      return NextResponse.json({
        subscription: null,
        trialDaysLeft: 3,
        isTrialing: true,
        roomCount,
        invoices: [],
      });
    }

    const now = Date.now();
    const trialEndMs = new Date(sub.trialEndDate).getTime();
    const trialDaysLeft = Math.max(0, Math.ceil((trialEndMs - now) / (1000 * 60 * 60 * 24)));
    const isExpired = sub.status === 'trialing' && trialDaysLeft <= 0;

    return NextResponse.json({
      subscription: sub,
      trialDaysLeft,
      isTrialing: sub.status === 'trialing',
      isExpired,
      roomCount,
      invoices,
    });
  } catch (error: any) {
    console.error('Subscription GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { plan = 'growth', billingCycle = 'monthly' } = body;

    const org = await db.query.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const prop = await db.query.properties.findFirst();

    const roomLimits: Record<string, number> = {
      essential: 10,
      growth: 30,
      pro: 100,
    };

    const pricesMonthly: Record<string, number> = {
      essential: 2500000, // ₦25,000 in kobo
      growth: 5000000,    // ₦50,000 in kobo
      pro: 10000000,     // ₦100,000 in kobo
    };

    const pricesYearly: Record<string, number> = {
      essential: 25000000, // ₦250,000 in kobo
      growth: 50000000,    // ₦500,000 in kobo
      pro: 100000000,     // ₦1,000,000 in kobo
    };

    const now = new Date();
    // EXACTLY 3 DAYS FREE TRIAL
    const trialEndDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const periodEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const roomLimit = roomLimits[plan] || 30;
    const amountMinorUnits = billingCycle === 'yearly' ? pricesYearly[plan] || 50000000 : pricesMonthly[plan] || 5000000;

    // Check if subscription exists for this organization
    const existing = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, org.id))
      .limit(1);

    let savedSub;

    if (existing.length > 0) {
      const [updated] = await db
        .update(subscriptions)
        .set({
          plan,
          billingCycle,
          status: 'trialing',
          trialStartDate: now,
          trialEndDate,
          roomLimit,
          amountMinorUnits,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing[0].id))
        .returning();
      savedSub = updated;
    } else {
      const [created] = await db
        .insert(subscriptions)
        .values({
          organizationId: org.id,
          propertyId: prop?.id || null,
          plan,
          billingCycle,
          status: 'trialing',
          trialStartDate: now,
          trialEndDate,
          currentPeriodStart: now,
          currentPeriodEnd: periodEndDate,
          roomLimit,
          amountMinorUnits,
        })
        .returning();
      savedSub = created;
    }

    // Send subscription activated transactional email asynchronously
    const userEmail = session?.user?.email || 'winner@sena.ng';
    const userName = session?.user?.name || 'Property Owner';
    const planDisplayNames: Record<string, string> = {
      essential: 'Essential',
      growth: 'Growth',
      pro: 'Pro',
    };

    try {
      await sendSenaEmail(
        'subscription.activated',
        {
          userName,
          organizationName: org.name,
          planName: `${planDisplayNames[plan] || 'Growth'} (3-Day Free Trial)`,
          billingCycle,
          amountFormatted: `₦${(amountMinorUnits / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })} / ${billingCycle === 'yearly' ? 'year' : 'month'}`,
          roomLimit,
          nextBillingDate: trialEndDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }),
        },
        {
          to: userEmail,
          organizationId: org.id,
          idempotencyKey: `sub_activated_${savedSub.id}_${Date.now()}`,
        }
      );
    } catch (emailErr) {
      console.warn('[SUBSCRIPTION EMAIL ERROR]', emailErr);
    }

    return NextResponse.json({
      success: true,
      subscription: savedSub,
      message: '3-Day free trial activated successfully.',
    });
  } catch (error: any) {
    console.error('Subscription POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
