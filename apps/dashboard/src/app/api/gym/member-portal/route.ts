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
  gymClasses,
  gymClassBookings,
  gymTrainers,
  gymCheckins,
  eq,
  and,
  desc,
  gte,
  sql,
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
    const { searchParams } = new URL(req.url);
    const memberIdParam = searchParams.get('memberId');

    // If specific member requested or get the first active member as demo
    let member: any = null;
    if (memberIdParam) {
      const [found] = await db
        .select()
        .from(gymMembers)
        .where(and(eq(gymMembers.id, memberIdParam), eq(gymMembers.propertyId, propertyId)));
      member = found;
    } else {
      const [firstMember] = await db
        .select()
        .from(gymMembers)
        .where(and(eq(gymMembers.propertyId, propertyId), eq(gymMembers.status, 'active')))
        .limit(1);
      member = firstMember;
    }

    if (!member) {
      return NextResponse.json({
        member: null,
        message: 'No active member found. Register a member first.',
      });
    }

    // Active subscription
    const [subscription] = await db
      .select({
        id: gymSubscriptions.id,
        startDate: gymSubscriptions.startDate,
        endDate: gymSubscriptions.endDate,
        status: gymSubscriptions.status,
        totalAmountMinorUnits: gymSubscriptions.totalAmountMinorUnits,
        paidAmountMinorUnits: gymSubscriptions.paidAmountMinorUnits,
        planName: gymMembershipPlans.name,
        accessHours: gymMembershipPlans.accessHours,
        maxClassCredits: gymMembershipPlans.maxClassCreditsPerMonth,
      })
      .from(gymSubscriptions)
      .innerJoin(gymMembershipPlans, eq(gymSubscriptions.planId, gymMembershipPlans.id))
      .where(
        and(
          eq(gymSubscriptions.memberId, member.id),
          eq(gymSubscriptions.propertyId, propertyId)
        )
      )
      .orderBy(desc(gymSubscriptions.createdAt))
      .limit(1);

    // Member's recent class bookings
    const bookings = await db
      .select({
        id: gymClassBookings.id,
        bookingDate: gymClassBookings.bookingDate,
        status: gymClassBookings.status,
        className: gymClasses.name,
        startTime: gymClasses.startTime,
        durationMinutes: gymClasses.durationMinutes,
        locationRoom: gymClasses.locationRoom,
      })
      .from(gymClassBookings)
      .innerJoin(gymClasses, eq(gymClassBookings.classId, gymClasses.id))
      .where(eq(gymClassBookings.memberId, member.id))
      .orderBy(desc(gymClassBookings.bookingDate))
      .limit(5);

    // Available classes for booking
    const availableClasses = await db
      .select({
        id: gymClasses.id,
        name: gymClasses.name,
        description: gymClasses.description,
        dayOfWeek: gymClasses.dayOfWeek,
        startTime: gymClasses.startTime,
        durationMinutes: gymClasses.durationMinutes,
        capacity: gymClasses.capacity,
        locationRoom: gymClasses.locationRoom,
        trainerName: gymTrainers.fullName,
      })
      .from(gymClasses)
      .leftJoin(gymTrainers, eq(gymClasses.trainerId, gymTrainers.id))
      .where(and(eq(gymClasses.propertyId, propertyId), eq(gymClasses.status, 'active')));

    // Member's recent check-ins
    const recentCheckins = await db
      .select({
        id: gymCheckins.id,
        checkInAt: gymCheckins.checkInAt,
        accessResult: gymCheckins.accessResult,
        accessPoint: gymCheckins.accessPoint,
      })
      .from(gymCheckins)
      .where(eq(gymCheckins.memberId, member.id))
      .orderBy(desc(gymCheckins.checkInAt))
      .limit(5);

    return NextResponse.json({
      member: {
        id: member.id,
        fullName: member.fullName,
        memberNumber: member.memberNumber,
        phone: member.phone,
        email: member.email,
        qrCodeToken: member.qrCodeToken,
        status: member.status,
        joinedAt: member.joinedAt,
      },
      subscription,
      bookings,
      availableClasses,
      recentCheckins,
    });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}

// POST: Book a class
async function handlePOST(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['gym']);
    if (industryCheck) return industryCheck;

    const propertyId = tenant.propertyId;
    const body = await req.json();
    const { memberId, classId, bookingDate } = body;

    if (!memberId || !classId || !bookingDate) {
      return NextResponse.json(
        { error: 'memberId, classId, and bookingDate are required.' },
        { status: 400 }
      );
    }

    // Verify member has active subscription
    const [sub] = await db
      .select()
      .from(gymSubscriptions)
      .where(
        and(
          eq(gymSubscriptions.memberId, memberId),
          eq(gymSubscriptions.propertyId, propertyId),
          eq(gymSubscriptions.status, 'active')
        )
      );

    if (!sub) {
      return NextResponse.json(
        { error: 'Member does not have an active subscription.' },
        { status: 400 }
      );
    }

    // Verify class capacity
    const [targetClass] = await db
      .select()
      .from(gymClasses)
      .where(and(eq(gymClasses.id, classId), eq(gymClasses.propertyId, propertyId)));

    if (!targetClass) {
      return NextResponse.json({ error: 'Class not found.' }, { status: 404 });
    }

    const [currentBookings] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymClassBookings)
      .where(
        and(
          eq(gymClassBookings.classId, classId),
          eq(gymClassBookings.bookingDate, bookingDate),
          eq(gymClassBookings.status, 'booked')
        )
      );

    if ((currentBookings?.count || 0) >= targetClass.capacity) {
      return NextResponse.json(
        { error: `Class is fully booked (${targetClass.capacity} / ${targetClass.capacity}).` },
        { status: 400 }
      );
    }

    const [booking] = await db
      .insert(gymClassBookings)
      .values({
        propertyId,
        classId,
        memberId,
        bookingDate,
        status: 'booked',
      })
      .returning();

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'gym');
export const POST = withMerchant(handlePOST, 'gym');
