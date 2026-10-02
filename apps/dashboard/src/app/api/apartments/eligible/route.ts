import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listEligibleApartments } from '@sena/inventory';
import { db } from '@sena/database';
import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;
    if (!propertyId) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }

    const checkInDate = req.nextUrl.searchParams.get('checkInDate') || '';
    const checkOutDate = req.nextUrl.searchParams.get('checkOutDate') || '';
    const excludeReservationId = req.nextUrl.searchParams.get('excludeReservationId') || undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate) || checkOutDate <= checkInDate) {
      return NextResponse.json({ error: 'Choose valid stay dates.' }, { status: 400 });
    }

    const apartments = await listEligibleApartments(db, propertyId, checkInDate, checkOutDate, excludeReservationId);
    return NextResponse.json({ apartments });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'apartments');