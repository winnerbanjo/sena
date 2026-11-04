import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest, assertIndustry } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import { db, restaurantIngredients, eq, and, asc } from '@sena/database';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['restaurant']);
    if (industryCheck) return industryCheck;

    const ingredients = await db
      .select()
      .from(restaurantIngredients)
      .where(eq(restaurantIngredients.propertyId, tenant.propertyId))
      .orderBy(asc(restaurantIngredients.name));

    return NextResponse.json({ ingredients });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['restaurant']);
    if (industryCheck) return industryCheck;

    const body = await req.json();
    const { name, unitOfMeasure = 'unit', currentStock = 0, minimumStockAlert = 5, costPerUnitMinorUnits = 0, supplierName } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Ingredient name is required.' }, { status: 400 });
    }

    const [ingredient] = await db
      .insert(restaurantIngredients)
      .values({
        propertyId: tenant.propertyId,
        name: name.trim(),
        unitOfMeasure,
        currentStock: String(currentStock),
        minimumStockAlert: String(minimumStockAlert),
        costPerUnitMinorUnits: Number(costPerUnitMinorUnits) || 0,
        supplierName: supplierName ? supplierName.trim() : null,
      })
      .returning();

    return NextResponse.json({ success: true, ingredient });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'restaurant');
export const POST = withMerchant(handlePOST, 'restaurant');
