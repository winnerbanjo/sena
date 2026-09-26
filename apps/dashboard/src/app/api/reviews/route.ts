import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, properties, propertyMembers, organizationMembers, reviews, eq, desc } from '@sena/database';

import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    let allReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.propertyId, propertyId))
      .orderBy(desc(reviews.submittedAt));

    if (statusFilter && statusFilter !== 'all') {
      allReviews = allReviews.filter((r) => r.status === statusFilter);
    }

    const published = allReviews.filter((r) => r.status === 'published');
    const avgRating =
      published.length > 0
        ? Number((published.reduce((sum, r) => sum + r.rating, 0) / published.length).toFixed(1))
        : 5.0;

    return NextResponse.json({
      reviews: allReviews,
      totalCount: allReviews.length,
      averageRating: avgRating,
    });
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

// Manually import an external review (Google, Booking.com, Testimonial)
async function handlePOST(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const body = await req.json();
    const { guestName, rating, title, body: reviewBody, source = 'manual' } = body;

    if (!guestName || !rating || !reviewBody) {
      return NextResponse.json(
        { error: 'Guest name, rating, and review text are required.' },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(reviews)
      .values({
        propertyId,
        guestName: guestName.trim(),
        rating: Math.min(5, Math.max(1, Number(rating))),
        title: title ? title.trim() : null,
        body: reviewBody.trim(),
        source: source || 'manual',
        status: 'published',
        isVerifiedStay: false, // Manual reviews NEVER receive verified stay badge
        submittedAt: new Date(),
        publishedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ success: true, review: created });
  } catch (error: any) {
    console.error('Error importing manual review:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

// Moderate review: publish/hide or post hotelier response
async function handlePATCH(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const body = await req.json();
    const { reviewId, status, response, hiddenReason, reason } = body;

    if (!reviewId) {
      return NextResponse.json({ error: 'Review ID required' }, { status: 400 });
    }

    const effectiveReason = (hiddenReason || reason || '').trim();

    const isHiding = status === 'hidden' || status === 'hidden_for_policy';

    if (isHiding && !effectiveReason) {
      return NextResponse.json(
        { error: 'A moderation reason is strictly required when hiding a guest review (e.g. defamation, profanity, spam, unverified false claim).' },
        { status: 400 }
      );
    }

    const updates: any = { updatedAt: new Date() };
    if (status) {
      updates.status = status;
      if (isHiding) {
        updates.hiddenReason = effectiveReason;
        updates.moderatedBy = session?.user?.name || session?.user?.email || 'Staff';
        updates.moderatedAt = new Date();
      } else if (status === 'published') {
        updates.hiddenReason = null;
      }
    }
    if (response !== undefined) {
      updates.response = response ? response.trim() : null;
      updates.responseAt = response ? new Date() : null;
    }

    const [updated] = await db
      .update(reviews)
      .set(updates)
      .where(eq(reviews.id, reviewId))
      .returning();

    return NextResponse.json({ success: true, review: updated });
  } catch (error: any) {
    console.error('Error moderating review:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'reviews');

export const POST = withMerchant(handlePOST, 'reviews');

export const PATCH = withMerchant(handlePATCH, 'reviews');
