export {
  APARTMENT_BLOCKING_STATUSES,
  checkApartmentAvailability,
  createApartmentHold,
  deriveApartmentBoardStatus,
  listEligibleApartments,
  type ApartmentBoardStatus,
  type EligibleApartment,
} from './apartments';
export {
  APARTMENT_REMOVAL_MESSAGES,
  apartmentOwnedStorageKey,
  classifyApartmentRemoval,
  removeApartment,
  restoreApartment,
  roleMayEditApartmentInventory,
  type ApartmentRemovalCode,
  type ApartmentRemovalDecision,
  type ApartmentRemovalFacts,
  type ApartmentRemovalResult,
} from './apartment-removal';
import { getDatesBetween } from '@sena/config';
import { db, inventory, roomTypes, bookingHolds } from '@sena/database';
import { and, eq, inArray, sql, gt } from 'drizzle-orm';
import { categoryAvailability, categoryCapacity } from './room-availability';

export {
  BLOCKING_STAY_STATUSES,
  NON_SELLABLE_OPERATIONAL_STATUSES,
  categoryAvailability,
  categoryCapacity,
  sellableRoomFilter,
  type CapacitySource,
  type CategoryAvailability,
  type CategoryCapacity,
  type CategoryNight,
} from './room-availability';

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
  const availability = await categoryAvailability(db, { propertyId, roomTypeId, checkInDate, checkOutDate });
  if (!availability) return { isAvailable: false, minAvailable: 0 };
  return { isAvailable: availability.isAvailable, minAvailable: Math.max(0, availability.minAvailable) };
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
    // Locking the category row serialises concurrent holds and bookings for it.
    const [roomType] = await tx
      .select({ totalInventory: roomTypes.totalInventory })
      .from(roomTypes)
      .where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.propertyId, propertyId)))
      .limit(1)
      .for('update');

    if (!roomType) {
      throw new Error('Room type not found');
    }

    const availability = await categoryAvailability(tx, { propertyId, roomTypeId, checkInDate, checkOutDate });
    if (!availability) throw new Error('Room type not found');

    const shortNight = availability.nights.find((night) => night.available < quantity);
    if (shortNight) {
      throw new Error(`Room is no longer available for date: ${shortNight.date}`);
    }

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
      minAvailable: availability.minAvailable - quantity,
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
  const [roomType] = await tx
    .select({ totalInventory: roomTypes.totalInventory })
    .from(roomTypes)
    .where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.propertyId, propertyId)))
    .limit(1)
    .for('update');
  if (!roomType) throw new Error('Room type not found');

  const capacity = await categoryCapacity(tx, propertyId, roomTypeId);
  if (!capacity) throw new Error('Room type not found');

  const checkInDate = stayDates[0];
  const checkOutDate = stayDates[stayDates.length - 1];
  // The availability engine reads live reservations, so a stay being written
  // inside this same transaction is not counted twice.
  const availability = await categoryAvailability(tx, {
    propertyId,
    roomTypeId,
    checkInDate,
    checkOutDate,
  });
  if (!availability) throw new Error('Room type not found');

  const shortNight = availability.nights.find((night) => night.available < quantity);
  if (shortNight) {
    throw new Error(`Room is no longer available for date: ${shortNight.date}`);
  }

  // The ledger row is retained for compatibility and reporting, but its
  // capacity column is refreshed from authoritative physical inventory instead
  // of freezing whatever was declared the first time the date was touched.
  for (const date of stayDates) {
    await tx.execute(
      sql`
        INSERT INTO ${inventory} (id, property_id, room_type_id, date, total_inventory, reserved_inventory, blocked_inventory)
        VALUES (gen_random_uuid(), ${propertyId}::uuid, ${roomTypeId}::uuid, ${date}, ${capacity.authoritativeCapacity}, 0, 0)
        ON CONFLICT (property_id, room_type_id, date)
        DO UPDATE SET total_inventory = ${capacity.authoritativeCapacity};
      `
    );
    await tx.execute(
      sql`
        UPDATE ${inventory}
        SET reserved_inventory = reserved_inventory + ${quantity}
        WHERE property_id = ${propertyId}::uuid
          AND room_type_id = ${roomTypeId}::uuid
          AND date = ${date};
      `
    );
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
