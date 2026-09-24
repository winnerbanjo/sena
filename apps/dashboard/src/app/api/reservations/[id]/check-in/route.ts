import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ReservationService } from '@sena/reservations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params;
    const body = await req.json();
    const { roomId } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required for check-in' }, { status: 400 });
    }

    const session = await auth();
    const actor = {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Front Desk Staff',
    };

    await ReservationService.checkIn(reservationId, roomId, actor);

    return NextResponse.json({
      success: true,
      message: 'Guest checked in successfully. Room marked occupied.',
    });
  } catch (error: any) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
