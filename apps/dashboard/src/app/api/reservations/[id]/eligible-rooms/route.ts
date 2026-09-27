import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { db, reservations, eq, and } from '@sena/database';
import { ReservationService } from '@sena/reservations';

async function handleGET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant?.propertyId) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }

    const { id: reservationId } = await params;
    const forCheckIn = req.nextUrl.searchParams.get('forCheckIn') === '1';

    const [reservation] = await db
      .select({
        id: reservations.id,
        propertyId: reservations.propertyId,
        roomTypeId: reservations.roomTypeId,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
        roomId: reservations.roomId,
      })
      .from(reservations)
      .where(and(eq(reservations.id, reservationId), eq(reservations.propertyId, tenant.propertyId)))
      .limit(1);

    if (!reservation) {
      return NextResponse.json({ error: 'This item is not available in your property.' }, { status: 404 });
    }

    const rooms = await ReservationService.eligibleRooms({
      propertyId: tenant.propertyId,
      roomTypeId: reservation.roomTypeId,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      excludeReservationId: reservation.id,
      forCheckIn,
    });

    return NextResponse.json({
      rooms,
      assignedRoomId: reservation.roomId || null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');
