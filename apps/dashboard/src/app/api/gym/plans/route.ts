import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest, assertIndustry } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import { db, gymMembershipPlans, eq, and, desc } from '@sena/database';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['gym']);
    if (industryCheck) return industryCheck;

    const plans = await db
      .select()
      .from(gymMembershipPlans)
      .where(and(eq(gymMembershipPlans.propertyId, tenant.propertyId), eq(gymMembershipPlans.status, 'active')))
      .orderBy(desc(gymMembershipPlans.createdAt));

    return NextResponse.json({ plans });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['gym']);
    if (industryCheck) return industryCheck;

    const body = await req.json();
    const { name, description, durationMonths = 1, priceMinorUnits, registrationFeeMinorUnits = 0, accessHours = 'all_hours', maxClassCreditsPerMonth = 0 } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Plan name is required.' }, { status: 400 });
    }
    if (!Number.isSafeInteger(priceMinorUnits) || priceMinorUnits < 0) {
      return NextResponse.json({ error: 'Valid price in minor units is required.' }, { status: 400 });
    }

    const [plan] = await db
      .insert(gymMembershipPlans)
      .values({
        propertyId: tenant.propertyId,
        name: name.trim(),
        description: description ? description.trim() : null,
        durationMonths: Number(durationMonths) || 1,
        priceMinorUnits,
        registrationFeeMinorUnits: Number(registrationFeeMinorUnits) || 0,
        accessHours,
        maxClassCreditsPerMonth: Number(maxClassCreditsPerMonth) || 0,
        status: 'active',
      })
      .returning();

    return NextResponse.json({ success: true, plan });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'gym');
export const POST = withMerchant(handlePOST, 'gym');
