import { NextRequest, NextResponse } from 'next/server';
import { db, properties, reviews, reviewTokens, eq } from '@sena/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, token, guestName, rating, title, body: reviewBody } = body;

    if (!slug || !guestName || !rating || !reviewBody) {
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

    // Check token if provided
    if (token) {
      const tokenRecord = await db.query.reviewTokens.findFirst({
        where: eq(reviewTokens.token, token.trim()),
      });

      if (tokenRecord && !tokenRecord.usedAt && new Date(tokenRecord.expiresAt) > new Date()) {
        isVerifiedStay = true;
        reservationId = tokenRecord.reservationId;

        // Mark token used
        await db
          .update(reviewTokens)
          .set({ usedAt: new Date() })
          .where(eq(reviewTokens.token, tokenRecord.token));
      }
    }

    // Insert review
    const [newReview] = await db
      .insert(reviews)
      .values({
        propertyId: property.id,
        reservationId: reservationId || undefined,
        guestName: guestName.trim(),
        rating: Math.min(5, Math.max(1, Number(rating))),
        title: title ? title.trim() : null,
        body: reviewBody.trim(),
        source: 'sena',
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
  } catch (error: any) {
    console.error('Submit review error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit review' },
      { status: 500 }
    );
  }
}
