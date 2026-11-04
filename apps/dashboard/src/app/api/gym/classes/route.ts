import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest, assertIndustry } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import { db, gymClasses, gymTrainers, eq, and, desc } from '@sena/database';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['gym']);
    if (industryCheck) return industryCheck;

    const classes = await db
      .select({
        id: gymClasses.id,
        name: gymClasses.name,
        description: gymClasses.description,
        dayOfWeek: gymClasses.dayOfWeek,
        startTime: gymClasses.startTime,
        durationMinutes: gymClasses.durationMinutes,
        capacity: gymClasses.capacity,
        locationRoom: gymClasses.locationRoom,
        priceMinorUnits: gymClasses.priceMinorUnits,
        status: gymClasses.status,
        trainerName: gymTrainers.fullName,
      })
      .from(gymClasses)
      .leftJoin(gymTrainers, eq(gymClasses.trainerId, gymTrainers.id))
      .where(and(eq(gymClasses.propertyId, tenant.propertyId), eq(gymClasses.status, 'active')))
      .orderBy(gymClasses.dayOfWeek, gymClasses.startTime);

    return NextResponse.json({ classes });
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
    const { name, description, trainerId, dayOfWeek = 1, startTime = '08:00', durationMinutes = 60, capacity = 20, locationRoom, priceMinorUnits = 0 } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Class name is required.' }, { status: 400 });
    }

    const [cls] = await db
      .insert(gymClasses)
      .values({
        propertyId: tenant.propertyId,
        trainerId: trainerId || null,
        name: name.trim(),
        description: description ? description.trim() : null,
        dayOfWeek: Number(dayOfWeek),
        startTime: String(startTime).trim(),
        durationMinutes: Number(durationMinutes) || 60,
        capacity: Number(capacity) || 20,
        locationRoom: locationRoom ? locationRoom.trim() : 'Fitness Studio',
        priceMinorUnits: Number(priceMinorUnits) || 0,
        status: 'active',
      })
      .returning();

    return NextResponse.json({ success: true, class: cls });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'gym');
export const POST = withMerchant(handlePOST, 'gym');
