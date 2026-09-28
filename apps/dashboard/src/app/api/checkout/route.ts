import { apiError } from '@/lib/api-error';
import { NextRequest, NextResponse } from 'next/server';
import { db, properties, eq } from '@sena/database';
import { ReservationService } from '@sena/reservations';
import { PaymentService } from '@sena/payments';
import { sendBookingConfirmationEmail } from '@sena/email';
import { directBookingPaymentAvailable } from '@/lib/integrations/paystack';
import { initializePropertyPaystack } from '@/lib/paystack-payments';

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

    const bankAccounts = await PaymentService.listPublicBankAccounts(property.id);
    const payAtPropertyEnabled = property.directBookingPayAtProperty !== false;
    const bankTransferEnabled = property.directBookingBankTransfer !== false && bankAccounts.length > 0;

    if (paymentMethod === 'paystack') {
      const isAvailable = await directBookingPaymentAvailable(property.id);
      if (!isAvailable) {
        return NextResponse.json(
          { error: 'Online payments are unavailable. Contact the property.' },
          { status: 400 }
        );
      }
    } else if (paymentMethod === 'bank_transfer') {
      if (!bankTransferEnabled) {
        return NextResponse.json({ error: 'Bank transfer is not available for this property.' }, { status: 400 });
      }
    } else if (paymentMethod === 'pay_at_property' || paymentMethod === 'direct') {
      if (!payAtPropertyEnabled) {
        return NextResponse.json({ error: 'Pay at property is not available for this booking.' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Choose a valid payment method.' }, { status: 400 });
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
        roomId: undefined,
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

    let onlinePayment;
    if (paymentMethod === 'paystack') {
      const host = req.headers.get('host') || 'app.sena.ng';
      const proto = host.includes('localhost') ? 'http' : 'https';
      onlinePayment = await initializePropertyPaystack({ propertyId: property.id, reservationId: reservation.id, email: guestEmail.trim().toLowerCase(), amountMinorUnits: reservation.totalAmountMinorUnits - reservation.paidAmountMinorUnits, currency: property.currency, source: 'direct_booking', callbackUrl: `${proto}://${host}/${property.slug}/confirmation?reference=${encodeURIComponent(reservation.reference)}&payment=confirming`, idempotencyKey: req.headers.get('idempotency-key') || holdId || undefined });
    }

    return NextResponse.json({
      success: true,
      payment: onlinePayment ? { authorizationUrl: onlinePayment.authorizationUrl, reference: onlinePayment.reference } : null,
      paymentState:
        paymentMethod === 'paystack'
          ? 'pending'
          : paymentMethod === 'bank_transfer'
            ? 'bank_transfer'
            : 'pay_at_property',
      bankAccounts: paymentMethod === 'bank_transfer' ? bankAccounts : [],
      reservation: {
        id: reservation.id,
        reference: reservation.reference,
        guestName,
        checkInDate,
        checkOutDate,
        nights: reservation.nights,
        totalAmountMinorUnits: reservation.totalAmountMinorUnits,
        paidAmountMinorUnits: reservation.paidAmountMinorUnits,
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
