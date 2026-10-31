import 'dotenv/config';
import assert from 'node:assert/strict';
import { db, organizations, properties, apartments, reservations, reservationEvents, eq } from '../packages/database/src/index';
import { ReservationService } from '../packages/reservations/src/index';

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS: ${name}`);
}

async function run() {
  console.log('--- TEST APARTMENT CHECK-IN SUITE ---');

  const runId = crypto.randomUUID().slice(0, 8);
  const staffActor = { id: crypto.randomUUID(), name: 'Receptionist Kemi' };

  const [org] = await db.insert(organizations).values({
    name: `Apt CheckIn Org ${runId}`,
    slug: `apt-org-${runId}`,
  }).returning();

  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Stay Connect Lekki Apartments',
    slug: `stayconnect-${runId}`,
    code: `SC-${runId}`,
    address: 'Lekki Phase 1, Lagos',
    phone: '+2348011112222',
    email: `stayconnect-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();

  const [apartment] = await db.insert(apartments).values({
    propertyId: property.id,
    name: 'Presidential Penthouse 401',
    apartmentType: 'penthouse',
    bedrooms: 3,
    bathrooms: 3,
    bedConfiguration: '3 King Beds',
    maxGuests: 6,
    basePriceMinorUnits: 15000000, // ₦150,000 / night
    operationalStatus: 'available',
    housekeepingStatus: 'clean',
  }).returning();

  const checkInDate = '2026-11-10';
  const checkOutDate = '2026-11-13';

  // Test 1: Create confirmed apartment reservation
  const res1 = await ReservationService.create({
    propertyId: property.id,
    apartmentId: apartment.id,
    checkInDate,
    checkOutDate,
    numGuests: 2,
    guest: {
      fullName: 'Chief Adebayo',
      email: `adebayo-${runId}@example.invalid`,
      phone: '+2348033334444',
    },
    paidAmountMinorUnits: 0,
    paymentStatus: 'pay_later',
  }, staffActor);

  assert.equal(res1.status, 'confirmed');
  assert.equal(res1.apartmentId, apartment.id);
  pass('Apartment reservation created in confirmed status');

  // Test 2: Check-in apartment stay
  await ReservationService.checkIn(
    res1.id,
    null,
    staffActor,
    { allowOutstandingBalance: true }
  );

  const [afterCheckIn] = await db.select().from(reservations).where(eq(reservations.id, res1.id));
  assert.equal(afterCheckIn.status, 'checked_in');
  assert.ok(afterCheckIn.actualCheckInAt instanceof Date, 'actualCheckInAt must be recorded on reservation');

  const [aptAfterCheckIn] = await db.select().from(apartments).where(eq(apartments.id, apartment.id));
  assert.equal(aptAfterCheckIn.operationalStatus, 'occupied', 'Apartment must transition to occupied');

  const events = await db.select().from(reservationEvents).where(eq(reservationEvents.reservationId, res1.id));
  const checkInEvent = events.find((e) => e.eventType === 'checked_in_outstanding' || e.eventType === 'checked_in');
  assert.ok(checkInEvent, 'Timeline event must record check-in');
  pass('Apartment check-in completes successfully with operational status, timestamps, and timeline event');

  // Test 3: Double check-in idempotency
  await ReservationService.checkIn(
    res1.id,
    null,
    staffActor,
    { allowOutstandingBalance: true }
  );
  pass('Subsequent check-in call on already checked-in apartment stay returns idempotently');

  // Test 4: Cannot check in another reservation when apartment is already occupied
  const res2 = await ReservationService.create({
    propertyId: property.id,
    apartmentId: apartment.id,
    checkInDate: '2026-11-13',
    checkOutDate: '2026-11-15',
    numGuests: 2,
    guest: {
      fullName: 'Dr. Okon',
      email: `okon-${runId}@example.invalid`,
      phone: '+2348055556666',
    },
    paidAmountMinorUnits: 0,
    paymentStatus: 'pay_later',
  }, staffActor);

  let conflictRejected = false;
  try {
    await ReservationService.checkIn(
      res2.id,
      null,
      staffActor,
      { allowOutstandingBalance: true }
    );
  } catch (err: any) {
    conflictRejected = true;
    assert.match(err.message, /already occupied/i);
  }
  assert.ok(conflictRejected, 'Must reject check-in when apartment is currently occupied by an active stay');
  pass('Cannot occupy an already-occupied apartment unit');

  // Test 5: Rejection when apartment is in maintenance or blocked
  const [maintApt] = await db.insert(apartments).values({
    propertyId: property.id,
    name: 'Executive Studio 102',
    apartmentType: 'studio',
    bedrooms: 1,
    bathrooms: 1,
    bedConfiguration: '1 Queen Bed',
    maxGuests: 2,
    basePriceMinorUnits: 8000000,
    operationalStatus: 'available',
    housekeepingStatus: 'clean',
  }).returning();

  const resMaint = await ReservationService.create({
    propertyId: property.id,
    apartmentId: maintApt.id,
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-22',
    numGuests: 1,
    guest: {
      fullName: 'Engr. Danladi',
      email: `danladi-${runId}@example.invalid`,
      phone: '+2348077778888',
    },
    paidAmountMinorUnits: 0,
    paymentStatus: 'pay_later',
  }, staffActor);

  // Transition apartment to maintenance operational status after booking
  await db.update(apartments).set({ operationalStatus: 'maintenance' }).where(eq(apartments.id, maintApt.id));

  let maintRejected = false;
  try {
    await ReservationService.checkIn(resMaint.id, null, staffActor, { allowOutstandingBalance: true });
  } catch (err: any) {
    maintRejected = true;
    assert.match(err.message, /out of service/i);
  }
  assert.ok(maintRejected, 'Must reject check-in when apartment is in maintenance or blocked status');
  pass('Apartments in maintenance or blocked status cannot be checked in');

  console.log(`\nALL ${passed} APARTMENT CHECK-IN TESTS PASSED!\n`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
