import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, guests, reservations, properties , propertyMembers, organizationMembers } from '@sena/database';
import { and, eq, desc, ilike, inArray, or, sql } from 'drizzle-orm';
import { badCursorResponse, cursorIsMalformed, cursorTimestamp, cursorUuid, decodeCursor, encodeCursor, escapeLikePattern, parsePageLimit } from '@/lib/pagination';

import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const { searchParams } = new URL(req.url);
    const limit = parsePageLimit(searchParams.get('limit'));
    const rawCursor = searchParams.get('cursor');
    const cursor = decodeCursor(rawCursor);
    const cursorCreatedAt = cursorTimestamp(cursor?.createdAt);
    const cursorId = cursorUuid(cursor?.id);
    if (cursorIsMalformed(rawCursor, cursor) || (rawCursor && (!cursorCreatedAt || !cursorId))) {
      return NextResponse.json(badCursorResponse(), { status: 400 });
    }
    const search = (searchParams.get('search') || '').trim().slice(0, 100);

    const conditions = [eq(guests.propertyId, propertyId)];
    if (search) {
      const pattern = `%${escapeLikePattern(search)}%`;
      conditions.push(or(
        ilike(guests.fullName, pattern),
        ilike(guests.email, pattern),
        ilike(guests.phone, pattern)
      )!);
    }
    if (cursorCreatedAt && cursorId) {
      conditions.push(sql`(${guests.createdAt}, ${guests.id}) < (${cursorCreatedAt}::timestamptz, ${cursorId}::uuid)`);
    }

    const rows = await db
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
      .where(sql.join(conditions, sql` and `))
      .orderBy(desc(guests.createdAt), desc(guests.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const guestIds = page.map((guest) => guest.id);

    // Aggregate only the guests on this page; money is returned as text so a
    // bigint sum is never narrowed through an unchecked Number().
    const stats = guestIds.length
      ? await db.select({
          guestId: reservations.guestId,
          totalStays: sql<number>`count(*) filter (where ${reservations.status} in ('checked_in', 'checked_out'))::int`,
          totalNights: sql<number>`coalesce(sum(${reservations.nights}) filter (where ${reservations.status} in ('checked_in', 'checked_out')), 0)::int`,
          totalSpendMinorUnits: sql<string>`coalesce(sum(${reservations.paidAmountMinorUnits}), 0)::text`,
          lastStayDate: sql<string | null>`max(${reservations.checkInDate}) filter (where ${reservations.status} in ('checked_in', 'checked_out'))`,
        })
          .from(reservations)
          .where(and(eq(reservations.propertyId, propertyId), inArray(reservations.guestId, guestIds)))
          .groupBy(reservations.guestId)
      : [];

    const byGuest = new Map(stats.map((stat) => [stat.guestId, stat]));
    const items = page.map((guest) => ({
      ...guest,
      totalStays: byGuest.get(guest.id)?.totalStays || 0,
      totalNights: byGuest.get(guest.id)?.totalNights || 0,
      totalSpendMinorUnits: byGuest.get(guest.id)?.totalSpendMinorUnits || '0',
      lastStayDate: byGuest.get(guest.id)?.lastStayDate || null,
    }));

    const last = page[page.length - 1];
    const nextCursor = rows.length > limit && last
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null;

    return NextResponse.json({ items, nextCursor });
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
