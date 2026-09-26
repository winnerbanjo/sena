import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ReservationService } from '@sena/reservations';
import { db, reservations, guests, properties, eq } from '@sena/database';
import { sendSenaEmail } from '@sena/email';

async function handlePOST(
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

    // Non-blocking checkout thank you email
    try {
      const [stayData] = await db
        .select({
          reference: reservations.reference,
          guestName: guests.fullName,
          guestEmail: guests.email,
          propertyName: properties.name,
          propertyAddress: properties.address,
          propertyPhone: properties.phone,
          propertyEmail: properties.email,
        })
        .from(reservations)
        .innerJoin(guests, eq(reservations.guestId, guests.id))
        .innerJoin(properties, eq(reservations.propertyId, properties.id))
        .where(eq(reservations.id, reservationId))
        .limit(1);

      if (stayData?.guestEmail) {
        await sendSenaEmail(
          'stay.checkout_thank_you',
          {
            guestName: stayData.guestName,
            reference: stayData.reference,
            propertyName: stayData.propertyName,
            propertyAddress: stayData.propertyAddress,
            propertyPhone: stayData.propertyPhone,
            propertyEmail: stayData.propertyEmail,
            bookAgainUrl: 'https://sena.ng',
          },
          {
            to: stayData.guestEmail,
            idempotencyKey: `checkout_${reservationId}`,
            relatedEntity: 'reservation',
            relatedId: reservationId,
          }
        );
      }
    } catch (emailErr) {
      console.warn('[CHECKOUT EMAIL ERROR]', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Guest checked out successfully. Room marked available & housekeeping task created.',
    });
  } catch (error: any) {
    console.error('Check-out error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservations');
