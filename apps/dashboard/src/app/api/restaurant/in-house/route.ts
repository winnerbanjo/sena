import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import { db, reservations, guests, rooms, apartments, eq, and, asc, sql } from '@sena/database';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Room-charge picker for POS: current in-house stays only, bounded and flagged. */
const IN_HOUSE_LIST_LIMIT = 1000;

async function handleGET(req: NextRequest) {
  try {
    const tenant = getMerchantRequest(req)?.tenant;
    if (!tenant) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 });
    const propertyId = tenant.propertyId;

    const rows = await db
      .select({
        id: reservations.id,
        reference: reservations.reference,
        guestName: guests.fullName,
        roomNumber: rooms.roomNumber,
        apartmentName: apartments.name,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
      })
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .leftJoin(rooms, eq(reservations.roomId, rooms.id))
      .leftJoin(apartments, eq(reservations.apartmentId, apartments.id))
      .where(and(eq(reservations.propertyId, propertyId), eq(reservations.status, 'checked_in')))
      .orderBy(asc(reservations.checkOutDate), asc(reservations.id))
      .limit(IN_HOUSE_LIST_LIMIT + 1);

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(reservations)
      .where(and(eq(reservations.propertyId, propertyId), eq(reservations.status, 'checked_in')));

    return NextResponse.json({
      items: rows.slice(0, IN_HOUSE_LIST_LIMIT),
      total: countRow?.total || 0,
      truncated: rows.length > IN_HOUSE_LIST_LIMIT,
    });
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'restaurant');
