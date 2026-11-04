import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest, assertIndustry } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import {
  db,
  restaurantOrders,
  restaurantOrderItems,
  restaurantMenuItems,
  restaurantTables,
  eq,
  and,
  inArray,
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

    const propertyId = tenant.propertyId;
    const url = new URL(req.url);
    const station = url.searchParams.get('station'); // 'all', 'kitchen', 'bar', 'grill'

    // Fetch active kitchen orders
    const activeOrders = await db
      .select({
        id: restaurantOrders.id,
        orderNumber: restaurantOrders.orderNumber,
        orderType: restaurantOrders.orderType,
        status: restaurantOrders.status,
        openedAt: restaurantOrders.openedAt,
        notes: restaurantOrders.notes,
        tableNumber: restaurantTables.tableNumber,
      })
      .from(restaurantOrders)
      .leftJoin(restaurantTables, eq(restaurantOrders.tableId, restaurantTables.id))
      .where(
        and(
          eq(restaurantOrders.propertyId, propertyId),
          inArray(restaurantOrders.status, ['open', 'sent_to_kds', 'preparing'])
        )
      )
      .orderBy(asc(restaurantOrders.openedAt))
      .limit(30);

    const orderIds = activeOrders.map((o) => o.id);
    let itemsByOrder: Record<string, any[]> = {};

    if (orderIds.length > 0) {
      let conditions = [inArray(restaurantOrderItems.orderId, orderIds)];
      if (station && station !== 'all') {
        conditions.push(eq(restaurantOrderItems.preparationStation, station));
      }

      const items = await db
        .select({
          id: restaurantOrderItems.id,
          orderId: restaurantOrderItems.orderId,
          quantity: restaurantOrderItems.quantity,
          notes: restaurantOrderItems.notes,
          preparationStation: restaurantOrderItems.preparationStation,
          kdsStatus: restaurantOrderItems.kdsStatus,
          sentToKdsAt: restaurantOrderItems.sentToKdsAt,
          itemName: restaurantMenuItems.name,
          preparationTimeMinutes: restaurantMenuItems.preparationTimeMinutes,
        })
        .from(restaurantOrderItems)
        .innerJoin(restaurantMenuItems, eq(restaurantOrderItems.menuItemId, restaurantMenuItems.id))
        .where(and(...conditions));

      for (const it of items) {
        if (!itemsByOrder[it.orderId]) itemsByOrder[it.orderId] = [];
        itemsByOrder[it.orderId].push(it);
      }
    }

    const tickets = activeOrders
      .map((ord) => ({
        ...ord,
        items: itemsByOrder[ord.id] || [],
      }))
      .filter((ord) => ord.items.length > 0);

    return NextResponse.json({ tickets });
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
    const { itemId, orderId, action } = body;

    if (itemId && action === 'mark_item_ready') {
      await db
        .update(restaurantOrderItems)
        .set({ kdsStatus: 'ready', completedAt: new Date() })
        .where(eq(restaurantOrderItems.id, itemId));
      return NextResponse.json({ success: true, message: 'Item marked ready' });
    }

    if (orderId && action === 'mark_order_ready') {
      await db
        .update(restaurantOrderItems)
        .set({ kdsStatus: 'ready', completedAt: new Date() })
        .where(eq(restaurantOrderItems.orderId, orderId));

      await db
        .update(restaurantOrders)
        .set({ status: 'ready', updatedAt: new Date() })
        .where(eq(restaurantOrders.id, orderId));

      return NextResponse.json({ success: true, message: 'Entire ticket marked ready' });
    }

    return NextResponse.json({ error: 'Invalid KDS action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'restaurant');
export const POST = withMerchant(handlePOST, 'restaurant');
