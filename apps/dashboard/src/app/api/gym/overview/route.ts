import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest, assertIndustry } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import {
  db,
  gymMembers,
  gymSubscriptions,
  gymMembershipPlans,
  gymCheckins,
  gymClasses,
  gymLeads,
  payments,
  eq,
  and,
  sql,
  desc,
  gte,
  inArray,
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
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
    const todayStart = new Date(`${todayStr}T00:00:00Z`);

    // Month start string (e.g. 2026-11-01)
    const monthStartStr = `${todayStr.slice(0, 7)}-01`;
    const monthStartDate = new Date(`${monthStartStr}T00:00:00Z`);

    // 3 hours ago for live occupancy threshold
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    // 1. Total Active & Inactive Members
    const [activeMembersCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymMembers)
      .where(and(eq(gymMembers.propertyId, propertyId), eq(gymMembers.status, 'active')));

    const [inactiveMembersCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymMembers)
      .where(and(eq(gymMembers.propertyId, propertyId), sql`${gymMembers.status} != 'active'`));

    // 2. Floor Occupancy & Check-in / Check-out Metrics
    const [currentlyInsideResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymCheckins)
      .where(
        and(
          eq(gymCheckins.propertyId, propertyId),
          eq(gymCheckins.accessResult, 'granted'),
          gte(gymCheckins.checkInAt, todayStart),
          sql`${gymCheckins.checkOutAt} IS NULL`,
          gte(gymCheckins.checkInAt, threeHoursAgo)
        )
      );

    const [todayGrantedCheckins] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymCheckins)
      .where(
        and(
          eq(gymCheckins.propertyId, propertyId),
          eq(gymCheckins.accessResult, 'granted'),
          gte(gymCheckins.checkInAt, todayStart)
        )
      );

    const [todayExitsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymCheckins)
      .where(
        and(
          eq(gymCheckins.propertyId, propertyId),
          gte(gymCheckins.checkOutAt, todayStart)
        )
      );

    const [todayDeniedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymCheckins)
      .where(
        and(
          eq(gymCheckins.propertyId, propertyId),
          eq(gymCheckins.accessResult, 'denied'),
          gte(gymCheckins.checkInAt, todayStart)
        )
      );

    // 3. Expiry Windows (7 days & 30 days)
    const next7DaysDate = new Date(now.getTime() + 7 * 86400000);
    const next7DaysStr = next7DaysDate.toISOString().split('T')[0];

    const next30DaysDate = new Date(now.getTime() + 30 * 86400000);
    const next30DaysStr = next30DaysDate.toISOString().split('T')[0];

    const expiring7dSubs = await db
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
          sql`${gymSubscriptions.endDate} <= ${next7DaysStr}`
        )
      )
      .limit(20);

    const [expiring30dCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymSubscriptions)
      .where(
        and(
          eq(gymSubscriptions.propertyId, propertyId),
          eq(gymSubscriptions.status, 'active'),
          gte(gymSubscriptions.endDate, todayStr),
          sql`${gymSubscriptions.endDate} <= ${next30DaysStr}`
        )
      );

    // 4. Financial Metrics (Minor Units / Kobo)
    // 4a. Payments today from payments table
    const [todayPaymentsResult] = await db
      .select({ total: sql<number>`coalesce(sum(${payments.amountMinorUnits}), 0)::bigint` })
      .from(payments)
      .where(
        and(
          eq(payments.propertyId, propertyId),
          eq(payments.status, 'successful'),
          gte(payments.createdAt, todayStart)
        )
      );

    // Subscriptions paid today
    const [todaySubsPaidResult] = await db
      .select({ total: sql<number>`coalesce(sum(${gymSubscriptions.paidAmountMinorUnits}), 0)::bigint` })
      .from(gymSubscriptions)
      .where(
        and(
          eq(gymSubscriptions.propertyId, propertyId),
          gte(gymSubscriptions.createdAt, todayStart)
        )
      );

    const todayRevenueMinorUnits = Math.max(
      Number(todayPaymentsResult?.total || 0),
      Number(todaySubsPaidResult?.total || 0)
    );

    // 4b. Month to date revenue
    const [monthSubsPaidResult] = await db
      .select({ total: sql<number>`coalesce(sum(${gymSubscriptions.paidAmountMinorUnits}), 0)::bigint` })
      .from(gymSubscriptions)
      .where(
        and(
          eq(gymSubscriptions.propertyId, propertyId),
          gte(gymSubscriptions.createdAt, monthStartDate)
        )
      );

    const monthRevenueMinorUnits = Number(monthSubsPaidResult?.total || 0);

    // 4c. Active MRR (Monthly Recurring Revenue) run-rate
    const activeSubsWithPlans = await db
      .select({
        totalAmount: gymSubscriptions.totalAmountMinorUnits,
        durationMonths: gymMembershipPlans.durationMonths,
      })
      .from(gymSubscriptions)
      .innerJoin(gymMembershipPlans, eq(gymSubscriptions.planId, gymMembershipPlans.id))
      .where(
        and(
          eq(gymSubscriptions.propertyId, propertyId),
          eq(gymSubscriptions.status, 'active')
        )
      );

    const activeMrrMinorUnits = activeSubsWithPlans.reduce((sum, sub) => {
      const months = Math.max(1, sub.durationMonths || 1);
      return sum + Math.round(Number(sub.totalAmount || 0) / months);
    }, 0);

    // 4d. Outstanding Balances for active subscriptions
    const [outstandingResult] = await db
      .select({
        total: sql<number>`coalesce(sum(${gymSubscriptions.totalAmountMinorUnits} - ${gymSubscriptions.paidAmountMinorUnits}), 0)::bigint`
      })
      .from(gymSubscriptions)
      .where(
        and(
          eq(gymSubscriptions.propertyId, propertyId),
          eq(gymSubscriptions.status, 'active'),
          sql`${gymSubscriptions.totalAmountMinorUnits} > ${gymSubscriptions.paidAmountMinorUnits}`
        )
      );

    const outstandingBalancesMinorUnits = Number(outstandingResult?.total || 0);

    // 5. Open Leads in CRM Pipeline
    let openLeadsCount = 0;
    try {
      const [leadsCountResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(gymLeads)
        .where(
          and(
            eq(gymLeads.propertyId, propertyId),
            inArray(gymLeads.status, ['new', 'contacted', 'trial_scheduled', 'trial_completed', 'offered'])
          )
        );
      openLeadsCount = leadsCountResult?.count || 0;
    } catch {
      openLeadsCount = 0;
    }

    // 6. Active Classes Count
    const [classesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymClasses)
      .where(and(eq(gymClasses.propertyId, propertyId), eq(gymClasses.status, 'active')));

    // 7. Recent Access Activity Feed (Top 10)
    const recentActivity = await db
      .select({
        id: gymCheckins.id,
        checkInAt: gymCheckins.checkInAt,
        checkOutAt: gymCheckins.checkOutAt,
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
      .limit(10);

    const maxCapacity = 100; // Standard gym floor capacity limit
    const currentlyInside = currentlyInsideResult?.count || 0;
    const occupancyPercentage = Math.min(100, Math.round((currentlyInside / maxCapacity) * 100));

    return NextResponse.json({
      metrics: {
        activeMembers: activeMembersCount?.count || 0,
        inactiveMembers: inactiveMembersCount?.count || 0,
        currentlyInside,
        maxCapacity,
        occupancyPercentage,
        todayCheckins: todayGrantedCheckins?.count || 0,
        todayExits: todayExitsCount?.count || 0,
        todayDenied: todayDeniedCount?.count || 0,
        expiringSoon: expiring7dSubs.length,
        expiring30d: expiring30dCount?.count || 0,
        activeClasses: classesCount?.count || 0,
        openLeads: openLeadsCount,
        todayRevenueMinorUnits,
        monthRevenueMinorUnits,
        activeMrrMinorUnits,
        outstandingBalancesMinorUnits,
      },
      expiringSubscriptions: expiring7dSubs,
      recentActivity,
    });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'gym');
