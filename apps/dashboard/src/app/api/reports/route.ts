import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { parseReportRange, reportRangeBounds } from '@/lib/reports';
import { NextRequest, NextResponse } from 'next/server';
import { db, payments, reservations, rooms, roomTypes, apartments, and, desc, eq, gt, gte, isNull, lte, ne } from '@sena/database';

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

    const [reservationRows, paymentRows, roomRows, roomTypeRows, apartmentRows] = await Promise.all([
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
          apartmentId: reservations.apartmentId,
          roomTypeName: roomTypes.name,
          apartmentName: apartments.name,
        })
        .from(reservations)
        .leftJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
        .leftJoin(apartments, eq(reservations.apartmentId, apartments.id))
        .where(
          and(
            eq(reservations.propertyId, propertyId),
            ne(reservations.status, 'cancelled'),
            ne(reservations.status, 'voided'),
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
      db
        .select({
          id: apartments.id,
          housekeepingStatus: apartments.housekeepingStatus,
        })
        .from(apartments)
        .where(and(eq(apartments.propertyId, propertyId), isNull(apartments.archivedAt))),
    ]);

    return NextResponse.json({
      range,
      days: bounds.days,
      startIso: bounds.startIso,
      endIso: bounds.endIso,
      reservations: reservationRows,
      payments: paymentRows,
      rooms: [
        ...roomRows,
        ...apartmentRows.map((unit) => ({
          id: unit.id,
          roomTypeId: null,
          housekeepingStatus: unit.housekeepingStatus,
          kind: 'apartment' as const,
        })),
      ],
      roomTypes: roomTypeRows,
    });
  } catch (error: unknown) {
    console.error('Reports API error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'reports');
