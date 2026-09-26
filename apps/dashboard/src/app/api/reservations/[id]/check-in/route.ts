import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ReservationService } from '@sena/reservations';
import { db, reservations, guests, rooms, roomTypes, properties, eq } from '@sena/database';
import { sendSenaEmail } from '@sena/email';

async function handlePOST(
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

    // Non-blocking stay checkin email
    try {
      const [stayData] = await db
        .select({
          reference: reservations.reference,
          checkoutDate: reservations.checkOutDate,
          guestName: guests.fullName,
          guestEmail: guests.email,
          roomNumber: rooms.roomNumber,
          roomTypeName: roomTypes.name,
          propertyName: properties.name,
          propertyAddress: properties.address,
          propertyPhone: properties.phone,
          propertyEmail: properties.email,
        })
        .from(reservations)
        .innerJoin(guests, eq(reservations.guestId, guests.id))
        .innerJoin(rooms, eq(rooms.id, roomId))
        .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
        .innerJoin(properties, eq(reservations.propertyId, properties.id))
        .where(eq(reservations.id, reservationId))
        .limit(1);

      if (stayData?.guestEmail) {
        await sendSenaEmail(
          'stay.checkin_confirmation',
          {
            guestName: stayData.guestName,
            reference: stayData.reference,
            propertyName: stayData.propertyName,
            propertyAddress: stayData.propertyAddress,
            propertyPhone: stayData.propertyPhone,
            propertyEmail: stayData.propertyEmail,
            roomNumber: stayData.roomNumber,
            roomType: stayData.roomTypeName,
            checkoutDate: stayData.checkoutDate,
          },
          {
            to: stayData.guestEmail,
            idempotencyKey: `checkin_${reservationId}`,
            relatedEntity: 'reservation',
            relatedId: reservationId,
          }
        );
      }
    } catch (emailErr) {
      console.warn('[CHECKIN EMAIL ERROR]', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Guest checked in successfully. Room marked occupied.',
    });
  } catch (error: any) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservations');
