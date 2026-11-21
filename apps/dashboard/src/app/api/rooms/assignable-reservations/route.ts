import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import { reservationListColumns } from '@/lib/reservation-list-columns';
import { db, reservations, guests, rooms, roomTypes, apartments, eq, and, isNull, asc, desc, sql } from '@sena/database';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** One room type's unassigned arrivals; more than this is surfaced, never hidden. */
const ASSIGNABLE_LIST_LIMIT = 1000;

async function handleGET(req: NextRequest) {
  try {
    const tenant = getMerchantRequest(req)?.tenant;
    if (!tenant) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 });
    const propertyId = tenant.propertyId;
    const { searchParams } = new URL(req.url);
    const roomTypeId = (searchParams.get('roomTypeId') || '').trim();
    const roomTypeName = (searchParams.get('roomType') || '').trim().slice(0, 100);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (roomTypeId && !uuid.test(roomTypeId)) {
      return NextResponse.json({ error: 'Unknown room type' }, { status: 400 });
    }
    if (!roomTypeId && !roomTypeName) {
      return NextResponse.json({ error: 'A room type is required' }, { status: 400 });
    }

    const filters = [
      eq(reservations.propertyId, propertyId),
      eq(reservations.status, 'confirmed'),
      isNull(reservations.roomId),
      isNull(reservations.apartmentId),
    ];
    if (roomTypeId) {
      filters.push(eq(reservations.roomTypeId, roomTypeId));
    } else {
      filters.push(eq(roomTypes.name, roomTypeName));
    }

    const rows = await db
      .select(reservationListColumns(propertyId))
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .leftJoin(rooms, eq(reservations.roomId, rooms.id))
      .leftJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
      .leftJoin(apartments, eq(reservations.apartmentId, apartments.id))
      .where(and(...filters))
      .orderBy(asc(reservations.checkInDate), desc(reservations.createdAt), desc(reservations.id))
      .limit(ASSIGNABLE_LIST_LIMIT + 1);

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(reservations)
      .leftJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
      .where(and(...filters));

    const items = rows
      .slice(0, ASSIGNABLE_LIST_LIMIT)
      .map(({ cursorCreatedAt: _cursorCreatedAt, ...row }) => row);

    return NextResponse.json({
      items,
      total: countRow?.total || 0,
      truncated: rows.length > ASSIGNABLE_LIST_LIMIT,
    });
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');
