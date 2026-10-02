/**
 * Reservation delete / void.
 *
 * One operator action, "Delete reservation". Sena decides whether that is a
 * real hard delete (nothing meaningful was ever attached) or a void that keeps
 * the reservation as history and takes it out of operations. Money and invoices
 * are never destroyed as a side effect.
 */
import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';

delete process.env.PAYSTACK_SECRET_KEY;
delete process.env.PAYSTACK_PUBLIC_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_PASSWORD;
delete process.env.REDIS_URL;
delete process.env.S3_ACCESS_KEY_ID;
delete process.env.S3_SECRET_ACCESS_KEY;
delete process.env.FLUTTERWAVE_SECRET_KEY;
delete process.env.FLUTTERWAVE_TEST_SECRET_KEY;

process.env.SENA_TEST_DATABASE_URL =
  process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@127.0.0.1:5432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL =
  process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
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
  const {
    db, organizations, properties, roomTypes, rooms, reservations, payments, propertyInvoices,
    bookingGroups, activityLogs, reservationEvents, apartments, eq, and, desc,
  } = await import('../packages/database/src/index');
  const { ReservationService, removeReservation, previewReservationRemoval, roleMayDeleteReservations } =
    await import('../packages/reservations/src/index');
  const { categoryAvailability, checkApartmentAvailability } = await import('../packages/inventory/src/index');

  const runId = crypto.randomUUID().slice(0, 8);
  const actor = { id: '', name: 'Removal QA' };
  const manager = { id: '', name: 'Property Manager' };
  const TODAY = '2026-10-02';
  const guest = (label: string) => ({
    fullName: `${label} ${runId}`,
    email: `${label.toLowerCase().replace(/\s+/g, '-')}-${runId}@example.invalid`,
    phone: '+2348000000000',
    preferences: [] as string[],
  });

  const [org] = await db.insert(organizations).values({ name: `Removal QA ${runId}`, slug: `rm-${runId}` }).returning();
  const propertyRow = async (name: string, slug: string) =>
    (await db.insert(properties).values({
      organizationId: org.id, name, slug, code: slug.toUpperCase().slice(0, 8), propertyType: 'hotel',
      country: 'NG', address: 'Local only', phone: '', email: `${slug}@example.invalid`,
      timezone: 'Africa/Lagos', currency: 'NGN', checkInTime: '14:00', checkOutTime: '11:00',
      checkInPaymentPolicy: 'allow_outstanding', checkOutPaymentPolicy: 'allow_outstanding',
      directBookingPayAtProperty: false, directBookingBankTransfer: false,
    }).returning())[0];

  const property = await propertyRow('Removal QA Hotel', `rm-a-${runId}`);
  const other = await propertyRow('Removal QA Other', `rm-b-${runId}`);

  const [executive] = await db.insert(roomTypes).values({
    propertyId: property.id, name: 'Executive', bedType: 'King', basePriceMinorUnits: 15000000, capacity: 3, totalInventory: 2,
  }).returning();
  const [otherType] = await db.insert(roomTypes).values({
    propertyId: other.id, name: 'Other Executive', bedType: 'King', basePriceMinorUnits: 15000000, capacity: 3, totalInventory: 1,
  }).returning();

  const mkRoom = async (roomNumber: string, typeId: string, propId = property.id) =>
    (await db.insert(rooms).values({
      propertyId: propId, roomTypeId: typeId, roomNumber, housekeepingStatus: 'clean', operationalStatus: 'available',
    }).returning())[0];
  const r3022 = await mkRoom('3022', executive.id);
  const r3023 = await mkRoom('3023', executive.id);
  // A dedicated room for the full-stay test, so an in-house guest from another
  // test never blocks it.
  const r4040 = await mkRoom('4040', executive.id);
  const otherRoom = await mkRoom('9001', otherType.id, other.id);

  const almond = (await db.insert(apartments).values({
    propertyId: property.id, name: `Almond ${runId}`, apartmentType: 'studio', bedConfiguration: 'Queen',
    maxGuests: 2, basePriceMinorUnits: 20000000, usePropertyAddress: true,
  }).returning())[0];

  const makeStay = async (label: string, roomId = r3022.id) =>
    ReservationService.create({
      propertyId: property.id, roomTypeId: executive.id, roomId,
      checkInDate: addDays(TODAY, 30), checkOutDate: addDays(TODAY, 33), numGuests: 2,
      source: 'walk_in', paymentStatus: 'pay_later', paidAmountMinorUnits: 0, guest: guest(label),
    }, actor);

  const makeApartmentStay = async (label: string) =>
    ReservationService.createForApartment({
      propertyId: property.id, apartmentId: almond.id,
      checkInDate: addDays(TODAY, 30), checkOutDate: addDays(TODAY, 33), numGuests: 2,
      source: 'walk_in', paymentStatus: 'pay_later', paidAmountMinorUnits: 0, guest: guest(label),
    }, actor);

  const scope = { propertyId: property.id, organizationId: org.id };
  const reload = async (id: string) =>
    (await db.select().from(reservations).where(eq(reservations.id, id)).limit(1))[0];
  const gone = async (id: string) =>
    (await db.select().from(reservations).where(eq(reservations.id, id)).limit(1)).length === 0;
  const previewOf = (id: string) => previewReservationRemoval({ ...scope, reservationId: id });

  // =========================================================================
  // TEST 1 - a brand-new reservation with no history is really deleted, and the
  // inventory it was holding is released by the authoritative engine.
  // =========================================================================
  {
    const dates1 = { checkInDate: addDays(TODAY, 30), checkOutDate: addDays(TODAY, 33) };
    const before = await categoryAvailability(db, { propertyId: property.id, roomTypeId: executive.id, ...dates1 });
    const stay = await makeStay('T1 Clean');
    const held = await categoryAvailability(db, { propertyId: property.id, roomTypeId: executive.id, ...dates1 });
    assert.equal(held.minAvailable, before.minAvailable - 1, 'creating the stay must consume one night of capacity');

    const preview = await previewOf(stay.id);
    assert.equal(preview.outcome, 'preview');
    if (preview.outcome !== 'preview') throw new Error('preview expected');
    assert.equal(preview.action, 'delete', 'a reservation with no history must be eligible for a real delete');
    assert.equal(preview.confirmationRequired, false, 'an ordinary clean delete should not be made cumbersome');

    const result = await removeReservation({ ...scope, reservationId: stay.id, actor: manager, reason: 'Duplicate reservation' });
    assert.equal(result.outcome, 'deleted');

    assert.equal(await gone(stay.id), true, 'the reservation row must actually be gone');
    const after = await categoryAvailability(db, { propertyId: property.id, roomTypeId: executive.id, ...dates1 });
    assert.equal(after.minAvailable, before.minAvailable, 'the released night must return to authoritative availability');

    // The audit evidence survives the row it describes, without a broken FK.
    const [audit] = await db.select().from(activityLogs)
      .where(and(eq(activityLogs.resource, 'reservation'), eq(activityLogs.resourceId, stay.id)))
      .orderBy(desc(activityLogs.createdAt)).limit(1);
    assert.ok(audit, 'a hard delete must still leave an audit row');
    assert.equal(audit.action, 'reservation_deleted');
    assert.equal(audit.actorName, 'Property Manager');
    assert.equal((audit.newValue as any).reason, 'Duplicate reservation');
    assert.equal((audit.newValue as any).removed, true);
    pass('TEST 1 a reservation with no history is hard deleted and its inventory is released');
  }

  // =========================================================================
  // TEST 2 - a payment forces a void. The payment is not deleted, altered or
  // refunded as a side effect of the operator removing the reservation.
  // =========================================================================
  {
    const stay = await makeStay('T2 Paid');
    const [payment] = await db.insert(payments).values({
      propertyId: property.id, reservationId: stay.id, amountMinorUnits: 4_500_000,
      currency: 'NGN', provider: 'manual', method: 'cash', status: 'successful', source: 'front_desk',
    }).returning();

    const preview = await previewOf(stay.id);
    assert.equal(preview.outcome, 'preview');
    if (preview.outcome !== 'preview') throw new Error('preview expected');
    assert.equal(preview.action, 'void', 'money on the reservation must force a void');
    assert.deepEqual(preview.reasons, ['payment']);

    const refused = await removeReservation({ ...scope, reservationId: stay.id, actor: manager });
    assert.equal(refused.outcome, 'confirmation_required', 'a historical delete must ask for the reference');

    const result = await removeReservation({
      ...scope, reservationId: stay.id, actor: manager, reason: 'Guest cancelled', confirmReference: stay.reference,
    });
    assert.equal(result.outcome, 'voided');

    const after = await reload(stay.id);
    assert.equal(after.status, 'voided', 'the reservation leaves operations but stays on the books');

    const [keptPayment] = await db.select().from(payments).where(eq(payments.id, payment.id));
    assert.ok(keptPayment, 'the payment must survive');
    assert.equal(keptPayment.amountMinorUnits, 4_500_000, 'the payment amount is unchanged');
    assert.equal(keptPayment.status, 'successful', 'the payment is not reversed or refunded');
    assert.equal(keptPayment.reservationId, stay.id, 'the payment stays linked to its reservation');

    const [event] = await db.select().from(reservationEvents)
      .where(and(eq(reservationEvents.reservationId, stay.id), eq(reservationEvents.eventType, 'reservation_voided')));
    assert.ok(event, 'voiding is recorded on the reservation timeline');
    pass('TEST 2 a payment is preserved unchanged and the reservation is voided, not deleted');
  }

  // =========================================================================
  // TEST 3 - an issued invoice is financial history and is never destroyed
  // because the reservation is removed from operations.
  // =========================================================================
  {
    const stay = await makeStay('T3 Invoiced');
    const [invoice] = await db.insert(propertyInvoices).values({
      propertyId: property.id, organizationId: org.id, reservationId: stay.id,
      invoiceNumber: `INV-RM-${runId}-1`, invoiceType: 'guest_folio', status: 'issued',
      recipientName: 'Invoice Guest', issueDate: TODAY, dueDate: addDays(TODAY, 7),
      subtotalMinorUnits: 4_500_000, totalAmountMinorUnits: 4_500_000, items: [],
    }).returning();

    const preview = await previewOf(stay.id);
    if (preview.outcome !== 'preview') throw new Error('preview expected');
    assert.equal(preview.action, 'void');
    assert.ok(preview.reasons.includes('invoice'));

    const result = await removeReservation({
      ...scope, reservationId: stay.id, actor: manager, reason: 'Created by mistake', confirmReference: stay.reference,
    });
    assert.equal(result.outcome, 'voided');

    const [keptInvoice] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invoice.id));
    assert.ok(keptInvoice, 'the invoice must survive');
    assert.equal(keptInvoice.invoiceNumber, invoice.invoiceNumber);
    assert.equal(keptInvoice.totalAmountMinorUnits, 4_500_000, 'the issued total is not rewritten');
    assert.equal(keptInvoice.reservationId, stay.id, 'the invoice stays linked to its reservation');
    pass('TEST 3 an issued invoice is preserved intact when the reservation is voided');
  }

  // =========================================================================
  // TEST 4 - an in-house guest has stay history that must not be physically
  // removed, so the destructive action is refused rather than silently done.
  // =========================================================================
  {
    const stay = await makeStay('T4 In House');
    await ReservationService.checkIn(stay.id, r3022.id, actor, { allowOutstandingBalance: true });

    const eventsBefore = await db.select().from(reservationEvents).where(eq(reservationEvents.reservationId, stay.id));

    const preview = await previewOf(stay.id);
    if (preview.outcome !== 'preview') throw new Error('preview expected');
    assert.equal(preview.action, 'blocked', 'a checked-in stay must not offer a destructive path');

    const result = await removeReservation({
      ...scope, reservationId: stay.id, actor: manager, confirmReference: stay.reference,
    });
    assert.equal(result.outcome, 'blocked');
    if (result.outcome !== 'blocked') throw new Error('blocked expected');
    assert.equal(result.code, 'in_house');

    const after = await reload(stay.id);
    assert.equal(after.status, 'checked_in', 'the in-house stay is untouched');
    const eventsAfter = await db.select().from(reservationEvents).where(eq(reservationEvents.reservationId, stay.id));
    assert.equal(eventsAfter.length, eventsBefore.length, 'no stay history was destroyed');

    // The guest later departs in the ordinary way, freeing the room again.
    await ReservationService.checkOut(stay.id, actor, true);
    assert.equal((await reload(stay.id)).status, 'checked_out', 'the stay ends through checkout, not deletion');
    pass('TEST 4 a checked-in reservation cannot be deleted and its stay history is intact');
  }

  // =========================================================================
  // TEST 5 - a completed stay is history that is kept, even though the guest is
  // gone and the room is already free.
  // =========================================================================
  {
    const stay = await makeStay('T5 Stayed', r4040.id);
    await ReservationService.checkIn(stay.id, r4040.id, actor, { allowOutstandingBalance: true });

    // An unpaid stay is not checked out silently; the balance is reported back.
    const unsettled = await ReservationService.checkOut(stay.id, actor);
    assert.ok(unsettled.outstandingBalanceMinorUnits > 0, 'an unpaid checkout reports the balance instead of completing');
    assert.equal((await reload(stay.id)).status, 'checked_in', 'the stay is still in house until it is settled or forced');
    await ReservationService.checkOut(stay.id, actor, true);

    const preview = await previewOf(stay.id);
    if (preview.outcome !== 'preview') throw new Error('preview expected');
    assert.equal(preview.action, 'void', 'a completed stay must be kept as history');
    assert.ok(preview.reasons.includes('stay history'));

    const result = await removeReservation({
      ...scope, reservationId: stay.id, actor: manager, reason: 'Management decision', confirmReference: stay.reference,
    });
    assert.equal(result.outcome, 'voided');

    const after = await reload(stay.id);
    assert.equal(after.status, 'voided');
    const timeline = await db.select().from(reservationEvents).where(eq(reservationEvents.reservationId, stay.id));
    assert.ok(
      timeline.some((e) => e.eventType === 'checked_in' || e.eventType === 'checked_in_outstanding'),
      'the check-in that really happened is still on the record',
    );
    assert.ok(
      timeline.some((e) => e.eventType === 'checked_out' || e.eventType === 'checked_out_outstanding'),
      'the checkout that really happened is still on the record',
    );
    pass('TEST 5 a checked-out reservation is voided and its stay history is preserved');
  }

  // =========================================================================
  // TEST 6 - removing one child of a multi-room booking group leaves the others
  // exactly as they were.
  // =========================================================================
  let groupId: string;
  let childA: string;
  let childB: string;
  let childC: string;
  {
    const group = await ReservationService.createGroup({
      propertyId: property.id, checkInDate: addDays(TODAY, 40), checkOutDate: addDays(TODAY, 43),
      roomIds: [r3022.id, r3023.id], numGuests: 2, source: 'walk_in', guest: guest('T6 Group'),
    }, actor);
    groupId = group.bookingGroup.id;
    childA = group.reservations[0].id;
    childB = group.reservations[1].id;

    const apartmentChild = await makeApartmentStay('T6 Annexe');
    await db.update(reservations).set({ bookingGroupId: groupId }).where(eq(reservations.id, apartmentChild.id));
    childC = apartmentChild.id;

    const result = await removeReservation({ ...scope, reservationId: childA, actor: manager, reason: 'Duplicate reservation' });
    assert.equal(result.outcome, 'deleted');

    assert.equal(await gone(childA), true, 'only the requested child is removed');
    for (const [label, id] of [['B', childB], ['C', childC]] as const) {
      const sibling = await reload(id);
      assert.ok(sibling, `sibling ${label} must survive`);
      assert.equal(sibling.bookingGroupId, groupId, `sibling ${label} must keep the group`);
      assert.notEqual(sibling.status, 'voided', `sibling ${label} must be untouched`);
    }
    const [groupRow] = await db.select().from(bookingGroups).where(eq(bookingGroups.id, groupId));
    assert.ok(groupRow, 'the booking group remains coherent while children exist');
    pass('TEST 6 deleting one child of a booking group leaves the other reservations untouched');
  }

  // =========================================================================
  // TEST 7 - removing the last child cleans up the now-empty booking group
  // instead of leaving an orphan behind.
  // =========================================================================
  {
    for (const id of [childB, childC]) {
      const row = await reload(id);
      const result = await removeReservation({
        ...scope, reservationId: id, actor: manager, reason: 'Test / erroneous entry', confirmReference: row.reference,
      });
      assert.ok(result.outcome === 'deleted' || result.outcome === 'voided', `removal of ${id} should succeed`);
    }

    const remaining = await db.select().from(reservations).where(eq(reservations.bookingGroupId, groupId));
    assert.equal(remaining.length, 0, 'no reservation should still point at the group');
    const orphan = await db.select().from(bookingGroups).where(eq(bookingGroups.id, groupId));
    assert.equal(orphan.length, 0, 'the empty booking group is removed rather than left orphaned');
    pass('TEST 7 deleting the last child of a booking group leaves no orphan group');
  }

  // =========================================================================
  // TEST 8 - a deleted reservation that was holding Room 3022 returns that
  // capacity to the authoritative availability engine.
  // =========================================================================
  {
    const dates = { checkInDate: addDays(TODAY, 50), checkOutDate: addDays(TODAY, 53) };
    const baseline = await categoryAvailability(db, { propertyId: property.id, roomTypeId: executive.id, ...dates });
    const stay = await makeStay('T8 Room 3022', r3022.id);
    const held = await categoryAvailability(db, { propertyId: property.id, roomTypeId: executive.id, ...dates });
    const result = await removeReservation({ ...scope, reservationId: stay.id, actor: manager, reason: 'Duplicate reservation' });
    assert.equal(result.outcome, 'deleted');

    const after = await categoryAvailability(db, { propertyId: property.id, roomTypeId: executive.id, ...dates });
    assert.equal(
      after.minAvailable, baseline.minAvailable,
      `the room night is available again immediately (baseline ${baseline.minAvailable}, held ${held.minAvailable}, after ${after.minAvailable})`,
    );

    const [room] = await db.select().from(rooms).where(eq(rooms.id, r3022.id));
    assert.equal(room.operationalStatus, 'available', 'the room itself is not left occupied');
    pass('TEST 8 deleting a reservation holding Room 3022 immediately releases its availability');
  }

  // =========================================================================
  // TEST 9 - the same for an apartment.
  // =========================================================================
  {
    const stay = await makeApartmentStay('T9 Almond');
    const dates = { checkInDate: addDays(TODAY, 30), checkOutDate: addDays(TODAY, 33) };
    const held = await checkApartmentAvailability(property.id, almond.id, dates.checkInDate, dates.checkOutDate);
    assert.equal(held.minAvailable, 0, 'the reserved apartment is not available while the stay holds it');

    const result = await removeReservation({ ...scope, reservationId: stay.id, actor: manager, reason: 'Duplicate reservation' });
    assert.equal(result.outcome, 'deleted');

    const after = await checkApartmentAvailability(property.id, almond.id, dates.checkInDate, dates.checkOutDate);
    assert.equal(after.minAvailable, 1, 'the apartment is available again immediately');
    pass('TEST 9 deleting an apartment reservation immediately releases the apartment');
  }

  // =========================================================================
  // TEST 10 - a reservation belonging to another property is never removable,
  // even when the caller knows its id.
  // =========================================================================
  {
    const foreign = await ReservationService.create({
      propertyId: other.id, roomTypeId: otherType.id, roomId: otherRoom.id,
      checkInDate: addDays(TODAY, 30), checkOutDate: addDays(TODAY, 33), numGuests: 1,
      source: 'walk_in', paymentStatus: 'pay_later', paidAmountMinorUnits: 0, guest: guest('T10 Foreign'),
    }, actor);

    const preview = await previewOf(foreign.id);
    assert.equal(preview.outcome, 'not_found', 'another property reservation must not be visible');

    const result = await removeReservation({ ...scope, reservationId: foreign.id, actor: manager, reason: 'Management decision' });
    assert.equal(result.outcome, 'not_found', 'a cross-property delete must be refused');
    assert.equal((await reload(foreign.id)).status, 'confirmed', 'the other property reservation is untouched');
    pass('TEST 10 a cross-property delete is blocked and the foreign reservation is untouched');
  }

  // =========================================================================
  // TEST 11 - destructive removal is management-only. Front desk keeps normal
  // operational control but cannot permanently remove a reservation.
  // =========================================================================
  {
    assert.equal(roleMayDeleteReservations('owner'), true);
    assert.equal(roleMayDeleteReservations('manager'), true);
    assert.equal(roleMayDeleteReservations('property manager'), true, 'role aliases resolve');
    assert.equal(roleMayDeleteReservations('front_desk'), false, 'front desk must not delete reservations');
    assert.equal(roleMayDeleteReservations('receptionist'), false, 'role aliases resolve for front desk');
    assert.equal(roleMayDeleteReservations('housekeeping'), false);
    assert.equal(roleMayDeleteReservations('accountant'), false);
    pass('TEST 11 destructive removal is limited to owner and manager roles');
  }

  // =========================================================================
  // TEST 12 - a repeated destructive request is a safe no-op rather than a
  // second mutation or a corruption.
  // =========================================================================
  {
    const stay = await makeStay('T12 Repeat');
    const first = await removeReservation({ ...scope, reservationId: stay.id, actor: manager, reason: 'Duplicate reservation' });
    assert.equal(first.outcome, 'deleted');

    const second = await removeReservation({ ...scope, reservationId: stay.id, actor: manager, reason: 'Duplicate reservation' });
    assert.equal(second.outcome, 'not_found', 're-deleting a hard-deleted reservation changes nothing');

    // A voided reservation answers repeat requests as already removed.
    const kept = await makeStay('T12 Repeat Void');
    await db.insert(payments).values({
      propertyId: property.id, reservationId: kept.id, amountMinorUnits: 1_000_000,
      currency: 'NGN', provider: 'manual', method: 'cash', status: 'successful', source: 'front_desk',
    });
    const voided = await removeReservation({ ...scope, reservationId: kept.id, actor: manager, confirmReference: kept.reference });
    assert.equal(voided.outcome, 'voided');

    const again = await removeReservation({ ...scope, reservationId: kept.id, actor: manager, confirmReference: kept.reference });
    assert.equal(again.outcome, 'already_removed', 'a second request on a voided reservation is idempotent');
    assert.equal((await reload(kept.id)).status, 'voided', 'the voided record is not mutated again');

    const [payment] = await db.select().from(payments).where(eq(payments.reservationId, kept.id));
    assert.equal(payment.amountMinorUnits, 1_000_000, 'repeat requests never touch the money');
    pass('TEST 12 repeated destructive requests are safe and idempotent');
  }

  console.log(`\n${passed} reservation removal checks passed.`);
}

run().catch((error) => {
  console.error("\nFAILED:", error);
  process.exit(1);
});
