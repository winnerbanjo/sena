import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest, assertIndustry } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { apiError } from '@/lib/api-error';
import {
  db,
  restaurantOrders,
  restaurantOrderItems,
  restaurantTables,
  reservations,
  reservationEvents,
  eq,
  and,
  desc,
  sql,
} from '@sena/database';
import crypto from 'crypto';

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
    const status = url.searchParams.get('status');

    let conditions = [eq(restaurantOrders.propertyId, propertyId)];
    if (status) {
      conditions.push(eq(restaurantOrders.status, status));
    }

    const orders = await db
      .select({
        id: restaurantOrders.id,
        orderNumber: restaurantOrders.orderNumber,
        orderType: restaurantOrders.orderType,
        status: restaurantOrders.status,
        tableId: restaurantOrders.tableId,
        tableNumber: restaurantTables.tableNumber,
        reservationId: restaurantOrders.reservationId,
        subtotalMinorUnits: restaurantOrders.subtotalMinorUnits,
        taxMinorUnits: restaurantOrders.taxMinorUnits,
        serviceChargeMinorUnits: restaurantOrders.serviceChargeMinorUnits,
        discountMinorUnits: restaurantOrders.discountMinorUnits,
        totalAmountMinorUnits: restaurantOrders.totalAmountMinorUnits,
        paidAmountMinorUnits: restaurantOrders.paidAmountMinorUnits,
        openedAt: restaurantOrders.openedAt,
        notes: restaurantOrders.notes,
      })
      .from(restaurantOrders)
      .leftJoin(restaurantTables, eq(restaurantOrders.tableId, restaurantTables.id))
      .where(and(...conditions))
      .orderBy(desc(restaurantOrders.openedAt))
      .limit(50);

    return NextResponse.json({ orders });
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

    const propertyId = tenant.propertyId;
    const organizationId = tenant.property.organizationId;
    const body = await req.json();

    const {
      orderType = 'dine_in',
      tableId,
      reservationId,
      items = [],
      notes,
      payNow = false,
      paymentMethod = 'cash',
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Order must contain at least one item.' }, { status: 400 });
    }

    // Calculate subtotal
    let subtotal = 0;
    for (const it of items) {
      const lineTotal = Number(it.unitPriceMinorUnits) * Number(it.quantity);
      if (!Number.isSafeInteger(lineTotal) || lineTotal <= 0) {
        return NextResponse.json({ error: 'Invalid order item pricing.' }, { status: 400 });
      }
      subtotal += lineTotal;
    }

    // 7.5% VAT and 5% Service Charge
    const taxMinorUnits = Math.round(subtotal * 0.075);
    const serviceChargeMinorUnits = Math.round(subtotal * 0.05);
    const totalAmountMinorUnits = subtotal + taxMinorUnits + serviceChargeMinorUnits;

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${Date.now().toString().slice(-4)}${randomSuffix}`;

    const paidAmount = payNow ? totalAmountMinorUnits : 0;
    const initialStatus = payNow ? 'completed' : 'sent_to_kds';

    const [order] = await db
      .insert(restaurantOrders)
      .values({
        propertyId,
        organizationId,
        orderNumber,
        orderType,
        tableId: tableId || null,
        reservationId: reservationId || null,
        status: initialStatus,
        subtotalMinorUnits: subtotal,
        taxMinorUnits,
        serviceChargeMinorUnits,
        totalAmountMinorUnits,
        paidAmountMinorUnits: paidAmount,
        notes: notes ? notes.trim() : null,
      })
      .returning();

    // Insert order items
    for (const it of items) {
      await db.insert(restaurantOrderItems).values({
        orderId: order.id,
        menuItemId: it.menuItemId,
        quantity: Number(it.quantity) || 1,
        unitPriceMinorUnits: Number(it.unitPriceMinorUnits),
        totalAmountMinorUnits: Number(it.unitPriceMinorUnits) * (Number(it.quantity) || 1),
        notes: it.notes ? String(it.notes).trim() : null,
        preparationStation: it.preparationStation || 'kitchen',
        kdsStatus: 'cooking',
        sentToKdsAt: new Date(),
      });
    }

    // If assigned to a table, update table status to occupied
    if (tableId && !payNow) {
      await db
        .update(restaurantTables)
        .set({ status: 'occupied', currentOrderId: order.id, updatedAt: new Date() })
        .where(eq(restaurantTables.id, tableId));
    }

    // If charged to a hotel guest stay folio, log to reservation audit trail
    if (reservationId) {
      const res = await db.query.reservations.findFirst({
        where: and(eq(reservations.id, reservationId), eq(reservations.propertyId, propertyId)),
      });
      if (res) {
        await db
          .update(reservations)
          .set({
            totalAmountMinorUnits: res.totalAmountMinorUnits + totalAmountMinorUnits,
            updatedAt: new Date(),
          })
          .where(eq(reservations.id, reservationId));

        await db.insert(reservationEvents).values({
          reservationId,
          eventType: 'room_service_charge',
          actorId: session?.user?.id || 'system',
          actorName: session?.user?.name || 'Restaurant POS',
          notes: `Posted restaurant bill ${orderNumber} (₦${totalAmountMinorUnits / 100}) to guest folio`,
        });
      }
    }

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    return NextResponse.json({ error: apiError(err) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'restaurant');
export const POST = withMerchant(handlePOST, 'restaurant');
