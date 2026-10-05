import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ReservationService } from '@sena/reservations';
import { resolveTenantForRequest } from '@/lib/tenant';

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant?.propertyId) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const preview = body.preview === true;
    const result = await ReservationService.updateStay(
      id,
      tenant.propertyId,
      {
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
        numGuests: Number(body.numGuests),
        roomId: body.roomId === undefined ? undefined : body.roomId,
        accommodationType: body.accommodationType,
        roomTypeId: typeof body.roomTypeId === 'string' ? body.roomTypeId : body.roomTypeId === null ? null : undefined,
        apartmentId: typeof body.apartmentId === 'string' ? body.apartmentId : body.apartmentId === null ? null : undefined,
        extensionAmountMinorUnits: body.extensionAmountMinorUnits ?? null,
        adjustmentAmountMinorUnits: body.adjustmentAmountMinorUnits ?? null,
        customTotalAmountMinorUnits: body.customTotalAmountMinorUnits == null ? null : Number(body.customTotalAmountMinorUnits),
        discountAmountMinorUnits: body.discountAmountMinorUnits == null ? null : Number(body.discountAmountMinorUnits),
        extensionReason: typeof body.extensionReason === 'string' ? body.extensionReason : null,
      },
      {
        id: session?.user?.id || '',
        name: session?.user?.name || 'Hotel Staff',
      },
      preview,
    );

    if (!preview && tenant.propertyId) {
      void import('@/lib/integrations/google/calendar')
        .then(({ maybeQueueGoogleReservationSync }) => maybeQueueGoogleReservationSync(tenant.propertyId, id))
        .catch(() => null);
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservations');
