import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { ReservationService } from '@sena/reservations';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant?.propertyId) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }

    const roomTypeId = req.nextUrl.searchParams.get('roomTypeId') || '';
    const checkInDate = req.nextUrl.searchParams.get('checkInDate') || '';
    const checkOutDate = req.nextUrl.searchParams.get('checkOutDate') || '';
    const forCheckIn = req.nextUrl.searchParams.get('forCheckIn') === '1';
    const excludeReservationId = req.nextUrl.searchParams.get('excludeReservationId') || undefined;
    const allRooms = req.nextUrl.searchParams.get('all') === '1';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate) || checkOutDate <= checkInDate) {
      return NextResponse.json({ error: 'Choose a room category and valid stay dates.' }, { status: 400 });
    }

    if (allRooms) {
      const rooms = await ReservationService.stayEligibleRooms(tenant.propertyId, checkInDate, checkOutDate, excludeReservationId);
      return NextResponse.json({ rooms });
    }

    if (!roomTypeId) {
      return NextResponse.json({ error: 'Choose a room category and valid stay dates.' }, { status: 400 });
    }

    const rooms = await ReservationService.eligibleRooms({
      propertyId: tenant.propertyId,
      roomTypeId,
      checkInDate,
      checkOutDate,
      excludeReservationId,
      forCheckIn,
    });

    return NextResponse.json({ rooms });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'rooms');
