import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, organizations, properties, users, eq } from '@sena/database';
import { resolveTenantForRequest } from '@/lib/tenant';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

async function handlePOST(req: NextRequest) {
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

    // Resolve Organization & Property strictly for authenticated tenant
    const tenant = await resolveTenantForRequest(session, req);
    let orgId = tenant?.property?.organizationId;


    if (!orgId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const prop = tenant?.property;

    // User email for Paystack customer
    let userEmail = session?.user?.email || undefined;
    if (!userEmail && tenant?.userId) {
      const u = await db.query.users.findFirst({ where: eq(users.id, tenant.userId) });
      userEmail = u?.email;
    }
    if (!userEmail) {
      return NextResponse.json({ error: 'Add an email address to your account before paying.' }, { status: 400 });
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

    if (!PAYSTACK_SECRET_KEY) return NextResponse.json({ error: 'Online payments are unavailable.' }, { status: 503 });

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
          organizationId: orgId,
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
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const POST = withMerchant(handlePOST, 'subscription');
