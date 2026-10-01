import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { restoreApartment, roleMayEditApartmentInventory } from '@sena/inventory';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function handlePOST(req: NextRequest) {
  try {
    const merchant = getMerchantRequest(req);
    const propertyId = merchant?.tenant.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    if (!roleMayEditApartmentInventory(merchant?.tenant.role || '')) {
      return NextResponse.json({ error: 'Your role does not allow this action. Contact your property manager.' }, { status: 403 });
    }
    const apartmentId = String(merchant?.body.apartmentId || '');
    const result = await restoreApartment({
      propertyId,
      apartmentId,
      organizationId: merchant.tenant.property.organizationId,
      actor: { id: merchant.tenant.userId, name: merchant.tenant.user.fullName || 'Staff' },
    });
    if (result.outcome === 'not_found') {
      return NextResponse.json({ error: 'That apartment could not be found for this property.' }, { status: 404 });
    }
    if (result.outcome === 'blocked') {
      return NextResponse.json({ error: result.message, code: result.code }, { status: 409 });
    }
    return NextResponse.json({ outcome: 'restored', apartmentId: result.apartmentId });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'apartments');
