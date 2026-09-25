import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, properties, propertyMembers, organizationMembers, reviews, eq, desc } from '@sena/database';

async function resolvePropertyForUser(userId: string) {
  const pm = await db.query.propertyMembers.findFirst({
    where: eq(propertyMembers.userId, userId),
  });
  if (pm) return pm.propertyId;

  const om = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, userId),
  });
  if (om) {
    const prop = await db.query.properties.findFirst({
      where: eq(properties.organizationId, om.organizationId),
    });
    if (prop) return prop.id;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    let propertyId = (session?.user as any)?.propertyId;

    if (!propertyId && session?.user?.id) {
      propertyId = await resolvePropertyForUser(session.user.id);
    }

    if (!propertyId) {
      const firstProp = await db.query.properties.findFirst();
      if (firstProp) propertyId = firstProp.id;
    }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Manually import an external review (Google, Booking.com, Testimonial)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    let propertyId = (session?.user as any)?.propertyId;

    if (!propertyId && session?.user?.id) {
      propertyId = await resolvePropertyForUser(session.user.id);
    }

    if (!propertyId) {
      const firstProp = await db.query.properties.findFirst();
      if (firstProp) propertyId = firstProp.id;
    }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Moderate review: publish/hide or post hotelier response
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    let propertyId = (session?.user as any)?.propertyId;

    if (!propertyId && session?.user?.id) {
      propertyId = await resolvePropertyForUser(session.user.id);
    }

    if (!propertyId) {
      const firstProp = await db.query.properties.findFirst();
      if (firstProp) propertyId = firstProp.id;
    }

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const body = await req.json();
    const { reviewId, status, response } = body;

    if (!reviewId) {
      return NextResponse.json({ error: 'Review ID required' }, { status: 400 });
    }

    const updates: any = { updatedAt: new Date() };
    if (status) updates.status = status;
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
