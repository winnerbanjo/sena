import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@sena/reservations';

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params;
    const merchant = getMerchantRequest(req);
    const body = merchant?.body ?? (await req.json().catch(() => ({})));

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { error: 'A detailed operational justification (at least 5 characters) is required to reverse a check-out.' },
        { status: 400 }
      );
    }

    const targetRoomId = typeof body.targetRoomId === 'string' && body.targetRoomId ? body.targetRoomId : undefined;

    const actor = {
      id: merchant?.tenant?.userId || '',
      name: merchant?.tenant?.user?.fullName || 'Senior Administrator',
      role: merchant?.tenant?.role,
    };

    await ReservationService.reverseCheckOut(reservationId, actor, reason, { targetRoomId });

    return NextResponse.json({
      success: true,
      message: 'Check-out reversed successfully. Guest stay restored to Checked In.',
    });
  } catch (error: any) {
    console.error('[REVERSE CHECKOUT ERROR]', error);
    if (error.code === 'ROOM_OCCUPIED_CONFLICT' || error.code === 'APARTMENT_OCCUPIED_CONFLICT') {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          conflictingReservationId: error.conflictingReservationId,
          conflictingReference: error.conflictingReference,
          targetRoomId: error.targetRoomId,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservation-reverse-checkout');
