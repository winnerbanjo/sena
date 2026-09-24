import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, rooms, roomTypes, reservations, guests } from '@sena/database';
import { getCache, setCache } from '@sena/integrations';
import { eq, and, gte, lte, or } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    let propertyId = (session?.user as any)?.propertyId;

    if (!propertyId) {
      const firstProp = await db.query.properties.findFirst();
      if (firstProp) propertyId = firstProp.id;
    }

    if (!propertyId) {
      return NextResponse.json({ rooms: [], reservations: [] });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    // Default 14 days view
    const endDate =
      searchParams.get('endDate') ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const cacheKey = `calendar:${propertyId}:${startDate}:${endDate}`;
    const cachedData = await getCache<any>(cacheKey);

    if (cachedData) {
      return NextResponse.json({ ...cachedData, cached: true });
    }

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

    // Cache in Valkey for 60 seconds
    await setCache(cacheKey, payload, 60);

    return NextResponse.json({ ...payload, cached: false });
  } catch (error: any) {
    console.error('Calendar API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
