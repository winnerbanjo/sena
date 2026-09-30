import { apiError } from '@/lib/api-error';
import { policyErrorResponse } from '@/lib/financial-status';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ReservationService } from '@sena/reservations';
import { db, reservations, guests, rooms, roomTypes, apartments, properties, eq } from '@sena/database';
import { sendSenaEmail } from '@sena/email';

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params;
    const body = await req.json();
    const roomId = typeof body.roomId === 'string' ? body.roomId : '';
    const allowOutstandingBalance = Boolean(body.allowOutstandingBalance);
    const [existing] = await db
      .select({ apartmentId: reservations.apartmentId })
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .limit(1);
    if (!existing?.apartmentId && !roomId) {
      return NextResponse.json(
        { error: 'Select a physical room before checking in.', code: 'ROOM_ASSIGNMENT_REQUIRED' },
        { status: 400 }
      );
    }

    const session = await auth();
    const actor = {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Front Desk Staff',
    };

    await ReservationService.checkIn(reservationId, existing?.apartmentId ? null : roomId, actor, { allowOutstandingBalance });

    const [resRow] = await db
      .select({ propertyId: reservations.propertyId })
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .limit(1);
    if (resRow?.propertyId) {
      void import('@/lib/integrations/google/calendar')
        .then(({ maybeQueueGoogleReservationSync }) =>
          maybeQueueGoogleReservationSync(resRow.propertyId, reservationId)
        )
        .catch(() => null);
    }

    // Non-blocking stay checkin email
    try {
      const [stayData] = await db
        .select({
          reference: reservations.reference,
          checkoutDate: reservations.checkOutDate,
          guestName: guests.fullName,
          guestEmail: guests.email,
          roomNumber: rooms.roomNumber,
          apartmentName: apartments.name,
          roomTypeName: roomTypes.name,
          propertyName: properties.name,
          propertyAddress: properties.address,
          propertyPhone: properties.phone,
          propertyEmail: properties.email,
        })
        .from(reservations)
        .innerJoin(guests, eq(reservations.guestId, guests.id))
        .leftJoin(rooms, eq(rooms.id, reservations.roomId))
        .leftJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
        .leftJoin(apartments, eq(reservations.apartmentId, apartments.id))
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
            roomNumber: stayData.apartmentName || stayData.roomNumber || 'Apartment',
            roomType: stayData.apartmentName || stayData.roomTypeName || 'Apartment',
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
    const policy = policyErrorResponse(error);
    if (policy) return NextResponse.json(policy.body, { status: policy.status });
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservations');
