import { getDatesBetween } from '@sena/config';
import { db, inventory, roomTypes, bookingHolds } from '@sena/database';
import { and, eq, inArray, sql, gt } from 'drizzle-orm';

export interface RoomTypeAvailability {
  roomTypeId: string;
  name: string;
  basePriceMinorUnits: number;
  availableCount: number;
  isAvailable: boolean;
}

/**
 * Check room availability for a requested stay range
 * Fast indexed query against inventory model and active 10-minute server-side holds
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

  // Query active unexpired 10-minute holds
  const activeHolds = await db
    .select()
    .from(bookingHolds)
    .where(
      and(
        eq(bookingHolds.propertyId, propertyId),
        eq(bookingHolds.roomTypeId, roomTypeId),
        eq(bookingHolds.status, 'active'),
        gt(bookingHolds.expiresAt, new Date())
      )
    );

  const inventoryByDate = new Map(records.map((r) => [r.date, r]));
  let minAvailable = defaultTotal;

  for (const date of stayDates) {
    const record = inventoryByDate.get(date);
    const total = record ? record.totalInventory : defaultTotal;
    const reserved = record ? record.reservedInventory : 0;
    const blocked = record ? record.blockedInventory : 0;

    // Calculate active holds covering this night
    const held = activeHolds
      .filter((h) => date >= h.checkInDate && date < h.checkOutDate)
      .reduce((sum, h) => sum + h.quantity, 0);

    const available = total - reserved - blocked - held;

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
 * Atomically create a 10-minute inventory hold.
 * Section 58 of PRD: Server-side inventory hold during guest checkout.
 */
export async function createHold(
  propertyId: string,
  roomTypeId: string,
  checkInDate: string,
  checkOutDate: string,
  quantity = 1,
  guestInfo?: { name?: string; email?: string }
): Promise<{ holdId: string; expiresAt: Date; minAvailable: number }> {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Choose a valid number of rooms.');
  const stayDates = getDatesBetween(checkInDate, checkOutDate);
  if (stayDates.length === 0) {
    throw new Error('Invalid stay dates');
  }

  return await db.transaction(async (tx) => {
    // 1. Ensure inventory rows exist & lock room type
    const roomTypeResult = await tx
      .select({ totalInventory: roomTypes.totalInventory })
      .from(roomTypes)
      .where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.propertyId, propertyId)))
      .limit(1).for('update');

    if (roomTypeResult.length === 0) {
      throw new Error('Room type not found');
    }

    const defaultTotal = roomTypeResult[0].totalInventory;

    // Ensure inventory records exist for each night
    for (const date of stayDates) {
      await tx.execute(
        sql`
          INSERT INTO ${inventory} (id, property_id, room_type_id, date, total_inventory, reserved_inventory, blocked_inventory)
          VALUES (gen_random_uuid(), ${propertyId}::uuid, ${roomTypeId}::uuid, ${date}, ${defaultTotal}, 0, 0)
          ON CONFLICT (property_id, room_type_id, date) DO NOTHING;
        `
      );
    }

    // 2. Lock inventory rows FOR UPDATE
    const records = await tx
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.propertyId, propertyId),
          eq(inventory.roomTypeId, roomTypeId),
          inArray(inventory.date, stayDates)
        )
      );

    // 3. Check active holds
    const activeHolds = await tx
      .select()
      .from(bookingHolds)
      .where(
        and(
          eq(bookingHolds.propertyId, propertyId),
          eq(bookingHolds.roomTypeId, roomTypeId),
          eq(bookingHolds.status, 'active'),
          gt(bookingHolds.expiresAt, new Date())
        )
      );

    const inventoryByDate = new Map(records.map((r: any) => [r.date, r]));
    let minAvail = defaultTotal;

    for (const date of stayDates) {
      const record = inventoryByDate.get(date);
      const total = record ? record.totalInventory : defaultTotal;
      const reserved = record ? record.reservedInventory : 0;
      const blocked = record ? record.blockedInventory : 0;
      const held = activeHolds
        .filter((h: any) => date >= h.checkInDate && date < h.checkOutDate)
        .reduce((sum: number, h: any) => sum + h.quantity, 0);

      const available = total - reserved - blocked - held;
      if (available < minAvail) minAvail = available;

      if (available < quantity) {
        throw new Error(`Room is no longer available for date: ${date}`);
      }
    }

    // 4. Create the 10-minute hold
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const [hold] = await tx
      .insert(bookingHolds)
      .values({
        propertyId,
        roomTypeId,
        checkInDate,
        checkOutDate,
        quantity,
        guestEmail: guestInfo?.email,
        guestName: guestInfo?.name,
        status: 'active',
        expiresAt,
      })
      .returning();

    return {
      holdId: hold.id,
      expiresAt: hold.expiresAt,
      minAvailable: minAvail - quantity,
    };
  });
}

/**
 * Release an active hold (e.g. guest cancels or backs out)
 */
export async function releaseHold(holdId: string): Promise<void> {
  await db
    .update(bookingHolds)
    .set({ status: 'released' })
    .where(eq(bookingHolds.id, holdId));
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
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !stayDates.length) throw new Error('Invalid room allocation.');
  await tx.select().from(roomTypes).where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.propertyId, propertyId))).for('update');
  const heldRooms = await tx.select().from(bookingHolds).where(and(eq(bookingHolds.propertyId, propertyId), eq(bookingHolds.roomTypeId, roomTypeId), eq(bookingHolds.status, 'active'), gt(bookingHolds.expiresAt, new Date())));
  for (const date of stayDates) {
    const held = heldRooms.filter((hold: any) => date >= hold.checkInDate && date < hold.checkOutDate).reduce((sum: number, hold: any) => sum + hold.quantity, 0);
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
        WHERE rt.id = ${roomTypeId}::uuid AND rt.property_id = ${propertyId}::uuid
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
          AND (total_inventory - reserved_inventory - blocked_inventory - ${held}) >= ${quantity}
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
