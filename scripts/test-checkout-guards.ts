import 'dotenv/config';
import assert from 'node:assert/strict';
import { db, organizations, properties, roomTypes, rooms, reservations, housekeepingTasks, reservationEvents, eq, and, inArray } from '../packages/database/src/index';
import { ReservationService } from '../packages/reservations/src/index';

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS: ${name}`);
}

async function run() {
  console.log('--- TEST CHECK-OUT GUARDS & OPERATIONAL TIMESTAMPS ---');

  const runId = crypto.randomUUID().slice(0, 8);
  const staffActor = { id: crypto.randomUUID(), name: 'Front Desk Lead Joy' };

  const [org] = await db.insert(organizations).values({
    name: `CheckOut Guards Org ${runId}`,
    slug: `co-org-${runId}`,
  }).returning();

  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Stay Connect Victoria Island',
    slug: `stayconnect-vi-${runId}`,
    code: `VI-${runId}`,
    address: 'Victoria Island, Lagos',
    phone: '+2348022223333',
    email: `stayconnect-vi-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();

  const [roomType] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Deluxe Room',
    capacity: 2,
    bedType: 'King Bed',
    basePriceMinorUnits: 5005000, // ₦50,050 / night
  }).returning();

  const [room] = await db.insert(rooms).values({
    propertyId: property.id,
    roomTypeId: roomType.id,
    roomNumber: `201-${runId}`,
    operationalStatus: 'available',
    housekeepingStatus: 'clean',
  }).returning();

  const checkInDate = '2026-11-05';
  const checkOutDate = '2026-11-08';

  // 1. Create reservation
  const res = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    roomId: room.id,
    checkInDate,
    checkOutDate,
    numGuests: 2,
    guest: {
      fullName: 'Alhaji Bello',
      email: `bello-${runId}@example.invalid`,
      phone: '+2348088889999',
    },
    paidAmountMinorUnits: 0,
    paymentStatus: 'pay_later',
  }, staffActor);

  assert.equal(res.status, 'confirmed');

  // Guard 1: Cannot check out a confirmed (not yet checked-in) reservation
  let confirmedCheckoutRejected = false;
  try {
    await ReservationService.checkOut(res.id, staffActor, true);
  } catch (err: any) {
    confirmedCheckoutRejected = true;
    assert.match(err.message, /only checked-in stays can be checked out/i);
  }
  assert.ok(confirmedCheckoutRejected, 'Must reject check-out for stays that have not checked in');
  pass('Cannot check out a stay that has not checked in');

  // Check in the guest
  await ReservationService.checkIn(res.id, room.id, staffActor, { allowOutstandingBalance: true });
  const [checkedInRes] = await db.select().from(reservations).where(eq(reservations.id, res.id));
  assert.equal(checkedInRes.status, 'checked_in');
  assert.ok(checkedInRes.actualCheckInAt instanceof Date, 'actualCheckInAt recorded');
  pass('Guest checked in successfully with actualCheckInAt timestamp');

  // Guard 2: Cannot check out with a future timestamp
  const futureTimestamp = new Date(Date.now() + 86400000 * 2); // 2 days in future
  let futureRejected = false;
  try {
    await ReservationService.checkOut(res.id, staffActor, true, { checkoutTimestamp: futureTimestamp });
  } catch (err: any) {
    futureRejected = true;
    assert.match(err.message, /future-dated check-out is not permitted/i);
  }
  assert.ok(futureRejected, 'Must reject future-dated checkout');
  pass('Future-dated check-out is strictly rejected');

  // 2. Perform valid checkout now
  await ReservationService.checkOut(res.id, staffActor, true);

  const [afterCheckOut] = await db.select().from(reservations).where(eq(reservations.id, res.id));
  assert.equal(afterCheckOut.status, 'checked_out');
  assert.ok(afterCheckOut.actualCheckOutAt instanceof Date, 'actualCheckOutAt must be recorded on reservation');
  assert.ok(afterCheckOut.actualCheckOutAt >= checkedInRes.actualCheckInAt!, 'checkout cannot be earlier than checkin');

  const [roomAfterCheckOut] = await db.select().from(rooms).where(eq(rooms.id, room.id));
  assert.equal(roomAfterCheckOut.operationalStatus, 'available', 'Room operational status returns to available');
  assert.equal(roomAfterCheckOut.housekeepingStatus, 'dirty', 'Room housekeeping status transitions to dirty');

  const openHkTasks = await db.select().from(housekeepingTasks).where(
    and(
      eq(housekeepingTasks.propertyId, property.id),
      eq(housekeepingTasks.roomId, room.id),
      inArray(housekeepingTasks.status, ['dirty', 'cleaning'])
    )
  );
  assert.ok(openHkTasks.length > 0, 'Housekeeping task must be created upon check-out');
  pass('Check-out completes successfully: sets actualCheckOutAt, marks room available & dirty, creates housekeeping task');

  // Guard 3: Subsequent check-out call on already checked-out reservation returns idempotently without error
  const idempotentResult = await ReservationService.checkOut(res.id, staffActor, true);
  assert.ok(typeof idempotentResult.outstandingBalanceMinorUnits === 'number');
  pass('Check-out on already checked-out stay is handled idempotently');

  console.log(`\nALL ${passed} CHECK-OUT GUARD TESTS PASSED!\n`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
