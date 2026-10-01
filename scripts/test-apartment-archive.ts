import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROLE_PERMISSIONS } from '../packages/config/src/index';
import {
  APARTMENT_ACTION_PANEL_CLASS,
  APARTMENT_ACTION_SHEET_CLASS,
  namesMatchForDeletion,
} from '../apps/dashboard/src/components/apartment-removal-ui';

process.env.SENA_TEST_DATABASE_URL = process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@localhost:55432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL = process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

const STAY_CONNECT = '63c6b4f4-fee4-415c-be16-c064a44edc76';
const ORG = '33000000-0000-4000-8000-000000000001';
const PROPERTY_A = '33000000-0000-4000-8000-000000000003';
const PROPERTY_B = '33000000-0000-4000-8000-000000000004';
const TODAY = '2036-01-15';

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS ${name}`);
}

async function run() {
  assert.notEqual(PROPERTY_A, STAY_CONNECT);
  assert.notEqual(PROPERTY_B, STAY_CONNECT);
  assert.notEqual(ORG, '5fb0e2fd-df83-41d4-8ccc-214b4a82344d');

  const page = readFileSync(resolve('apps/dashboard/src/app/apartments/page.tsx'), 'utf8');
  assert.match(page, /APARTMENT_ACTION_SHEET_CLASS/);
  assert.match(page, /data-apartment-removal-confirm/);
  assert.match(page, /t\('deleteTitle'\)/);
  assert.match(page, /t\('archiveTitle'\)/);
  assert.match(page, /t\('deleteBody'\)/);
  assert.match(page, /t\('archiveBody'\)/);
  assert.match(page, /namesMatchForDeletion/);
  assert.doesNotMatch(page, /DropdownMenu/);
  assert.match(APARTMENT_ACTION_SHEET_CLASS, /items-end/);
  assert.match(APARTMENT_ACTION_SHEET_CLASS, /p-4/);
  assert.match(APARTMENT_ACTION_SHEET_CLASS, /sm:items-center/);
  assert.doesNotMatch(APARTMENT_ACTION_SHEET_CLASS, /w-48|absolute/);
  assert.match(APARTMENT_ACTION_PANEL_CLASS, /w-full/);
  assert.match(APARTMENT_ACTION_PANEL_CLASS, /max-w-lg/);
  assert.match(APARTMENT_ACTION_PANEL_CLASS, /max-h-\[90vh\]/);
  assert.match(APARTMENT_ACTION_PANEL_CLASS, /text-start/);
  assert.equal(namesMatchForDeletion('  Almond House  ', 'Almond House'), true);
  assert.equal(namesMatchForDeletion('almond house', 'Almond House'), false);
  const locales = ['en', 'fr', 'ar', 'sw', 'yo', 'ha', 'ig'];
  const requiredKeys = [
    'more', 'deleteApartment', 'deleteTitle', 'deleteBody', 'typeName', 'archiveTitle', 'archiveBody',
    'archiveAction', 'restore', 'archived', 'archivedBadge', 'emptyArchived', 'activeReservation',
    'upcomingReservations', 'activeHold', 'activeHousekeeping',
  ];
  const english = JSON.parse(readFileSync(resolve('apps/dashboard/messages/en.json'), 'utf8')).apartments;
  assert.equal(english.deleteTitle, 'Delete apartment?');
  assert.equal(english.deleteBody, 'Deleting this apartment will permanently remove it from your inventory.');
  assert.equal(english.archiveTitle, 'Archive apartment?');
  assert.equal(english.archiveBody, 'This apartment has booking or operational history, so Sena will preserve its records and remove it from active inventory.');
  assert.equal(english.archiveAction, 'Archive apartment');
  assert.equal(english.activeReservation, 'This apartment has an active reservation and cannot be removed yet.');
  assert.equal(english.upcomingReservations, 'This apartment has upcoming reservations. Reassign or cancel those reservations before removing it.');
  for (const locale of locales) {
    const messages = JSON.parse(readFileSync(resolve(`apps/dashboard/messages/${locale}.json`), 'utf8')).apartments;
    for (const key of requiredKeys) {
      assert.equal(typeof messages[key], 'string', `${locale} missing apartments.${key}`);
      assert.ok(messages[key].trim().length > 0, `${locale} apartments.${key} empty`);
    }
  }
  assert.equal(ROLE_PERMISSIONS.owner.includes('room.edit'), true);
  assert.equal(ROLE_PERMISSIONS.manager.includes('room.edit'), true);
  assert.equal(ROLE_PERMISSIONS.front_desk.includes('room.edit'), false);
  assert.equal(ROLE_PERMISSIONS.housekeeping.includes('room.edit'), false);
  assert.equal(ROLE_PERMISSIONS.accountant.includes('room.edit'), false);
  const removalUi = readFileSync(resolve('apps/dashboard/src/app/api/apartments/route.ts'), 'utf8');
  assert.match(removalUi, /roleMayEditApartmentInventory/);
  assert.match(removalUi, /withMerchant\(handleDELETE, 'apartments'\)/);
  pass('mobile confirmation sheet and localized removal copy');

  const postgres = createRequire(resolve('packages/database/package.json'))('postgres') as (url: string, options: { max: number }) => {
    unsafe: (sql: string) => Promise<unknown>;
    end: () => Promise<void>;
  };
  const migrator = postgres(process.env.DATABASE_URL!, { max: 1 });
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
    payments,
    propertyInvoices,
    roomImages,
    bookingHolds,
    activityLogs,
    propertyMembers,
    eq,
    and,
    sql,
    isNull,
  } = await import('../packages/database/src/index');
  const { ReservationService } = await import('../packages/reservations/src/index');
  const { HousekeepingService } = await import('../packages/housekeeping/src/index');
  const { checkApartmentAvailability, createApartmentHold, removeApartment, restoreApartment, roleMayEditApartmentInventory } = await import('../packages/inventory/src/index');
  const { PaymentService } = await import('../packages/payments/src/index');
  const { getWebsiteData } = await import('../apps/booking/src/lib/website-data');

  assert.equal(roleMayEditApartmentInventory('owner'), true);
  assert.equal(roleMayEditApartmentInventory('Front Desk'), false);
  assert.equal(roleMayEditApartmentInventory('housekeeping'), false);
  pass('unauthorized role blocked');

  const stayBefore = await db.execute(sql`select (select count(*)::int from apartments where property_id = ${STAY_CONNECT}) as apartments, (select count(*)::int from property_members where property_id = ${STAY_CONNECT}) as staff`);
  const beforeRow = (stayBefore as unknown as { apartments: number; staff: number }[])[0]
    || (stayBefore as { rows?: { apartments: number; staff: number }[] }).rows?.[0];

  await db.delete(reservations).where(eq(reservations.propertyId, PROPERTY_A));
  await db.delete(reservations).where(eq(reservations.propertyId, PROPERTY_B));
  await db.delete(properties).where(eq(properties.id, PROPERTY_A));
  await db.delete(properties).where(eq(properties.id, PROPERTY_B));

  const runId = crypto.randomUUID().slice(0, 8);
  const [existingOrg] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, ORG)).limit(1);
  if (!existingOrg) {
    await db.insert(organizations).values({ id: ORG, name: `Archive QA ${runId}`, slug: `apt-arch-${runId}` });
  }
  const [propertyA] = await db.insert(properties).values({
    id: PROPERTY_A,
    organizationId: ORG,
    name: 'Synthetic Archive',
    slug: `apt-arch-a-${runId}`,
    code: `ARA-${runId}`,
    address: '12 Synthetic Close',
    country: 'Nigeria',
    phone: '',
    email: `arch-a-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();
  await db.insert(properties).values({
    id: PROPERTY_B,
    organizationId: ORG,
    name: 'Synthetic Archive Other',
    slug: `apt-arch-b-${runId}`,
    code: `ARB-${runId}`,
    address: 'Other street',
    phone: '',
    email: `arch-b-${runId}@example.invalid`,
  });

  const actor = { id: '', name: 'Archive Tester' };
  const guest = (label: string) => ({
    fullName: `${label} ${runId}`,
    email: `${label}-${runId}@example.invalid`,
    phone: '+2348000000000',
  });

  async function makeApartment(name: string) {
    const [row] = await db.insert(apartments).values({
      propertyId: PROPERTY_A,
      name,
      apartmentType: 'studio',
      bedrooms: 1,
      bathrooms: 1,
      bedConfiguration: '1 Queen',
      maxGuests: 2,
      basePriceMinorUnits: 1_000_000,
      amenities: [],
      usePropertyAddress: true,
      websiteVisibility: true,
      bookingVisibility: true,
    }).returning();
    return row;
  }

  const deletedKeys: string[] = [];
  async function remove(apartmentId: string, confirmName?: string) {
    return removeApartment({
      propertyId: PROPERTY_A,
      apartmentId,
      organizationId: ORG,
      actor,
      today: TODAY,
      confirmName,
      deleteOwnedMedia: async (key) => {
        deletedKeys.push(key);
      },
    });
  }

  const blank = await makeApartment(`Blank ${runId}`);
  const imageId = crypto.randomUUID();
  const ownedKey = `apartments/${PROPERTY_A}/${blank.id}/${imageId}.jpg`;
  const sharedKey = `apartments/${PROPERTY_A}/${blank.id}/shared.jpg`;
  await db.insert(roomImages).values({
    id: imageId,
    propertyId: PROPERTY_A,
    apartmentId: blank.id,
    storageKey: ownedKey,
    url: `https://example.invalid/${ownedKey}`,
    contentType: 'image/jpeg',
    byteSize: 100,
    sortOrder: 0,
    isCover: true,
  });
  const [category] = await db.insert(roomTypes).values({
    propertyId: PROPERTY_A,
    name: `Deluxe ${runId}`,
    bedType: 'King',
    basePriceMinorUnits: 10_000,
    capacity: 2,
    totalInventory: 1,
  }).returning();
  const sharedImageId = crypto.randomUUID();
  await db.insert(roomImages).values({
    id: sharedImageId,
    propertyId: PROPERTY_A,
    roomTypeId: category.id,
    storageKey: sharedKey,
    url: `https://example.invalid/${sharedKey}`,
    contentType: 'image/jpeg',
    byteSize: 80,
    sortOrder: 1,
    isCover: true,
  });
  await db.insert(roomImages).values({
    propertyId: PROPERTY_A,
    apartmentId: blank.id,
    storageKey: sharedKey,
    url: `https://example.invalid/${sharedKey}`,
    contentType: 'image/jpeg',
    byteSize: 80,
    sortOrder: 1,
    isCover: false,
  });

  const unconfirmed = await remove(blank.id, 'nope');
  assert.equal(unconfirmed.outcome, 'confirmation_required');
  assert.equal((await db.select({ id: apartments.id }).from(apartments).where(eq(apartments.id, blank.id))).length, 1);
  const hard = await remove(blank.id, blank.name);
  assert.equal(hard.outcome, 'deleted');
  assert.equal((await db.select({ id: apartments.id }).from(apartments).where(eq(apartments.id, blank.id))).length, 0);
  assert.deepEqual(deletedKeys, [ownedKey]);
  const sharedLeft = await db.select({ id: roomImages.id }).from(roomImages).where(eq(roomImages.id, sharedImageId));
  assert.equal(sharedLeft.length, 1);
  const deletedAudit = await db.select({ action: activityLogs.action }).from(activityLogs).where(and(eq(activityLogs.propertyId, PROPERTY_A), eq(activityLogs.resourceId, blank.id), eq(activityLogs.action, 'apartment_deleted')));
  assert.equal(deletedAudit.length, 1);
  pass('unused apartment can hard delete');
  pass('gallery cleaned after safe hard delete');

  const history = await makeApartment(`History ${runId}`);
  const stay = await ReservationService.create({
    propertyId: PROPERTY_A,
    apartmentId: history.id,
    checkInDate: '2036-02-01',
    checkOutDate: '2036-02-03',
    numGuests: 1,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Ada'),
  });
  const payment = await PaymentService.recordPayment({
    reservationId: stay.id,
    amountMinorUnits: stay.totalAmountMinorUnits,
    provider: 'manual',
    method: 'cash',
    providerReference: `ARCH-${runId}`,
  }, `arch-pay-${runId}`);
  const [invoice] = await db.insert(propertyInvoices).values({
    propertyId: PROPERTY_A,
    organizationId: ORG,
    reservationId: stay.id,
    invoiceNumber: `INV-ARCH-${runId}`,
    recipientName: 'Ada',
    issueDate: '2036-02-01',
    dueDate: '2036-02-01',
    totalAmountMinorUnits: stay.totalAmountMinorUnits,
    subtotalMinorUnits: stay.totalAmountMinorUnits,
  }).returning();
  await ReservationService.checkIn(stay.id, null, actor, { allowOutstandingBalance: true });
  await ReservationService.checkOut(stay.id, actor);
  await HousekeepingService.updateApartmentStatus(PROPERTY_A, history.id, 'clean', actor);
  const archived = await remove(history.id, history.name);
  assert.equal(archived.outcome, 'archived');
  const [archivedRow] = await db.select().from(apartments).where(eq(apartments.id, history.id));
  assert.ok(archivedRow.archivedAt);
  assert.equal(archivedRow.id, history.id);
  const [stillStay] = await db.select().from(reservations).where(eq(reservations.id, stay.id));
  assert.equal(stillStay.apartmentId, history.id);
  assert.equal(stillStay.status, 'checked_out');
  const [stillPayment] = await db.select().from(payments).where(eq(payments.id, payment.id));
  assert.equal(stillPayment.reservationId, stay.id);
  const [stillInvoice] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invoice.id));
  assert.equal(stillInvoice.reservationId, stay.id);
  const archiveAudit = await db.select({ action: activityLogs.action }).from(activityLogs).where(and(eq(activityLogs.propertyId, PROPERTY_A), eq(activityLogs.resourceId, history.id), eq(activityLogs.action, 'apartment_archived')));
  assert.equal(archiveAudit.length, 1);
  pass('apartment with history cannot hard delete');
  pass('apartment with history archives instead');
  pass('historical reservation still resolves');
  pass('historical payment/invoice preserved');

  const upcoming = await makeApartment(`Upcoming ${runId}`);
  const future = await ReservationService.create({
    propertyId: PROPERTY_A,
    apartmentId: upcoming.id,
    checkInDate: '2036-06-01',
    checkOutDate: '2036-06-03',
    numGuests: 1,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Future'),
  });
  const futureBlock = await remove(upcoming.id, upcoming.name);
  assert.equal(futureBlock.outcome, 'blocked');
  if (futureBlock.outcome === 'blocked') {
    assert.equal(futureBlock.code, 'upcoming_reservations');
    assert.equal(futureBlock.message, 'This apartment has upcoming reservations. Reassign or cancel those reservations before removing it.');
  }
  const [futureStill] = await db.select({ status: reservations.status }).from(reservations).where(eq(reservations.id, future.id));
  assert.equal(futureStill.status, 'confirmed');
  pass('future reservation blocks removal');

  const inHouse = await makeApartment(`In House ${runId}`);
  const current = await ReservationService.create({
    propertyId: PROPERTY_A,
    apartmentId: inHouse.id,
    checkInDate: '2036-01-14',
    checkOutDate: '2036-01-18',
    numGuests: 1,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Inhouse'),
  });
  await ReservationService.checkIn(current.id, null, actor, { allowOutstandingBalance: true });
  const stayBlock = await remove(inHouse.id, inHouse.name);
  assert.equal(stayBlock.outcome, 'blocked');
  if (stayBlock.outcome === 'blocked') {
    assert.equal(stayBlock.message, 'This apartment has an active reservation and cannot be removed yet.');
  }
  const [inHouseStill] = await db.select({ status: reservations.status }).from(reservations).where(eq(reservations.id, current.id));
  assert.equal(inHouseStill.status, 'checked_in');
  pass('checked-in stay blocks removal');

  const held = await makeApartment(`Held ${runId}`);
  const hold = await createApartmentHold(PROPERTY_A, held.id, '2036-07-01', '2036-07-03');
  const holdBlock = await remove(held.id, held.name);
  assert.equal(holdBlock.outcome, 'blocked');
  if (holdBlock.outcome === 'blocked') assert.equal(holdBlock.code, 'active_hold');
  const [holdStill] = await db.select({ status: bookingHolds.status }).from(bookingHolds).where(eq(bookingHolds.id, hold.holdId));
  assert.equal(holdStill.status, 'active');
  pass('active hold blocks removal');

  const cleaning = await makeApartment(`Cleaning ${runId}`);
  await HousekeepingService.updateApartmentStatus(PROPERTY_A, cleaning.id, 'cleaning', actor);
  const cleanBlock = await remove(cleaning.id, cleaning.name);
  assert.equal(cleanBlock.outcome, 'blocked');
  if (cleanBlock.outcome === 'blocked') assert.equal(cleanBlock.code, 'active_housekeeping');
  await HousekeepingService.updateApartmentStatus(PROPERTY_A, cleaning.id, 'clean', actor);
  const cleaned = await remove(cleaning.id, cleaning.name);
  assert.equal(cleaned.outcome, 'archived');
  pass('active housekeeping blocks removal and completed housekeeping archives');

  const hidden = await checkApartmentAvailability(PROPERTY_A, history.id, '2036-08-01', '2036-08-03');
  assert.equal(hidden.isAvailable, false);
  await assert.rejects(
    () => ReservationService.create({
      propertyId: PROPERTY_A,
      apartmentId: history.id,
      checkInDate: '2036-08-01',
      checkOutDate: '2036-08-03',
      numGuests: 1,
      source: 'direct',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: guest('Book'),
    }),
    /archived/
  );
  await assert.rejects(() => createApartmentHold(PROPERTY_A, history.id, '2036-08-01', '2036-08-03'), /archived/);
  const site = await getWebsiteData(propertyA.slug);
  assert.ok(site);
  assert.equal(site.rooms.some((room) => room.id === history.id), false);
  assert.equal(site.rooms.some((room) => room.id === upcoming.id), true);
  const listed = await db.select({ id: apartments.id }).from(apartments).where(and(eq(apartments.propertyId, PROPERTY_A), isNull(apartments.archivedAt), eq(apartments.websiteVisibility, true)));
  assert.equal(listed.some((row) => row.id === history.id), false);
  pass('archived apartment not bookable');
  pass('archived apartment hidden from public website');

  const restored = await restoreApartment({
    propertyId: PROPERTY_A,
    apartmentId: history.id,
    organizationId: ORG,
    actor,
  });
  assert.equal(restored.outcome, 'restored');
  if (restored.outcome === 'restored') assert.equal(restored.apartmentId, history.id);
  const [restoredRow] = await db.select().from(apartments).where(eq(apartments.id, history.id));
  assert.equal(restoredRow.archivedAt, null);
  assert.equal(restoredRow.id, history.id);
  const openAgain = await checkApartmentAvailability(PROPERTY_A, history.id, '2036-09-01', '2036-09-03');
  assert.equal(openAgain.isAvailable, true);
  const [stillPaid] = await db.select({ id: payments.id }).from(payments).where(eq(payments.id, payment.id));
  assert.equal(stillPaid.id, payment.id);
  const restoreAudit = await db.select({ action: activityLogs.action }).from(activityLogs).where(and(eq(activityLogs.propertyId, PROPERTY_A), eq(activityLogs.resourceId, history.id), eq(activityLogs.action, 'apartment_restored')));
  assert.equal(restoreAudit.length, 1);
  pass('restore apartment');
  pass('restored apartment keeps same ID');

  const foreign = await removeApartment({
    propertyId: PROPERTY_B,
    apartmentId: upcoming.id,
    organizationId: ORG,
    actor,
    today: TODAY,
    confirmName: upcoming.name,
  });
  assert.equal(foreign.outcome, 'not_found');
  const wrongOrg = await removeApartment({
    propertyId: PROPERTY_A,
    apartmentId: upcoming.id,
    organizationId: '33000000-0000-4000-8000-000000000099',
    actor,
    today: TODAY,
    confirmName: upcoming.name,
  });
  assert.equal(wrongOrg.outcome, 'not_found');
  assert.equal((await db.select({ id: apartments.id }).from(apartments).where(eq(apartments.id, upcoming.id))).length, 1);
  pass('tenant isolation');

  const [physical] = await db.insert(rooms).values({
    propertyId: PROPERTY_A,
    roomTypeId: category.id,
    roomNumber: `9${runId.slice(0, 3)}`,
    housekeepingStatus: 'clean',
    operationalStatus: 'available',
  }).returning();
  const roomStay = await ReservationService.create({
    propertyId: PROPERTY_A,
    roomTypeId: category.id,
    roomId: physical.id,
    checkInDate: '2036-11-01',
    checkOutDate: '2036-11-03',
    numGuests: 1,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Room'),
  });
  assert.equal(roomStay.roomTypeId, category.id);
  assert.equal(roomStay.apartmentId ?? null, null);
  assert.equal(roomStay.roomId, physical.id);
  pass('hotel room reservations stay unchanged');

  const stayAfter = await db.execute(sql`select (select count(*)::int from apartments where property_id = ${STAY_CONNECT}) as apartments, (select count(*)::int from property_members where property_id = ${STAY_CONNECT}) as staff`);
  const afterRow = (stayAfter as unknown as { apartments: number; staff: number }[])[0]
    || (stayAfter as { rows?: { apartments: number; staff: number }[] }).rows?.[0];
  assert.equal(Number(beforeRow?.apartments ?? 0), Number(afterRow?.apartments ?? 0));
  assert.equal(Number(beforeRow?.staff ?? 0), Number(afterRow?.staff ?? 0));
  const memberTouch = await db.select({ id: propertyMembers.id }).from(propertyMembers).where(eq(propertyMembers.propertyId, STAY_CONNECT));
  assert.equal(memberTouch.length, Number(beforeRow?.staff ?? 0));
  pass('Stay Connect apartments and staff were not modified');

  await db.delete(reservations).where(eq(reservations.propertyId, PROPERTY_A));
  await db.delete(reservations).where(eq(reservations.propertyId, PROPERTY_B));
  await db.delete(properties).where(eq(properties.id, PROPERTY_A));
  await db.delete(properties).where(eq(properties.id, PROPERTY_B));

  console.log(`\n${passed} apartment archive tests passed`);
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
