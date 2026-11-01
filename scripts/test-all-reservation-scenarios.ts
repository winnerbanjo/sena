import 'dotenv/config';
import assert from 'node:assert/strict';
import { db, organizations, properties, roomTypes, rooms, guests, reservations, eq } from '../packages/database/src/index';
import { ReservationService } from '../packages/reservations/src/index';

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS: ${name}`);
}

async function runAllTests() {
  console.log('--- COMPREHENSIVE RESERVATION CREATION TEST SUITE ---');

  const runId = crypto.randomUUID().slice(0, 8);
  const staffActor = { id: crypto.randomUUID(), name: 'Front Desk Lead' };

  // Setup isolated organization and property
  const [org] = await db.insert(organizations).values({
    name: `Scenario Test Org ${runId}`,
    slug: `scenario-org-${runId}`,
  }).returning();

  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Stay Connect Scenario Hotel',
    slug: `stayconnect-scen-${runId}`,
    code: `SC-${runId}`,
    address: 'Victoria Island, Lagos',
    phone: '+2348011119999',
    email: `scenario-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();

  // Create room type with standard rate ₦95,000 (9,500,000 minor units)
  const standardPrice = 9500000;
  const [roomType] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Executive Suite',
    capacity: 2,
    bedType: 'King Bed',
    basePriceMinorUnits: standardPrice,
    totalInventory: 1, // Exactly 1 inventory unit to test inventory constraints & concurrency
  }).returning();

  const [room] = await db.insert(rooms).values({
    propertyId: property.id,
    roomTypeId: roomType.id,
    roomNumber: `101-${runId}`,
    operationalStatus: 'available',
    housekeepingStatus: 'clean',
  }).returning();

  // Scenario 1: Walk-in reservation
  console.log('\n--- Scenario 1: Walk-in Reservation ---');
  const res1 = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    roomId: room.id,
    checkInDate: '2026-11-10',
    checkOutDate: '2026-11-11',
    numGuests: 2,
    source: 'walk_in',
    guest: {
      fullName: 'Chief Emeka Walkin',
      email: `emeka-${runId}@example.com`,
      phone: '+2348033330001',
    },
  }, staffActor);

  assert.equal(res1.source, 'walk_in');
  assert.equal(res1.status, 'confirmed');
  assert.equal(res1.paymentStatus, 'pay_later');
  assert.equal(res1.paidAmountMinorUnits, 0);
  pass('Scenario 1: Walk-in reservation created successfully in confirmed unpaid state');

  // Scenario 2: Online reservation
  console.log('\n--- Scenario 2: Online Reservation ---');
  const res2 = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    checkInDate: '2026-11-15',
    checkOutDate: '2026-11-17',
    numGuests: 2,
    source: 'direct',
    guest: {
      fullName: 'Amina Online',
      email: `amina-${runId}@example.com`,
      phone: '+2348033330002',
    },
  }, staffActor);

  assert.equal(res2.source, 'direct');
  assert.equal(res2.status, 'confirmed');
  pass('Scenario 2: Online reservation created successfully');

  // Scenario 3: One-night reservation
  console.log('\n--- Scenario 3: One-Night Reservation ---');
  const res3 = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-21',
    numGuests: 1,
    source: 'walk_in',
    guest: {
      fullName: 'One Night Guest',
      email: `onenight-${runId}@example.com`,
      phone: '+2348033330003',
    },
  }, staffActor);

  assert.equal(res3.nights, 1);
  assert.equal(res3.totalAmountMinorUnits, standardPrice);
  pass('Scenario 3: One-night reservation calculates exactly 1 night and correct rack rate');

  // Scenario 4: Multiple-night reservation
  console.log('\n--- Scenario 4: Multiple-Night Reservation ---');
  const res4 = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    checkInDate: '2026-11-25',
    checkOutDate: '2026-11-29',
    numGuests: 2,
    source: 'walk_in',
    guest: {
      fullName: 'Multi Night Guest',
      email: `multi-${runId}@example.com`,
      phone: '+2348033330004',
    },
  }, staffActor);

  assert.equal(res4.nights, 4);
  assert.equal(res4.totalAmountMinorUnits, standardPrice * 4);
  pass('Scenario 4: Multiple-night reservation calculates exactly 4 nights and 4x rate');

  // Scenario 5: Standard room rate
  console.log('\n--- Scenario 5: Standard Room Rate ---');
  assert.equal(res3.standardAmountMinorUnits, standardPrice);
  assert.equal(res3.discountAmountMinorUnits, 0);
  assert.equal(res3.totalAmountMinorUnits, standardPrice);
  pass('Scenario 5: Standard room rate billed with zero discount');

  // Scenario 6: Negotiated room rate (e.g. ₦120,000 for 1 night or discounted rate)
  console.log('\n--- Scenario 6: Negotiated Room Rate ---');
  const agreedPrice = 12000000; // ₦120,000
  const res6 = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    checkInDate: '2026-12-01',
    checkOutDate: '2026-12-02',
    numGuests: 2,
    source: 'walk_in',
    customTotalAmountMinorUnits: agreedPrice,
    guest: {
      fullName: 'VIP Negotiated Guest',
      email: `negotiated-${runId}@example.com`,
      phone: '+2348033330006',
    },
  }, staffActor);

  assert.equal(res6.totalAmountMinorUnits, agreedPrice);
  pass('Scenario 6: Negotiated room rate (₦120,000) applied correctly');

  // Scenario 7: Reservation without upfront payment
  console.log('\n--- Scenario 7: Reservation Without Upfront Payment ---');
  assert.equal(res6.paymentStatus, 'pay_later');
  assert.equal(res6.paidAmountMinorUnits, 0);
  assert.equal(res6.balanceMinorUnits, agreedPrice);
  pass('Scenario 7: Reservation created without upfront payment in default unpaid state');

  // Scenario 8: Reservation with existing guest
  console.log('\n--- Scenario 8: Reservation With Existing Guest ---');
  const [existingGuest] = await db.insert(guests).values({
    organizationId: org.id,
    propertyId: property.id,
    fullName: 'Loyal Returning Guest',
    email: `loyal-${runId}@example.com`,
    phone: '+2348055550008',
  }).returning();

  const res8 = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    checkInDate: '2026-12-05',
    checkOutDate: '2026-12-07',
    numGuests: 1,
    source: 'walk_in',
    guestId: existingGuest.id,
  }, staffActor);

  assert.equal(res8.guestId, existingGuest.id);
  pass('Scenario 8: Reservation accurately linked to existing guest profile');

  // Scenario 9: Reservation with new guest (with phone only or fallback)
  console.log('\n--- Scenario 9: Reservation With New Guest (Phone Only) ---');
  const res9 = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    checkInDate: '2026-12-10',
    checkOutDate: '2026-12-12',
    numGuests: 2,
    source: 'walk_in',
    guest: {
      fullName: 'Walkin No Email',
      phone: '+2348077770009',
    },
  }, staffActor);

  const [guest9] = await db.select().from(guests).where(eq(guests.id, res9.guestId));
  assert.ok(guest9);
  assert.equal(guest9.fullName, 'Walkin No Email');
  assert.equal(guest9.phone, '+2348077770009');
  assert.ok(guest9.email.includes('@guest.sena.ng'));
  pass('Scenario 9: Walk-in guest with phone-only resolved cleanly with fallback email');

  // Scenario 10: Two simultaneous reservations attempting to book the same room
  console.log('\n--- Scenario 10: Concurrency - Simultaneous Bookings on Same Room ---');
  const simDates = { checkInDate: '2026-12-20', checkOutDate: '2026-12-22' };

  let successCount = 0;
  let failureCount = 0;
  let failureError = '';

  const [attempt1, attempt2] = await Promise.allSettled([
    ReservationService.create({
      propertyId: property.id,
      roomTypeId: roomType.id,
      roomId: room.id,
      ...simDates,
      numGuests: 1,
      source: 'walk_in',
      guest: { fullName: 'Concurrent Guest 1', email: `c1-${runId}@example.com`, phone: '+2348099990001' },
    }, staffActor),
    ReservationService.create({
      propertyId: property.id,
      roomTypeId: roomType.id,
      roomId: room.id,
      ...simDates,
      numGuests: 1,
      source: 'walk_in',
      guest: { fullName: 'Concurrent Guest 2', email: `c2-${runId}@example.com`, phone: '+2348099990002' },
    }, staffActor),
  ]);

  if (attempt1.status === 'fulfilled') successCount++;
  else { failureCount++; failureError = attempt1.reason?.message; }

  if (attempt2.status === 'fulfilled') successCount++;
  else { failureCount++; failureError = attempt2.reason?.message; }

  assert.equal(successCount, 1, 'Exactly one simultaneous reservation must succeed');
  assert.equal(failureCount, 1, 'The competing simultaneous reservation must be rejected');
  assert.match(failureError, /fully booked|no longer available/i, 'Rejection error must describe availability conflict');
  pass('Scenario 10: Concurrency locking strictly allows exactly 1 booking and rejects overlapping attempt');

  console.log(`\nALL ${passed} RESERVATION SCENARIOS TESTED AND PASSED!\n`);
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
