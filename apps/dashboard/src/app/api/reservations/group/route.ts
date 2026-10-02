import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ReservationService } from '@sena/reservations';
import { resolveTenantForRequest } from '@/lib/tenant';

async function handlePOST(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;
    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found for user session' }, { status: 400 });
    }

    const body = await req.json();
    const roomIds = Array.isArray(body.roomIds) ? body.roomIds.filter((id: unknown) => typeof id === 'string') : [];
    const result = await ReservationService.createGroup(
      {
        propertyId,
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
        roomIds,
        numGuests: Number(body.numGuests || 1),
        source: body.source || 'walk_in',
        guestId: body.guestId,
        guest: body.guest,
        specialRequests: body.specialRequests,
      },
      {
        id: session?.user?.id || '',
        name: session?.user?.name || 'Hotel Staff',
      },
      req.headers.get('idempotency-key') || undefined,
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservations');
