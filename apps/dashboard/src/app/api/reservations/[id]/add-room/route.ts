import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@sena/reservations';

async function handlePOST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = getMerchantRequest(req);
    const propertyId = merchant?.tenant.propertyId;
    if (!propertyId) {
      return NextResponse.json(
        { error: 'Your account does not have access to this property.' },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body = merchant?.body || {};

    const accommodationType = body.accommodationType as 'room' | 'apartment';
    if (!accommodationType || !['room', 'apartment'].includes(accommodationType)) {
      return NextResponse.json(
        { error: 'Specify whether to add a hotel room or an apartment.' },
        { status: 400 },
      );
    }

    const result = await ReservationService.addAccommodation(
      {
        propertyId,
        reservationId: id,
        accommodationType,
        roomTypeId: typeof body.roomTypeId === 'string' ? body.roomTypeId : undefined,
        roomId: typeof body.roomId === 'string' ? body.roomId : undefined,
        apartmentId: typeof body.apartmentId === 'string' ? body.apartmentId : undefined,
        checkInDate: typeof body.checkInDate === 'string' ? body.checkInDate : undefined,
        checkOutDate: typeof body.checkOutDate === 'string' ? body.checkOutDate : undefined,
        numGuests: body.numGuests ? Number(body.numGuests) : 1,
        customTotalAmountMinorUnits: body.customTotalAmountMinorUnits != null ? Number(body.customTotalAmountMinorUnits) : null,
        source: typeof body.source === 'string' ? body.source : undefined,
        specialRequests: typeof body.specialRequests === 'string' ? body.specialRequests : undefined,
      },
      {
        id: merchant?.session?.user?.id || '',
        name: merchant?.tenant.user.fullName || 'Front Desk Staff',
      },
    );

    return NextResponse.json({
      success: true,
      message: `Additional accommodation added to booking (${result.reservation.reference})`,
      ...result,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservations');
