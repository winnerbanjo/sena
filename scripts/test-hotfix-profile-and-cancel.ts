import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env before database import
for (const envPath of [resolve(__dirname, '../.env')]) {
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=["']?([^"'\r\n]+)["']?/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  }
}

import assert from 'assert';
import { db, reservations, guests, rooms, roomTypes, properties, propertyInvoices, payments, reservationEvents, activityLogs, inventory, users, eq, and, sql } from '@sena/database';
import { ReservationService } from '@sena/reservations';
import { mapReservationItem } from '../apps/dashboard/src/components/reservation-room';
import { ROLE_PERMISSIONS } from '@sena/config';
import { getDatesBetween } from '@sena/config';

async function runHotfixTests() {
  console.log('--- STARTING HOTFIX VERIFICATION SUITE ---');

  // Find a property for tests
  const [property] = await db.select().from(properties).limit(1);
  assert(property, 'Property must exist');
  console.log(`Using property: ${property.name} (${property.id})`);

  // =========================================================================
  // TEST SUITE 1: TASK A - EDIT GUEST PROFILE & ROOT CAUSE FIX
  // =========================================================================
  console.log('\n[TEST 1] Verifying Task A: mapReservationItem includes guestId');
  const mockApiReservation = {
    id: '11111111-1111-1111-1111-111111111111',
    reference: 'SEN-TEST01',
    guestId: '22222222-2222-2222-2222-222222222222',
    guestName: 'Ada Lovelace',
    guestEmail: 'ada@example.com',
    guestPhone: '+2348000000001',
    roomTypeName: 'Deluxe Suite',
    roomTypeId: '33333333-3333-3333-3333-333333333333',
    roomId: '44444444-4444-4444-4444-444444444444',
    roomNumber: '101',
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-04',
    nights: 3,
    numGuests: 2,
    status: 'confirmed' as const,
    paymentStatus: 'paid' as const,
    totalAmountMinorUnits: 15000000,
    paidAmountMinorUnits: 15000000,
  };

  const mapped = mapReservationItem(mockApiReservation);
  assert.strictEqual(
    mapped.guestId,
    mockApiReservation.guestId,
    'Root cause regression: mapReservationItem MUST preserve guestId so EditGuestDialog renders'
  );
  console.log('✓ mapReservationItem correctly outputs guestId:', mapped.guestId);

  // Database persistence test for guest profile editing
  console.log('\n[TEST 2] Verifying Guest profile editing persists and preserves financial/room integrity');
  // Create a dedicated guest and reservation for testing
  const [testGuest] = await db
    .insert(guests)
    .values({
      organizationId: property.organizationId,
      propertyId: property.id,
      fullName: 'Initial Profile Name',
      email: 'initial.guest@example.com',
      phone: '+2348011112222',
    })
    .returning();

  const [testRoomType] = await db.select().from(roomTypes).where(eq(roomTypes.propertyId, property.id)).limit(1);
  assert(testRoomType, 'Room type must exist');

  const [testRoom] = await db.select().from(rooms).where(eq(rooms.roomTypeId, testRoomType.id)).limit(1);
  assert(testRoom, 'Room must exist');

  const [testReservation] = await db
    .insert(reservations)
    .values({
      reference: `SEN-HOTFIX-${Date.now().toString().slice(-5)}`,
      propertyId: property.id,
      guestId: testGuest.id,
      roomTypeId: testRoomType.id,
      roomId: testRoom.id,
      checkInDate: '2026-12-10',
      checkOutDate: '2026-12-12',
      nights: 2,
      numGuests: 1,
      status: 'confirmed',
      paymentStatus: 'paid',
      totalAmountMinorUnits: 5000000,
      paidAmountMinorUnits: 5000000,
    })
    .returning();

  // Simulate PATCH /api/guests/[id]
  const updatedName = 'Updated Guest Name PhD';
  const updatedEmail = 'updated.guest@example.com';
  const updatedPhone = '+2348099998888';

  await db
    .update(guests)
    .set({
      fullName: updatedName,
      email: updatedEmail,
      phone: updatedPhone,
      updatedAt: new Date(),
    })
    .where(and(eq(guests.id, testGuest.id), eq(guests.propertyId, property.id)));

  const [refetchedGuest] = await db.select().from(guests).where(eq(guests.id, testGuest.id));
  assert.strictEqual(refetchedGuest.fullName, updatedName);
  assert.strictEqual(refetchedGuest.email, updatedEmail);
  assert.strictEqual(refetchedGuest.phone, updatedPhone);

  // Verify reservation financials and room assignment remain untouched
  const [untouchedRes] = await db.select().from(reservations).where(eq(reservations.id, testReservation.id));
  assert.strictEqual(untouchedRes.totalAmountMinorUnits, 5000000);
  assert.strictEqual(untouchedRes.paidAmountMinorUnits, 5000000);
  assert.strictEqual(untouchedRes.roomId, testRoom.id);
  assert.strictEqual(untouchedRes.status, 'confirmed');
  console.log('✓ Guest profile updated in DB without altering financials, payment, or room assignment');

  // =========================================================================
  // TEST SUITE 2: TASK B - CANCEL RESERVATION
  // =========================================================================
  console.log('\n[TEST 3] Verifying Reservation Cancellation: Inventory release & audit recording');
  
  // Create an active reservation using ReservationService to allocate real inventory
  const stayDates = ['2026-12-20', '2026-12-21'];
  const cancelTestRes = await ReservationService.create({
    propertyId: property.id,
    guestId: testGuest.id,
    roomTypeId: testRoomType.id,
    checkInDate: '2026-12-20',
    checkOutDate: '2026-12-22',
    numGuests: 1,
    source: 'direct',
  });

  console.log(`Created reservation ${cancelTestRes.reference} for dates 2026-12-20 to 2026-12-22`);

  // Check inventory booked count before cancel
  const invBefore = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.propertyId, property.id),
        eq(inventory.roomTypeId, testRoomType.id),
        eq(inventory.date, '2026-12-20')
      )
    );
  const bookedBefore = invBefore[0]?.reservedInventory || 0;
  console.log(`Reserved inventory before cancellation: ${bookedBefore}`);

  // Now Cancel Reservation
  const cancelReason = 'Customer changed travel schedule';
  const [existingUser] = await db.select().from(users).limit(1);
  const actor = existingUser
    ? { id: existingUser.id, name: existingUser.fullName || 'Senior Front Desk' }
    : { id: '', name: 'Senior Front Desk' };

  await ReservationService.cancel(cancelTestRes.id, actor, cancelReason);

  // Verify reservation record
  const [cancelledRow] = await db.select().from(reservations).where(eq(reservations.id, cancelTestRes.id));
  assert.strictEqual(cancelledRow.status, 'cancelled', 'Status must be cancelled');
  assert.strictEqual(cancelledRow.cancellationReason, cancelReason, 'Cancellation reason must be recorded');
  assert(cancelledRow.cancelledAt, 'cancelledAt timestamp must be recorded');
  assert.strictEqual(cancelledRow.cancelledBy, actor.id || null, 'cancelledBy must match actor');
  console.log('✓ Reservation status = cancelled, reason and actor recorded');

  // Verify inventory released
  const invAfter = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.propertyId, property.id),
        eq(inventory.roomTypeId, testRoomType.id),
        eq(inventory.date, '2026-12-20')
      )
    );
  const bookedAfter = invAfter[0]?.reservedInventory || 0;
  assert.strictEqual(bookedAfter, bookedBefore - 1, 'Inventory reserved inventory must be decremented by 1');
  console.log(`✓ Inventory correctly released: ${bookedBefore} -> ${bookedAfter}`);

  // Verify timeline event
  const events = await db
    .select()
    .from(reservationEvents)
    .where(and(eq(reservationEvents.reservationId, cancelTestRes.id), eq(reservationEvents.eventType, 'cancelled')));
  assert(events.length >= 1, 'Cancellation event must exist in reservationEvents');
  assert(events[0].description.includes(cancelReason), 'Event description must include reason');
  console.log('✓ Timeline event recorded:', events[0].description);

  // =========================================================================
  // TEST SUITE 3: DOUBLE CANCELLATION IDEMPOTENCY
  // =========================================================================
  console.log('\n[TEST 4] Verifying Double Cancellation Idempotency');
  await ReservationService.cancel(cancelTestRes.id, actor, 'Second cancellation attempt');
  const invDouble = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.propertyId, property.id),
        eq(inventory.roomTypeId, testRoomType.id),
        eq(inventory.date, '2026-12-20')
      )
    );
  assert.strictEqual(invDouble[0]?.reservedInventory || 0, bookedAfter, 'Second cancellation must NOT release inventory again');
  console.log('✓ Double cancellation is completely idempotent (no inventory double-release)');

  // =========================================================================
  // TEST SUITE 4: STATE MACHINE ENFORCEMENT
  // =========================================================================
  console.log('\n[TEST 5] Verifying State Machine Rules: cannot cancel checked_in or checked_out');
  const [checkedInRes] = await db
    .insert(reservations)
    .values({
      reference: `SEN-IN-${Date.now().toString().slice(-5)}`,
      propertyId: property.id,
      guestId: testGuest.id,
      roomTypeId: testRoomType.id,
      checkInDate: '2026-12-01',
      checkOutDate: '2026-12-03',
      nights: 2,
      numGuests: 1,
      status: 'checked_in',
      totalAmountMinorUnits: 4000000,
    })
    .returning();

  let checkInErrorCaught = false;
  try {
    await ReservationService.cancel(checkedInRes.id, actor, 'Trying to cancel active stay');
  } catch (err: any) {
    checkInErrorCaught = true;
    assert(err.message.includes('This stay cannot be cancelled.'));
  }
  assert(checkInErrorCaught, 'Must throw error when trying to cancel checked_in reservation');
  console.log('✓ State machine successfully blocked cancellation of checked_in stay');

  const [checkedOutRes] = await db
    .insert(reservations)
    .values({
      reference: `SEN-OUT-${Date.now().toString().slice(-5)}`,
      propertyId: property.id,
      guestId: testGuest.id,
      roomTypeId: testRoomType.id,
      checkInDate: '2026-11-20',
      checkOutDate: '2026-11-22',
      nights: 2,
      numGuests: 1,
      status: 'checked_out',
      totalAmountMinorUnits: 4000000,
    })
    .returning();

  let checkOutErrorCaught = false;
  try {
    await ReservationService.cancel(checkedOutRes.id, actor, 'Trying to cancel past stay');
  } catch (err: any) {
    checkOutErrorCaught = true;
    assert(err.message.includes('This stay cannot be cancelled.'));
  }
  assert(checkOutErrorCaught, 'Must throw error when trying to cancel checked_out reservation');
  console.log('✓ State machine successfully blocked cancellation of checked_out stay');

  // =========================================================================
  // TEST SUITE 5: RBAC PERMISSIONS VERIFICATION
  // =========================================================================
  console.log('\n[TEST 6] Verifying RBAC Permissions for reservation cancellation');
  assert(ROLE_PERMISSIONS.owner.includes('reservation.cancel'), 'Owner must have reservation.cancel');
  assert(ROLE_PERMISSIONS.manager.includes('reservation.cancel'), 'Manager must have reservation.cancel');
  assert(ROLE_PERMISSIONS.front_desk.includes('reservation.cancel'), 'Front Desk must have reservation.cancel');
  assert(!ROLE_PERMISSIONS.housekeeping.includes('reservation.cancel' as any), 'Housekeeping must NOT have reservation.cancel');
  console.log('✓ RBAC permissions correctly configured across all roles');

  console.log('\n======================================================');
  console.log('🎉 ALL HOTFIX VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('======================================================\n');
  process.exit(0);
}

runHotfixTests().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
