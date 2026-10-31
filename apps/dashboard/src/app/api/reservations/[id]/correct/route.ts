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
        { error: 'A detailed operational justification (at least 5 characters) is required for emergency correction.' },
        { status: 400 }
      );
    }

    const actor = {
      id: merchant?.tenant?.userId || '',
      name: merchant?.tenant?.user?.fullName || 'Senior Administrator',
    };

    await ReservationService.emergencyCorrectStay(reservationId, actor, {
      status: body.status,
      checkInDate: body.checkInDate,
      checkOutDate: body.checkOutDate,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: 'Reservation emergency correction applied successfully.',
    });
  } catch (error: any) {
    console.error('[EMERGENCY CORRECTION ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservation-correct');
