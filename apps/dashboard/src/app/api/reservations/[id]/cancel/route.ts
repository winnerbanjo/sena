import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@sena/reservations';
import { db, activityLogs } from '@sena/database';

export const dynamic = 'force-dynamic';

async function handlePOST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await context.params;
    const merchant = getMerchantRequest(req);
    const tenant = merchant?.tenant;
    const session = merchant?.session;
    const body = merchant?.body || {};

    const reason = typeof body.reason === 'string' ? body.reason.trim() : undefined;

    const actor = {
      id: tenant?.userId || session?.user?.id || '',
      name: tenant?.user?.fullName || 'Staff',
    };

    await ReservationService.cancel(reservationId, actor, reason);

    if (tenant?.propertyId) {
      void import('@/lib/integrations/google/calendar')
        .then(({ maybeQueueGoogleReservationSync }) =>
          maybeQueueGoogleReservationSync(tenant.propertyId, reservationId)
        )
        .catch(() => null);

      const isValidActorUuid = Boolean(
        actor.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor.id)
      );

      await db.insert(activityLogs).values({
        organizationId: tenant.property.organizationId,
        propertyId: tenant.propertyId,
        actorId: isValidActorUuid ? actor.id : undefined,
        actorName: actor.name,
        action: 'reservation.cancelled',
        resource: 'reservation',
        resourceId: reservationId,
        newValue: { reason: reason || null, cancelledAt: new Date().toISOString() },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Reservation cancelled successfully. Inventory released.',
    });
  } catch (error: any) {
    console.error('Cancel reservation error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservation-cancel');
