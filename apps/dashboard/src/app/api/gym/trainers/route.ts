import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest, assertIndustry } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import { db, gymTrainers, eq, and, desc } from '@sena/database';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['gym']);
    if (industryCheck) return industryCheck;

    const trainers = await db
      .select()
      .from(gymTrainers)
      .where(and(eq(gymTrainers.propertyId, tenant.propertyId), eq(gymTrainers.status, 'active')))
      .orderBy(desc(gymTrainers.createdAt));

    return NextResponse.json({ trainers });
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
    const { fullName, phone, email, specializations = [], hourlyRateMinorUnits = 0, bio } = body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return NextResponse.json({ error: 'Trainer name is required.' }, { status: 400 });
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });
    }

    const [trainer] = await db
      .insert(gymTrainers)
      .values({
        propertyId: tenant.propertyId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : null,
        specializations: Array.isArray(specializations) ? specializations : [],
        hourlyRateMinorUnits: Number(hourlyRateMinorUnits) || 0,
        bio: bio ? bio.trim() : null,
        status: 'active',
      })
      .returning();

    return NextResponse.json({ success: true, trainer });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'gym');
export const POST = withMerchant(handlePOST, 'gym');
