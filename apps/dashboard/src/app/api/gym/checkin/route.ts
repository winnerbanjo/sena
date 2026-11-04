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
  eq,
  and,
  desc,
  gte,
  or,
} from '@sena/database';

export const dynamic = 'force-dynamic';

async function handlePOST(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['gym']);
    if (industryCheck) return industryCheck;

    const propertyId = tenant.propertyId;
    const timezone = tenant.property.timezone || 'Africa/Lagos';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

    const body = await req.json();
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!token) {
      return NextResponse.json({ error: 'Scan or enter a member QR token or Member ID.' }, { status: 400 });
    }

    // Lookup member by qrCodeToken OR memberNumber OR phone
    const member = await db.query.gymMembers.findFirst({
      where: and(
        eq(gymMembers.propertyId, propertyId),
        or(
          eq(gymMembers.qrCodeToken, token),
          eq(gymMembers.memberNumber, token),
          eq(gymMembers.phone, token)
        )
      ),
    });

    if (!member) {
      return NextResponse.json({
        accessResult: 'denied',
        denialReason: 'Member not found. Check ID or register new membership.',
        member: null,
      });
    }

    if (member.status === 'suspended') {
      await db.insert(gymCheckins).values({
        propertyId,
        memberId: member.id,
        accessResult: 'denied',
        denialReason: 'Membership suspended by management.',
        verifiedBy: session?.user?.name || 'Reception Terminal',
      });

      return NextResponse.json({
        accessResult: 'denied',
        denialReason: 'Membership suspended by management.',
        member: {
          id: member.id,
          fullName: member.fullName,
          memberNumber: member.memberNumber,
          phone: member.phone,
        },
      });
    }

    // Check latest subscription
    const latestSub = await db
      .select({
        id: gymSubscriptions.id,
        planName: gymMembershipPlans.name,
        startDate: gymSubscriptions.startDate,
        endDate: gymSubscriptions.endDate,
        status: gymSubscriptions.status,
      })
      .from(gymSubscriptions)
      .innerJoin(gymMembershipPlans, eq(gymSubscriptions.planId, gymMembershipPlans.id))
      .where(and(eq(gymSubscriptions.memberId, member.id), eq(gymSubscriptions.propertyId, propertyId)))
      .orderBy(desc(gymSubscriptions.endDate))
      .limit(1);

    const subscription = latestSub[0] || null;

    if (!subscription || subscription.status !== 'active' || subscription.endDate < todayStr) {
      const reason = !subscription
        ? 'No subscription found for this member.'
        : subscription.endDate < todayStr
        ? `Subscription expired on ${subscription.endDate}. Please renew.`
        : `Subscription status is ${subscription.status}.`;

      await db.insert(gymCheckins).values({
        propertyId,
        memberId: member.id,
        accessResult: 'denied',
        denialReason: reason,
        verifiedBy: session?.user?.name || 'Reception Terminal',
      });

      return NextResponse.json({
        accessResult: 'denied',
        denialReason: reason,
        member: {
          id: member.id,
          fullName: member.fullName,
          memberNumber: member.memberNumber,
          phone: member.phone,
        },
        subscription,
      });
    }

    // Access granted!
    const [checkin] = await db
      .insert(gymCheckins)
      .values({
        propertyId,
        memberId: member.id,
        accessResult: 'granted',
        accessPoint: body.accessPoint || 'main_entrance',
        verifiedBy: session?.user?.name || 'Reception Terminal',
      })
      .returning();

    return NextResponse.json({
      accessResult: 'granted',
      checkinId: checkin.id,
      member: {
        id: member.id,
        fullName: member.fullName,
        memberNumber: member.memberNumber,
        phone: member.phone,
      },
      subscription: {
        planName: subscription.planName,
        expiresOn: subscription.endDate,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}

export const POST = withMerchant(handlePOST, 'gym');
