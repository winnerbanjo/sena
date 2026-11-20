import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import { reservationListColumns } from '@/lib/reservation-list-columns';
import { db, reservations, guests, rooms, roomTypes, apartments, eq, and, asc, desc, inArray, sql } from '@sena/database';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Operational boards are deliberately bounded. A front desk needs today's
 * arrivals, in-house stays and today's departures, not the property history.
 * If a property exceeds this many rows in one bucket the response says so and
 * the screen shows a truncation notice instead of pretending the list is whole.
 */
const OPERATIONAL_LIST_LIMIT = 1000;

function propertyToday(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function handleGET(req: NextRequest) {
  try {
    const tenant = getMerchantRequest(req)?.tenant;
    if (!tenant) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 });
    const propertyId = tenant.propertyId;
    const today = propertyToday(tenant.property.timezone || 'Africa/Lagos');

    const list = () =>
      db
        .select(reservationListColumns(propertyId))
        .from(reservations)
        .leftJoin(guests, eq(reservations.guestId, guests.id))
        .leftJoin(rooms, eq(reservations.roomId, rooms.id))
        .leftJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
        .leftJoin(apartments, eq(reservations.apartmentId, apartments.id));

    const [arrivalsTodayRows, arrivalsAllRows, inHouseRows, departuresTodayRows, countsRows] = await Promise.all([
      list()
        .where(and(
          eq(reservations.propertyId, propertyId),
          eq(reservations.status, 'confirmed'),
          sql`${reservations.checkInDate} <= ${today}`
        ))
        .orderBy(asc(reservations.checkInDate), desc(reservations.createdAt), desc(reservations.id))
        .limit(OPERATIONAL_LIST_LIMIT + 1),
      list()
        .where(and(eq(reservations.propertyId, propertyId), eq(reservations.status, 'confirmed')))
        .orderBy(asc(reservations.checkInDate), desc(reservations.createdAt), desc(reservations.id))
        .limit(OPERATIONAL_LIST_LIMIT + 1),
      list()
        .where(and(eq(reservations.propertyId, propertyId), eq(reservations.status, 'checked_in')))
        .orderBy(asc(reservations.checkOutDate), desc(reservations.createdAt), desc(reservations.id))
        .limit(OPERATIONAL_LIST_LIMIT + 1),
      list()
        .where(and(
          eq(reservations.propertyId, propertyId),
          eq(reservations.status, 'checked_in'),
          sql`${reservations.checkOutDate} <= ${today}`
        ))
        .orderBy(asc(reservations.checkOutDate), desc(reservations.createdAt), desc(reservations.id))
        .limit(OPERATIONAL_LIST_LIMIT + 1),
      db
        .select({
          arrivalsToday: sql<number>`count(*) filter (where ${reservations.status} = 'confirmed' and ${reservations.checkInDate} <= ${today})::int`,
          arrivalsAll: sql<number>`count(*) filter (where ${reservations.status} = 'confirmed')::int`,
          inHouse: sql<number>`count(*) filter (where ${reservations.status} = 'checked_in')::int`,
          departuresToday: sql<number>`count(*) filter (where ${reservations.status} = 'checked_in' and ${reservations.checkOutDate} <= ${today})::int`,
        })
        .from(reservations)
        .where(and(
          eq(reservations.propertyId, propertyId),
          inArray(reservations.status, ['confirmed', 'checked_in'])
        )),
    ]);

    const counts = countsRows[0] || { arrivalsToday: 0, arrivalsAll: 0, inHouse: 0, departuresToday: 0 };
    const page = (rows: Array<Record<string, unknown>>) => ({
      items: rows.slice(0, OPERATIONAL_LIST_LIMIT).map(({ cursorCreatedAt: _cursorCreatedAt, ...row }) => row),
      truncated: rows.length > OPERATIONAL_LIST_LIMIT,
    });

    return NextResponse.json({
      today,
      limit: OPERATIONAL_LIST_LIMIT,
      arrivals: {
        today: { ...page(arrivalsTodayRows), total: counts.arrivalsToday },
        all: { ...page(arrivalsAllRows), total: counts.arrivalsAll },
      },
      inHouse: { ...page(inHouseRows), total: counts.inHouse },
      departures: {
        today: { ...page(departuresTodayRows), total: counts.departuresToday },
      },
    });
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');
