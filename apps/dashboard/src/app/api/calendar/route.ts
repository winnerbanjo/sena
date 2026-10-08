import { isValidCalendarDate } from '@sena/config';
import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, properties, rooms, roomTypes, apartments, reservations, guests , propertyMembers, organizationMembers } from '@sena/database';
import { eq, and, gte, lte, or, isNull, notInArray } from 'drizzle-orm';

import { noteCountsByReservation } from '@/lib/reservation-notes';
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
    const [roomList, apartmentList] = await Promise.all([
      db
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
        .orderBy(rooms.roomNumber),
      db
        .select({
          id: apartments.id,
          name: apartments.name,
          apartmentType: apartments.apartmentType,
          operationalStatus: apartments.operationalStatus,
          housekeepingStatus: apartments.housekeepingStatus,
        })
        .from(apartments)
        .where(and(eq(apartments.propertyId, propertyId), isNull(apartments.archivedAt)))
        .orderBy(apartments.name),
    ]);
    const calendarRows = [
      ...roomList.map((room) => ({ ...room, kind: 'room' as const, group: 'rooms' as const })),
      ...apartmentList.map((apartment) => ({
        id: apartment.id,
        roomNumber: apartment.name,
        floor: null,
        operationalStatus: apartment.operationalStatus,
        housekeepingStatus: apartment.housekeepingStatus,
        roomTypeId: null,
        roomTypeName: apartment.apartmentType,
        kind: 'apartment' as const,
        group: 'apartments' as const,
      })),
    ];

    // 2. Fetch Reservations overlapping the date range
    const resList = await db
      .select({
        id: reservations.id,
        reference: reservations.reference,
        bookingGroupId: reservations.bookingGroupId,
        roomId: reservations.roomId,
        roomNumber: rooms.roomNumber,
        roomTypeName: roomTypes.name,
        apartmentId: reservations.apartmentId,
        apartmentName: apartments.name,
        guestId: reservations.guestId,
        guestName: guests.fullName,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
        status: reservations.status,
        paymentStatus: reservations.paymentStatus,
        source: reservations.source,
        totalAmountMinorUnits: reservations.totalAmountMinorUnits,
        paidAmountMinorUnits: reservations.paidAmountMinorUnits,
      })
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .leftJoin(rooms, eq(reservations.roomId, rooms.id))
      .leftJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
      .leftJoin(apartments, eq(reservations.apartmentId, apartments.id))
      .where(
        and(
          eq(reservations.propertyId, propertyId),
          notInArray(reservations.status, ['cancelled', 'no_show']),
          lte(reservations.checkInDate, endDate),
          gte(reservations.checkOutDate, startDate)
        )
      );

    const noteCounts = await noteCountsByReservation(propertyId, resList.map((reservation) => reservation.id));
    const payload = {
      rooms: calendarRows,
      reservations: resList.map((reservation) => ({
        ...reservation,
        noteCount: noteCounts.get(reservation.id) || 0,
      })),
      dateRange: { startDate, endDate },
    };

    return NextResponse.json(
      { ...payload, cached: false },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Calendar API error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'calendar');
