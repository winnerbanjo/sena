import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, guests, reservations, properties } from '@sena/database';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    let propertyId = (session?.user as any)?.propertyId;

    if (!propertyId) {
      const firstProp = await db.query.properties.findFirst();
      if (firstProp) propertyId = firstProp.id;
    }

    if (!propertyId) {
      return NextResponse.json({ guests: [] });
    }

    const guestList = await db
      .select({
        id: guests.id,
        fullName: guests.fullName,
        email: guests.email,
        phone: guests.phone,
        identificationType: guests.identificationType,
        identificationNumber: guests.identificationNumber,
        preferences: guests.preferences,
        notes: guests.notes,
        createdAt: guests.createdAt,
      })
      .from(guests)
      .where(eq(guests.propertyId, propertyId))
      .orderBy(desc(guests.createdAt));

    // Compute stays and spend per guest
    const enrichedGuests = await Promise.all(
      guestList.map(async (g) => {
        const resStats = await db
          .select({
            count: sql<number>`count(*)::int`,
            totalSpent: sql<number>`coalesce(sum(${reservations.paidAmountMinorUnits}), 0)::int`,
          })
          .from(reservations)
          .where(eq(reservations.guestId, g.id));

        const lastRes = await db
          .select({ checkInDate: reservations.checkInDate })
          .from(reservations)
          .where(eq(reservations.guestId, g.id))
          .orderBy(desc(reservations.checkInDate))
          .limit(1);

        return {
          ...g,
          totalStays: resStats[0]?.count || 0,
          totalSpendMinorUnits: resStats[0]?.totalSpent || 0,
          lastStayDate: lastRes[0]?.checkInDate || null,
        };
      })
    );

    return NextResponse.json({ guests: enrichedGuests });
  } catch (error: any) {
    console.error('Guests API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    let propertyId = (session?.user as any)?.propertyId;

    if (!propertyId) {
      const firstProp = await db.query.properties.findFirst();
      if (firstProp) propertyId = firstProp.id;
    }

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    }

    const body = await req.json();
    const { fullName, email, phone, identificationType, identificationNumber, preferences, notes } =
      body;

    const [prop] = await db
      .select({ organizationId: properties.organizationId })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    const organizationId = prop?.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Property has no associated organization' }, { status: 400 });
    }

    const [newGuest] = await db
      .insert(guests)
      .values({
        organizationId,
        propertyId,
        fullName,
        email,
        phone,
        identificationType,
        identificationNumber,
        preferences: preferences || [],
        notes,
      })
      .returning();

    return NextResponse.json({ success: true, guest: newGuest });
  } catch (error: any) {
    console.error('Guest create error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
