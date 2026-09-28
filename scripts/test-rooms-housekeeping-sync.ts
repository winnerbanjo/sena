import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';

process.env.SENA_TEST_DATABASE_URL = process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@localhost:55432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL = process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS ${name}`);
}

async function run() {
  const { db, organizations, properties, users, propertyMembers, roomTypes, rooms, reservations, housekeepingTasks, eq, and, inArray } = await import('../packages/database/src/index');
  const { ReservationService } = await import('../packages/reservations/src/index');
  const { HousekeepingService, ensureOpenHousekeepingTask } = await import('../packages/housekeeping/src/index');
  const { listEligibleRooms } = await import('../packages/reservations/src/index');

  const runId = crypto.randomUUID().slice(0, 8);
  const guest = (label: string) => ({
    fullName: `${label} ${runId}`,
    email: `${label.toLowerCase().replace(/\s+/g, '-')}-${runId}@example.invalid`,
    phone: '+2348000000000',
    preferences: [] as string[],
  });

  const [org] = await db.insert(organizations).values({ name: 'HK QA', slug: `hk-${runId}` }).returning();
  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'HK QA Hotel',
    slug: `hk-a-${runId}`,
    code: `HK-${runId}`,
    address: 'Local only',
    phone: '',
    email: `hk-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();
  const [other] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'HK QA Other',
    slug: `hk-b-${runId}`,
    code: `HB-${runId}`,
    address: 'Local only',
    phone: '',
    email: `hk-b-${runId}@example.invalid`,
  }).returning();

  const [mary] = await db.insert(users).values({ fullName: 'Mary Housekeeper', email: `mary-${runId}@example.invalid`, passwordHash: 'x', isActive: true }).returning();
  const [tunde] = await db.insert(users).values({ fullName: 'Tunde Manager', email: `tunde-${runId}@example.invalid`, passwordHash: 'x', isActive: true }).returning();
  const [otherStaff] = await db.insert(users).values({ fullName: 'Other Property Staff', email: `other-${runId}@example.invalid`, passwordHash: 'x', isActive: true }).returning();
  await db.insert(propertyMembers).values({ propertyId: property.id, userId: mary.id, role: 'housekeeping' });
  await db.insert(propertyMembers).values({ propertyId: property.id, userId: tunde.id, role: 'manager' });
  await db.insert(propertyMembers).values({ propertyId: other.id, userId: otherStaff.id, role: 'housekeeping' });

  const [deluxe] = await db.insert(roomTypes).values({ propertyId: property.id, name: 'Deluxe Room', bedType: 'King', basePriceMinorUnits: 10000, capacity: 2, totalInventory: 4 }).returning();
  const [room3006] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: deluxe.id, roomNumber: '3006', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [room3008] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: deluxe.id, roomNumber: '3008', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [room3012] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: deluxe.id, roomNumber: '3012', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [otherRoom] = await db.insert(rooms).values({
    propertyId: other.id,
    roomTypeId: (await db.insert(roomTypes).values({ propertyId: other.id, name: 'Other Deluxe', bedType: 'King', basePriceMinorUnits: 10000, capacity: 2, totalInventory: 1 }).returning())[0].id,
    roomNumber: '201',
    housekeepingStatus: 'clean',
    operationalStatus: 'available',
  }).returning();

  const stay = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    roomId: room3008.id,
    checkInDate: '2032-01-10',
    checkOutDate: '2032-01-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Checkout Guest'),
  });
  await ReservationService.checkIn(stay.id, room3008.id, { id: '', name: 'Reception' }, { allowOutstandingBalance: true });
  await ReservationService.checkOut(stay.id, { id: '', name: 'Reception' }, true);

  const afterCheckout = await db.query.rooms.findFirst({ where: eq(rooms.id, room3008.id) });
  const checkoutTasks = await db.select().from(housekeepingTasks).where(and(eq(housekeepingTasks.roomId, room3008.id), inArray(housekeepingTasks.status, ['dirty', 'cleaning'])));
  assert.equal((await db.query.reservations.findFirst({ where: eq(reservations.id, stay.id) }))?.status, 'checked_out');
  assert.equal(afterCheckout?.housekeepingStatus, 'dirty');
  assert.equal(afterCheckout?.operationalStatus, 'available');
  assert.equal(checkoutTasks.length, 1);
  pass('TEST 1 checkout creates one turnover task and marks the room dirty');

  await ReservationService.checkOut(stay.id, { id: '', name: 'Reception' }, true);
  const retryTasks = await db.select().from(housekeepingTasks).where(eq(housekeepingTasks.roomId, room3008.id));
  assert.equal(retryTasks.filter((task) => task.status === 'dirty' || task.status === 'cleaning').length, 1);
  pass('TEST 14 checkout retry does not create a duplicate task');

  await HousekeepingService.sendToHousekeeping(property.id, room3012.id, { id: '', name: 'Front Desk' });
  await HousekeepingService.sendToHousekeeping(property.id, room3012.id, { id: '', name: 'Front Desk' });
  const sent = await db.query.rooms.findFirst({ where: eq(rooms.id, room3012.id) });
  const sentTasks = await db.select().from(housekeepingTasks).where(and(eq(housekeepingTasks.roomId, room3012.id), inArray(housekeepingTasks.status, ['dirty', 'cleaning'])));
  assert.equal(sent?.housekeepingStatus, 'dirty');
  assert.equal(sentTasks.length, 1);
  pass('TEST 2 Rooms send-to-housekeeping updates readiness without duplicate work');

  const assigned = await HousekeepingService.assignStaff(property.id, room3012.id, mary.id, { id: '', name: 'Manager' });
  assert.equal(assigned.assignedToUserId, mary.id);
  const assignedTask = await db.query.housekeepingTasks.findFirst({ where: eq(housekeepingTasks.id, assigned.taskId) });
  assert.equal(assignedTask?.assignedToUserId, mary.id);
  pass('TEST 3 unassigned task can be assigned to same-property staff');

  await assert.rejects(() => HousekeepingService.assignStaff(property.id, room3012.id, otherStaff.id), /not available in your property/);
  pass('TEST 4 assignment to another property staff member is rejected');

  await HousekeepingService.updateStatus(property.id, room3012.id, 'cleaning', { id: mary.id, name: 'Mary Housekeeper' });
  const cleaning = await db.query.rooms.findFirst({ where: eq(rooms.id, room3012.id) });
  assert.equal(cleaning?.housekeepingStatus, 'cleaning');
  await HousekeepingService.updateStatus(property.id, room3012.id, 'clean', { id: mary.id, name: 'Mary Housekeeper' });
  const ready = await db.query.rooms.findFirst({ where: eq(rooms.id, room3012.id) });
  const completed = await db.select().from(housekeepingTasks).where(and(eq(housekeepingTasks.roomId, room3012.id), inArray(housekeepingTasks.status, ['dirty', 'cleaning'])));
  assert.equal(ready?.housekeepingStatus, 'clean');
  assert.equal(completed.length, 0);
  const checkInReady = await listEligibleRooms({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: '2032-02-10',
    checkOutDate: '2032-02-12',
    forCheckIn: true,
  });
  assert.equal(checkInReady.find((room) => room.id === room3012.id)?.eligible, true);
  pass('TEST 5 and 9 assigned → cleaning → clean updates Rooms and Front Desk eligibility');

  await HousekeepingService.updateStatus(property.id, room3012.id, 'clean', { id: mary.id, name: 'Mary Housekeeper' });
  assert.equal((await db.query.rooms.findFirst({ where: eq(rooms.id, room3012.id) }))?.housekeepingStatus, 'clean');
  pass('TEST 6 marking clean twice is idempotent');

  await HousekeepingService.sendToHousekeeping(property.id, room3006.id, { id: '', name: 'Manager' });
  await db.update(rooms).set({ operationalStatus: 'maintenance' }).where(eq(rooms.id, room3006.id));
  const completedMaintenance = await HousekeepingService.updateStatus(property.id, room3006.id, 'clean', { id: mary.id, name: 'Mary Housekeeper' });
  const afterMaintenance = await db.query.rooms.findFirst({ where: eq(rooms.id, room3006.id) });
  assert.equal(completedMaintenance.operationalStatus, 'maintenance');
  assert.equal(afterMaintenance?.operationalStatus, 'maintenance');
  assert.equal(afterMaintenance?.housekeepingStatus, 'clean');
  const blocked = await listEligibleRooms({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: '2032-03-10',
    checkOutDate: '2032-03-12',
    forCheckIn: true,
  });
  assert.equal(blocked.find((room) => room.id === room3006.id)?.eligible, false);
  pass('TEST 7 housekeeping completion does not make an out-of-service room sellable');

  const dirtyArrival = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: '2032-04-10',
    checkOutDate: '2032-04-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Dirty Check-in'),
  });
  await HousekeepingService.sendToHousekeeping(property.id, room3008.id, { id: '', name: 'Front Desk' });
  await assert.rejects(() => ReservationService.checkIn(dirtyArrival.id, room3008.id), /clean room/i);
  pass('TEST 8 immediate check-in to a dirty room is rejected');

  const future = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: '2032-08-10',
    checkOutDate: '2032-08-12',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Future Assignment'),
  });
  const futureAssign = await ReservationService.assignRoom(future.id, room3008.id);
  assert.equal(futureAssign.roomNumber, '3008');
  assert.equal((await db.query.rooms.findFirst({ where: eq(rooms.id, room3008.id) }))?.housekeepingStatus, 'dirty');
  pass('TEST 10 future assignment to a currently dirty room is allowed');

  const workspace = await HousekeepingService.getWorkspace(property.id);
  const roomTruth = workspace.rooms.find((room) => room.id === room3008.id);
  const openTask = workspace.tasks.find((task) => task.roomId === room3008.id && (task.status === 'dirty' || task.status === 'cleaning'));
  assert.equal(roomTruth?.housekeepingStatus, 'dirty');
  assert.ok(openTask);
  pass('TEST 11 Rooms and Housekeeping share the same room readiness source');

  await assert.rejects(() => HousekeepingService.updateStatus(other.id, room3008.id, 'clean'));
  await assert.rejects(() => HousekeepingService.assignStaff(other.id, room3008.id, mary.id));
  pass('TEST 13 cross-property room and task mutation is rejected');

  const raced = await Promise.allSettled([
    HousekeepingService.assignStaff(property.id, room3008.id, mary.id),
    HousekeepingService.assignStaff(property.id, room3008.id, tunde.id),
  ]);
  assert.equal(raced.filter((result) => result.status === 'fulfilled').length, 2);
  const finalTask = (await db.select().from(housekeepingTasks).where(and(eq(housekeepingTasks.roomId, room3008.id), inArray(housekeepingTasks.status, ['dirty', 'cleaning']))))[0];
  assert.ok(finalTask.assignedToUserId === mary.id || finalTask.assignedToUserId === tunde.id);
  assert.equal([mary.id, tunde.id].includes(finalTask.assignedToUserId || ''), true);
  pass('TEST concurrency last authoritative staff assignment wins without duplicate tasks');

  await ensureOpenHousekeepingTask(db as any, { propertyId: property.id, roomId: room3008.id });
  const stillOne = await db.select().from(housekeepingTasks).where(and(eq(housekeepingTasks.roomId, room3008.id), inArray(housekeepingTasks.status, ['dirty', 'cleaning'])));
  assert.equal(stillOne.length, 1);
  pass('ensureOpenHousekeepingTask is idempotent');

  console.log(`${passed} rooms + housekeeping sync checks passed.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
