import { NextRequest, NextResponse } from 'next/server';
import { createHold, releaseHold } from '@sena/inventory';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { propertyId, roomTypeId, checkInDate, checkOutDate, quantity = 1, guestName, guestEmail } = body;

    if (!propertyId || !roomTypeId || !checkInDate || !checkOutDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: propertyId, roomTypeId, checkInDate, checkOutDate' },
        { status: 400 }
      );
    }

    const holdResult = await createHold(
      propertyId,
      roomTypeId,
      checkInDate,
      checkOutDate,
      Number(quantity),
      { name: guestName, email: guestEmail }
    );

    return NextResponse.json({
      success: true,
      holdId: holdResult.holdId,
      expiresAt: holdResult.expiresAt.toISOString(),
      minAvailable: holdResult.minAvailable,
      message: 'Room temporarily held for 10 minutes.',
    });
  } catch (error: any) {
    console.error('Error creating 10-minute hold:', error);
    // If the room is not available or locked by another concurrent guest
    const isConflict = error.message?.includes('not available') || error.message?.includes('capacity');
    return NextResponse.json(
      { error: error.message || 'Room is no longer available' },
      { status: isConflict ? 409 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const holdId = searchParams.get('holdId');
    if (holdId) {
      await releaseHold(holdId);
    }
    return NextResponse.json({ success: true, message: 'Hold released' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to release hold' }, { status: 500 });
  }
}
