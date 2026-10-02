import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { updateStay } from '@sena/reservations';

async function handlePATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const merchant = getMerchantRequest(req);
    const propertyId = merchant?.tenant.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    const { id } = await context.params;
    const body = merchant?.body || {};
    const preview = body.preview === true;
    const result = await updateStay(
      id,
      propertyId,
      {
        checkInDate: String(body.checkInDate || ''),
        checkOutDate: String(body.checkOutDate || ''),
        numGuests: Number(body.numGuests || 1),
        roomId: typeof body.roomId === 'string' ? body.roomId : body.roomId === null ? null : undefined,
        extensionAmountMinorUnits: body.extensionAmountMinorUnits == null ? null : Number(body.extensionAmountMinorUnits),
        adjustmentAmountMinorUnits: body.adjustmentAmountMinorUnits == null ? null : Number(body.adjustmentAmountMinorUnits),
        extensionReason: typeof body.extensionReason === 'string' ? body.extensionReason : null,
      },
      {
        id: merchant?.session?.user?.id || '',
        name: merchant?.tenant.user.fullName || 'Front Desk Staff',
      },
      preview,
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const PATCH = withMerchant(handlePATCH, 'reservations');
