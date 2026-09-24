import { NextRequest, NextResponse } from 'next/server';
import { db, properties, payments, eq } from '@sena/database';
import { ReservationService } from '@sena/reservations';
import { sendBookingConfirmationEmail } from '@sena/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      holdId,
      propertyId,
      roomTypeId,
      checkInDate,
      checkOutDate,
      numGuests = 1,
      guestName,
      guestEmail,
      guestPhone,
      paymentMethod = 'direct',
    } = body;

    if (!propertyId || !roomTypeId || !checkInDate || !checkOutDate || !guestName || !guestEmail) {
      return NextResponse.json(
        { error: 'Missing required booking details' },
        { status: 400 }
      );
    }

    // Fetch property for email and details
    const property = await db.query.properties.findFirst({
      where: eq(properties.id, propertyId),
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Create reservation (which converts hold atomically)
    const reservation = await ReservationService.create(
      {
        propertyId,
        roomTypeId,
        checkInDate,
        checkOutDate,
        numGuests: Number(numGuests),
        source: 'direct',
        paymentStatus: paymentMethod === 'pay_at_property' ? 'pay_later' : 'paid',
        paidAmountMinorUnits: paymentMethod === 'pay_at_property' ? 0 : undefined,
        guest: {
          fullName: guestName.trim(),
          email: guestEmail.trim().toLowerCase(),
          phone: guestPhone ? guestPhone.trim() : '+234 000 000 0000',
        },
        holdId,
      } as any,
      { id: '', name: 'Guest Direct Booking Engine' }
    );

    // If marked paid, record payment transaction
    if (paymentMethod !== 'pay_at_property') {
      await db.insert(payments).values({
        propertyId,
        reservationId: reservation.id,
        amountMinorUnits: reservation.totalAmountMinorUnits,
        currency: property.currency,
        provider: 'paystack',
        providerReference: `PAY-${reservation.reference}`,
        status: 'successful',
        method: 'card',
        notes: `Online guest booking payment for ${guestName.trim()}`,
      });
    }

    // Trigger transactional confirmation email
    try {
      await sendBookingConfirmationEmail({
        guestEmail: guestEmail.trim().toLowerCase(),
        guestName: guestName.trim(),
        propertyName: property.name,
        reference: reservation.reference,
        roomType: 'Reserved Room',
        checkInDate,
        checkOutDate,
        nights: reservation.nights,
        totalAmountFormatted: `₦${(reservation.totalAmountMinorUnits / 100).toLocaleString()}`,
        propertyAddress: property.address || undefined,
        propertyPhone: property.phone || undefined,
      });
    } catch (emailErr) {
      console.error('Non-critical: Confirmation email dispatch failed:', emailErr);
    }

    return NextResponse.json({
      success: true,
      reservation: {
        id: reservation.id,
        reference: reservation.reference,
        guestName,
        checkInDate,
        checkOutDate,
        nights: reservation.nights,
        totalAmountMinorUnits: reservation.totalAmountMinorUnits,
        status: reservation.status,
      },
    });
  } catch (error: any) {
    console.error('Booking checkout error:', error);
    const isConflict = error.message?.includes('not available') || error.message?.includes('capacity');
    return NextResponse.json(
      { error: error.message || 'Failed to complete reservation' },
      { status: isConflict ? 409 : 500 }
    );
  }
}
