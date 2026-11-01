import { db, properties, organizations, roomTypes, rooms, reservations, guests, propertyInvoices, payments, housekeepingTasks, reservationEvents, activityLogs, eq, and } from '@sena/database';
import { ReservationService } from '@sena/reservations';
import { HousekeepingService } from '@sena/housekeeping';

async function runE2ETests() {
  console.log('--- STARTING SENA PMS 15-SCENARIO E2E REGRESSION TEST SUITE ---');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, scenario: string, details?: any) {
    if (condition) {
      console.log(`✅ [PASS] Scenario: ${scenario}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] Scenario: ${scenario}`, details || '');
      failedCount++;
      throw new Error(`Assertion failed: ${scenario}`);
    }
  }

  // Set up isolated property for E2E run
  const testId = crypto.randomUUID().slice(0, 8);
  const [org] = await db.insert(organizations).values({
    name: `Test Org ${testId}`,
    slug: `test-org-${testId}`,
  }).returning();

  const [prop] = await db.insert(properties).values({
    organizationId: org.id,
    name: `PMS Test Property ${testId}`,
    code: `PMS${testId.toUpperCase().slice(0, 3)}`,
    slug: `pms-test-${testId}`,
    address: '123 Test Boulevard, Victoria Island, Lagos',
    email: `pms-${testId}@test.sena.ng`,
    phone: '+2348011112222',
    checkInPaymentPolicy: 'allow_outstanding',
    checkOutPaymentPolicy: 'allow_outstanding',
  }).returning();

  const [category] = await db.insert(roomTypes).values({
    propertyId: prop.id,
    name: 'Executive Suite',
    bedType: 'king',
    basePriceMinorUnits: 15000000, // ₦150,000
    capacity: 2,
    inventory: 2,
  }).returning();

  // Create two physical rooms in this category
  const [room101] = await db.insert(rooms).values({
    propertyId: prop.id,
    roomTypeId: category.id,
    roomNumber: '101',
    floor: '1st Floor',
    operationalStatus: 'available',
    housekeepingStatus: 'clean',
  }).returning();

  const [room102] = await db.insert(rooms).values({
    propertyId: prop.id,
    roomTypeId: category.id,
    roomNumber: '102',
    floor: '1st Floor',
    operationalStatus: 'available',
    housekeepingStatus: 'clean',
  }).returning();

  const today = '2026-11-01';
  const tomorrow = '2026-11-02';
  const dayAfterTomorrow = '2026-11-03';

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: Create walk-in reservation (partial contact: phone only)
    // -------------------------------------------------------------
    const walkInRes = await ReservationService.create({
      propertyId: prop.id,
      roomTypeId: category.id,
      checkInDate: today,
      checkOutDate: tomorrow,
      numGuests: 1,
      source: 'walk_in',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: {
        fullName: 'Chief Walk-in Guest',
        phone: '+2348099887766',
      },
    }, { id: 'test-actor-1', name: 'Front Desk Officer' });

    assert(
      walkInRes.id && walkInRes.status === 'confirmed' && walkInRes.source === 'walk_in',
      '1. Create walk-in reservation (with partial contact)'
    );

    // -------------------------------------------------------------
    // SCENARIO 2: Create online reservation
    // -------------------------------------------------------------
    const onlineRes = await ReservationService.create({
      propertyId: prop.id,
      roomTypeId: category.id,
      checkInDate: tomorrow,
      checkOutDate: dayAfterTomorrow,
      numGuests: 2,
      source: 'direct',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: {
        fullName: 'Online Booker',
        email: `booker.${testId}@guest.sena.ng`,
        phone: '+2348012345678',
      },
    }, { id: 'test-actor-1', name: 'Booking Engine' });

    assert(
      onlineRes.id && onlineRes.status === 'confirmed' && onlineRes.source === 'direct',
      '2. Create online reservation'
    );

    // -------------------------------------------------------------
    // SCENARIO 3: Assign an available room
    // -------------------------------------------------------------
    const assignResult = await ReservationService.assignRoom(
      walkInRes.id,
      room101.id,
      { id: 'test-actor-1', name: 'Front Desk Officer' },
      'Standard assignment'
    );

    const [updatedWalkIn] = await db.select().from(reservations).where(eq(reservations.id, walkInRes.id));
    assert(
      assignResult.roomId === room101.id && updatedWalkIn.roomId === room101.id,
      '3. Assign an available room'
    );

    // -------------------------------------------------------------
    // SCENARIO 4: Change an existing guest\'s room (reassignment before check-in)
    // -------------------------------------------------------------
    const changeRoomBeforeCheckin = await ReservationService.assignRoom(
      walkInRes.id,
      room102.id,
      { id: 'test-actor-1', name: 'Front Desk Officer' },
      'Guest preferred room 102'
    );

    const [reassignedRes] = await db.select().from(reservations).where(eq(reservations.id, walkInRes.id));
    assert(
      changeRoomBeforeCheckin.roomId === room102.id && reassignedRes.roomId === room102.id,
      '4a. Change reservation room prior to check-in'
    );

    // -------------------------------------------------------------
    // SCENARIO 5: Check in a guest
    // -------------------------------------------------------------
    await ReservationService.checkIn(
      walkInRes.id,
      room102.id,
      { id: 'test-actor-1', name: 'Front Desk Officer' },
      { allowOutstandingBalance: true }
    );

    const [checkedInStay] = await db.select().from(reservations).where(eq(reservations.id, walkInRes.id));
    const [room102AfterCheckin] = await db.select().from(rooms).where(eq(rooms.id, room102.id));
    assert(
      checkedInStay.status === 'checked_in' &&
      checkedInStay.actualCheckInAt != null &&
      room102AfterCheckin.operationalStatus === 'occupied',
      '5. Check in a guest (room occupied & actualCheckInAt recorded)'
    );

    // -------------------------------------------------------------
    // SCENARIO 4b: Reassign an IN-HOUSE checked-in guest to another clean room
    // -------------------------------------------------------------
    // Guest in 102 wants to move to 101. Room 101 is clean and available.
    const inHouseRoomMove = await ReservationService.assignRoom(
      walkInRes.id,
      room101.id,
      { id: 'test-actor-1', name: 'Front Desk Officer' },
      'AC issue in 102, moved to 101'
    );

    const [stayAfterMove] = await db.select().from(reservations).where(eq(reservations.id, walkInRes.id));
    const [room101AfterMove] = await db.select().from(rooms).where(eq(rooms.id, room101.id));
    const [room102AfterMove] = await db.select().from(rooms).where(eq(rooms.id, room102.id));
    const [task102] = await db.select().from(housekeepingTasks).where(
      and(
        eq(housekeepingTasks.roomId, room102.id),
        eq(housekeepingTasks.propertyId, prop.id),
        eq(housekeepingTasks.status, 'dirty')
      )
    );

    assert(
      inHouseRoomMove.roomId === room101.id &&
      stayAfterMove.roomId === room101.id &&
      room101AfterMove.operationalStatus === 'occupied' &&
      room102AfterMove.operationalStatus === 'available' &&
      room102AfterMove.housekeepingStatus === 'dirty' &&
      task102 != null,
      '4b. Reassign in-house checked-in guest (101 occupied, 102 marked dirty with housekeeping task queued)'
    );

    // -------------------------------------------------------------
    // SCENARIO 7: Generate and post an invoice
    // -------------------------------------------------------------
    const [invoice] = await db.insert(propertyInvoices).values({
      organizationId: org.id,
      propertyId: prop.id,
      reservationId: walkInRes.id,
      guestId: walkInRes.guestId,
      invoiceNumber: `INV-${testId}-01`,
      issueDate: today,
      dueDate: today,
      status: 'issued',
      totalAmountMinorUnits: walkInRes.totalAmountMinorUnits,
      subtotalMinorUnits: walkInRes.totalAmountMinorUnits,
      recipientName: 'Chief Walk-in Guest',
      items: [
        {
          id: crypto.randomUUID(),
          description: 'Executive Suite - 1 Night',
          quantity: 1,
          unitPriceMinorUnits: walkInRes.totalAmountMinorUnits,
          totalMinorUnits: walkInRes.totalAmountMinorUnits,
        },
      ],
    }).returning();

    assert(invoice.id && invoice.status === 'issued', '7. Generate and post an invoice');

    // -------------------------------------------------------------
    // SCENARIO 8: Record a payment
    // -------------------------------------------------------------
    const paymentAmount = walkInRes.totalAmountMinorUnits; // Pay in full
    const [recordedPayment] = await db.insert(payments).values({
      propertyId: prop.id,
      reservationId: walkInRes.id,
      amountMinorUnits: paymentAmount,
      currency: 'NGN',
      method: 'cash',
      status: 'successful',
      category: 'room_charge',
    }).returning();

    await db.update(reservations).set({
      paidAmountMinorUnits: paymentAmount,
      paymentStatus: 'paid',
    }).where(eq(reservations.id, walkInRes.id));

    await db.update(propertyInvoices).set({
      status: 'paid',
      paidAmountMinorUnits: paymentAmount,
    }).where(eq(propertyInvoices.id, invoice.id));

    const [resAfterPayment] = await db.select().from(reservations).where(eq(reservations.id, walkInRes.id));
    assert(
      recordedPayment.id && resAfterPayment.paymentStatus === 'paid' && resAfterPayment.paidAmountMinorUnits === paymentAmount,
      '8. Record a payment and update folio'
    );

    // -------------------------------------------------------------
    // SCENARIO 6: Check out a guest
    // -------------------------------------------------------------
    const checkoutResult = await ReservationService.checkOut(
      walkInRes.id,
      { id: 'test-actor-1', name: 'Front Desk Officer' },
      false
    );

    const [checkedOutStay] = await db.select().from(reservations).where(eq(reservations.id, walkInRes.id));
    assert(
      checkedOutStay.status === 'checked_out' &&
      checkedOutStay.actualCheckOutAt != null &&
      checkoutResult.outstandingBalanceMinorUnits === 0,
      '6. Check out a guest (status checked_out & actualCheckOutAt recorded)'
    );

    // -------------------------------------------------------------
    // SCENARIO 9: Release a room after checkout (Room -> available, Housekeeping -> dirty)
    // -------------------------------------------------------------
    const [room101AfterCheckout] = await db.select().from(rooms).where(eq(rooms.id, room101.id));
    const [task101] = await db.select().from(housekeepingTasks).where(
      and(
        eq(housekeepingTasks.roomId, room101.id),
        eq(housekeepingTasks.propertyId, prop.id),
        eq(housekeepingTasks.status, 'dirty')
      )
    );

    assert(
      room101AfterCheckout.operationalStatus === 'available' &&
      room101AfterCheckout.housekeepingStatus === 'dirty' &&
      task101 != null,
      '9. Release a room after checkout (room available, dirty, task queued)'
    );

    // -------------------------------------------------------------
    // SCENARIO 10: Mark a room dirty (Housekeeping workflow)
    // -------------------------------------------------------------
    const dirtyResult = await HousekeepingService.sendToHousekeeping(
      prop.id,
      room102.id,
      { id: 'test-actor-1', name: 'Supervisor' },
      'Routine maintenance mark'
    );

    const [room102Dirty] = await db.select().from(rooms).where(eq(rooms.id, room102.id));
    assert(
      dirtyResult.status === 'dirty' && room102Dirty.housekeepingStatus === 'dirty',
      '10. Mark a room dirty'
    );

    // -------------------------------------------------------------
    // SCENARIO 11: Complete housekeeping (clean & completed task)
    // -------------------------------------------------------------
    // Start cleaning
    await HousekeepingService.updateStatus(prop.id, room101.id, 'cleaning', { id: 'cleaner-1', name: 'Cleaner 1' });
    // Finish cleaning
    await HousekeepingService.updateStatus(prop.id, room101.id, 'clean', { id: 'cleaner-1', name: 'Cleaner 1' });

    const [room101Cleaned] = await db.select().from(rooms).where(eq(rooms.id, room101.id));
    const [task101Cleaned] = await db.select().from(housekeepingTasks).where(eq(housekeepingTasks.id, task101.id));

    assert(
      room101Cleaned.housekeepingStatus === 'clean' &&
      task101Cleaned.status === 'clean' &&
      task101Cleaned.completedAt != null,
      '11. Complete housekeeping (room clean, task completed)'
    );

    // -------------------------------------------------------------
    // SCENARIO 12: Make the cleaned room available again for next reservation
    // -------------------------------------------------------------
    const eligibleRoomsForOnline = await ReservationService.eligibleRooms({
      propertyId: prop.id,
      roomTypeId: category.id,
      checkInDate: tomorrow,
      checkOutDate: dayAfterTomorrow,
      excludeReservationId: onlineRes.id,
      forCheckIn: true,
    });

    const eligible101 = eligibleRoomsForOnline.find(r => r.id === room101.id);
    assert(
      eligible101 != null && eligible101.eligible === true && eligible101.readinessLabel.includes('Clean'),
      '12. Cleaned room is available and eligible for next reservation'
    );

    // -------------------------------------------------------------
    // SCENARIO 13: Prevent two guests from occupying the same room
    // -------------------------------------------------------------
    // Assign room 101 to online reservation and check in
    await ReservationService.assignRoom(onlineRes.id, room101.id, { id: 'test-actor-1', name: 'Front Desk' });
    await ReservationService.checkIn(onlineRes.id, room101.id, { id: 'test-actor-1', name: 'Front Desk' }, { allowOutstandingBalance: true });

    // Now try to assign room 101 to a third reservation for the same dates
    const thirdRes = await ReservationService.create({
      propertyId: prop.id,
      roomTypeId: category.id,
      checkInDate: tomorrow,
      checkOutDate: dayAfterTomorrow,
      numGuests: 1,
      source: 'walk_in',
      paymentStatus: 'pay_later',
      paidAmountMinorUnits: 0,
      guest: { fullName: 'Third Guest', phone: '+2348000000001' },
    });

    let doubleOccupancyBlocked = false;
    try {
      await ReservationService.assignRoom(thirdRes.id, room101.id, { id: 'test-actor-1', name: 'Front Desk' });
    } catch (err: any) {
      if (/no longer available|already occupied/i.test(err.message)) {
        doubleOccupancyBlocked = true;
      }
    }

    assert(
      doubleOccupancyBlocked,
      '13. Prevent two guests from occupying same room (collision detected & blocked)'
    );

    // -------------------------------------------------------------
    // SCENARIO 14: Prevent overlapping reservations when category is full
    // -------------------------------------------------------------
    // Category capacity is 2. Both room 101 and room 102 are occupied on tomorrow.
    // Assign room 102 to thirdRes for tomorrow
    // Clean room 102 first
    await HousekeepingService.updateStatus(prop.id, room102.id, 'clean', { id: 'cleaner-1', name: 'Cleaner 1' });
    await ReservationService.assignRoom(thirdRes.id, room102.id, { id: 'test-actor-1', name: 'Front Desk' });

    let overbookingBlocked = false;
    try {
      await ReservationService.create({
        propertyId: prop.id,
        roomTypeId: category.id,
        checkInDate: tomorrow,
        checkOutDate: dayAfterTomorrow,
        numGuests: 1,
        source: 'walk_in',
        paymentStatus: 'pay_later',
        paidAmountMinorUnits: 0,
        guest: { fullName: 'Fourth Guest', phone: '+2348000000002' },
      });
    } catch (err: any) {
      if (/fully booked/i.test(err.message)) {
        overbookingBlocked = true;
      }
    }

    assert(
      overbookingBlocked,
      '14. Prevent overlapping reservations (category fully booked prevented overbooking)'
    );

    // -------------------------------------------------------------
    // SCENARIO 15: Verify historical records remain intact
    // -------------------------------------------------------------
    const events = await db.select().from(reservationEvents).where(eq(reservationEvents.reservationId, walkInRes.id));
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.propertyId, prop.id));
    const pastInvoices = await db.select().from(propertyInvoices).where(eq(propertyInvoices.propertyId, prop.id));

    const hasCreatedEvent = events.some(e => e.eventType === 'reservation_created');
    const hasMoveEvent = events.some(e => e.eventType === 'room_changed');
    const hasCheckInEvent = events.some(e => e.eventType.includes('checked_in'));
    const hasCheckOutEvent = events.some(e => e.eventType.includes('checked_out'));

    assert(
      hasCreatedEvent &&
      hasMoveEvent &&
      hasCheckInEvent &&
      hasCheckOutEvent &&
      pastInvoices.length > 0 &&
      logs.length > 0,
      '15. Verify historical records remain intact (immutable audit events, invoice, activity logs)'
    );

    console.log(`\n======================================================`);
    console.log(`ALL 15 PMS LIFECYCLE SCENARIOS COMPLETED SUCCESSFULLY!`);
    console.log(`Passed: ${passedCount} / 15`);
    console.log(`Failed: ${failedCount}`);
    console.log(`======================================================\n`);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during E2E test:', err);
    process.exit(1);
  }
}

runE2ETests();
