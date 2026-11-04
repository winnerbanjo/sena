import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, guests, reservations, properties , propertyMembers, organizationMembers } from '@sena/database';
import { eq, desc, sql } from 'drizzle-orm';

import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

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

    // One aggregate query avoids two additional queries for every guest.
    const stats = await db.select({
      guestId: reservations.guestId,
      totalStays: sql<number>`count(*) filter (where ${reservations.status} in ('checked_in', 'checked_out'))::int`,
      totalNights: sql<number>`coalesce(sum(${reservations.nights}) filter (where ${reservations.status} in ('checked_in', 'checked_out')), 0)::int`,
      totalSpendMinorUnits: sql<number>`coalesce(sum(${reservations.paidAmountMinorUnits}), 0)::bigint`,
      lastStayDate: sql<string>`max(${reservations.checkInDate}) filter (where ${reservations.status} in ('checked_in', 'checked_out'))`,
    }).from(reservations).where(eq(reservations.propertyId, propertyId)).groupBy(reservations.guestId);
    const byGuest = new Map(stats.map(stat => [stat.guestId, stat]));
    const enrichedGuests = guestList.map(guest => ({ ...guest, totalStays: byGuest.get(guest.id)?.totalStays || 0, totalNights: byGuest.get(guest.id)?.totalNights || 0, totalSpendMinorUnits: Number(byGuest.get(guest.id)?.totalSpendMinorUnits || 0), lastStayDate: byGuest.get(guest.id)?.lastStayDate || null }));

    return NextResponse.json({ guests: enrichedGuests });
  } catch (error: any) {
    console.error('Guests API error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;
    const organizationId = tenant?.property.organizationId;

    if (!propertyId || !organizationId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    }

    const body = await req.json();
    const { fullName, email, phone, identificationType, identificationNumber, preferences, notes } =
      body;

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
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'guests');

export const POST = withMerchant(handlePOST, 'guests');
