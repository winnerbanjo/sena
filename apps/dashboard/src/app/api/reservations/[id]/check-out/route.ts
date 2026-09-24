import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ReservationService } from '@sena/reservations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params;
    const body = await req.json().catch(() => ({}));
    const force = Boolean(body?.force);

    const session = await auth();
    const actor = {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Front Desk Staff',
    };

    const result = await ReservationService.checkOut(reservationId, actor, force);

    if (result.outstandingBalanceMinorUnits > 0 && !force) {
      return NextResponse.json(
        {
          error: 'Outstanding balance pending',
          outstandingBalanceMinorUnits: result.outstandingBalanceMinorUnits,
          requiresForce: true,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Guest checked out successfully. Room marked available & housekeeping task created.',
    });
  } catch (error: any) {
    console.error('Check-out error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
