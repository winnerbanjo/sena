import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ReservationService } from '@sena/reservations';
import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant?.propertyId) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }

    const { id } = await params;
    await ReservationService.cancel(id, {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Hotel Staff',
    });
    return NextResponse.json({ cancelled: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservation-cancel');