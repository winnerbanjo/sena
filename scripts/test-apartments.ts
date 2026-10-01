import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { storageKeyForRoomImage } from '../apps/dashboard/src/lib/room-gallery';
import { applyInvoiceSettlementToReservation } from '../apps/dashboard/src/lib/invoice-settlement';

process.env.SENA_TEST_DATABASE_URL = process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@localhost:55432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL = process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

const STAY_CONNECT = '63c6b4f4-fee4-415c-be16-c064a44edc76';
const PROPERTY_A = '33000000-0000-4000-8000-000000000003';
const PROPERTY_B = '33000000-0000-4000-8000-000000000004';

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS ${name}`);
}

async function run() {
  const postgres = createRequire(resolve('packages/database/package.json'))('postgres') as (url: string, options: { max: number }) => {
    unsafe: (sql: string) => Promise<unknown>;
    end: () => Promise<void>;
  } & ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<Array<{ name: string | null }>>);
  const migrator = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [images] = await migrator`select to_regclass('public.room_images') as name`;
  if (!images?.name) await migrator.unsafe(readFileSync(resolve('packages/database/drizzle/0007_room_images.sql'), 'utf8'));
  const [receipts] = await migrator`select to_regclass('public.payment_receipts') as name`;
  if (!receipts?.name) await migrator.unsafe(readFileSync(resolve('packages/database/drizzle/0008_payment_receipts.sql'), 'utf8'));
  await migrator.unsafe(readFileSync(resolve('packages/database/drizzle/0009_apartments.sql'), 'utf8'));
  await migrator.unsafe(readFileSync(resolve('packages/database/drizzle/0010_apartment_archive.sql'), 'utf8'));
  await migrator.end();

  const {
    db,
    organizations,
    properties,
    apartments,
    roomTypes,
    rooms,
    reservations,
    housekeepingTasks,
    payments,
    paymentReceipts,
    propertyInvoices,
    roomImages,
    eq,
    and,
    sql,
  } = await import('../packages/database/src/index');
  const { ReservationService } = await import('../packages/reservations/src/index');
  const { HousekeepingService } = await import('../packages/housekeeping/src/index');
  const { checkApartmentAvailability, createApartmentHold } = await import('../packages/inventory/src/index');
  const { PaymentService } = await import('../packages/payments/src/index');

  assert.notEqual(PROPERTY_A, STAY_CONNECT);
  assert.notEqual(PROPERTY_B, STAY_CONNECT);

  await db.delete(reservations).where(eq(reservations.propertyId, PROPERTY_A));
  await db.delete(reservations).where(eq(reservations.propertyId, PROPERTY_B));
  await db.delete(properties).where(eq(properties.id, PROPERTY_A));
  await db.delete(properties).where(eq(properties.id, PROPERTY_B));

  const runId = crypto.randomUUID().slice(0, 8);
  const [org] = await db.insert(organizations).values({ name: `Apt QA ${runId}`, slug: `apt-${runId}` }).returning();
  const [propertyA] = await db.insert(properties).values({
    id: PROPERTY_A,
    organizationId: org.id,
    name: 'Synthetic Apartments',
    slug: `apt-a-${runId}`,
    code: `APA-${runId}`,
    address: '12 Synthetic Close',
    country: 'Nigeria',
    phone: '',
    email: `apt-a-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();
  const [propertyB] = await db.insert(properties).values({
    id: PROPERTY_B,
    organizationId: org.id,
    name: 'Synthetic Other',
    slug: `apt-b-${runId}`,
    code: `APB-${runId}`,
    address: 'Other street',
    phone: '',
    email: `apt-b-${runId}@example.invalid`,
  }).returning();

  assert.equal(propertyA.id, PROPERTY_A);
  const roomTypeCount = await db.select({ id: roomTypes.id }).from(roomTypes).where(eq(roomTypes.propertyId, PROPERTY_A));
  assert.equal(roomTypeCount.length, 0);

  const [almond] = await db.insert(apartments).values({
    propertyId: PROPERTY_A,
    name: 'Almond',
    apartmentType: 'two_bedroom',
    bedrooms: 2,
    bathrooms: 2,
    bedConfiguration: '1 King, 2 Singles',
    maxGuests: 4,
    basePriceMinorUnits: 50_000_000,
    amenities: ['Wi-Fi', 'Kitchen'],
    usePropertyAddress: false,
    address: '4 Almond Lane',
    area: 'Lekki',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
  }).returning();
  const [cedar] = await db.insert(apartments).values({
    propertyId: PROPERTY_A,
    name: 'Cedar',
    apartmentType: 'studio',
    bedrooms: 0,
    bathrooms: 1,
    bedConfiguration: '1 Queen',
    maxGuests: 2,
    basePriceMinorUnits: 20_000_000,
    amenities: ['Wi-Fi'],
    usePropertyAddress: true,
  }).returning();

  const imageId = crypto.randomUUID();
  const storageKey = storageKeyForRoomImage({
    propertyId: PROPERTY_A,
    apartmentId: almond.id,
    imageId,
    extension: 'jpg',
  });
  assert.equal(storageKey, `apartments/${PROPERTY_A}/${almond.id}/${imageId}.jpg`);
  await db.insert(roomImages).values({
    id: imageId,
    propertyId: PROPERTY_A,
    apartmentId: almond.id,
    storageKey,
    url: `https://example.invalid/${storageKey}`,
    contentType: 'image/jpeg',
    byteSize: 1200,
    sortOrder: 0,
    isCover: true,
  });
  pass('apartment-only property has one unit and no room category');

  const open = await checkApartmentAvailability(PROPERTY_A, almond.id, '2032-10-05', '2032-10-08');
  assert.equal(open.isAvailable, true);
  assert.equal(open.minAvailable, 1);
  const guest = (label: string) => ({
    fullName: `${label} ${runId}`,
    email: `${label}-${runId}@example.invalid`,
    phone: '+2348000000000',
  });
  const first = await ReservationService.create({
    propertyId: PROPERTY_A,
    apartmentId: almond.id,
    checkInDate: '2032-10-05',
    checkOutDate: '2032-10-08',
    numGuests: 2,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Ada'),
  });
  assert.equal(first.apartmentId, almond.id);
  assert.equal(first.roomTypeId, null);
  assert.equal(first.roomId, null);
  assert.equal(first.totalAmountMinorUnits, 150_000_000);
  const blocked = await checkApartmentAvailability(PROPERTY_A, almond.id, '2032-10-05', '2032-10-08');
  assert.equal(blocked.isAvailable, false);
  await assert.rejects(
    () => ReservationService.create({
      propertyId: PROPERTY_A,
      apartmentId: almond.id,
      checkInDate: '2032-10-05',
      checkOutDate: '2032-10-08',
      numGuests: 2,
      source: 'walk_in',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: guest('Bola'),
    }),
    /already booked/
  );
  pass('overlap Oct 5-8 cannot double-book');

  const cedarStay = await ReservationService.create({
    propertyId: PROPERTY_A,
    apartmentId: cedar.id,
    checkInDate: '2032-10-05',
    checkOutDate: '2032-10-08',
    numGuests: 1,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Chi'),
  });
  assert.equal(cedarStay.apartmentId, cedar.id);
  pass('multiple apartments stay independent');

  const next = await ReservationService.create({
    propertyId: PROPERTY_A,
    apartmentId: almond.id,
    checkInDate: '2032-10-08',
    checkOutDate: '2032-10-10',
    numGuests: 2,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Dayo'),
  });
  assert.ok(next.id);
  pass('checkout day is free for the next stay');

  const [edited] = await db.update(apartments).set({ name: 'Almond House', bedrooms: 2 }).where(and(eq(apartments.id, almond.id), eq(apartments.propertyId, PROPERTY_A))).returning();
  const still = await db.select().from(reservations).where(eq(reservations.id, first.id));
  assert.equal(edited.id, almond.id);
  assert.equal(still[0].apartmentId, almond.id);
  pass('edit preserves apartment id and reservation history');

  const [deluxe] = await db.insert(roomTypes).values({
    propertyId: PROPERTY_A,
    name: 'Deluxe',
    bedType: 'King',
    basePriceMinorUnits: 10_000,
    capacity: 2,
    totalInventory: 2,
  }).returning();
  const [physical] = await db.insert(rooms).values({
    propertyId: PROPERTY_A,
    roomTypeId: deluxe.id,
    roomNumber: '3001',
    housekeepingStatus: 'clean',
    operationalStatus: 'available',
  }).returning();
  const roomStay = await ReservationService.create({
    propertyId: PROPERTY_A,
    roomTypeId: deluxe.id,
    roomId: physical.id,
    checkInDate: '2032-11-01',
    checkOutDate: '2032-11-03',
    numGuests: 2,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Efe'),
  });
  assert.equal(roomStay.roomTypeId, deluxe.id);
  assert.equal(roomStay.apartmentId ?? null, null);
  const categories = await db.select().from(roomTypes).where(eq(roomTypes.propertyId, PROPERTY_A));
  assert.equal(categories.length, 1);
  assert.equal(categories[0].name, 'Deluxe');
  pass('mixed property keeps hotel rooms separate from apartments');

  const payment = await PaymentService.recordPayment({
    reservationId: first.id,
    amountMinorUnits: first.totalAmountMinorUnits,
    provider: 'manual',
    method: 'cash',
    providerReference: `APT-${runId}`,
  }, `apt-pay-${runId}`);
  const [invoice] = await db.insert(propertyInvoices).values({
    propertyId: PROPERTY_A,
    organizationId: org.id,
    reservationId: first.id,
    invoiceNumber: `INV-APT-${runId}`,
    recipientName: 'Ada',
    issueDate: '2032-10-05',
    dueDate: '2032-10-05',
    totalAmountMinorUnits: first.totalAmountMinorUnits,
    subtotalMinorUnits: first.totalAmountMinorUnits,
  }).returning();
  const settlement = applyInvoiceSettlementToReservation({
    reservationPaidMinorUnits: 0,
    reservationTotalMinorUnits: first.totalAmountMinorUnits,
    amountMinorUnits: first.totalAmountMinorUnits,
  });
  assert.equal(settlement.paymentStatus, 'paid');
  const [receipt] = await db.insert(paymentReceipts).values({
    propertyId: PROPERTY_A,
    paymentId: payment.id,
    storageKey: `receipts/${PROPERTY_A}/${payment.id}.jpg`,
    contentType: 'image/jpeg',
    originalFilename: 'cash.jpg',
    byteSize: 400,
  }).returning();
  const paid = await db.select().from(reservations).where(eq(reservations.id, first.id));
  assert.equal(paid[0].paidAmountMinorUnits, first.totalAmountMinorUnits);
  assert.equal(paid[0].apartmentId, almond.id);
  assert.equal(receipt.paymentId, payment.id);
  assert.equal(invoice.reservationId, first.id);
  pass('payment, receipt and invoice use the existing reservation path');

  await ReservationService.checkIn(first.id, null, { id: '', name: 'Front desk' }, { allowOutstandingBalance: true });
  const occupied = await db.select().from(apartments).where(eq(apartments.id, almond.id));
  assert.equal(occupied[0].operationalStatus, 'occupied');
  await ReservationService.checkOut(first.id, { id: '', name: 'Front desk' });
  const dirty = await db.select().from(apartments).where(eq(apartments.id, almond.id));
  assert.equal(dirty[0].housekeepingStatus, 'dirty');
  assert.equal(dirty[0].operationalStatus, 'available');
  const tasks = await db.select().from(housekeepingTasks).where(and(eq(housekeepingTasks.propertyId, PROPERTY_A), eq(housekeepingTasks.apartmentId, almond.id)));
  assert.ok(tasks.length >= 1);
  await HousekeepingService.updateApartmentStatus(PROPERTY_A, almond.id, 'cleaning', { id: '', name: 'Housekeeper' });
  await HousekeepingService.updateApartmentStatus(PROPERTY_A, almond.id, 'clean', { id: '', name: 'Housekeeper' });
  const clean = await db.select().from(apartments).where(eq(apartments.id, almond.id));
  assert.equal(clean[0].housekeepingStatus, 'clean');
  pass('housekeeping reuses Needs Cleaning to Clean & Ready');

  const foreignAvailability = await checkApartmentAvailability(PROPERTY_B, almond.id, '2033-01-01', '2033-01-03');
  assert.equal(foreignAvailability.isAvailable, false);
  await assert.rejects(
    () => createApartmentHold(PROPERTY_B, almond.id, '2033-01-01', '2033-01-03'),
    /not found/
  );
  await assert.rejects(
    () => ReservationService.create({
      propertyId: PROPERTY_B,
      apartmentId: almond.id,
      checkInDate: '2033-01-01',
      checkOutDate: '2033-01-03',
      numGuests: 1,
      source: 'direct',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: guest('Foreign'),
    }),
    /not found/
  );
  await assert.rejects(
    () => HousekeepingService.updateApartmentStatus(PROPERTY_B, almond.id, 'dirty', { id: '', name: 'Other' }),
    /not found/
  );
  const crossGallery = await db.update(roomImages).set({ url: 'https://example.invalid/stolen' }).where(and(eq(roomImages.id, imageId), eq(roomImages.propertyId, PROPERTY_B))).returning();
  assert.equal(crossGallery.length, 0);
  const untouched = await db.select({ url: roomImages.url }).from(roomImages).where(eq(roomImages.id, imageId));
  assert.match(untouched[0].url, /apartments\//);
  pass('property B cannot view, book, edit, or change gallery for property A');

  const stayConnectRows = await db.execute(sql`select count(*)::int as n from apartments where property_id = ${STAY_CONNECT}`);
  const stayCount = Number((stayConnectRows as unknown as { n: number }[])[0]?.n ?? (stayConnectRows as { rows?: { n: number }[] }).rows?.[0]?.n ?? 0);
  assert.equal(stayCount, 0);
  pass('Stay Connect has no apartments from this test');

  await db.delete(reservations).where(eq(reservations.propertyId, PROPERTY_A));
  await db.delete(reservations).where(eq(reservations.propertyId, PROPERTY_B));
  await db.delete(properties).where(eq(properties.id, PROPERTY_A));
  await db.delete(properties).where(eq(properties.id, PROPERTY_B));
  await db.delete(organizations).where(eq(organizations.id, org.id));
  console.log(`\n${passed} apartment tests passed`);
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
