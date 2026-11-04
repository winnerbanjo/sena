import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest, assertIndustry } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import {
  db,
  gymMembers,
  gymSubscriptions,
  gymCheckins,
  gymClasses,
  eq,
  and,
  sql,
  desc,
  gte,
} from '@sena/database';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['gym']);
    if (industryCheck) return industryCheck;

    const propertyId = tenant.propertyId;
    const timezone = tenant.property.timezone || 'Africa/Lagos';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

    // 1. Total Active Members
    const [membersCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymMembers)
      .where(and(eq(gymMembers.propertyId, propertyId), eq(gymMembers.status, 'active')));

    // 2. Total Check-ins Today
    const todayStart = new Date(`${todayStr}T00:00:00Z`);
    const [todayCheckins] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymCheckins)
      .where(and(eq(gymCheckins.propertyId, propertyId), gte(gymCheckins.checkInAt, todayStart)));

    // 3. Subscriptions Expiring in next 7 days
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStr = nextWeekDate.toISOString().split('T')[0];

    const expiringSubs = await db
      .select({
        id: gymSubscriptions.id,
        endDate: gymSubscriptions.endDate,
        memberId: gymSubscriptions.memberId,
        memberName: gymMembers.fullName,
        memberPhone: gymMembers.phone,
        status: gymSubscriptions.status,
      })
      .from(gymSubscriptions)
      .innerJoin(gymMembers, eq(gymSubscriptions.memberId, gymMembers.id))
      .where(
        and(
          eq(gymSubscriptions.propertyId, propertyId),
          eq(gymSubscriptions.status, 'active'),
          gte(gymSubscriptions.endDate, todayStr),
          sql`${gymSubscriptions.endDate} <= ${nextWeekStr}`
        )
      )
      .limit(10);

    // 4. Recent Check-in Activity Feed
    const recentActivity = await db
      .select({
        id: gymCheckins.id,
        checkInAt: gymCheckins.checkInAt,
        accessResult: gymCheckins.accessResult,
        accessPoint: gymCheckins.accessPoint,
        denialReason: gymCheckins.denialReason,
        memberName: gymMembers.fullName,
        memberNumber: gymMembers.memberNumber,
      })
      .from(gymCheckins)
      .innerJoin(gymMembers, eq(gymCheckins.memberId, gymMembers.id))
      .where(eq(gymCheckins.propertyId, propertyId))
      .orderBy(desc(gymCheckins.checkInAt))
      .limit(8);

    // 5. Total Active Classes
    const [classesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymClasses)
      .where(and(eq(gymClasses.propertyId, propertyId), eq(gymClasses.status, 'active')));

    return NextResponse.json({
      metrics: {
        activeMembers: membersCount?.count || 0,
        todayCheckins: todayCheckins?.count || 0,
        expiringSoon: expiringSubs.length,
        activeClasses: classesCount?.count || 0,
      },
      expiringSubscriptions: expiringSubs,
      recentActivity,
    });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');
