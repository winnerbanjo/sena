import 'dotenv/config';
import assert from 'node:assert/strict';
import { ROLE_PERMISSIONS } from '../packages/config/src/index';
import { db, organizations, properties, roomTypes, rooms, apartments, reservations, housekeepingTasks, reservationEvents, activityLogs, eq, and, inArray } from '../packages/database/src/index';
import { ReservationService } from '../packages/reservations/src/index';

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS: ${name}`);
}

async function run() {
  console.log('--- TEST MASTER ADMINISTRATOR & EMERGENCY CORRECTIONS ---');

  const runId = crypto.randomUUID().slice(0, 8);
  const adminActor = { id: crypto.randomUUID(), name: 'General Manager Sarah' };
  const deskActor = { id: crypto.randomUUID(), name: 'Receptionist Kemi' };

  // 1. Verify Role-Based Permissions
  assert.ok(ROLE_PERMISSIONS.owner.includes('reservation.reverse_checkout'), 'Owner must have reverse checkout permission');
  assert.ok(ROLE_PERMISSIONS.owner.includes('admin.emergency_correction'), 'Owner must have emergency correction permission');
  assert.ok(ROLE_PERMISSIONS.owner.includes('reservation.correct_status'), 'Owner must have correct status permission');
  assert.ok(ROLE_PERMISSIONS.owner.includes('invoice.amend'), 'Owner must have invoice amend permission');

  assert.ok(ROLE_PERMISSIONS.manager.includes('reservation.reverse_checkout'), 'Manager must have reverse checkout permission');
  assert.ok(ROLE_PERMISSIONS.manager.includes('admin.emergency_correction'), 'Manager must have emergency correction permission');
  assert.ok(ROLE_PERMISSIONS.manager.includes('reservation.correct_status'), 'Manager must have correct status permission');
  assert.ok(ROLE_PERMISSIONS.manager.includes('invoice.amend'), 'Manager must have invoice amend permission');

  assert.ok(!ROLE_PERMISSIONS.front_desk.includes('reservation.reverse_checkout'), 'Front desk must NOT have reverse checkout permission');
  assert.ok(!ROLE_PERMISSIONS.front_desk.includes('admin.emergency_correction'), 'Front desk must NOT have emergency correction permission');
  assert.ok(!ROLE_PERMISSIONS.front_desk.includes('reservation.correct_status'), 'Front desk must NOT have correct status permission');
  assert.ok(!ROLE_PERMISSIONS.front_desk.includes('invoice.amend'), 'Front desk must NOT have invoice amend permission');
  pass('RBAC permissions correctly enforce privileged access for Owner and Manager while restricting Front Desk');

  const [org] = await db.insert(organizations).values({
    name: `Master Ops Org ${runId}`,
    slug: `master-org-${runId}`,
  }).returning();

  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Stay Connect Master Property',
    slug: `stayconnect-master-${runId}`,
    code: `MC-${runId}`,
    address: 'Victoria Island, Lagos',
    phone: '+2348033331111',
    email: `master-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();

  const [roomType] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Executive Suite',
    capacity: 2,
    bedType: 'King Bed',
    basePriceMinorUnits: 7500000,
  }).returning();

  const [room1] = await db.insert(rooms).values({
    propertyId: property.id,
    roomTypeId: roomType.id,
    roomNumber: `301-${runId}`,
    operationalStatus: 'available',
    housekeepingStatus: 'clean',
  }).returning();

  const [room2] = await db.insert(rooms).values({
    propertyId: property.id,
    roomTypeId: roomType.id,
    roomNumber: `302-${runId}`,
    operationalStatus: 'available',
    housekeepingStatus: 'clean',
  }).returning();

  // Create stay and check in, then check out
  const stay = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    roomId: room1.id,
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-04',
    numGuests: 2,
    guest: {
      fullName: 'Mr. Emmanuel Cole',
      email: `cole-${runId}@example.invalid`,
      phone: '+2348099991111',
    },
    paidAmountMinorUnits: 0,
    paymentStatus: 'pay_later',
  }, deskActor);

  await ReservationService.checkIn(stay.id, room1.id, deskActor, { allowOutstandingBalance: true });
  await ReservationService.checkOut(stay.id, deskActor, true);

  const [checkedOutRes] = await db.select().from(reservations).where(eq(reservations.id, stay.id));
  assert.equal(checkedOutRes.status, 'checked_out');

  // Test 2: Mandatory Reason Enforcement on Reverse Check-out
  let noReasonRejected = false;
  try {
    await ReservationService.reverseCheckOut(stay.id, adminActor, '');
  } catch (err: any) {
    noReasonRejected = true;
    assert.match(err.message, /detailed operational reason/i);
  }
  assert.ok(noReasonRejected, 'Must reject reverse check-out without detailed justification');

  let shortReasonRejected = false;
  try {
    await ReservationService.reverseCheckOut(stay.id, adminActor, 'oops');
  } catch (err: any) {
    shortReasonRejected = true;
    assert.match(err.message, /at least 5 characters/i);
  }
  assert.ok(shortReasonRejected, 'Must reject reverse check-out with reason under 5 characters');
  pass('Mandatory operational justification enforced (>= 5 chars)');

  // Test 3: Conflict Rejection when Room is Occupied by another guest
  // Simulate another stay assigned to room1 and checked in
  const stay2 = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    roomId: room1.id,
    checkInDate: '2026-11-04',
    checkOutDate: '2026-11-06',
    numGuests: 1,
    guest: {
      fullName: 'New Guest Mrs. Obi',
      email: `obi-${runId}@example.invalid`,
      phone: '+2348099992222',
    },
    paidAmountMinorUnits: 0,
    paymentStatus: 'pay_later',
  }, deskActor);
  // Mark room1 clean after previous guest checkout so stay2 can check in
  await db.update(rooms).set({ housekeepingStatus: 'clean' }).where(eq(rooms.id, room1.id));
  await ReservationService.checkIn(stay2.id, room1.id, deskActor, { allowOutstandingBalance: true });

  let conflictCaught = false;
  try {
    await ReservationService.reverseCheckOut(stay.id, adminActor, 'Erroneous checkout - guest still in room');
  } catch (err: any) {
    conflictCaught = true;
    assert.equal(err.code, 'ROOM_OCCUPIED_CONFLICT');
  }
  assert.ok(conflictCaught, 'Must detect and reject reverse check-out when room is already occupied');
  pass('Structured room conflict returned when unit is occupied by another active stay');

  // Test 4: Conflict Resolution - Reassign to alternate available room (room2)
  await ReservationService.reverseCheckOut(
    stay.id,
    adminActor,
    'Reinstating stay; guest relocated to room 302 due to concurrent occupancy',
    { targetRoomId: room2.id }
  );

  const [reinstatedRes] = await db.select().from(reservations).where(eq(reservations.id, stay.id));
  assert.equal(reinstatedRes.status, 'checked_in', 'Status must return to checked_in');
  assert.equal(reinstatedRes.roomId, room2.id, 'Room must be reassigned to room2');
  assert.equal(reinstatedRes.actualCheckOutAt, null, 'actualCheckOutAt must be cleared upon reversal');

  const [room2State] = await db.select().from(rooms).where(eq(rooms.id, room2.id));
  assert.equal(room2State.operationalStatus, 'occupied', 'Target room operational status must become occupied');

  // Housekeeping task cleanup check
  const openHkTasks = await db.select().from(housekeepingTasks).where(
    and(
      eq(housekeepingTasks.propertyId, property.id),
      eq(housekeepingTasks.roomId, room2.id),
      inArray(housekeepingTasks.status, ['dirty', 'cleaning'])
    )
  );
  assert.equal(openHkTasks.length, 0, 'Open checkout housekeeping task must be cleared');

  // Timeline event check
  const events = await db.select().from(reservationEvents).where(eq(reservationEvents.reservationId, stay.id));
  const revEvent = events.find((e) => e.eventType === 'checkout_reversed');
  assert.ok(revEvent, 'Timeline must record checkout_reversed event');
  assert.match(revEvent.description, /Reinstating stay/);

  // Immutable Activity Log check
  const [log] = await db.select().from(activityLogs).where(
    and(
      eq(activityLogs.resourceId, stay.id),
      eq(activityLogs.action, 'reservation.reverse_checkout')
    )
  );
  assert.ok(log, 'activityLogs must record immutable audit entry');
  assert.equal(log.propertyId, property.id);
  assert.equal(log.actorName, adminActor.name);
  assert.equal((log.previousValue as any)?.status, 'checked_out');
  assert.equal((log.previousValue as any)?.actualCheckOutAt, checkedOutRes.actualCheckOutAt?.toISOString());
  assert.equal((log.newValue as any)?.status, 'checked_in');
  assert.match((log.newValue as any)?.reason, /Reinstating stay/);
  pass('Reverse check-out successfully reinstates stay, resolves conflicts, and writes immutable audit log');

  // Test 5: Emergency Status and Stay Correction
  await ReservationService.emergencyCorrectStay(
    stay.id,
    adminActor,
    {
      checkOutDate: '2026-11-05',
      reason: 'Administrative date correction requested by GM',
    }
  );

  const [correctedRes] = await db.select().from(reservations).where(eq(reservations.id, stay.id));
  assert.equal(correctedRes.checkOutDate, '2026-11-05');
  assert.equal(correctedRes.nights, 4);

  const [correctionLog] = await db.select().from(activityLogs).where(
    and(
      eq(activityLogs.resourceId, stay.id),
      eq(activityLogs.action, 'reservation.emergency_corrected')
    )
  );
  assert.ok(correctionLog, 'activityLogs must record emergency correction');
  assert.match((correctionLog.newValue as any)?.reason, /Administrative date correction/);
  pass('Emergency reservation stay correction successfully applied with audit record');

  console.log(`\nALL ${passed} MASTER ADMINISTRATOR CORRECTION TESTS PASSED!\n`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
