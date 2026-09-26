import { apiError } from '@/lib/api-error';
import { NextRequest, NextResponse } from 'next/server';
import { db, properties, reviews, reservations, reviewTokens, eq, and } from '@sena/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, token, bookingReference, guestName, rating, title, body: reviewBody } = body;

    if (typeof slug !== 'string' || typeof guestName !== 'string' || !guestName.trim() || guestName.length>255 || !Number.isInteger(Number(rating)) || Number(rating)<1 || Number(rating)>5 || typeof reviewBody !== 'string' || !reviewBody.trim() || reviewBody.length>10000) {
      return NextResponse.json(
        { error: 'Missing required review fields' },
        { status: 400 }
      );
    }

    // Resolve property by slug
    const property = await db.query.properties.findFirst({
      where: eq(properties.slug, slug.toLowerCase().trim()),
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    let isVerifiedStay = false;
    let reservationId: string | null = null;

    return await db.transaction(async (tx) => {
    // A booking reference alone is not proof that the sender stayed here.
    if (token) {
      const [tokenRecord] = await tx.select().from(reviewTokens).where(eq(reviewTokens.token, String(token).trim())).for('update');
      if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt <= new Date()) return NextResponse.json({error:'This review link has expired or already been used.'},{status:400});
      const stay = await tx.query.reservations.findFirst({where:and(eq(reservations.id,tokenRecord.reservationId),eq(reservations.propertyId,property.id))});
      if (!stay || stay.status !== 'checked_out') return NextResponse.json({error:'This review link does not match a completed stay at this property.'},{status:400});
      isVerifiedStay=true;
      reservationId=stay.id;
      await tx.update(reviewTokens).set({usedAt:new Date()}).where(eq(reviewTokens.token,tokenRecord.token));
    }

    // Insert review
    const [newReview] = await tx
      .insert(reviews)
      .values({
        propertyId: property.id,
        reservationId: reservationId || undefined,
        guestName: guestName.trim(),
        rating: Math.min(5, Math.max(1, Number(rating))),
        title: title ? title.trim() : null,
        body: reviewBody.trim(),
        source: isVerifiedStay ? 'direct_stay' : 'website',
        status: 'published',
        isVerifiedStay,
        submittedAt: new Date(),
        publishedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      review: newReview,
    });
    });
  } catch (error: any) {
    console.error('Submit review error:', error);
    return NextResponse.json(
      { error: apiError(error) },
      { status: 500 }
    );
  }
}
