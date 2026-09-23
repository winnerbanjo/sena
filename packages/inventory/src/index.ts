import { getDatesBetween } from '@sena/config';
import { db, inventory, roomTypes } from '@sena/database';
import { and, eq, inArray, sql } from 'drizzle-orm';

export interface RoomTypeAvailability {
  roomTypeId: string;
  name: string;
  basePriceMinorUnits: number;
  availableCount: number;
  isAvailable: boolean;
}

/**
 * Check room availability for a requested stay range
 * Fast cached / indexed query against inventory model
 */
export async function checkAvailability(
  propertyId: string,
  roomTypeId: string,
  checkInDate: string,
  checkOutDate: string
): Promise<{ isAvailable: boolean; minAvailable: number }> {
  const stayDates = getDatesBetween(checkInDate, checkOutDate);
  if (stayDates.length === 0) {
    return { isAvailable: false, minAvailable: 0 };
  }

  // Fetch room type total inventory
  const roomTypeResult = await db
    .select({ totalInventory: roomTypes.totalInventory })
    .from(roomTypes)
    .where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.propertyId, propertyId)))
    .limit(1);

  if (roomTypeResult.length === 0) {
    return { isAvailable: false, minAvailable: 0 };
  }

  const defaultTotal = roomTypeResult[0].totalInventory;

  // Query inventory rows for each night
  const records = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.propertyId, propertyId),
        eq(inventory.roomTypeId, roomTypeId),
        inArray(inventory.date, stayDates)
      )
    );

  const inventoryByDate = new Map(records.map((r) => [r.date, r]));
  let minAvailable = defaultTotal;

  for (const date of stayDates) {
    const record = inventoryByDate.get(date);
    const total = record ? record.totalInventory : defaultTotal;
    const reserved = record ? record.reservedInventory : 0;
    const blocked = record ? record.blockedInventory : 0;
    const available = total - reserved - blocked;

    if (available < minAvailable) {
      minAvailable = available;
    }

    if (available <= 0) {
      return { isAvailable: false, minAvailable: 0 };
    }
  }

  return { isAvailable: minAvailable > 0, minAvailable };
}

/**
 * Atomically reserve inventory within an active database transaction.
 * Uses row-level lock or UPSERT with concurrency check.
 */
export async function reserveInventoryInTransaction(
  tx: any,
  propertyId: string,
  roomTypeId: string,
  stayDates: string[],
  quantity = 1
): Promise<boolean> {
  for (const date of stayDates) {
    // 1. Ensure inventory row exists or lock it with FOR UPDATE
    await tx.execute(
      sql`
        INSERT INTO ${inventory} (id, property_id, room_type_id, date, total_inventory, reserved_inventory, blocked_inventory)
        SELECT 
          gen_random_uuid(), 
          ${propertyId}::uuid, 
          ${roomTypeId}::uuid, 
          ${date}, 
          rt.total_inventory, 
          0, 
          0
        FROM ${roomTypes} rt
        WHERE rt.id = ${roomTypeId}::uuid
        ON CONFLICT (property_id, room_type_id, date) DO NOTHING;
      `
    );

    // 2. Lock row and verify available capacity: (total - reserved - blocked) >= quantity
    const updated = await tx.execute(
      sql`
        UPDATE ${inventory}
        SET reserved_inventory = reserved_inventory + ${quantity}
        WHERE property_id = ${propertyId}::uuid
          AND room_type_id = ${roomTypeId}::uuid
          AND date = ${date}
          AND (total_inventory - reserved_inventory - blocked_inventory) >= ${quantity}
        RETURNING id;
      `
    );

    if (!updated || updated.length === 0) {
      throw new Error(`Room is no longer available for date: ${date}`);
    }
  }

  return true;
}

/**
 * Release reserved inventory (e.g. upon cancellation)
 */
export async function releaseInventoryInTransaction(
  tx: any,
  propertyId: string,
  roomTypeId: string,
  stayDates: string[],
  quantity = 1
): Promise<void> {
  for (const date of stayDates) {
    await tx.execute(
      sql`
        UPDATE ${inventory}
        SET reserved_inventory = GREATEST(0, reserved_inventory - ${quantity})
        WHERE property_id = ${propertyId}::uuid
          AND room_type_id = ${roomTypeId}::uuid
          AND date = ${date};
      `
    );
  }
}
