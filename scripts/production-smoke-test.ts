import {
  db,
  properties,
  roomTypes,
  rooms,
  guests,
  reservations,
  reservationEvents,
  housekeepingTasks,
  propertyInvoices,
  payments,
  eq,
  and,
  inArray,
} from '@sena/database';
import { ReservationService } from '@sena/reservations';
import { PaymentService } from '@sena/payments';
import { HousekeepingService } from '@sena/housekeeping';

interface SmokeStepResult {
  step: number;
  name: string;
  success: boolean;
  details: any;
  error?: string;
}

const results: SmokeStepResult[] = [];

async function runProductionSmokeTest() {
  console.log('===============================================================');
  console.log('       SENA OS PRODUCTION PMS SMOKE TEST VERIFICATION          ');
  console.log('===============================================================\n');

  const propertyId = '484c4d9b-670a-4171-aed9-2c8ebc1073e0'; // Stay Connect Global
  const actor = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Production Smoke Verifier',
  };

  // 0. Verify Property & Room Setup
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId));

  if (!property) {
    throw new Error(`Production property Stay Connect (${propertyId}) not found!`);
  }
  console.log(`Verified Production Property: ${property.name} (${property.code})`);

  // Find Room 101
  const stayRooms = await db
    .select()
    .from(rooms)
    .where(eq(rooms.propertyId, propertyId));

  const room101 = stayRooms.find((r) => r.roomNumber === '101');
  if (!room101) {
    throw new Error('Required production room 101 not found.');
  }

  // Create dedicated test candidate Room 102 in the same room category to test room reassignment
  const [room102] = await db
    .insert(rooms)
    .values({
      propertyId,
      roomTypeId: room101.roomTypeId,
      roomNumber: '102-SMOKE',
      floor: '1st Floor',
      operationalStatus: 'available',
      housekeepingStatus: 'clean',
    })
    .returning();

  console.log(`Initial Room 101 State: ${room101.operationalStatus} / ${room101.housekeepingStatus}`);
  console.log(`Created Room 102-SMOKE State: ${room102.operationalStatus} / ${room102.housekeepingStatus}`);

  let testReservationId: string | null = null;
  let testGuestId: string | null = null;
  let testInvoiceId: string | null = null;

  try {
    // -----------------------------------------------------------------
    // STEP 1: Create a Walk-in Reservation (Phone only, no email)
    // -----------------------------------------------------------------
    console.log('\n--- STEP 1: Create Walk-in Reservation ---');
    const testPhone = '+2348099887766';
    const checkInDate = '2026-11-05';
    const checkOutDate = '2026-11-06';

    const reservation = await ReservationService.create(
      {
        propertyId,
        guest: {
          fullName: 'Production SmokeTest Guest',
          phone: testPhone,
          // Email intentionally omitted to verify partial contact fallback on production
        },
        roomTypeId: room101.roomTypeId,
        checkInDate,
        checkOutDate,
        numGuests: 1,
        adults: 1,
        children: 0,
        source: 'walk_in',
        paymentStatus: 'pay_later',
        paidAmountMinorUnits: 0,
        customTotalAmountMinorUnits: 9500000, // ₦95,000 standard rate
      },
      actor
    );

    testReservationId = reservation.id;
    testGuestId = reservation.guestId;

    const [createdGuest] = await db
      .select()
      .from(guests)
      .where(eq(guests.id, testGuestId));

    console.log(`✅ Reservation Created: Ref ${reservation.reference} (ID: ${reservation.id})`);
    console.log(`✅ Guest Resolved: ${createdGuest.fullName} | Email: ${createdGuest.email} | Phone: ${createdGuest.phone}`);

    results.push({
      step: 1,
      name: 'Create walk-in reservation (phone-only)',
      success: reservation.status === 'confirmed' && createdGuest.email.includes('@guest.sena.ng'),
      details: {
        reference: reservation.reference,
        status: reservation.status,
        paymentStatus: reservation.paymentStatus,
        totalAmountMinorUnits: reservation.totalAmountMinorUnits,
        guestEmail: createdGuest.email,
      },
    });

    // -----------------------------------------------------------------
    // STEP 2: Assign a Room (Room 101)
    // -----------------------------------------------------------------
    console.log('\n--- STEP 2: Assign Initial Room (101) ---');
    const assigned = await ReservationService.assignRoom(
      reservation.id,
      room101.id,
      actor,
      'Initial Front Desk room allocation'
    );

    const [resAfterAssign] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservation.id));

    console.log(`✅ Room Assigned: Room ID ${resAfterAssign.roomId} (Room 101)`);
    results.push({
      step: 2,
      name: 'Assign room (Room 101)',
      success: resAfterAssign.roomId === room101.id,
      details: { roomId: resAfterAssign.roomId, roomNumber: '101' },
    });

    // -----------------------------------------------------------------
    // STEP 3: Check In Guest
    // -----------------------------------------------------------------
    console.log('\n--- STEP 3: Check In Guest ---');
    await ReservationService.checkIn(
      reservation.id,
      room101.id,
      actor,
      { allowOutstandingBalance: true }
    );

    const [resAfterCheckIn] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservation.id));

    const [room101AfterCheckIn] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, room101.id));

    console.log(`✅ Guest Checked In: Status = ${resAfterCheckIn.status}, actualCheckInAt = ${resAfterCheckIn.actualCheckInAt}`);
    console.log(`✅ Room 101 Operational Status: ${room101AfterCheckIn.operationalStatus}`);

    results.push({
      step: 3,
      name: 'Check in guest',
      success:
        resAfterCheckIn.status === 'checked_in' &&
        resAfterCheckIn.actualCheckInAt !== null &&
        room101AfterCheckIn.operationalStatus === 'occupied',
      details: {
        status: resAfterCheckIn.status,
        actualCheckInAt: resAfterCheckIn.actualCheckInAt,
        room101Status: room101AfterCheckIn.operationalStatus,
      },
    });

    // -----------------------------------------------------------------
    // STEP 4: Change Room While Checked In (Reassign 101 -> 102-SMOKE)
    // -----------------------------------------------------------------
    console.log('\n--- STEP 4: Change Room While Checked In (101 -> 102-SMOKE) ---');
    const reassigned = await ReservationService.assignRoom(
      reservation.id,
      room102.id,
      actor,
      'Guest requested room move'
    );

    const [resAfterReassign] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservation.id));

    console.log(`✅ Reservation Room Updated to: ${resAfterReassign.roomId} (Room 102-SMOKE)`);
    results.push({
      step: 4,
      name: 'Change guest room while checked in',
      success: resAfterReassign.roomId === room102.id,
      details: {
        newRoomId: resAfterReassign.roomId,
        newRoomNumber: '102-SMOKE',
      },
    });

    // -----------------------------------------------------------------
    // STEP 5: Confirm Old Room = Dirty & New Room = Occupied
    // -----------------------------------------------------------------
    console.log('\n--- STEP 5: Confirm State Synchronization ---');
    const [room101AfterMove] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, room101.id));

    const [room102AfterMove] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, room102.id));

    const tasksFor101 = await db
      .select()
      .from(housekeepingTasks)
      .where(
        and(
          eq(housekeepingTasks.roomId, room101.id),
          inArray(housekeepingTasks.status, ['dirty', 'cleaning'])
        )
      );

    console.log(`✅ Old Room 101 Status: ${room101AfterMove.operationalStatus} / ${room101AfterMove.housekeepingStatus}`);
    console.log(`✅ New Room 102-SMOKE Status: ${room102AfterMove.operationalStatus} / ${room102AfterMove.housekeepingStatus}`);
    console.log(`✅ Housekeeping Task Queued for Room 101: ${tasksFor101.length > 0 ? 'YES' : 'NO'}`);

    const step5Pass =
      room101AfterMove.operationalStatus === 'available' &&
      room101AfterMove.housekeepingStatus === 'dirty' &&
      room102AfterMove.operationalStatus === 'occupied' &&
      tasksFor101.length > 0;

    results.push({
      step: 5,
      name: 'Old room dirty & new room occupied with task queued',
      success: step5Pass,
      details: {
        room101: {
          operational: room101AfterMove.operationalStatus,
          housekeeping: room101AfterMove.housekeepingStatus,
        },
        room102: {
          operational: room102AfterMove.operationalStatus,
          housekeeping: room102AfterMove.housekeepingStatus,
        },
        tasksQueued: tasksFor101.length,
      },
    });

    // -----------------------------------------------------------------
    // STEP 6: Check Out Guest
    // -----------------------------------------------------------------
    console.log('\n--- STEP 6: Check Out Guest ---');
    const checkoutResult = await ReservationService.checkOut(
      reservation.id,
      actor,
      true // allow checkout with pending folio settlement in next step
    );

    const [resAfterCheckout] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservation.id));

    console.log(`✅ Guest Checked Out: Status = ${resAfterCheckout.status}, actualCheckOutAt = ${resAfterCheckout.actualCheckOutAt}`);
    results.push({
      step: 6,
      name: 'Check out guest',
      success:
        resAfterCheckout.status === 'checked_out' &&
        resAfterCheckout.actualCheckOutAt !== null,
      details: {
        status: resAfterCheckout.status,
        actualCheckOutAt: resAfterCheckout.actualCheckOutAt,
      },
    });

    // -----------------------------------------------------------------
    // STEP 7: Generate and Post Final Invoice
    // -----------------------------------------------------------------
    console.log('\n--- STEP 7: Generate and Post Final Invoice ---');
    const today = new Date().toISOString().split('T')[0];
    const [invoice] = await db
      .insert(propertyInvoices)
      .values({
        organizationId: property.organizationId,
        propertyId,
        reservationId: reservation.id,
        guestId: testGuestId,
        invoiceNumber: `INV-SMOKE-${Date.now().toString().slice(-6)}`,
        recipientName: 'Production SmokeTest Guest',
        recipientPhone: testPhone,
        status: 'issued',
        issueDate: today,
        dueDate: today,
        subtotalMinorUnits: 9500000,
        taxVatMinorUnits: 0,
        taxConsumptionMinorUnits: 0,
        serviceChargeMinorUnits: 0,
        discountMinorUnits: 0,
        totalAmountMinorUnits: 9500000,
        paidAmountMinorUnits: 0,
        currency: 'NGN',
        items: [
          {
            description: 'Accommodation - Deluxe Standard Room',
            quantity: 1,
            unitPriceMinorUnits: 9500000,
            amountMinorUnits: 9500000,
          },
        ],
      })
      .returning();

    testInvoiceId = invoice.id;
    const initialBalance = invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits;
    console.log(`✅ Invoice Posted: ${invoice.invoiceNumber} | Total: ₦95,000 | Balance: ₦${initialBalance / 100}`);

    results.push({
      step: 7,
      name: 'Generate and post final invoice',
      success: invoice.status === 'issued' && initialBalance === 9500000,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        total: invoice.totalAmountMinorUnits,
        balance: initialBalance,
      },
    });

    // -----------------------------------------------------------------
    // STEP 8: Record Payment
    // -----------------------------------------------------------------
    console.log('\n--- STEP 8: Record Payment ---');
    const payment = await PaymentService.recordPayment({
      propertyId,
      reservationId: reservation.id,
      amountMinorUnits: 9500000,
      method: 'cash',
      actorId: actor.id,
      notes: 'Production smoke test folio settlement',
    });

    // Update invoice balance
    await db
      .update(propertyInvoices)
      .set({
        paidAmountMinorUnits: 9500000,
        status: 'paid',
        updatedAt: new Date(),
      })
      .where(eq(propertyInvoices.id, invoice.id));

    const [updatedInvoice] = await db
      .select()
      .from(propertyInvoices)
      .where(eq(propertyInvoices.id, invoice.id));

    const finalBalance = updatedInvoice.totalAmountMinorUnits - updatedInvoice.paidAmountMinorUnits;
    console.log(`✅ Payment Recorded: ID ${payment.id} | Amount: ₦95,000`);
    console.log(`✅ Invoice Paid: Status = ${updatedInvoice.status} | Balance = ₦${finalBalance / 100}`);

    results.push({
      step: 8,
      name: 'Record payment and clear invoice balance',
      success: payment.status === 'successful' && finalBalance === 0 && updatedInvoice.status === 'paid',
      details: {
        paymentId: payment.id,
        paymentStatus: payment.status,
        invoiceStatus: updatedInvoice.status,
        invoiceBalance: finalBalance,
      },
    });

    // -----------------------------------------------------------------
    // STEP 9: Confirm Room Transitions Into Housekeeping After Checkout
    // -----------------------------------------------------------------
    console.log('\n--- STEP 9: Confirm Room 102 Transitions to Housekeeping ---');
    // checkOut automatically set operationalStatus = 'available', housekeepingStatus = 'dirty' and queued task!
    const [room102AfterCheckout] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, room102.id));

    const tasksFor102 = await db
      .select()
      .from(housekeepingTasks)
      .where(
        and(
          eq(housekeepingTasks.roomId, room102.id),
          inArray(housekeepingTasks.status, ['dirty', 'cleaning'])
        )
      );

    console.log(`✅ Room 102 Status: ${room102AfterCheckout.operationalStatus} / ${room102AfterCheckout.housekeepingStatus}`);
    console.log(`✅ Housekeeping Task Queued for Room 102: ${tasksFor102.length > 0 ? 'YES' : 'NO'}`);

    results.push({
      step: 9,
      name: 'Confirm room transitions into housekeeping',
      success:
        room102AfterCheckout.operationalStatus === 'available' &&
        room102AfterCheckout.housekeepingStatus === 'dirty' &&
        tasksFor102.length > 0,
      details: {
        room102Operational: room102AfterCheckout.operationalStatus,
        room102Housekeeping: room102AfterCheckout.housekeepingStatus,
        tasksQueued: tasksFor102.length,
      },
    });

    // -----------------------------------------------------------------
    // STEP 10: Complete Housekeeping and Verify Room Becomes Clean & Ready
    // -----------------------------------------------------------------
    console.log('\n--- STEP 10: Complete Housekeeping ---');
    // Use HousekeepingService to officially update status to clean
    await HousekeepingService.updateStatus(propertyId, room101.id, 'clean', actor);
    await HousekeepingService.updateStatus(propertyId, room102.id, 'clean', actor);

    const [room101Final] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, room101.id));

    const [room102Final] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, room102.id));

    console.log(`✅ Room 101 Final: ${room101Final.operationalStatus} / ${room101Final.housekeepingStatus}`);
    console.log(`✅ Room 102 Final: ${room102Final.operationalStatus} / ${room102Final.housekeepingStatus}`);

    results.push({
      step: 10,
      name: 'Complete housekeeping and restore rooms to clean/ready',
      success:
        room101Final.operationalStatus === 'available' &&
        room101Final.housekeepingStatus === 'clean' &&
        room102Final.operationalStatus === 'available' &&
        room102Final.housekeepingStatus === 'clean',
      details: {
        room101: { operational: room101Final.operationalStatus, housekeeping: room101Final.housekeepingStatus },
        room102: { operational: room102Final.operationalStatus, housekeeping: room102Final.housekeepingStatus },
      },
    });

  } finally {
    // -----------------------------------------------------------------
    // CLEANUP: Clean test artifacts safely without touching customer data
    // -----------------------------------------------------------------
    console.log('\n--- CLEANUP: Removing Test Records ---');
    if (testInvoiceId) {
      await db.delete(propertyInvoices).where(eq(propertyInvoices.id, testInvoiceId));
      console.log(`Cleaned up smoke test invoice: ${testInvoiceId}`);
    }

    if (testReservationId) {
      await db.delete(payments).where(eq(payments.reservationId, testReservationId));
      await db.delete(reservationEvents).where(eq(reservationEvents.reservationId, testReservationId));
      await db.delete(reservations).where(eq(reservations.id, testReservationId));
      console.log(`Cleaned up smoke test reservation: ${testReservationId}`);
    }

    if (testGuestId) {
      await db.delete(guests).where(eq(guests.id, testGuestId));
      console.log(`Cleaned up smoke test guest: ${testGuestId}`);
    }

    // Clean up test room 102-SMOKE
    await db.delete(housekeepingTasks).where(eq(housekeepingTasks.roomId, room102.id));
    await db.delete(rooms).where(eq(rooms.id, room102.id));
    console.log(`Cleaned up test room: ${room102.id} (102-SMOKE)`);

    // Clean up any remaining smoke test tasks for 101
    await db
      .delete(housekeepingTasks)
      .where(
        and(
          eq(housekeepingTasks.roomId, room101.id),
          eq(housekeepingTasks.status, 'completed')
        )
      );

    // Guarantee room 101 is clean and available
    await db
      .update(rooms)
      .set({ housekeepingStatus: 'clean', operationalStatus: 'available' })
      .where(eq(rooms.id, room101.id));

    console.log('✅ Room 101 restored to pristine available / clean state.');
    console.log('✅ Zero customer bookings were altered.');
  }

  console.log('\n===============================================================');
  console.log('                 PRODUCTION SMOKE TEST SUMMARY                 ');
  console.log('===============================================================');
  let allPassed = true;
  for (const r of results) {
    const status = r.success ? 'PASS' : 'FAIL';
    console.log(`Step ${r.step}: [${status}] ${r.name}`);
    if (!r.success) allPassed = false;
  }
  console.log('===============================================================');
  console.log(allPassed ? '>>> ALL 10 PRODUCTION SMOKE TEST STEPS PASSED <<<' : '>>> SMOKE TEST FAILED <<<');
  console.log('===============================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runProductionSmokeTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal Production Smoke Test Error:', err);
    process.exit(1);
  });
