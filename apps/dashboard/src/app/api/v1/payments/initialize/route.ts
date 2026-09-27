import { NextRequest, NextResponse } from 'next/server';
import { db, guests, properties, reservations } from '@sena/database';
import { eq, or, and } from 'drizzle-orm';
import { authenticateApiRequest, logApiRequest } from '@/lib/api-auth';
import { initializePropertyPaystack } from '@/lib/paystack-payments';

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

    if (!propertyId || !reservationIdentifier) {
      return NextResponse.json(
        { error: { code: 'MISSING_TARGET', message: "'property_id' and a reservation identifier are required." } },
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
    }
    if (!reservationRecord) {
      return NextResponse.json(
        { error: { code: 'MISSING_RESERVATION', message: 'A reservation identifier is required.' } },
        { status: 400 }
      );
    }
    const guest = await db.query.guests.findFirst({ where: and(eq(guests.id, reservationRecord.guestId), eq(guests.propertyId, propertyId)) });
    const amountMinorUnits = reservationRecord.totalAmountMinorUnits - reservationRecord.paidAmountMinorUnits;
    if (!guest?.email || amountMinorUnits <= 0) {
      return NextResponse.json(
        { error: { code: 'PAYMENT_UNAVAILABLE', message: 'This reservation cannot accept an online payment.' } },
        { status: 400 }
      );
    }

    // 4. Initialize Paystack Transaction
    const host = req.headers.get('host') || 'app.sena.ng';
    const proto = host.includes('localhost') ? 'http' : 'https';
    const fallbackCallback = `${proto}://${host}/booking-preview?reference=${encodeURIComponent(reservationRecord.reference)}&payment=confirming`;
    const initialized = await initializePropertyPaystack({ propertyId, reservationId: reservationRecord.id, email: guest.email, amountMinorUnits, currency: prop.currency || 'NGN', source: 'api_booking', callbackUrl: fallbackCallback, idempotencyKey: req.headers.get('idempotency-key') || undefined });

    const responsePayload = {
      data: {
        reference: initialized.reference,
        amount_minor_units: amountMinorUnits,
        currency: prop.currency || 'NGN',
        authorization_url: initialized.authorizationUrl,
        reservation_id: reservationRecord?.id,
        reservation_reference: reservationRecord?.reference,
      },
    };

    logApiRequest(propertyId, 'POST', '/api/v1/payments/initialize', 200, Date.now() - startTime, authResult.apiKey, req);

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) {
    console.error('API Error /v1/payments/initialize:', error instanceof Error ? error.message : 'unknown');
    const notConnected = error?.message === 'PAYSTACK_NOT_CONNECTED';
    return NextResponse.json(
      { error: { code: notConnected ? 'PAYSTACK_NOT_CONNECTED' : 'PAYMENT_GATEWAY_ERROR', message: notConnected ? 'Online payments are not configured for this property.' : 'Payment provider could not initialize the transaction.' } },
      { status: notConnected ? 409 : 502 }
    );
  }
}
