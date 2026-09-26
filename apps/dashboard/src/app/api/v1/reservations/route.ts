import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@sena/reservations';
import { db, bookingHolds, roomTypes, properties } from '@sena/database';
import { eq, and } from 'drizzle-orm';
import { authenticateApiRequest, logApiRequest, checkIdempotency, saveIdempotency } from '@/lib/api-auth';
import { dispatchWebhookEvent } from '@/lib/webhooks';

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
    const roomTypeId = body.room_type_id || body.roomTypeId;
    const checkIn = body.check_in || body.checkInDate;
    const checkOut = body.check_out || body.checkOutDate;
    const holdId = body.hold_id || body.holdId;
    const guest = body.guest || {};
    const guestName = guest.full_name || guest.name || guest.fullName;
    const guestEmail = guest.email;
    const guestPhone = guest.phone || '';
    const numGuests = Number(body.num_guests || body.numGuests || 1);
    const adults = Number(body.adults || numGuests || 1);
    const children = Number(body.children || 0);
    const specialRequests = body.special_requests || body.specialRequests || '';
    const paymentMethod = body.payment_method || body.paymentMethod || 'pay_at_property';
    const source = (body.source || 'api') as any;

    if (!propertyId || !roomTypeId || !checkIn || !checkOut || !guestName || !guestEmail) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: "Required fields: 'property_id', 'room_type_id', 'check_in', 'check_out', 'guest.name', 'guest.email'.",
          },
        },
        { status: 400 }
      );
    }

    // 2. Authenticate API key & verify property boundary
    const authResult = await authenticateApiRequest(req, 'reservations:create', propertyId);
    if (!authResult.success) {
      return authResult.response;
    }

    const rawIdempotencyKey = req.headers.get('idempotency-key');
    const idempotencyKey = rawIdempotencyKey ? `connect:${authResult.apiKey.id}:${rawIdempotencyKey}` : undefined;
    if (idempotencyKey && idempotencyKey.length > 255) return NextResponse.json({ error: { code: 'INVALID_REQUEST', message: 'Idempotency key is too long.' } }, { status: 400 });
    if (idempotencyKey) {
      const cached = await checkIdempotency(idempotencyKey);
      if (cached.isReplay) return NextResponse.json(cached.payload, { status: cached.statusCode });
    }

    // 3. If hold_id is passed, verify hold integrity
    if (holdId) {
      const [hold] = await db
        .select()
        .from(bookingHolds)
        .where(
          and(
            eq(bookingHolds.id, holdId),
            eq(bookingHolds.propertyId, propertyId),
            eq(bookingHolds.roomTypeId, roomTypeId)
          )
        )
        .limit(1);

      if (!hold) {
        return NextResponse.json(
          { error: { code: 'HOLD_NOT_FOUND', message: 'The specified hold was not found for this property and room type.' } },
          { status: 404 }
        );
      }

      if (hold.status !== 'active' || new Date(hold.expiresAt) < new Date()) {
        return NextResponse.json(
          { error: { code: 'HOLD_EXPIRED', message: 'The inventory hold has expired or has already been converted.' } },
          { status: 410 }
        );
      }
    }

    // 4. Create reservation atomically via ReservationService
    const reservation = await ReservationService.create(
      {
        propertyId,
        roomTypeId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numGuests,
        adults,
        children,
        source,
        paymentStatus: 'pay_later',
        paidAmountMinorUnits: 0,
        specialRequests,
        guest: {
          fullName: guestName,
          email: guestEmail,
          phone: guestPhone,
        },
        holdId,
      } as any,
      { id: authResult.apiKey.id, name: `API Key (${authResult.apiKey.name})` },
      rawIdempotencyKey ? `connect:${authResult.apiKey.id}:${rawIdempotencyKey}` : undefined
    );

    // Fetch enriched reservation details for response and webhooks
    const fullReservation = await ReservationService.getById(reservation.id);

    const responsePayload = {
      data: {
        id: fullReservation?.id || reservation.id,
        reference: fullReservation?.reference || reservation.reference,
        property_id: propertyId,
        room_type: {
          id: fullReservation?.roomType?.id || roomTypeId,
          name: fullReservation?.roomType?.name || '',
          bed_type: fullReservation?.roomType?.bedType || '',
        },
        check_in: fullReservation?.checkInDate || checkIn,
        check_out: fullReservation?.checkOutDate || checkOut,
        nights: fullReservation?.nights || 1,
        num_guests: fullReservation?.numGuests || numGuests,
        guest: {
          id: fullReservation?.guest?.id,
          name: fullReservation?.guest?.fullName || guestName,
          email: fullReservation?.guest?.email || guestEmail,
          phone: fullReservation?.guest?.phone || guestPhone,
        },
        financials: {
          currency: 'NGN',
          total_amount_minor_units: fullReservation?.totalAmountMinorUnits || 0,
          total_amount: ((fullReservation?.totalAmountMinorUnits || 0) / 100).toFixed(2),
          paid_amount_minor_units: fullReservation?.paidAmountMinorUnits || 0,
          balance_minor_units: fullReservation?.balanceMinorUnits || 0,
          payment_status: fullReservation?.paymentStatus || 'pending',
        },
        status: fullReservation?.status || 'confirmed',
        source: fullReservation?.source || source,
        special_requests: fullReservation?.specialRequests || specialRequests,
        created_at: fullReservation?.createdAt?.toISOString() || new Date().toISOString(),
      },
    };

    // 5. Dispatch Webhooks
    dispatchWebhookEvent(propertyId, 'reservation.created', responsePayload.data);
    dispatchWebhookEvent(propertyId, 'reservation.confirmed', responsePayload.data);

    // 6. Save Idempotency response if key supplied
    if (idempotencyKey) {
      await saveIdempotency(idempotencyKey, 'reservations:create', responsePayload);
    }

    logApiRequest(propertyId, 'POST', '/api/v1/reservations', 201, Date.now() - startTime, authResult.apiKey, req);

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error: any) {
    console.error('API Error /v1/reservations:', error);
    const isConflict = error.message?.includes('not available') || error.message?.includes('capacity');
    const statusCode = isConflict ? 409 : 500;
    const errorCode = isConflict ? 'INVENTORY_UNAVAILABLE' : 'INTERNAL_SERVER_ERROR';

    return NextResponse.json(
      { error: { code: errorCode, message: error.message || 'Failed to create reservation.' } },
      { status: statusCode }
    );
  }
}
