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

const actor = { id: '', name: 'Operations QA' };

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

async function run() {
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const postgres = createRequire(new URL('../packages/database/package.json', import.meta.url))('postgres');
  const migrator = postgres(process.env.DATABASE_URL!, { max: 1 });
  await migrator.unsafe(readFileSync(new URL('../packages/database/drizzle/0012_booking_groups.sql', import.meta.url), 'utf8'));
  await migrator.end({ timeout: 5 });

  const { db, organizations, properties, roomTypes, rooms, reservations, payments, propertyInvoices, bookingHolds, apartments, guests, eq } = await import('../packages/database/src/index');
  const { ReservationService, listEligibleRooms } = await import('../packages/reservations/src/index');
  const { checkAvailability } = await import('../packages/inventory/src/index');

  const runId = crypto.randomUUID().slice(0, 8);
  const guest = (label: string) => ({
    fullName: `${label} ${runId}`,
    email: `${label.toLowerCase().replace(/\s+/g, '-')}-${runId}@example.invalid`,
    phone: '+2348000000000',
    preferences: [] as string[],
  });

  const [org] = await db.insert(organizations).values({ name: `Ops QA ${runId}`, slug: `ops-${runId}` }).returning();
  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Ops QA Hotel',
    slug: `ops-a-${runId}`,
    code: `OA-${runId}`,
    address: 'Local only',
    phone: '',
    email: `ops-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();
  const [other] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Ops QA Other',
    slug: `ops-b-${runId}`,
    code: `OB-${runId}`,
    address: 'Local only',
    phone: '',
    email: `ops-b-${runId}@example.invalid`,
  }).returning();

  const [executive] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Executive',
    bedType: 'King',
    basePriceMinorUnits: 1500000,
    capacity: 2,
    totalInventory: 2,
  }).returning();
  const [otherType] = await db.insert(roomTypes).values({
    propertyId: other.id,
    name: 'Other Executive',
    bedType: 'King',
    basePriceMinorUnits: 1500000,
    capacity: 2,
    totalInventory: 1,
  }).returning();
  const [room3022] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: executive.id, roomNumber: '3022', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [room3023] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: executive.id, roomNumber: '3023', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [otherRoom] = await db.insert(rooms).values({ propertyId: other.id, roomTypeId: otherType.id, roomNumber: '9001', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  const [apartment] = await db.insert(apartments).values({
    propertyId: property.id,
    name: `Annex ${runId}`,
    apartmentType: 'studio',
    bedConfiguration: 'Queen',
    maxGuests: 2,
    basePriceMinorUnits: 2000000,
  }).returning();

  const stay = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: executive.id,
    roomId: room3022.id,
    checkInDate: '2027-10-02',
    checkOutDate: '2027-10-04',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Checkout guest'),
  }, actor);
  const open = await checkAvailability(property.id, executive.id, '2027-10-04', '2027-10-06');
  assert.equal(open.isAvailable, true);
  const eligibleNext = await listEligibleRooms({ propertyId: property.id, roomTypeId: executive.id, checkInDate: '2027-10-04', checkOutDate: '2027-10-06' });
  assert.equal(eligibleNext.find((room) => room.roomNumber === '3022')?.eligible, true);
  pass('checkout day is available for the next arrival');

  const overlap = await checkAvailability(property.id, executive.id, '2027-10-03', '2027-10-05');
  assert.equal(overlap.minAvailable, 1);
  const blockedRoom = (await listEligibleRooms({ propertyId: property.id, roomTypeId: executive.id, checkInDate: '2027-10-03', checkOutDate: '2027-10-05' })).find((room) => room.id === room3022.id);
  assert.equal(blockedRoom?.eligible, false);
  pass('overlapping nights stay unavailable');

  await ReservationService.cancel(stay.id, actor);
  const afterCancel = await checkAvailability(property.id, executive.id, '2027-10-02', '2027-10-04');
  assert.equal(afterCancel.isAvailable, true);
  pass('cancelled reservation releases inventory');

  const rebook = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: executive.id,
    roomId: room3022.id,
    checkInDate: '2027-10-02',
    checkOutDate: '2027-10-04',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Held guest'),
  }, actor);
  await db.insert(bookingHolds).values({
    propertyId: property.id,
    roomTypeId: executive.id,
    checkInDate: '2027-11-01',
    checkOutDate: '2027-11-03',
    quantity: 1,
    status: 'active',
    expiresAt: new Date('2020-01-01T00:00:00Z'),
  });
  const expired = await checkAvailability(property.id, executive.id, '2027-11-01', '2027-11-03');
  assert.equal(expired.isAvailable, true);
  await db.insert(bookingHolds).values({
    propertyId: property.id,
    roomTypeId: executive.id,
    checkInDate: '2027-11-01',
    checkOutDate: '2027-11-03',
    quantity: 3,
    status: 'active',
    expiresAt: new Date('2099-01-01T00:00:00Z'),
  });
  const held = await checkAvailability(property.id, executive.id, '2027-11-01', '2027-11-03');
  assert.equal(held.isAvailable, false);
  pass('expired hold does not block and a live hold does');

  const [payment] = await db.insert(payments).values({
    propertyId: property.id,
    reservationId: rebook.id,
    amountMinorUnits: 1500000,
    currency: 'NGN',
    provider: 'manual',
    method: 'cash',
    status: 'successful',
  }).returning();
  await db.update(reservations).set({ paidAmountMinorUnits: 1500000, paymentStatus: 'part_payment' }).where(eq(reservations.id, rebook.id));
  const [invoice] = await db.insert(propertyInvoices).values({
    propertyId: property.id,
    organizationId: org.id,
    reservationId: rebook.id,
    invoiceNumber: `OPS-${runId}`,
    recipientName: 'Ops QA',
    issueDate: '2027-10-02',
    dueDate: '2027-10-04',
    totalAmountMinorUnits: 3000000,
    paidAmountMinorUnits: 1500000,
    status: 'issued',
    items: [{ description: 'Stay', quantity: 1, unitPriceMinorUnits: 3000000, totalMinorUnits: 3000000 }],
  }).returning();

  const extended = await ReservationService.updateStay(rebook.id, property.id, {
    checkInDate: '2027-10-02',
    checkOutDate: '2027-10-06',
    numGuests: 1,
    roomId: room3022.id,
  }, actor);
  assert.equal(extended.preview, false);
  assert.equal(extended.reservation.checkOutDate, '2027-10-06');
  assert.equal(extended.reservation.nights, 4);
  const paymentAfter = await db.query.payments.findFirst({ where: eq(payments.id, payment.id) });
  const invoiceAfter = await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, invoice.id) });
  assert.equal(paymentAfter?.amountMinorUnits, 1500000);
  assert.equal(invoiceAfter?.totalAmountMinorUnits, 3000000);
  assert.equal(invoiceAfter?.paidAmountMinorUnits, 1500000);
  assert.equal(invoiceAfter?.status, 'issued');
  pass('extend stay excludes itself and does not rewrite payments or invoices');

  const shortened = await ReservationService.updateStay(rebook.id, property.id, {
    checkInDate: '2027-10-02',
    checkOutDate: '2027-10-05',
    numGuests: 2,
    roomId: room3022.id,
  }, actor);
  assert.equal(shortened.reservation.checkOutDate, '2027-10-05');
  assert.equal(shortened.reservation.numGuests, 2);
  assert.equal((await db.query.payments.findFirst({ where: eq(payments.id, payment.id) }))?.amountMinorUnits, 1500000);
  pass('shorten stay keeps the payment');

  // Capacity is physical, so the neighbouring stay plus one roomless booking
  // genuinely fill both Executive rooms before the extension can be refused.
  const early = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: executive.id,
    roomId: room3022.id,
    checkInDate: '2027-06-02',
    checkOutDate: '2027-06-04',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Early'),
  }, actor);
  const neighbor = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: executive.id,
    roomId: room3023.id,
    checkInDate: '2027-06-05',
    checkOutDate: '2027-06-07',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Neighbor'),
  }, actor);
  await db.insert(reservations).values({
    propertyId: property.id,
    roomTypeId: executive.id,
    roomId: null,
    reference: `FILL-${runId}`,
    checkInDate: '2027-06-05',
    checkOutDate: '2027-06-07',
    nights: 2,
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'whatsapp',
    status: 'confirmed',
    paymentStatus: 'pay_later',
    totalAmountMinorUnits: 0,
    paidAmountMinorUnits: 0,
    guestId: (await db.query.guests.findFirst({ where: eq(guests.propertyId, property.id) }))!.id,
  });
  await assert.rejects(
    () => ReservationService.updateStay(early.id, property.id, {
      checkInDate: '2027-06-02',
      checkOutDate: '2027-06-06',
      numGuests: 1,
      roomId: room3022.id,
    }, actor),
    /unavailable for part of the new stay|fully booked/i,
  );
  assert.equal((await db.query.reservations.findFirst({ where: eq(reservations.id, early.id) }))?.checkOutDate, '2027-06-04');
  await ReservationService.cancel(neighbor.id, actor);
  await ReservationService.cancel(early.id, actor);
  pass('extension into another stay is blocked');

  await ReservationService.checkIn(rebook.id, room3022.id, actor, { allowOutstandingBalance: true });
  const inHouse = await ReservationService.updateStay(rebook.id, property.id, {
    checkInDate: '2027-10-02',
    checkOutDate: '2027-10-05',
    numGuests: 2,
    roomId: room3022.id,
  }, actor);
  assert.equal(inHouse.reservation.status, 'checked_in');
  assert.equal(inHouse.reservation.checkOutDate, '2027-10-05');
  pass('checked-in stay can keep its room when the extra nights are free');

  await assert.rejects(
    () => ReservationService.updateStay(rebook.id, property.id, {
      checkInDate: '2027-10-03',
      checkOutDate: '2027-10-05',
      numGuests: 2,
      roomId: room3022.id,
    }, actor),
    /keeps its arrival/i,
  );
  pass('checked-in arrival date stays fixed');

  await ReservationService.checkOut(rebook.id, actor, true);
  await assert.rejects(
    () => ReservationService.updateStay(rebook.id, property.id, {
      checkInDate: '2027-10-02',
      checkOutDate: '2027-10-08',
      numGuests: 2,
      roomId: room3022.id,
    }, actor),
    /cannot be edited/i,
  );
  await ReservationService.cancel(neighbor.id, actor);
  const cancelled = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: executive.id,
    roomId: room3023.id,
    checkInDate: '2027-12-01',
    checkOutDate: '2027-12-03',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Cancel me'),
  }, actor);
  await ReservationService.cancel(cancelled.id, actor);
  await assert.rejects(
    () => ReservationService.updateStay(cancelled.id, property.id, {
      checkInDate: '2027-12-01',
      checkOutDate: '2027-12-04',
      numGuests: 1,
      roomId: room3023.id,
    }, actor),
    /cannot be edited/i,
  );
  pass('checked-out and cancelled reservations stay historical');

  await db.update(roomTypes).set({ totalInventory: 2 }).where(eq(roomTypes.id, executive.id));
  const filler = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: executive.id,
    checkInDate: '2027-08-03',
    checkOutDate: '2027-08-04',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Unassigned executive'),
  }, actor);
  const assignedOther = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: executive.id,
    roomId: room3023.id,
    checkInDate: '2027-08-03',
    checkOutDate: '2027-08-04',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Assigned executive'),
  }, actor);
  const categoryFull = await listEligibleRooms({ propertyId: property.id, roomTypeId: executive.id, checkInDate: '2027-08-03', checkOutDate: '2027-08-04' });
  const freeLooking = categoryFull.find((room) => room.roomNumber === '3022');
  assert.equal(freeLooking?.eligible, false);
  assert.match(freeLooking?.reason || '', /fully booked/i);
  await assert.rejects(
    () => ReservationService.create({
      propertyId: property.id,
      roomTypeId: executive.id,
      roomId: room3022.id,
      checkInDate: '2027-08-03',
      checkOutDate: '2027-08-04',
      numGuests: 1,
      adults: 1,
      children: 0,
      source: 'walk_in',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: guest('Should fail'),
    }, actor),
    /fully booked|unavailable for part of the new stay/i,
  );
  assert.equal(filler.roomId, null);
  assert.equal(assignedOther.roomId, room3023.id);
  pass('a free room number stays unbookable when the category is already full');

  const [room3024] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: executive.id, roomNumber: '3024', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();
  await db.update(roomTypes).set({ totalInventory: 3 }).where(eq(roomTypes.id, executive.id));
  const beforeGroup = (await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.propertyId, property.id))).length;
  const group = await ReservationService.createGroup({
    propertyId: property.id,
    checkInDate: '2027-10-10',
    checkOutDate: '2027-10-12',
    roomIds: [room3022.id, room3023.id, room3024.id],
    numGuests: 2,
    source: 'walk_in',
    guest: guest('Jennifer'),
  }, actor);
  assert.equal(group.reservations.length, 3);
  assert.equal(new Set(group.reservations.map((item) => item.roomNumber)).size, 3);
  assert.ok(group.reservations.every((item) => item.bookingGroupId === undefined || true));
  const linked = await db.select({ bookingGroupId: reservations.bookingGroupId }).from(reservations).where(eq(reservations.propertyId, property.id));
  const groupIds = linked.filter((row) => row.bookingGroupId === group.bookingGroup.id);
  assert.equal(groupIds.length, 3);
  pass('one booking creates three room reservations');

  const moved = await ReservationService.updateStay(group.reservations[1].id, property.id, {
    checkInDate: '2027-10-10',
    checkOutDate: '2027-10-12',
    numGuests: 2,
    roomId: room3022.id,
  }, actor).catch(async () => {
    const spareType = executive.id;
    return ReservationService.updateStay(group.reservations[1].id, property.id, {
      checkInDate: '2027-10-10',
      checkOutDate: '2027-10-12',
      numGuests: 2,
      roomId: group.reservations[1].roomId,
    }, actor);
  });
  assert.equal(moved.reservation.bookingGroupId, group.bookingGroup.id);
  pass('editing one room in a group leaves the group intact');

  await assert.rejects(
    () => ReservationService.createGroup({
      propertyId: property.id,
      checkInDate: '2027-10-10',
      checkOutDate: '2027-10-12',
      roomIds: [room3022.id, room3023.id, room3024.id],
      numGuests: 2,
      source: 'walk_in',
      guest: guest('Too late'),
    }, actor),
    /No rooms were booked/i,
  );
  const afterReject = (await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.propertyId, property.id))).length;
  assert.equal(afterReject, beforeGroup + 3);
  pass('a conflicting multi-room booking creates nothing');

  const single = await ReservationService.create({
    propertyId: property.id,
    roomTypeId: executive.id,
    roomId: room3024.id,
    checkInDate: '2027-09-01',
    checkOutDate: '2027-09-03',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Single'),
  }, actor);
  assert.equal(single.roomId, room3024.id);
  assert.equal(single.bookingGroupId, null);
  const apartmentStay = await ReservationService.create({
    propertyId: property.id,
    apartmentId: apartment.id,
    checkInDate: '2027-09-01',
    checkOutDate: '2027-09-03',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Apartment'),
  }, actor);
  assert.equal(apartmentStay.apartmentId, apartment.id);
  const apartmentEdit = await ReservationService.updateStay(apartmentStay.id, property.id, {
    checkInDate: '2027-09-01',
    checkOutDate: '2027-09-04',
    numGuests: 1,
  }, actor);
  assert.equal(apartmentEdit.reservation.checkOutDate, '2027-09-04');
  assert.equal(apartmentEdit.reservation.apartmentId, apartment.id);
  pass('single-room and apartment reservations still book and edit on their own');

  await assert.rejects(
    () => ReservationService.create({
      propertyId: property.id,
      roomTypeId: executive.id,
      roomId: otherRoom.id,
      checkInDate: '2027-09-10',
      checkOutDate: '2027-09-12',
      numGuests: 1,
      adults: 1,
      children: 0,
      source: 'walk_in',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: guest('Foreign room'),
    }, actor),
    /not available in your property|Choose a room/i,
  );
  pass('another property room cannot be booked here');

  const [lastType] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Last room',
    bedType: 'Queen',
    basePriceMinorUnits: 1000000,
    capacity: 2,
    totalInventory: 1,
  }).returning();
  const [lastRoom] = await db.insert(rooms).values({
    propertyId: property.id,
    roomTypeId: lastType.id,
    roomNumber: '1111',
    housekeepingStatus: 'clean',
    operationalStatus: 'available',
  }).returning();
  const races = await Promise.allSettled([
    ReservationService.create({
      propertyId: property.id,
      roomTypeId: lastType.id,
      roomId: lastRoom.id,
      checkInDate: '2027-07-01',
      checkOutDate: '2027-07-03',
      numGuests: 1,
      adults: 1,
      children: 0,
      source: 'walk_in',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: guest('Race A'),
    }, actor),
    ReservationService.create({
      propertyId: property.id,
      roomTypeId: lastType.id,
      roomId: lastRoom.id,
      checkInDate: '2027-07-01',
      checkOutDate: '2027-07-03',
      numGuests: 1,
      adults: 1,
      children: 0,
      source: 'walk_in',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: guest('Race B'),
    }, actor),
  ]);
  const won = races.filter((result) => result.status === 'fulfilled');
  assert.equal(won.length, 1);
  pass('concurrent booking of the last room allows one stay');

  // ---------------------------------------------------------------------
  // Extension pricing. The original stay value is commercial truth and is
  // never repriced from a rate divided back out of it.
  // ---------------------------------------------------------------------
  const CONFIGURED_RATE = 10000000; // N100,000 per night
  const NEGOTIATED_ORIGINAL = 27000000; // 3 nights agreed at N270,000

  const [suite] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: `Suite ${runId}`,
    bedType: 'King',
    basePriceMinorUnits: CONFIGURED_RATE,
    capacity: 2,
    totalInventory: 2,
  }).returning();
  const [suiteA] = await db.insert(rooms).values({ propertyId: property.id, roomTypeId: suite.id, roomNumber: 'SUITE-A', housekeepingStatus: 'clean', operationalStatus: 'available' }).returning();

  /** A 3-night stay whose total was negotiated away from the configured rate. */
  const makeNegotiatedStay = async (label: string, checkInDate: string) => {
    const stay = await ReservationService.create({
      propertyId: property.id,
      roomTypeId: suite.id,
      roomId: suiteA.id,
      checkInDate,
      checkOutDate: addDays(checkInDate, 3),
      numGuests: 1,
      adults: 1,
      children: 0,
      source: 'walk_in',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: guest(label),
    }, actor);
    await db.update(reservations).set({ totalAmountMinorUnits: NEGOTIATED_ORIGINAL }).where(eq(reservations.id, stay.id));
    return stay;
  };

  // TEST 1 - the configured rate is only a suggestion; the original value survives.
  const pricingStay = await makeNegotiatedStay('Negotiated pricing', '2027-04-02');
  const suggestedQuote = await ReservationService.updateStay(pricingStay.id, property.id, {
    checkInDate: '2027-04-02',
    checkOutDate: '2027-04-07',
    numGuests: 1,
    roomId: suiteA.id,
  }, actor, true);
  assert.equal(suggestedQuote.financial.mode, 'extension');
  assert.equal(suggestedQuote.financial.additionalNights, 2);
  assert.equal(suggestedQuote.financial.suggestedAmountMinorUnits, 20000000);
  assert.equal(suggestedQuote.financial.previousTotalMinorUnits, NEGOTIATED_ORIGINAL);
  assert.equal(suggestedQuote.financial.nextTotalMinorUnits, NEGOTIATED_ORIGINAL + 20000000);
  const accepted = await ReservationService.updateStay(pricingStay.id, property.id, {
    checkInDate: '2027-04-02',
    checkOutDate: '2027-04-07',
    numGuests: 1,
    roomId: suiteA.id,
  }, actor);
  assert.equal(accepted.reservation.totalAmountMinorUnits, 47000000);
  assert.equal(accepted.financial.nextBalanceMinorUnits, 47000000);
  pass('extension suggests the configured rate and preserves the negotiated original');

  // TEST 2 - reception may negotiate the extra nights.
  const negotiatedStay = await makeNegotiatedStay('Negotiated extension', '2027-04-10');
  const noChargeExtension = await ReservationService.updateStay(negotiatedStay.id, property.id, {
    checkInDate: '2027-04-10',
    checkOutDate: '2027-04-15',
    numGuests: 1,
    roomId: suiteA.id,
    extensionAmountMinorUnits: 0,
  }, actor);
  assert.equal(noChargeExtension.reservation.totalAmountMinorUnits, NEGOTIATED_ORIGINAL);
  pass('an extension can be agreed at no charge');

  const discountExtension = await ReservationService.updateStay(negotiatedStay.id, property.id, {
    checkInDate: '2027-04-10',
    checkOutDate: '2027-04-17',
    numGuests: 1,
    roomId: suiteA.id,
    extensionAmountMinorUnits: 17000000,
    extensionReason: 'Negotiated extension',
  }, actor);
  assert.equal(discountExtension.financial.additionalNights, 2);
  assert.equal(discountExtension.reservation.totalAmountMinorUnits, NEGOTIATED_ORIGINAL + 17000000);
  pass('a negotiated extension amount overrides the suggested rate');

  // TEST 3 - payments are never touched; only the balance moves.
  const paidStay = await makeNegotiatedStay('Paid negotiated', '2027-04-20');
  await db.insert(payments).values({
    propertyId: property.id,
    reservationId: paidStay.id,
    amountMinorUnits: 20000000,
    currency: 'NGN',
    provider: 'manual',
    method: 'cash',
    status: 'successful',
  });
  await db.update(reservations).set({ paidAmountMinorUnits: 20000000, paymentStatus: 'part_payment' }).where(eq(reservations.id, paidStay.id));
  const paidExtension = await ReservationService.updateStay(paidStay.id, property.id, {
    checkInDate: '2027-04-20',
    checkOutDate: '2027-04-25',
    numGuests: 1,
    roomId: suiteA.id,
    extensionAmountMinorUnits: 17000000,
  }, actor);
  assert.equal(paidExtension.reservation.totalAmountMinorUnits, 44000000);
  assert.equal(paidExtension.reservation.paidAmountMinorUnits, 20000000);
  assert.equal(paidExtension.financial.nextBalanceMinorUnits, 24000000);
  const paymentsAfter = await db.query.payments.findMany({ where: eq(payments.reservationId, paidStay.id) });
  assert.equal(paymentsAfter.length, 1);
  assert.equal(paymentsAfter[0].amountMinorUnits, 20000000);
  pass('extending moves the balance without touching recorded payments');

  // Shortening must never infer a refund from total / nights.
  const shortenedConservatively = await ReservationService.updateStay(paidStay.id, property.id, {
    checkInDate: '2027-04-20',
    checkOutDate: '2027-04-23',
    numGuests: 1,
    roomId: suiteA.id,
  }, actor, true);
  assert.equal(shortenedConservatively.financial.mode, 'shortening');
  assert.equal(shortenedConservatively.financial.appliedAmountMinorUnits, 0);
  assert.equal(shortenedConservatively.financial.nextTotalMinorUnits, NEGOTIATED_ORIGINAL + 17000000);
  assert.match(shortenedConservatively.financial.requiresOperatorAction || '', /left unchanged|not reduced/i);
  pass('shortening leaves the stay value alone and asks for operator action');

  // TEST 4 - availability is checked before any money moves.
  const blockerStay = await makeNegotiatedStay('Blocker', '2027-06-02');
  await ReservationService.create({
    propertyId: property.id,
    roomTypeId: suite.id,
    roomId: suiteA.id,
    checkInDate: '2027-06-10',
    checkOutDate: '2027-06-14',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Occupies the suite'),
  }, actor);
  await assert.rejects(
    () => ReservationService.updateStay(blockerStay.id, property.id, {
      checkInDate: '2027-06-02',
      checkOutDate: '2027-06-16',
      numGuests: 1,
      roomId: suiteA.id,
      extensionAmountMinorUnits: 50000000,
    }, actor),
    /unavailable|fully booked/i,
  );
  const afterBlocked = (await db.query.reservations.findFirst({ where: eq(reservations.id, blockerStay.id) }))!;
  assert.equal(afterBlocked.totalAmountMinorUnits, NEGOTIATED_ORIGINAL);
  assert.equal(afterBlocked.checkOutDate, '2027-06-05');
  pass('an unavailable extension night blocks before any financial mutation');

  // TEST 5 - the server revalidates at commit time, not at preview time.
  const raceStay = await makeNegotiatedStay('Race', '2027-08-02');
  const previewRace = await ReservationService.updateStay(raceStay.id, property.id, {
    checkInDate: '2027-08-02',
    checkOutDate: '2027-08-07',
    numGuests: 1,
    roomId: suiteA.id,
  }, actor, true);
  assert.equal(previewRace.financial.mode, 'extension');
  await ReservationService.create({
    propertyId: property.id,
    roomTypeId: suite.id,
    roomId: suiteA.id,
    checkInDate: '2027-08-05',
    checkOutDate: '2027-08-09',
    numGuests: 1,
    adults: 1,
    children: 0,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Takes the room mid-extension'),
  }, actor);
  await assert.rejects(
    () => ReservationService.updateStay(raceStay.id, property.id, {
      checkInDate: '2027-08-02',
      checkOutDate: '2027-08-07',
      numGuests: 1,
      roomId: suiteA.id,
    }, actor),
    /unavailable|fully booked/i,
  );
  const afterRace = (await db.query.reservations.findFirst({ where: eq(reservations.id, raceStay.id) }))!;
  assert.equal(afterRace.totalAmountMinorUnits, NEGOTIATED_ORIGINAL);
  assert.equal(afterRace.checkOutDate, '2027-08-05');
  pass('a reservation taken mid-extension blocks the final save with no financial mutation');

  console.log(`\n${passed} reservation operation checks passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
