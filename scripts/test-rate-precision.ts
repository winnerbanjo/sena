import 'dotenv/config';
import assert from 'node:assert/strict';
import { createRoomTypeSchema, apartmentInputSchema } from '../packages/validation/src/index';
import { db, organizations, properties, roomTypes, rooms, apartments, reservations, invoices, eq } from '../packages/database/src/index';
import { ReservationService } from '../packages/reservations/src/index';

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS: ${name}`);
}

async function run() {
  console.log('--- TEST RATE PRECISION & NON-100 MULTIPLE AMOUNTS ---');

  // Test 1: Validation Schema Acceptance
  const testPrices = [50000, 50050, 50075, 50099, 50125.5];
  for (const price of testPrices) {
    const minorUnits = Math.round(price * 100);
    const roomTypeParsed = createRoomTypeSchema.safeParse({
      name: `Precision Room ${price}`,
      basePriceMinorUnits: minorUnits,
      capacity: 2,
      bedType: 'King Bed',
      totalInventory: 5,
    });
    assert.ok(roomTypeParsed.success, `createRoomTypeSchema must accept price ${price} (${minorUnits} minor units)`);

    const aptParsed = apartmentInputSchema.safeParse({
      name: `Precision Suite ${price}`,
      apartmentType: 'one_bedroom',
      bedrooms: 1,
      bathrooms: 1,
      bedConfiguration: '1 King Bed',
      maxGuests: 2,
      basePriceMinorUnits: minorUnits,
    });
    assert.ok(aptParsed.success, `apartmentInputSchema must accept price ${price} (${minorUnits} minor units)`);
  }
  pass('Validation schemas accept arbitrary rates down to smallest currency unit (50000, 50050, 50075, 50099, 50125.50)');

  // Test 2: Database & Domain Precision
  const runId = crypto.randomUUID().slice(0, 8);
  const staffActor = { id: crypto.randomUUID(), name: 'Finance Lead' };

  const [org] = await db.insert(organizations).values({
    name: `Rate Org ${runId}`,
    slug: `rate-org-${runId}`,
  }).returning();

  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Stay Connect Precision Hotel',
    slug: `stayconnect-rate-${runId}`,
    code: `RP-${runId}`,
    address: 'Lekki Phase 1, Lagos',
    phone: '+2348011112222',
    email: `rate-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();

  // Create room type with ₦50,075 per night (= 5,007,500 minor units)
  const rateMinorUnits = 5007500;
  const [roomType] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Precision Deluxe',
    capacity: 2,
    bedType: 'King Bed',
    basePriceMinorUnits: rateMinorUnits,
  }).returning();

  assert.equal(roomType.basePriceMinorUnits, rateMinorUnits);
  pass('Room type created with exact rate ₦50,075.00 (5,007,500 kobo)');

  const [room] = await db.insert(rooms).values({
    propertyId: property.id,
    roomTypeId: roomType.id,
    roomNumber: `401-${runId}`,
    operationalStatus: 'available',
    housekeepingStatus: 'clean',
  }).returning();

  // Book 3 nights: 3 * 50,075 = ₦150,225 = 15,022,500 minor units
  const stay = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: roomType.id,
    roomId: room.id,
    checkInDate: '2026-11-10',
    checkOutDate: '2026-11-13',
    numGuests: 2,
    guest: {
      fullName: 'Chief Adebayo',
      email: `adebayo-${runId}@example.invalid`,
      phone: '+2348066667777',
    },
    paidAmountMinorUnits: 0,
    paymentStatus: 'pay_later',
  }, staffActor);

  const [dbStay] = await db.select().from(reservations).where(eq(reservations.id, stay.id));
  const expectedTotalMinorUnits = rateMinorUnits * 3;
  assert.equal(dbStay.totalAmountMinorUnits, expectedTotalMinorUnits);
  assert.equal(dbStay.totalAmountMinorUnits, 15022500, '3 nights at ₦50,075 must equal ₦150,225.00 exactly');
  pass('Reservation calculates exact total with arbitrary rate precision without rounding to ₦100');

  // Test Apartment with ₦75,125.50 (= 7,512,550 minor units)
  const aptPriceMinorUnits = 7512550;
  const [apt] = await db.insert(apartments).values({
    propertyId: property.id,
    name: `Apt 501-${runId}`,
    apartmentType: 'two_bedroom',
    bedrooms: 2,
    bathrooms: 2,
    bedConfiguration: '2 King Beds',
    maxGuests: 4,
    basePriceMinorUnits: aptPriceMinorUnits,
    operationalStatus: 'available',
    housekeepingStatus: 'clean',
  }).returning();

  assert.equal(apt.basePriceMinorUnits, aptPriceMinorUnits);

  const aptStay = await ReservationService.create({
    propertyId: property.id,
    apartmentId: apt.id,
    checkInDate: '2026-11-15',
    checkOutDate: '2026-11-17',
    numGuests: 3,
    guest: {
      fullName: 'Dr. Stella Okon',
      email: `okon-${runId}@example.invalid`,
      phone: '+2348055554444',
    },
    paidAmountMinorUnits: 0,
    paymentStatus: 'pay_later',
  }, staffActor);

  const [dbAptStay] = await db.select().from(reservations).where(eq(reservations.id, aptStay.id));
  // 2 nights * 7,512,550 = 15,025,100
  assert.equal(dbAptStay.totalAmountMinorUnits, aptPriceMinorUnits * 2);
  assert.equal(dbAptStay.totalAmountMinorUnits, 15025100);
  pass('Apartment stay calculates exact total with arbitrary rate down to 50 kobo');

  console.log(`\nALL ${passed} RATE PRECISION TESTS PASSED!\n`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
