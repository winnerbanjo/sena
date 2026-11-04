import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest, assertIndustry } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import { db, restaurantTables, eq, and, asc } from '@sena/database';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const industryCheck = assertIndustry(tenant, ['restaurant']);
    if (industryCheck) return industryCheck;

    const tables = await db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.propertyId, tenant.propertyId))
      .orderBy(asc(restaurantTables.tableNumber));

    return NextResponse.json({ tables });
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
    const { tableNumber, capacity = 4, section = 'indoor' } = body;

    if (!tableNumber || typeof tableNumber !== 'string' || !tableNumber.trim()) {
      return NextResponse.json({ error: 'Table number is required.' }, { status: 400 });
    }

    const [table] = await db
      .insert(restaurantTables)
      .values({
        propertyId: tenant.propertyId,
        tableNumber: tableNumber.trim(),
        capacity: Number(capacity) || 4,
        section: section.trim() || 'indoor',
        status: 'available',
      })
      .returning();

    return NextResponse.json({ success: true, table });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'restaurant');
export const POST = withMerchant(handlePOST, 'restaurant');
