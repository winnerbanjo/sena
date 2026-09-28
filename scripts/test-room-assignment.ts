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
  const { db, organizations, properties, roomTypes, rooms, reservations, inventory, eq, and } = await import('../packages/database/src/index');
  const { ReservationService, listEligibleRooms } = await import('../packages/reservations/src/index');
  const { checkAvailability } = await import('../packages/inventory/src/index');

  const runId = crypto.randomUUID().slice(0, 8);
  const guest = (label: string) => ({
    fullName: `${label} ${runId}`,
    email: `${label.toLowerCase().replace(/\s+/g, '-')}-${runId}@example.invalid`,
    phone: '+2348000000000',
    preferences: [] as string[],
  });

  const [org] = await db.insert(organizations).values({ name: 'Assignment QA', slug: `assign-${runId}` }).returning();
  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Assignment QA Hotel',
    slug: `assign-a-${runId}`,
    code: `AA-${runId}`,
    address: 'Local only',
    phone: '',
    email: `assign-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();
  const [other] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Assignment QA Other',
    slug: `assign-b-${runId}`,
    code: `AB-${runId}`,
    address: 'Local only',
    phone: '',
    email: `assign-b-${runId}@example.invalid`,
  }).returning();

  const [deluxe] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Deluxe Room',
    bedType: 'King',
    basePriceMinorUnits: 10000,
    capacity: 2,
    totalInventory: 4,
  }).returning();
  const [executive] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Executive Suite',
    bedType: 'King',
    basePriceMinorUnits: 20000,
    capacity: 2,
    totalInventory: 1,
  }).returning();
  const [otherType] = await db.insert(roomTypes).values({
    propertyId: other.id,
    name: 'Other Deluxe',
    bedType: 'King',
    basePriceMinorUnits: 10000,
    capacity: 2,
    totalInventory: 1,
  }).returning();

  const [room301] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: deluxe.id, roomNumber: '301', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [room302] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: deluxe.id, roomNumber: '302', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [room303] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: deluxe.id, roomNumber: '303', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [roomDirty] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: deluxe.id, roomNumber: '304', housekeepingStatus: 'dirty', operationalStatus: 'available' }).returning();
  const [roomExec] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: executive.id, roomNumber: '401', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [otherRoom] = await db.insert(rooms).values({ propertyId: other.id, roomTypeId: otherType.id, roomNumber: '201', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();

  const base = {
    propertyId: property.id,
    roomTypeId: deluxe.id,
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in' as const,
    paymentStatus: 'pay_later' as const,
    paidAmountMinorUnits: 0,
  };

  const assigned = await ReservationService.create({
    ...base,
    checkInDate: '2031-01-10',
    checkOutDate: '2031-01-12',
    roomId: room301.id,
    guest: guest('Assigned Now'),
  });
  assert.equal(assigned.roomId, room301.id);
  assert.equal(assigned.roomTypeId, deluxe.id);
  pass('TEST 1 admin create stores room category and physical room');

  const later = await ReservationService.create({
    ...base,
    checkInDate: '2031-02-10',
    checkOutDate: '2031-02-12',
    guest: guest('Assign Later'),
  });
  assert.equal(later.roomId, null);
  const laterAvail = await checkAvailability(property.id, deluxe.id, '2031-02-10', '2031-02-12');
  assert.equal(laterAvail.minAvailable, 3);
  pass('TEST 2 assign later reserves room-type inventory and leaves physical room unassigned');

  const website = await ReservationService.create({
    ...base,
    source: 'direct',
    checkInDate: '2031-03-10',
    checkOutDate: '2031-03-12',
    guest: guest('Website Guest'),
  });
  assert.equal(website.roomId, null);
  assert.equal(website.source, 'direct');
  pass('TEST 3 website category-only booking leaves physical room unassigned');

  const arrival = await ReservationService.create({
    ...base,
    checkInDate: '2031-04-10',
    checkOutDate: '2031-04-12',
    guest: guest('Front Desk Arrival'),
  });
  assert.equal(arrival.roomId, null);
  await assert.rejects(() => ReservationService.checkIn(arrival.id, undefined), /ROOM_ASSIGNMENT_REQUIRED/);
  pass('TEST 7 check-in without physical room is rejected');

  const checkInEligible = await listEligibleRooms({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: arrival.checkInDate,
    checkOutDate: arrival.checkOutDate,
    excludeReservationId: arrival.id,
    forCheckIn: true,
  });
  assert.equal(checkInEligible.filter((room) => room.eligible).some((room) => room.id === roomDirty.id), false);
  assert.equal(checkInEligible.find((room) => room.id === roomDirty.id)?.readinessLabel, 'Dirty');
  assert.equal(checkInEligible.some((room) => room.id === roomExec.id), false);
  pass('TEST 12/13 eligibility engine hides other categories and dirty rooms at check-in');

  await ReservationService.checkIn(arrival.id, room302.id, { id: '', name: 'Receptionist' }, { allowOutstandingBalance: true });
  const checkedIn = await db.query.reservations.findFirst({ where: eq(reservations.id, arrival.id) });
  const occupied302 = await db.query.rooms.findFirst({ where: eq(rooms.id, room302.id) });
  assert.equal(checkedIn?.status, 'checked_in');
  assert.equal(checkedIn?.roomId, room302.id);
  assert.equal(occupied302?.operationalStatus, 'occupied');
  pass('TEST 4 unassigned arrival requires explicit room 302 then assign and check-in');

  const preassigned = await ReservationService.create({
    ...base,
    checkInDate: '2031-05-10',
    checkOutDate: '2031-05-12',
    roomId: room303.id,
    guest: guest('Already Assigned'),
  });
  await ReservationService.checkIn(preassigned.id, room303.id, { id: '', name: 'Receptionist' }, { allowOutstandingBalance: true });
  const kept = await db.query.reservations.findFirst({ where: eq(reservations.id, preassigned.id) });
  assert.equal(kept?.roomId, room303.id);
  assert.equal(kept?.status, 'checked_in');
  pass('TEST 5 existing assignment is preserved on check-in');

  const changeable = await ReservationService.create({
    ...base,
    checkInDate: '2031-06-10',
    checkOutDate: '2031-06-12',
    roomId: room301.id,
    guest: guest('Change Room'),
  });
  const changed = await ReservationService.assignRoom(changeable.id, room303.id, { id: '', name: 'Front Desk' });
  assert.equal(changed.roomNumber, '303');
  const afterChange = await db.query.reservations.findFirst({ where: eq(reservations.id, changeable.id) });
  assert.equal(afterChange?.roomId, room303.id);
  const stillAvailable301 = await db.query.rooms.findFirst({ where: eq(rooms.id, room301.id) });
  assert.equal(stillAvailable301?.operationalStatus, 'available');
  pass('TEST 6 change room 301 → 303 updates assignment without double occupancy');

  await assert.rejects(() => ReservationService.checkIn(later.id, roomExec.id), /room type/i);
  pass('TEST 8 wrong room category is rejected');

  const conflictGuest = await ReservationService.create({
    ...base,
    checkInDate: '2031-06-10',
    checkOutDate: '2031-06-12',
    guest: guest('Conflict Guest'),
  });
  await assert.rejects(() => ReservationService.assignRoom(conflictGuest.id, room303.id), /no longer available/i);
  pass('TEST 9 conflicting physical room is rejected');

  await assert.rejects(() => ReservationService.checkIn(later.id, otherRoom.id));
  await assert.rejects(() => ReservationService.assignRoom(later.id, otherRoom.id));
  pass('TEST 10 another property room is rejected');

  const concurrentA = await ReservationService.create({
    ...base,
    checkInDate: '2031-07-10',
    checkOutDate: '2031-07-12',
    guest: guest('Concurrent A'),
  });
  const concurrentB = await ReservationService.create({
    ...base,
    checkInDate: '2031-07-10',
    checkOutDate: '2031-07-12',
    guest: guest('Concurrent B'),
  });
  const raced = await Promise.allSettled([
    ReservationService.assignRoom(concurrentA.id, room301.id),
    ReservationService.assignRoom(concurrentB.id, room301.id),
  ]);
  assert.equal(raced.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(raced.filter((result) => result.status === 'rejected').length, 1);
  const assigned301 = await db.select().from(reservations).where(and(eq(reservations.roomId, room301.id), eq(reservations.status, 'confirmed')));
  const julyAssignments = assigned301.filter((row) => row.checkInDate === '2031-07-10');
  assert.equal(julyAssignments.length, 1);
  pass('TEST 11 concurrent assignment to the same physical room has exactly one winner');

  const assignEligible = await listEligibleRooms({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: '2031-08-10',
    checkOutDate: '2031-08-12',
    forCheckIn: false,
  });
  assert.equal(assignEligible.find((room) => room.id === roomDirty.id)?.eligible, true);
  const checkInDirty = await listEligibleRooms({
    propertyId: property.id,
    roomTypeId: deluxe.id,
    checkInDate: '2031-08-10',
    checkOutDate: '2031-08-12',
    forCheckIn: true,
  });
  assert.equal(checkInDirty.find((room) => room.id === roomDirty.id)?.eligible, false);
  pass('TEST housekeeping readiness: dirty rooms can be assigned later but not checked in');

  await assert.rejects(() => ReservationService.checkIn(later.id, roomDirty.id), /clean room/i);
  pass('TEST dirty room check-in is rejected');

  const afterWebsite = await checkAvailability(property.id, deluxe.id, '2031-03-10', '2031-03-12');
  assert.equal(afterWebsite.minAvailable, 3);
  const reservedRows = await db.select().from(inventory).where(and(eq(inventory.propertyId, property.id), eq(inventory.roomTypeId, deluxe.id), eq(inventory.date, '2031-03-10')));
  assert.equal(reservedRows[0]?.reservedInventory, 1);
  pass('TEST 15 unassigned physical room still reserves room-type inventory');

  await assert.rejects(() => ReservationService.checkIn(later.id, ''));
  pass('TEST 16 empty roomId cannot bypass the server invariant');

  console.log(`${passed} room assignment checks passed.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
