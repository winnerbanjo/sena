/**
 * Inventory authority: physical rooms are the one source of truth for hotel
 * room capacity. Declared inventory and frozen ledger snapshots can never
 * contradict real inventory.
 */
import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';

process.env.SENA_TEST_DATABASE_URL = process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@127.0.0.1:5432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL = process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS ${name}`);
}

async function run() {
  const { db, organizations, properties, roomTypes, rooms, reservations, bookingHolds, inventory, guests, eq, and } =
    await import('../packages/database/src/index');
  const { categoryAvailability, categoryCapacity, checkAvailability, createHold, releaseHold } =
    await import('../packages/inventory/src/index');

  const runId = crypto.randomUUID().slice(0, 8);
  const [org] = await db.insert(organizations).values({ name: `Inv QA ${runId}`, slug: `inv-${runId}` }).returning();
  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Inventory Authority QA',
    slug: `inv-a-${runId}`,
    code: `IA-${runId}`,
    propertyType: 'hotel',
    country: 'NG',
    address: 'Local only',
    phone: '',
    email: `inv-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    checkInPaymentPolicy: 'pay_at_property',
    checkOutPaymentPolicy: 'pay_at_property',
    directBookingPayAtProperty: false,
    directBookingBankTransfer: false,
  }).returning();

  const [executive] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Executive',
    bedType: 'King',
    basePriceMinorUnits: 10000000,
    capacity: 2,
    totalInventory: 99, // deliberately wrong; physical rooms must win
  }).returning();
  const [room3022] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: executive.id, roomNumber: '3022', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [room4001] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: executive.id, roomNumber: '4001', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();

  const newGuest = async (label: string) => {
    const [guest] = await db.insert(guests).values({
      organizationId: org.id,
      propertyId: property.id,
      fullName: `${label} ${runId}`,
      email: `${label.toLowerCase().replace(/\s+/g, '-')}-${runId}@example.invalid`,
      phone: '+2348000000000',
      preferences: [],
    }).returning();
    return guest.id as string;
  };

  const stay = async (over: Record<string, unknown> = {}) => ({
    propertyId: property.id,
    roomTypeId: executive.id,
    checkInDate: '2028-01-02',
    checkOutDate: '2028-01-04',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guestId: await newGuest('Guest'),
    ...over,
  });
  const avail = (checkInDate: string, checkOutDate: string, excludeReservationId?: string) =>
    categoryAvailability(db, { propertyId: property.id, roomTypeId: executive.id, checkInDate, checkOutDate, excludeReservationId });

  // TEST 1 - two physical rooms, nothing booked.
  let a = await avail('2028-01-02', '2028-01-04');
  assert.equal(a?.source, 'physical-rooms');
  assert.equal(a?.authoritativeCapacity, 2);
  assert.equal(a?.minAvailable, 2);
  pass('TEST 1 physical rooms are the capacity');

  // TEST 2 - one assigned blocking reservation leaves one unit.
  const assigned = await db.insert(reservations).values({
    ...await stay({ checkInDate: '2028-01-10', checkOutDate: '2028-01-12' }),
    reference: `IA-${runId}-A`,
    roomId: room3022.id,
    status: 'confirmed',
    nights: 2,
    totalAmountMinorUnits: 0,
    paidAmountMinorUnits: 0,
  } as any).returning();
  a = await avail('2028-01-10', '2028-01-12');
  assert.equal(a?.minAvailable, 1);
  pass('TEST 2 one assigned reservation consumes one unit');

  // TEST 3 - one unassigned confirmed reservation also consumes one unit.
  await db.insert(reservations).values({
    ...await stay({ checkInDate: '2028-01-20', checkOutDate: '2028-01-22' }),
    reference: `IA-${runId}-B`,
    roomId: null,
    status: 'confirmed',
    nights: 2,
    totalAmountMinorUnits: 0,
    paidAmountMinorUnits: 0,
  } as any);
  a = await avail('2028-01-20', '2028-01-22');
  assert.equal(a?.minAvailable, 1);
  pass('TEST 3 an unassigned reservation consumes one unit');

  // TEST 4 - assigned plus unassigned fills the category.
  await db.insert(reservations).values({
    ...await stay({ checkInDate: '2028-01-20', checkOutDate: '2028-01-22' }),
    reference: `IA-${runId}-C`,
    roomId: room4001.id,
    status: 'confirmed',
    nights: 2,
    totalAmountMinorUnits: 0,
    paidAmountMinorUnits: 0,
  } as any);
  a = await avail('2028-01-20', '2028-01-22');
  assert.equal(a?.minAvailable, 0);
  assert.equal(a?.isAvailable, false);
  pass('TEST 4 assigned plus unassigned leaves no capacity');

  // TEST 5 - checkout day is reusable by the same physical room.
  const checkoutDay = await db.insert(reservations).values({
    ...await stay({ checkInDate: '2028-02-02', checkOutDate: '2028-02-03' }),
    reference: `IA-${runId}-D`,
    roomId: room3022.id,
    status: 'checked_in',
    nights: 1,
    totalAmountMinorUnits: 0,
    paidAmountMinorUnits: 0,
  } as any).returning();
  a = await avail('2028-02-03', '2028-02-04');
  assert.equal(a?.minAvailable, 2);
  pass('TEST 5 checkout day is available for the next arrival');

  // TEST 6 - both rooms check out on Oct 3 while a roomless stay begins Oct 3.
  const scA = await db.insert(reservations).values({
    ...await stay({ checkInDate: '2028-03-02', checkOutDate: '2028-03-03' }),
    reference: `IA-${runId}-SC-A`,
    roomId: room3022.id,
    status: 'checked_in',
    nights: 1,
    totalAmountMinorUnits: 0,
    paidAmountMinorUnits: 0,
  } as any).returning();
  await db.insert(reservations).values({
    ...await stay({ checkInDate: '2028-03-02', checkOutDate: '2028-03-03' }),
    reference: `IA-${runId}-SC-B`,
    roomId: room4001.id,
    status: 'checked_in',
    nights: 1,
    totalAmountMinorUnits: 0,
    paidAmountMinorUnits: 0,
  } as any);
  await db.insert(reservations).values({
    ...await stay({ checkInDate: '2028-03-03', checkOutDate: '2028-03-04' }),
    reference: `IA-${runId}-SC-C`,
    roomId: null,
    status: 'confirmed',
    nights: 1,
    totalAmountMinorUnits: 0,
    paidAmountMinorUnits: 0,
  } as any);
  a = await avail('2028-03-03', '2028-03-04');
  assert.equal(a?.authoritativeCapacity, 2);
  assert.equal(a?.minAvailable, 1, 'one roomless stay consumes exactly one of two released rooms');
  pass('TEST 6 roomless stay on checkout day leaves one room assignable');

  // TEST 7 / 8 - holds.
  await db.insert(bookingHolds).values({
    propertyId: property.id,
    roomTypeId: executive.id,
    checkInDate: '2028-04-01',
    checkOutDate: '2028-04-03',
    quantity: 1,
    status: 'expired',
    expiresAt: new Date(Date.now() - 60_000),
  });
  a = await avail('2028-04-01', '2028-04-03');
  assert.equal(a?.minAvailable, 2);
  pass('TEST 7 an expired hold consumes nothing');

  const hold = await createHold(property.id, executive.id, '2028-04-01', '2028-04-03', 1);
  a = await avail('2028-04-01', '2028-04-03');
  assert.equal(a?.minAvailable, 1);
  pass('TEST 8 a live hold consumes capacity');
  await releaseHold(hold.holdId);
  a = await avail('2028-04-01', '2028-04-03');
  assert.equal(a?.minAvailable, 2);

  // TEST 9 - declared higher than physical never oversells.
  a = await avail('2028-05-01', '2028-05-03');
  assert.equal(a?.declaredTotalInventory, 99);
  assert.equal(a?.authoritativeCapacity, 2);
  pass('TEST 9 declared inventory cannot oversell physical rooms');

  // TEST 10 - declared lower than physical is drift, not a capacity limit.
  await db.update(roomTypes).set({ totalInventory: 1 }).where(eq(roomTypes.id, executive.id));
  a = await avail('2028-05-01', '2028-05-03');
  assert.equal(a?.authoritativeCapacity, 2);
  pass('TEST 10 declared drift is never treated as a capacity limit');

  // TEST 11 - a stale ledger snapshot cannot restrict availability.
  await db.insert(inventory).values({
    propertyId: property.id,
    roomTypeId: executive.id,
    date: '2028-06-01',
    totalInventory: 1,
    reservedInventory: 1,
    blockedInventory: 0,
  });
  await db.insert(rooms).values({ propertyId: property.id, roomTypeId: executive.id, roomNumber: '4002', housekeepingStatus: 'clean', operationalStatus: 'available' });
  a = await avail('2028-06-01', '2028-06-02');
  assert.equal(a?.authoritativeCapacity, 3);
  assert.equal(a?.minAvailable, 3, 'a stale snapshot must not restrict current capacity');
  pass('TEST 11 stale inventory snapshots do not restrict availability');

  // TEST 15 / Direct Booking path uses the same engine.
  const direct = await checkAvailability(property.id, executive.id, '2028-06-01', '2028-06-02');
  assert.equal(direct.minAvailable, 3);
  assert.equal(direct.isAvailable, true);
  pass('TEST 15 Direct Booking shares the authoritative engine');

  // Out-of-service rooms leave capacity without deleting anything.
  await db.update(rooms).set({ operationalStatus: 'maintenance' }).where(eq(rooms.id, room4001.id));
  a = await avail('2028-05-01', '2028-05-03');
  assert.equal(a?.authoritativeCapacity, 2);
  await db.update(rooms).set({ operationalStatus: 'available' }).where(eq(rooms.id, room4001.id));

  // Legacy category with no physical rooms still sells its declared stock.
  const [legacy] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Legacy Wing',
    bedType: 'Queen',
    basePriceMinorUnits: 5000000,
    capacity: 2,
    totalInventory: 3,
  }).returning();
  const legacyCapacity = await categoryCapacity(db, property.id, legacy.id);
  assert.equal(legacyCapacity?.source, 'legacy-declared');
  assert.equal(legacyCapacity?.authoritativeCapacity, 3);
  pass('a category with no physical rooms keeps its declared legacy stock');

  // Self-exclusion keeps an edited stay from conflicting with itself.
  const selfExcluded = await avail('2028-03-02', '2028-03-04', scA[0].id);
  assert.equal(selfExcluded?.minAvailable, 2);
  pass('excluding the stay being edited removes its own self-conflict');

  void checkoutDay;
  void assigned;
  console.log(`\n${passed} inventory authority checks passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});