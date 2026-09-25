import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, organizations, properties, users, eq } from '@sena/database';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { plan = 'growth', billingCycle = 'monthly' } = body;

    if (!['essential', 'growth', 'pro'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 });
    }

    // Resolve Organization & Property
    const org = await db.query.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const prop = await db.query.properties.findFirst();

    // User email for Paystack customer
    let userEmail = session?.user?.email;
    if (!userEmail) {
      const ownerUser = await db.query.users.findFirst();
      userEmail = ownerUser?.email || 'owner@sena.ng';
    }

    // Amounts in Kobo
    const pricesMonthly: Record<string, number> = {
      essential: 2500000, // ₦25,000
      growth: 5000000,    // ₦50,000
      pro: 10000000,     // ₦100,000
    };

    const pricesYearly: Record<string, number> = {
      essential: 25000000, // ₦250,000
      growth: 50000000,    // ₦500,000
      pro: 100000000,     // ₦1,000,000
    };

    const amountKobo = billingCycle === 'yearly' ? pricesYearly[plan] : pricesMonthly[plan];

    // Determine host for callback
    const host = req.headers.get('host') || 'app.sena.ng';
    const proto = host.includes('localhost') ? 'http' : 'https';
    const callbackUrl = `${proto}://${host}/billing?verified=true`;

    const reference = `SUB-${plan.toUpperCase()}-${Date.now()}`;

    // Call Paystack Transaction Initialize
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        amount: amountKobo,
        currency: 'NGN',
        reference,
        callback_url: callbackUrl,
        metadata: {
          type: 'subscription_upgrade',
          organizationId: org.id,
          propertyId: prop?.id,
          plan,
          billingCycle,
          userEmail,
          custom_fields: [
            {
              display_name: 'Operating Tier',
              variable_name: 'plan',
              value: plan.toUpperCase(),
            },
            {
              display_name: 'Billing Cycle',
              variable_name: 'billing_cycle',
              value: billingCycle,
            },
            {
              display_name: 'Property',
              variable_name: 'property_name',
              value: prop?.name || 'Your Property',
            },
          ],
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      console.error('[PAYSTACK INIT ERROR]', paystackData);
      return NextResponse.json(
        { error: paystackData.message || 'Failed to initialize Paystack checkout' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      authorizationUrl: paystackData.data.authorization_url,
      accessCode: paystackData.data.access_code,
      reference: paystackData.data.reference,
    });
  } catch (error: any) {
    console.error('Subscription checkout initialization error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
