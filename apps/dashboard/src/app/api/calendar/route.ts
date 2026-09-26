import { isValidCalendarDate } from '@sena/config';
import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, properties, rooms, roomTypes, reservations, guests , propertyMembers, organizationMembers } from '@sena/database';
import { eq, and, gte, lte, or } from 'drizzle-orm';

import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ rooms: [], reservations: [] });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    // Default 14 days view
    const endDate =
      searchParams.get('endDate') ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate) || endDate <= startDate) return NextResponse.json({ error: 'Choose a valid calendar date range.' }, { status: 400 });

    // 1. Fetch Rooms with Room Types
    const roomList = await db
      .select({
        id: rooms.id,
        roomNumber: rooms.roomNumber,
        floor: rooms.floor,
        operationalStatus: rooms.operationalStatus,
        housekeepingStatus: rooms.housekeepingStatus,
        roomTypeId: rooms.roomTypeId,
        roomTypeName: roomTypes.name,
      })
      .from(rooms)
      .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(rooms.propertyId, propertyId))
      .orderBy(rooms.roomNumber);

    // 2. Fetch Reservations overlapping the date range
    const resList = await db
      .select({
        id: reservations.id,
        reference: reservations.reference,
        roomId: reservations.roomId,
        guestId: reservations.guestId,
        guestName: guests.fullName,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
        status: reservations.status,
        paymentStatus: reservations.paymentStatus,
        source: reservations.source,
      })
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .where(
        and(
          eq(reservations.propertyId, propertyId),
          lte(reservations.checkInDate, endDate),
          gte(reservations.checkOutDate, startDate)
        )
      );

    const payload = {
      rooms: roomList,
      reservations: resList,
      dateRange: { startDate, endDate },
    };

    return NextResponse.json({ ...payload, cached: false });
  } catch (error: any) {
    console.error('Calendar API error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'calendar');
