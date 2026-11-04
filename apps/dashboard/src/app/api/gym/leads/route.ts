import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest, assertIndustry } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import {
  db,
  gymLeads,
  gymMembers,
  eq,
  and,
  desc,
  ilike,
  or,
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
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const conditions = [eq(gymLeads.propertyId, propertyId)];

    if (status && status !== 'all') {
      conditions.push(eq(gymLeads.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(gymLeads.fullName, `%${search}%`),
          ilike(gymLeads.phone, `%${search}%`),
          ilike(gymLeads.email, `%${search}%`)
        )!
      );
    }

    const leads = await db
      .select({
        id: gymLeads.id,
        fullName: gymLeads.fullName,
        phone: gymLeads.phone,
        email: gymLeads.email,
        source: gymLeads.source,
        status: gymLeads.status,
        trialDate: gymLeads.trialDate,
        notes: gymLeads.notes,
        lossReason: gymLeads.lossReason,
        convertedMemberId: gymLeads.convertedMemberId,
        createdAt: gymLeads.createdAt,
        updatedAt: gymLeads.updatedAt,
      })
      .from(gymLeads)
      .where(and(...conditions))
      .orderBy(desc(gymLeads.createdAt))
      .limit(100);

    // Stage counts for Kanban / funnel
    const countsByStage = await db
      .select({
        status: gymLeads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(gymLeads)
      .where(eq(gymLeads.propertyId, propertyId))
      .groupBy(gymLeads.status);

    const stagesSummary: Record<string, number> = {
      new: 0,
      contacted: 0,
      trial_scheduled: 0,
      trial_completed: 0,
      offered: 0,
      converted: 0,
      lost: 0,
    };

    countsByStage.forEach((item) => {
      if (item.status in stagesSummary) {
        stagesSummary[item.status] = item.count;
      }
    });

    return NextResponse.json({ leads, stagesSummary });
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
    const organizationId = tenant.organizationId;
    const body = await req.json();

    const { fullName, phone, email, source, notes, trialDate } = body;

    if (!fullName || !phone) {
      return NextResponse.json(
        { error: 'Full name and phone number are required.' },
        { status: 400 }
      );
    }

    const [lead] = await db
      .insert(gymLeads)
      .values({
        propertyId,
        organizationId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : null,
        source: source || 'walk_in',
        status: 'new',
        trialDate: trialDate || null,
        notes: notes ? notes.trim() : null,
      })
      .returning();

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}

async function handlePATCH(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['gym']);
    if (industryCheck) return industryCheck;

    const propertyId = tenant.propertyId;
    const body = await req.json();
    const { id, status, notes, trialDate, lossReason, convertedMemberId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required.' }, { status: 400 });
    }

    const updateFields: any = { updatedAt: new Date() };
    if (status !== undefined) updateFields.status = status;
    if (notes !== undefined) updateFields.notes = notes;
    if (trialDate !== undefined) updateFields.trialDate = trialDate;
    if (lossReason !== undefined) updateFields.lossReason = lossReason;
    if (convertedMemberId !== undefined) updateFields.convertedMemberId = convertedMemberId;

    const [updatedLead] = await db
      .update(gymLeads)
      .set(updateFields)
      .where(and(eq(gymLeads.id, id), eq(gymLeads.propertyId, propertyId)))
      .returning();

    if (!updatedLead) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    return NextResponse.json({ lead: updatedLead });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'gym');
export const POST = withMerchant(handlePOST, 'gym');
export const PATCH = withMerchant(handlePATCH, 'gym');
