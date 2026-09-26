import { apiError } from '@/lib/api-error';
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
        paymentStatus: 'pay_later',
        paidAmountMinorUnits: 0,
        guest: {
          fullName: guestName.trim(),
          email: guestEmail.trim().toLowerCase(),
          phone: guestPhone ? guestPhone.trim() : '+234 000 000 0000',
        },
        holdId,
      } as any,
      { id: '', name: 'Guest Direct Booking Engine' },
      holdId || req.headers.get('idempotency-key') || undefined
    );

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
      },
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: apiError(error) },
      { status: 500 }
    );
  }
}
