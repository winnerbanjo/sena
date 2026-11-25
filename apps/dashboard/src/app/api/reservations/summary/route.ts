import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, reservations } from '@sena/database';

export const dynamic = 'force-dynamic';

/**
 * Property-wide reservation aggregates. Analytics needs totals over the whole
 * history, which the paginated list no longer returns. Keep the sums in SQL so
 * no rows are shipped to the browser.
 */
async function handleGET(req: NextRequest) {
  try {
    const propertyId = getMerchantRequest(req)?.tenant.propertyId;
    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found for user session' }, { status: 403 });
    }

    const [summary] = await db
      .select({
        totalReservations: sql<number>`count(*)::int`,
        validReservations: sql<number>`count(*) filter (where ${reservations.status} <> 'cancelled')::int`,
        totalBookingValueMinorUnits: sql<string>`coalesce(sum(${reservations.totalAmountMinorUnits}) filter (where ${reservations.status} <> 'cancelled'), 0)::text`,
        totalNights: sql<number>`coalesce(sum(${reservations.nights}) filter (where ${reservations.status} <> 'cancelled'), 0)::int`,
        directCount: sql<number>`count(*) filter (where ${reservations.source} = 'direct')::int`,
        frontDeskCount: sql<number>`count(*) filter (where ${reservations.source} in ('walk_in', 'manual'))::int`,
        whatsappCount: sql<number>`count(*) filter (where ${reservations.source} = 'whatsapp')::int`,
        otaCount: sql<number>`count(*) filter (where ${reservations.source} not in ('direct', 'walk_in', 'manual', 'whatsapp'))::int`,
      })
      .from(reservations)
      .where(eq(reservations.propertyId, propertyId));

    const byRoomType = await db
      .select({
        roomTypeId: reservations.roomTypeId,
        paidAmountMinorUnits: sql<string>`coalesce(sum(${reservations.paidAmountMinorUnits}), 0)::text`,
      })
      .from(reservations)
      .where(eq(reservations.propertyId, propertyId))
      .groupBy(reservations.roomTypeId);

    return NextResponse.json({
      summary: {
        ...summary,
        byRoomType: byRoomType.filter((row) => row.roomTypeId),
      },
    });
  } catch (error: unknown) {
    console.error('Reservation summary error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');
