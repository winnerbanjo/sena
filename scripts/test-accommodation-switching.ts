/**
 * Accommodation switching: an existing reservation can be moved between rooms,
 * room categories and apartments without cancelling and recreating it.
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

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

async function run() {
  const { db, organizations, properties, roomTypes, rooms, reservations, payments, propertyInvoices, apartments, bookingGroups, reservationEvents, eq, and } =
    await import('../packages/database/src/index');
  const { ReservationService } = await import('../packages/reservations/src/index');

  const runId = crypto.randomUUID().slice(0, 8);
  const actor = { id: '', name: 'Switch QA' };
  const guest = (label: string) => ({
    fullName: `${label} ${runId}`,
    email: `${label.toLowerCase().replace(/\s+/g, '-')}-${runId}@example.invalid`,
    phone: '+2348000000000',
    preferences: [] as string[],
  });

  const [org] = await db.insert(organizations).values({ name: `Switch QA ${runId}`, slug: `sw-${runId}` }).returning();
  const propertyRow = async (name: string, slug: string) =>
    (await db.insert(properties).values({
      organizationId: org.id,
      name,
      slug,
      code: slug.toUpperCase().slice(0, 8),
      propertyType: 'hotel',
      country: 'NG',
      address: 'Local only',
      phone: '',
      email: `${slug}@example.invalid`,
      timezone: 'Africa/Lagos',
      currency: 'NGN',
      checkInTime: '14:00',
      checkOutTime: '11:00',
      checkInPaymentPolicy: 'pay_at_property',
      checkOutPaymentPolicy: 'pay_at_property',
      directBookingPayAtProperty: false,
      directBookingBankTransfer: false,
    }).returning())[0];

  const property = await propertyRow('Switch QA Hotel', `sw-a-${runId}`);
  const other = await propertyRow('Switch QA Other', `sw-b-${runId}`);

  const [executive] = await db.insert(roomTypes).values({
    propertyId: property.id, name: 'Executive', bedType: 'King', basePriceMinorUnits: 15000000, capacity: 3, totalInventory: 2,
  }).returning();
  const [deluxe] = await db.insert(roomTypes).values({
    propertyId: property.id, name: 'Deluxe', bedType: 'Queen', basePriceMinorUnits: 9000000, capacity: 2, totalInventory: 2,
  }).returning();
  const [otherType] = await db.insert(roomTypes).values({
    propertyId: other.id, name: 'Other Executive', bedType: 'King', basePriceMinorUnits: 15000000, capacity: 3, totalInventory: 1,
  }).returning();

  const mkRoom = async (roomNumber: string, typeId: string, propId = property.id) =>
    (await db.insert(rooms).values({ propertyId: propId, roomTypeId: typeId, roomNumber, housekeepingStatus: 'clean', operationalStatus: 'available' }).returning())[0];
  const r3022 = await mkRoom('3022', executive.id);
  const r3023 = await mkRoom('3023', executive.id);
  const r101 = await mkRoom('101', deluxe.id);
  const otherRoom = await mkRoom('9001', otherType.id, other.id);

  const mkApartment = async (name: string, propId = property.id) =>
    (await db.insert(apartments).values({
      propertyId: propId,
      name,
      apartmentType: 'studio',
      bedConfiguration: 'Queen',
      maxGuests: 2,
      basePriceMinorUnits: 20000000,
      usePropertyAddress: true,
    }).returning())[0];
  const almond = await mkApartment(`Almond ${runId}`);
  const cedar = await mkApartment(`Cedar ${runId}`);
  const otherApartment = await mkApartment(`Other Annex ${runId}`, other.id);

  const makeRoomStay = async (label: string, checkInDate: string, roomId = r3022.id, typeId = executive.id) =>
    ReservationService.create({
      propertyId: property.id,
      roomTypeId: typeId,
      roomId,
      checkInDate,
      checkOutDate: addDays(checkInDate, 3),
      numGuests: 2,
      source: 'walk_in',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: guest(label),
    }, actor);

  const makeApartmentStay = async (label: string, checkInDate: string, apartmentId: string) =>
    ReservationService.create({
      propertyId: property.id,
      apartmentId,
      checkInDate,
      checkOutDate: addDays(checkInDate, 3),
      numGuests: 2,
      source: 'walk_in',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: guest(label),
    }, actor);

  const reload = async (id: string) =>
    (await db.select().from(reservations).where(eq(reservations.id, id)).limit(1))[0];

  // TEST 1 - room to room.
  const t1 = await makeRoomStay('Room to room', '2029-01-10');
  const r1 = await ReservationService.updateStay(t1.id, property.id, {
    checkInDate: '2029-01-10', checkOutDate: '2029-01-13', numGuests: 2,
    accommodationType: 'room', roomTypeId: executive.id, roomId: r3023.id,
  }, actor);
  assert.equal(r1.reservation.roomId, r3023.id);
  assert.equal(r1.reservation.id, t1.id);
  assert.equal(r1.reservation.reference, t1.reference);
  assert.equal(r1.accommodationChanged, true);
  pass('TEST 1 room 3022 to room 3023 keeps the same reservation');

  // TEST 2 - across categories, both ids move together.
  const t2 = await makeRoomStay('Category move', '2029-01-20');
  const r2 = await ReservationService.updateStay(t2.id, property.id, {
    checkInDate: '2029-01-20', checkOutDate: '2029-01-23', numGuests: 2,
    accommodationType: 'room', roomTypeId: deluxe.id, roomId: r101.id,
  }, actor);
  assert.equal(r2.reservation.roomTypeId, deluxe.id);
  assert.equal(r2.reservation.roomId, r101.id);
  assert.equal(r2.reservation.apartmentId, null);
  pass('TEST 2 moving between categories updates room type and room together');

  // A mismatched pair is refused.
  await assert.rejects(
    () => ReservationService.updateStay(t2.id, property.id, {
      checkInDate: '2029-01-20', checkOutDate: '2029-01-23', numGuests: 2,
      accommodationType: 'room', roomTypeId: executive.id, roomId: r101.id,
    }, actor),
    /not in the selected category/i,
  );
  assert.equal((await reload(t2.id)).roomTypeId, deluxe.id);

  // TEST 3 - room to apartment.
  const t3 = await makeRoomStay('Room to apartment', '2029-02-10');
  const before3 = await reload(t3.id);
  const r3 = await ReservationService.updateStay(t3.id, property.id, {
    checkInDate: '2029-02-10', checkOutDate: '2029-02-13', numGuests: 2,
    accommodationType: 'apartment', apartmentId: almond.id,
  }, actor);
  assert.equal(r3.reservation.apartmentId, almond.id);
  assert.equal(r3.reservation.roomId, null);
  assert.equal(r3.reservation.roomTypeId, null);
  assert.equal(r3.reservation.id, before3.id);
  assert.equal(r3.reservation.reference, before3.reference);
  assert.equal(r3.reservation.guestId, before3.guestId);
  assert.equal(r3.reservation.status, before3.status);
  pass('TEST 3 room to apartment preserves identity, guest, reference and status');

  // TEST 4 - apartment to room.
  const t4 = await makeApartmentStay('Apartment to room', '2029-03-10', almond.id);
  const r4 = await ReservationService.updateStay(t4.id, property.id, {
    checkInDate: '2029-03-10', checkOutDate: '2029-03-13', numGuests: 2,
    accommodationType: 'room', roomTypeId: executive.id, roomId: r3022.id,
  }, actor);
  assert.equal(r4.reservation.roomId, r3022.id);
  assert.equal(r4.reservation.roomTypeId, executive.id);
  assert.equal(r4.reservation.apartmentId, null);
  assert.equal(r4.reservation.reference, t4.reference);
  pass('TEST 4 apartment to room preserves identity');

  // TEST 5 - apartment to apartment.
  const t5 = await makeApartmentStay('Apartment to apartment', '2029-04-10', almond.id);
  const r5 = await ReservationService.updateStay(t5.id, property.id, {
    checkInDate: '2029-04-10', checkOutDate: '2029-04-13', numGuests: 2,
    accommodationType: 'apartment', apartmentId: cedar.id,
  }, actor);
  assert.equal(r5.reservation.apartmentId, cedar.id);
  assert.equal(r5.reservation.roomId, null);
  assert.equal(r5.reservation.roomTypeId, null);
  pass('TEST 5 apartment to apartment preserves identity');

  // TEST 6 - unavailable apartment blocks and changes nothing.
  const blocker6 = await makeApartmentStay('Blocks almond', '2029-05-10', almond.id);
  const subject6 = await makeRoomStay('Wants almond', '2029-05-10', r3023.id);
  const snapshot6 = await reload(subject6.id);
  await assert.rejects(
    () => ReservationService.updateStay(subject6.id, property.id, {
      checkInDate: '2029-05-10', checkOutDate: '2029-05-13', numGuests: 2,
      accommodationType: 'apartment', apartmentId: almond.id,
    }, actor),
    /unavailable for part of the new stay/i,
  );
  const after6 = await reload(subject6.id);
  assert.equal(after6.roomId, snapshot6.roomId);
  assert.equal(after6.apartmentId, null);
  assert.equal(after6.roomTypeId, snapshot6.roomTypeId);
  void blocker6;
  pass('TEST 6 an unavailable apartment blocks the switch with no mutation');

  // TEST 7 - unavailable room blocks.
  const occupant7 = await makeRoomStay('Holds 3022', '2029-06-10', r3022.id);
  const subject7 = await makeApartmentStay('Wants 3022', '2029-06-10', almond.id);
  const snapshot7 = await reload(subject7.id);
  await assert.rejects(
    () => ReservationService.updateStay(subject7.id, property.id, {
      checkInDate: '2029-06-10', checkOutDate: '2029-06-13', numGuests: 2,
      accommodationType: 'room', roomTypeId: executive.id, roomId: r3022.id,
    }, actor),
    /unavailable|fully booked/i,
  );
  const after7 = await reload(subject7.id);
  assert.equal(after7.roomId, null);
  assert.equal(after7.apartmentId, snapshot7.apartmentId);
  void occupant7;
  pass('TEST 7 an unavailable room blocks the switch with no mutation');

  // TEST 8 - concurrency: available at preview, taken before save.
  const subject8 = await makeRoomStay('Race', '2029-07-10', r3022.id);
  const preview8 = await ReservationService.updateStay(subject8.id, property.id, {
    checkInDate: '2029-07-10', checkOutDate: '2029-07-13', numGuests: 2,
    accommodationType: 'room', roomTypeId: executive.id, roomId: r3023.id,
  }, actor, true);
  assert.equal(preview8.preview, true);
  await makeRoomStay('Sneaks in', '2029-07-11', r3023.id);
  const snapshot8 = await reload(subject8.id);
  await assert.rejects(
    () => ReservationService.updateStay(subject8.id, property.id, {
      checkInDate: '2029-07-10', checkOutDate: '2029-07-13', numGuests: 2,
      accommodationType: 'room', roomTypeId: executive.id, roomId: r3023.id,
    }, actor),
    /unavailable|fully booked/i,
  );
  assert.equal((await reload(subject8.id)).roomId, snapshot8.roomId);
  pass('TEST 8 a room taken between preview and save blocks with no partial mutation');

  // TEST 9 - negotiated total and payments survive a room to apartment switch.
  const subject9 = await makeRoomStay('Negotiated', '2029-08-10');
  await db.update(reservations).set({ totalAmountMinorUnits: 27000000 }).where(eq(reservations.id, subject9.id));
  const [payment9] = await db.insert(payments).values({
    propertyId: property.id,
    reservationId: subject9.id,
    amountMinorUnits: 20000000,
    currency: 'NGN',
    provider: 'manual',
    method: 'cash',
    status: 'successful',
  }).returning();
  await db.update(reservations).set({ paidAmountMinorUnits: 20000000, paymentStatus: 'part_payment' }).where(eq(reservations.id, subject9.id));
  const r9 = await ReservationService.updateStay(subject9.id, property.id, {
    checkInDate: '2029-08-10', checkOutDate: '2029-08-13', numGuests: 2,
    accommodationType: 'apartment', apartmentId: cedar.id,
  }, actor);
  assert.equal(r9.reservation.totalAmountMinorUnits, 27000000);
  assert.equal(r9.reservation.paidAmountMinorUnits, 20000000);
  assert.equal(r9.financial.nextBalanceMinorUnits, 7000000);
  const paymentAfter9 = (await db.select().from(payments).where(eq(payments.id, payment9.id)).limit(1))[0];
  assert.equal(paymentAfter9.amountMinorUnits, 20000000);
  assert.equal((await db.select().from(payments).where(eq(payments.reservationId, subject9.id))).length, 1);
  pass('TEST 9 negotiated total, payment and outstanding are preserved');

  // TEST 10 - an existing invoice is not rewritten.
  const subject10 = await makeRoomStay('Invoiced', '2029-09-10');
  const [invoice10] = await db.insert(propertyInvoices).values({
    propertyId: property.id,
    organizationId: org.id,
    reservationId: subject10.id,
    invoiceNumber: `SW-${runId}`,
    recipientName: 'Switch QA',
    issueDate: '2029-09-10',
    dueDate: '2029-09-13',
    totalAmountMinorUnits: 45000000,
    paidAmountMinorUnits: 0,
    status: 'issued',
    items: [{ description: 'Executive Stay', quantity: 1, unitPriceMinorUnits: 45000000, totalMinorUnits: 45000000 }],
  }).returning();
  await ReservationService.updateStay(subject10.id, property.id, {
    checkInDate: '2029-09-10', checkOutDate: '2029-09-13', numGuests: 2,
    accommodationType: 'apartment', apartmentId: almond.id,
  }, actor);
  const invoiceAfter10 = (await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invoice10.id)).limit(1))[0];
  assert.equal(invoiceAfter10.totalAmountMinorUnits, 45000000);
  assert.equal(invoiceAfter10.status, 'issued');
  assert.deepEqual(invoiceAfter10.items, invoice10.items);
  pass('TEST 10 existing invoice values are not rewritten');

  // TEST 11 - a booking-group child keeps its group; siblings are untouched.
  const group = await ReservationService.createGroup({
    propertyId: property.id,
    checkInDate: '2029-10-10',
    checkOutDate: '2029-10-12',
    roomIds: [r3022.id, r3023.id],
    numGuests: 2,
    source: 'walk_in',
    guest: guest('Group guest'),
  }, actor);
  const childA = group.reservations[0];
  const childB = group.reservations[1];
  const siblingBefore = await reload(childB.id);
  await ReservationService.updateStay(childA.id, property.id, {
    checkInDate: '2029-10-10', checkOutDate: '2029-10-12', numGuests: 2,
    accommodationType: 'apartment', apartmentId: almond.id,
  }, actor);
  const childAfter = await reload(childA.id);
  const siblingAfter = await reload(childB.id);
  assert.equal(childAfter.bookingGroupId, group.bookingGroup.id);
  assert.equal(childAfter.apartmentId, almond.id);
  assert.equal(siblingAfter.roomId, siblingBefore.roomId);
  assert.equal(siblingAfter.bookingGroupId, group.bookingGroup.id);
  pass('TEST 11 a group child keeps its booking group and siblings are untouched');

  // TEST 12 - checked-in stays can move.
  const subject12 = await makeRoomStay('In house', '2029-11-10');
  await db.update(reservations).set({ status: 'checked_in' }).where(eq(reservations.id, subject12.id));
  await db.update(rooms).set({ operationalStatus: 'occupied' }).where(eq(rooms.id, r3022.id));
  const r12 = await ReservationService.updateStay(subject12.id, property.id, {
    checkInDate: '2029-11-10', checkOutDate: '2029-11-13', numGuests: 2,
    accommodationType: 'apartment', apartmentId: almond.id,
  }, actor);
  assert.equal(r12.reservation.status, 'checked_in');
  assert.equal(r12.reservation.id, subject12.id);
  assert.equal(r12.reservation.apartmentId, almond.id);
  const vacatedRoom = (await db.select().from(rooms).where(eq(rooms.id, r3022.id)).limit(1))[0];
  assert.equal(vacatedRoom.operationalStatus, 'available');
  assert.equal(vacatedRoom.housekeepingStatus, 'dirty');
  const movedIn = (await db.select().from(apartments).where(eq(apartments.id, almond.id)).limit(1))[0];
  assert.equal(movedIn.operationalStatus, 'occupied');
  pass('TEST 12 a checked-in stay moves without checkout and releases the old room');

  // TEST 13 - checkout-day reuse still allows the next arrival.
  const subject13 = await makeRoomStay('Checkout reuse', '2029-12-02', r101.id, deluxe.id);
  await ReservationService.updateStay(subject13.id, property.id, {
    checkInDate: '2029-12-02', checkOutDate: '2029-12-03', numGuests: 2,
    accommodationType: 'room', roomTypeId: deluxe.id, roomId: r101.id,
  }, actor);
  const next13 = await makeRoomStay('Next arrival', '2029-12-03', r101.id, deluxe.id);
  assert.equal(next13.roomId, r101.id);
  pass('TEST 13 checkout day is still reusable after switching');

  // TEST 14 - tenant isolation.
  const subject14 = await makeRoomStay('Isolation', '2030-01-10');
  await assert.rejects(
    () => ReservationService.updateStay(subject14.id, property.id, {
      checkInDate: '2030-01-10', checkOutDate: '2030-01-13', numGuests: 2,
      accommodationType: 'room', roomTypeId: otherType.id, roomId: otherRoom.id,
    }, actor),
    /not in this property/i,
  );
  await assert.rejects(
    () => ReservationService.updateStay(subject14.id, property.id, {
      checkInDate: '2030-01-10', checkOutDate: '2030-01-13', numGuests: 2,
      accommodationType: 'apartment', apartmentId: otherApartment.id,
    }, actor),
    /not in this property/i,
  );
  const after14 = await reload(subject14.id);
  assert.equal(after14.roomId, r3022.id);
  assert.equal(after14.apartmentId, null);
  pass('TEST 14 another property room or apartment cannot be attached');

  // Audit trail.
  const events = await db.select().from(reservationEvents).where(eq(reservationEvents.reservationId, subject9.id));
  const switchEvent = events.find((event: any) => event.eventType === 'reservation_accommodation_changed');
  assert.ok(switchEvent, 'expected an accommodation change audit row');
  assert.match(switchEvent.description, /Accommodation changed from Room 3022 to Cedar/);
  assert.equal(switchEvent.metadata.previousAccommodation.type, 'room');
  assert.equal(switchEvent.metadata.nextAccommodation.type, 'apartment');
  assert.equal(switchEvent.metadata.paymentsUntouched, true);
  assert.equal(switchEvent.metadata.invoicesUntouched, true);
  pass('accommodation switch is recorded on the staff timeline');

  console.log(`\n${passed} accommodation switching checks passed`);
  void bookingGroups;
  void and;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});