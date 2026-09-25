import { NextRequest, NextResponse } from 'next/server';
import { db, properties, reservations, payments } from '@sena/database';
import { eq, or, and } from 'drizzle-orm';
import { authenticateApiRequest, logApiRequest } from '@/lib/api-auth';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400 }
      );
    }

    const propertyId = body.property_id || body.propertyId;
    const reservationIdentifier = body.reservation_id || body.reservation_reference || body.reservationId;
    const customAmount = body.amount_minor_units || body.amountMinorUnits;
    const customEmail = body.email;
    const callbackUrl = body.callback_url || body.callbackUrl;

    if (!propertyId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PROPERTY_ID', message: "'property_id' is required." } },
        { status: 400 }
      );
    }

    // 1. Authenticate API Key
    const authResult = await authenticateApiRequest(req, 'payments:create', propertyId);
    if (!authResult.success) {
      return authResult.response;
    }

    // 2. Fetch Property
    const [prop] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!prop) {
      return NextResponse.json(
        { error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found.' } },
        { status: 404 }
      );
    }

    let reservationRecord: any = null;
    let amountMinorUnits = customAmount;
    let customerEmail = customEmail;

    // 3. Resolve Reservation if provided
    if (reservationIdentifier) {
      const [res] = await db
        .select()
        .from(reservations)
        .where(
          and(
            eq(reservations.propertyId, propertyId),
            or(eq(reservations.id, reservationIdentifier), eq(reservations.reference, reservationIdentifier))
          )
        )
        .limit(1);

      if (!res) {
        return NextResponse.json(
          { error: { code: 'RESERVATION_NOT_FOUND', message: 'Reservation not found for this property.' } },
          { status: 404 }
        );
      }

      reservationRecord = res;
      if (!amountMinorUnits) {
        amountMinorUnits = res.totalAmountMinorUnits - res.paidAmountMinorUnits;
      }
    }

    if (!amountMinorUnits || amountMinorUnits <= 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_AMOUNT', message: 'Payment amount must be greater than 0.' } },
        { status: 400 }
      );
    }

    if (!customerEmail) {
      return NextResponse.json(
        { error: { code: 'MISSING_EMAIL', message: "Customer 'email' is required to initialize payment." } },
        { status: 400 }
      );
    }

    const reference = `SEN-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 4. Initialize Paystack Transaction
    const host = req.headers.get('host') || 'app.sena.ng';
    const proto = host.includes('localhost') ? 'http' : 'https';
    const fallbackCallback = `${proto}://${host}/booking-preview?reference=${reservationRecord?.reference || ''}&status=verified`;

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: customerEmail,
        amount: amountMinorUnits,
        currency: prop.currency || 'NGN',
        reference,
        callback_url: callbackUrl || fallbackCallback,
        metadata: {
          type: 'booking_payment',
          property_id: propertyId,
          reservation_id: reservationRecord?.id,
          reservation_reference: reservationRecord?.reference,
          api_key_id: authResult.apiKey.id,
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      console.error('Paystack initialization failure:', paystackData);
      return NextResponse.json(
        {
          error: {
            code: 'PAYMENT_GATEWAY_ERROR',
            message: paystackData.message || 'Payment provider could not initialize transaction.',
          },
        },
        { status: 502 }
      );
    }

    // 5. Pre-insert payment record in pending state
    if (reservationRecord) {
      await db.insert(payments).values({
        propertyId,
        reservationId: reservationRecord.id,
        amountMinorUnits,
        currency: prop.currency || 'NGN',
        provider: 'paystack',
        providerReference: reference,
        status: 'pending',
        method: 'card',
        notes: `API initialized payment for reservation ${reservationRecord.reference}`,
      });
    }

    const responsePayload = {
      data: {
        reference,
        amount_minor_units: amountMinorUnits,
        currency: prop.currency || 'NGN',
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reservation_id: reservationRecord?.id,
        reservation_reference: reservationRecord?.reference,
      },
    };

    logApiRequest(propertyId, 'POST', '/api/v1/payments/initialize', 200, Date.now() - startTime, authResult.apiKey, req);

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) {
    console.error('API Error /v1/payments/initialize:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to initialize payment.' } },
      { status: 500 }
    );
  }
}
