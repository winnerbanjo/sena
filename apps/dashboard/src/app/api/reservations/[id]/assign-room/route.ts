import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ReservationService } from '@sena/reservations';

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params;
    const body = await req.json();
    const roomId = typeof body.roomId === 'string' ? body.roomId : '';

    if (!roomId) {
      return NextResponse.json({ error: 'Select a physical room to assign.', code: 'ROOM_ASSIGNMENT_REQUIRED' }, { status: 400 });
    }

    const session = await auth();
    const actor = {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Front Desk Staff',
    };

    const assigned = await ReservationService.assignRoom(reservationId, roomId, actor);

    return NextResponse.json({
      success: true,
      roomId: assigned.roomId,
      roomNumber: assigned.roomNumber,
      message: `Room ${assigned.roomNumber} assigned.`,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservations');
