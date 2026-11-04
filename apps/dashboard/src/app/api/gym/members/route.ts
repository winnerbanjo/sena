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
  eq,
  and,
  desc,
  sql,
  ilike,
  or,
} from '@sena/database';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['gym']);
    if (industryCheck) return industryCheck;

    const propertyId = tenant.propertyId;
    const url = new URL(req.url);
    const search = url.searchParams.get('q')?.trim();
    const status = url.searchParams.get('status')?.trim();

    let conditions = [eq(gymMembers.propertyId, propertyId)];

    if (status && ['active', 'inactive', 'suspended'].includes(status)) {
      conditions.push(eq(gymMembers.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(gymMembers.fullName, `%${search}%`),
          ilike(gymMembers.phone, `%${search}%`),
          ilike(gymMembers.memberNumber, `%${search}%`),
          ilike(gymMembers.email, `%${search}%`)
        )!
      );
    }

    const members = await db
      .select({
        id: gymMembers.id,
        memberNumber: gymMembers.memberNumber,
        fullName: gymMembers.fullName,
        email: gymMembers.email,
        phone: gymMembers.phone,
        emergencyContactName: gymMembers.emergencyContactName,
        emergencyContactPhone: gymMembers.emergencyContactPhone,
        status: gymMembers.status,
        qrCodeToken: gymMembers.qrCodeToken,
        joinedAt: gymMembers.joinedAt,
        createdAt: gymMembers.createdAt,
      })
      .from(gymMembers)
      .where(and(...conditions))
      .orderBy(desc(gymMembers.createdAt))
      .limit(100);

    // Enrich with latest active subscription if any
    const memberIds = members.map((m) => m.id);
    let subsMap = new Map<string, any>();

    if (memberIds.length > 0) {
      const activeSubs = await db
        .select({
          id: gymSubscriptions.id,
          memberId: gymSubscriptions.memberId,
          planName: gymMembershipPlans.name,
          startDate: gymSubscriptions.startDate,
          endDate: gymSubscriptions.endDate,
          status: gymSubscriptions.status,
        })
        .from(gymSubscriptions)
        .innerJoin(gymMembershipPlans, eq(gymSubscriptions.planId, gymMembershipPlans.id))
        .where(
          and(
            eq(gymSubscriptions.propertyId, propertyId),
            sql`${gymSubscriptions.memberId} IN ${memberIds}`
          )
        )
        .orderBy(desc(gymSubscriptions.createdAt));

      for (const sub of activeSubs) {
        if (!subsMap.has(sub.memberId)) {
          subsMap.set(sub.memberId, sub);
        }
      }
    }

    const enriched = members.map((m) => ({
      ...m,
      latestSubscription: subsMap.get(m.id) || null,
    }));

    return NextResponse.json({ members: enriched });
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

    const propertyId = tenant.propertyId;
    const organizationId = tenant.property.organizationId;
    const body = await req.json();

    const { fullName, phone, email, emergencyContactName, emergencyContactPhone, medicalNotes } = body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });
    }

    // Auto-generate member number: GYM-XXXXXX
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const memberNumber = `GYM-${randomSuffix}`;

    // Auto-generate unique QR Code Access Token
    const qrCodeToken = `SENA-GYM-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;

    const [newMember] = await db
      .insert(gymMembers)
      .values({
        propertyId,
        organizationId,
        memberNumber,
        fullName: fullName.trim(),
        email: email ? email.trim() : null,
        phone: phone.trim(),
        emergencyContactName: emergencyContactName ? emergencyContactName.trim() : null,
        emergencyContactPhone: emergencyContactPhone ? emergencyContactPhone.trim() : null,
        medicalNotes: medicalNotes ? medicalNotes.trim() : null,
        qrCodeToken,
        status: 'active',
      })
      .returning();

    // If an initial membership plan was selected, create the subscription
    if (body.planId) {
      const plan = await db.query.gymMembershipPlans.findFirst({
        where: and(eq(gymMembershipPlans.id, body.planId), eq(gymMembershipPlans.propertyId, propertyId)),
      });

      if (plan) {
        const timezone = tenant.property.timezone || 'Africa/Lagos';
        const startDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
        const endDateObj = new Date();
        endDateObj.setMonth(endDateObj.getMonth() + plan.durationMonths);
        const endDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(endDateObj);

        await db.insert(gymSubscriptions).values({
          propertyId,
          memberId: newMember.id,
          planId: plan.id,
          startDate,
          endDate,
          status: 'active',
          totalAmountMinorUnits: plan.priceMinorUnits + plan.registrationFeeMinorUnits,
          paidAmountMinorUnits: plan.priceMinorUnits + plan.registrationFeeMinorUnits, // default settled at registration
        });
      }
    }

    return NextResponse.json({ success: true, member: newMember });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');
export const POST = withMerchant(handlePOST, 'reservations');
