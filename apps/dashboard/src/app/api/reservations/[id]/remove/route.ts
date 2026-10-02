import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { previewReservationRemoval, removeReservation } from '@sena/reservations';
import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/** Tell the operator what Delete reservation will actually do before they commit. */
async function handleGET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant?.propertyId) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }

    const { id } = await params;
    const preview = await previewReservationRemoval({
      propertyId: tenant.propertyId,
      reservationId: id,
      organizationId: tenant.property.organizationId,
    });
    if (preview.outcome === 'not_found') {
      return NextResponse.json({ error: 'This reservation is no longer available.' }, { status: 404 });
    }
    return NextResponse.json(preview);
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handleDELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant?.propertyId) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }

    const { id } = await params;
    const body = getMerchantRequest(req)?.body || {};

    const result = await removeReservation({
      propertyId: tenant.propertyId,
      reservationId: id,
      organizationId: tenant.property.organizationId,
      actor: {
        id: session?.user?.id || '',
        name: session?.user?.name || 'Hotel Staff',
      },
      reason: body.reason,
      confirmReference: typeof body.confirmReference === 'string' ? body.confirmReference : undefined,
    });

    if (result.outcome === 'not_found') {
      return NextResponse.json({ error: 'This reservation is no longer available.' }, { status: 404 });
    }
    if (result.outcome === 'blocked') {
      return NextResponse.json({ error: result.message, code: result.code }, { status: 409 });
    }
    if (result.outcome === 'confirmation_required') {
      return NextResponse.json(
        { error: result.message, code: result.code, confirmationRequired: true },
        { status: 428 },
      );
    }
    if (result.outcome === 'already_removed') {
      return NextResponse.json({ outcome: result.outcome, reference: result.reference });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'reservation-removal');
export const DELETE = withMerchant(handleDELETE, 'reservation-removal');
