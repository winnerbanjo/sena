import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ReservationService } from '@sena/reservations';
import { resolveTenantForRequest } from '@/lib/tenant';

async function handleGET(
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
    const group = await ReservationService.bookingGroup(tenant.propertyId, id);
    if (!group) return NextResponse.json({ error: 'This booking is not in your property.' }, { status: 404 });
    return NextResponse.json({ bookingGroup: group });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');
