import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest, assertIndustry } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import {
  db,
  restaurantMenuCategories,
  restaurantMenuItems,
  eq,
  and,
  asc,
} from '@sena/database';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['restaurant']);
    if (industryCheck) return industryCheck;

    const categories = await db
      .select()
      .from(restaurantMenuCategories)
      .where(and(eq(restaurantMenuCategories.propertyId, tenant.propertyId), eq(restaurantMenuCategories.isActive, true)))
      .orderBy(asc(restaurantMenuCategories.displayOrder));

    const items = await db
      .select()
      .from(restaurantMenuItems)
      .where(and(eq(restaurantMenuItems.propertyId, tenant.propertyId), eq(restaurantMenuItems.isAvailable, true)))
      .orderBy(asc(restaurantMenuItems.name));

    return NextResponse.json({ categories, items });
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

    if (body.type === 'category') {
      const { name, description, displayOrder = 0 } = body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });
      }
      const [category] = await db
        .insert(restaurantMenuCategories)
        .values({
          propertyId: tenant.propertyId,
          name: name.trim(),
          description: description ? description.trim() : null,
          displayOrder: Number(displayOrder) || 0,
          isActive: true,
        })
        .returning();
      return NextResponse.json({ success: true, category });
    }

    // Creating menu item
    const { categoryId, name, description, priceMinorUnits, costMinorUnits = 0, preparationStation = 'kitchen', preparationTimeMinutes = 15 } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Item name is required.' }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ error: 'Category is required.' }, { status: 400 });
    }
    if (!Number.isSafeInteger(priceMinorUnits) || priceMinorUnits < 0) {
      return NextResponse.json({ error: 'Valid price in minor units is required.' }, { status: 400 });
    }

    const [item] = await db
      .insert(restaurantMenuItems)
      .values({
        propertyId: tenant.propertyId,
        categoryId,
        name: name.trim(),
        description: description ? description.trim() : null,
        priceMinorUnits,
        costMinorUnits: Number(costMinorUnits) || 0,
        preparationStation,
        preparationTimeMinutes: Number(preparationTimeMinutes) || 15,
        isAvailable: true,
      })
      .returning();

    return NextResponse.json({ success: true, item });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'restaurant');
export const POST = withMerchant(handlePOST, 'restaurant');
