import { NextRequest, NextResponse } from 'next/server';
import { db, reservations } from '@sena/database';
import { eq, or } from 'drizzle-orm';
import { ReservationService } from '@sena/reservations';
import { authenticateApiRequest, logApiRequest } from '@/lib/api-auth';
import { dispatchWebhookEvent } from '@/lib/webhooks';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id: idOrRef } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || body.cancellation_reason || 'API request cancellation';

    // 1. Authenticate API key with cancel scope
    const authResult = await authenticateApiRequest(req, 'reservations:cancel');
    if (!authResult.success) {
      return authResult.response;
    }

    // 2. Fetch reservation
    const [resRecord] = await db
      .select()
      .from(reservations)
      .where(or(eq(reservations.id, idOrRef), eq(reservations.reference, idOrRef)))
      .limit(1);

    if (!resRecord) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `Reservation '${idOrRef}' not found.` } },
        { status: 404 }
      );
    }

    // 3. Strict Tenant Isolation
    if (resRecord.propertyId !== authResult.apiKey.propertyId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Tenant boundary violation: you cannot cancel reservations belonging to other properties.' } },
        { status: 403 }
      );
    }

    if (resRecord.status === 'cancelled') {
      return NextResponse.json(
        {
          data: {
            id: resRecord.id,
            reference: resRecord.reference,
            status: 'cancelled',
            message: 'Reservation is already cancelled.',
          },
        },
        { status: 200 }
      );
    }

    // 4. Cancel reservation and release inventory atomically
    await ReservationService.cancel(resRecord.id, {
      id: authResult.apiKey.id,
      name: `API (${authResult.apiKey.name})`,
    });

    const fullReservation = await ReservationService.getById(resRecord.id);

    const responsePayload = {
      data: {
        id: resRecord.id,
        reference: resRecord.reference,
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
        inventory_released: true,
      },
    };

    // 5. Dispatch Webhook Event
    dispatchWebhookEvent(resRecord.propertyId, 'reservation.cancelled', {
      ...responsePayload.data,
      guest: fullReservation?.guest,
      room_type: fullReservation?.roomType,
      check_in: resRecord.checkInDate,
      check_out: resRecord.checkOutDate,
    });

    logApiRequest(resRecord.propertyId, 'POST', `/api/v1/reservations/${idOrRef}/cancel`, 200, Date.now() - startTime, authResult.apiKey, req);

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) {
    console.error('API Error /v1/reservations/[id]/cancel:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to cancel reservation.' } },
      { status: 500 }
    );
  }
}
