import { NextRequest, NextResponse } from 'next/server';
import { db, reservations } from '@sena/database';
import { eq, or } from 'drizzle-orm';
import { ReservationService } from '@sena/reservations';
import { authenticateApiRequest, logApiRequest } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id: refOrId } = await params;

  try {
    // Authenticate API key
    const authResult = await authenticateApiRequest(req, 'reservations:read');
    if (!authResult.success) {
      return authResult.response;
    }

    // Look up reservation by either reference or ID
    const [found] = await db
      .select({ id: reservations.id, propertyId: reservations.propertyId })
      .from(reservations)
      .where(or(eq(reservations.reference, refOrId), eq(reservations.id, refOrId)))
      .limit(1);

    if (!found) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `Reservation '${refOrId}' not found.` } },
        { status: 404 }
      );
    }

    // Enforce Tenant Isolation
    if (found.propertyId !== authResult.apiKey.propertyId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Tenant boundary violation: you cannot access reservations belonging to other properties.' } },
        { status: 403 }
      );
    }

    const fullReservation = await ReservationService.getById(found.id);
    if (!fullReservation) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `Reservation '${refOrId}' not found.` } },
        { status: 404 }
      );
    }

    const responsePayload = {
      data: {
        id: fullReservation.id,
        reference: fullReservation.reference,
        property_id: fullReservation.propertyId,
        room_type: {
          id: fullReservation.roomType?.id,
          name: fullReservation.roomType?.name,
          bed_type: fullReservation.roomType?.bedType,
        },
        room_id: fullReservation.roomId,
        check_in: fullReservation.checkInDate,
        check_out: fullReservation.checkOutDate,
        nights: fullReservation.nights,
        num_guests: fullReservation.numGuests,
        guest: {
          id: fullReservation.guest?.id,
          name: fullReservation.guest?.fullName,
          email: fullReservation.guest?.email,
          phone: fullReservation.guest?.phone,
        },
        financials: {
          currency: 'NGN',
          total_amount_minor_units: fullReservation.totalAmountMinorUnits,
          total_amount: (fullReservation.totalAmountMinorUnits / 100).toFixed(2),
          paid_amount_minor_units: fullReservation.paidAmountMinorUnits,
          balance_minor_units: fullReservation.balanceMinorUnits,
          payment_status: fullReservation.paymentStatus,
        },
        status: fullReservation.status,
        source: fullReservation.source,
        special_requests: fullReservation.specialRequests,
        created_at: fullReservation.createdAt?.toISOString(),
        updated_at: fullReservation.updatedAt?.toISOString(),
        timeline: fullReservation.events.map((e) => ({
          event_type: e.eventType,
          description: e.description,
          actor_name: e.actorName,
          created_at: e.createdAt?.toISOString(),
        })),
      },
    };

    logApiRequest(found.propertyId, 'GET', `/api/v1/reservations/${refOrId}`, 200, Date.now() - startTime, authResult.apiKey, req);

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) {
    console.error('API Error /v1/reservations/[id]:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Failed to fetch reservation.' } },
      { status: 500 }
    );
  }
}
