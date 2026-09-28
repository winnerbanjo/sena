import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { parseReportRange, reportRangeBounds } from '@/lib/reports';
import { NextRequest, NextResponse } from 'next/server';
import { db, payments, reservations, rooms, roomTypes, and, desc, eq, gt, gte, lte, ne } from '@sena/database';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const merchant = getMerchantRequest(req);
    const propertyId = merchant?.tenant.propertyId;
    if (!propertyId) {
      return NextResponse.json({
        range: parseReportRange(req.nextUrl.searchParams.get('range')),
        reservations: [],
        payments: [],
        rooms: [],
        roomTypes: [],
        days: 1,
      });
    }

    const range = parseReportRange(req.nextUrl.searchParams.get('range'));
    const bounds = reportRangeBounds(range);
    const rangeEndExclusive = new Date(bounds.end);
    rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);
    rangeEndExclusive.setHours(0, 0, 0, 0);

    const [reservationRows, paymentRows, roomRows, roomTypeRows] = await Promise.all([
      db
        .select({
          id: reservations.id,
          status: reservations.status,
          source: reservations.source,
          nights: reservations.nights,
          totalAmountMinorUnits: reservations.totalAmountMinorUnits,
          paidAmountMinorUnits: reservations.paidAmountMinorUnits,
          checkInDate: reservations.checkInDate,
          checkOutDate: reservations.checkOutDate,
          roomTypeId: reservations.roomTypeId,
          roomTypeName: roomTypes.name,
        })
        .from(reservations)
        .leftJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
        .where(
          and(
            eq(reservations.propertyId, propertyId),
            ne(reservations.status, 'cancelled'),
            lte(reservations.checkInDate, bounds.endIso),
            gt(reservations.checkOutDate, bounds.startIso)
          )
        )
        .orderBy(desc(reservations.createdAt)),
      db
        .select({
          id: payments.id,
          amountMinorUnits: payments.amountMinorUnits,
          provider: payments.provider,
          providerReference: payments.providerReference,
          method: payments.method,
          status: payments.status,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(
          and(
            eq(payments.propertyId, propertyId),
            gte(payments.createdAt, bounds.start),
            lte(payments.createdAt, rangeEndExclusive)
          )
        )
        .orderBy(desc(payments.createdAt)),
      db
        .select({
          id: rooms.id,
          roomTypeId: rooms.roomTypeId,
          housekeepingStatus: rooms.housekeepingStatus,
        })
        .from(rooms)
        .where(eq(rooms.propertyId, propertyId)),
      db
        .select({
          id: roomTypes.id,
          name: roomTypes.name,
          basePriceMinorUnits: roomTypes.basePriceMinorUnits,
        })
        .from(roomTypes)
        .where(eq(roomTypes.propertyId, propertyId)),
    ]);

    return NextResponse.json({
      range,
      days: bounds.days,
      startIso: bounds.startIso,
      endIso: bounds.endIso,
      reservations: reservationRows,
      payments: paymentRows,
      rooms: roomRows,
      roomTypes: roomTypeRows,
    });
  } catch (error: unknown) {
    console.error('Reports API error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'reports');
