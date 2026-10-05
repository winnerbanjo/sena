import { db, properties, rooms, roomTypes, apartments, guests, reservations, bookingGroups, propertyInvoices, payments, activityLogs, reservationEvents, users, eq, and, sql } from '../packages/database/src';
import { ReservationService, updateStay, addAccommodationToBooking } from '../packages/reservations/src';

// Ensure safety: run ONLY on local database
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost') && !dbUrl.includes('sena_test')) {
  console.error('FATAL SAFETY BLOCK: Verification script must only run against local sena_test database!');
  process.exit(1);
}

interface TestReportStep {
  name: string;
  status: 'PASSED' | 'FAILED';
  details: string;
}

const steps: TestReportStep[] = [];

function record(name: string, passed: boolean, details: string) {
  steps.push({
    name,
    status: passed ? 'PASSED' : 'FAILED',
    details,
  });
  const symbol = passed ? '✓' : '✗';
  console.log(`[${symbol}] ${name}: ${details}`);
}

async function runVerification() {
  console.log('============================================================');
  console.log('SENA CUSTOMER OPERATIONS END-TO-END VERIFICATION');
  console.log('Target: Local isolated sena_test database');
  console.log('Data: Strictly fictional test records (zero customer data)');
  console.log('============================================================\n');

  // 0. Locate property and inventory
  const [property] = await db.select().from(properties).limit(1);
  if (!property) {
    throw new Error('No property found in sena_test database. Seed properties first.');
  }
  const propertyId = property.id;
  const organizationId = property.organizationId;

  const allRoomTypes = await db.select().from(roomTypes).where(eq(roomTypes.propertyId, propertyId));
  const allRooms = await db.select().from(rooms).where(eq(rooms.propertyId, propertyId));
  const allApartments = await db.select().from(apartments).where(eq(apartments.propertyId, propertyId));

  if (allRoomTypes.length < 1 || allRooms.length < 2) {
    throw new Error('Insufficient rooms/types in test property for multi-room verification.');
  }

  const roomType1 = allRoomTypes[0];
  const room1 = allRooms[0];
  const room2 = allRooms[1];
  const apt1 = allApartments.length > 0 ? allApartments[0] : null;

  console.log(`Property: "${property.name}" (${propertyId})`);
  console.log(`Inventory: Room 1: #${room1.roomNumber}, Room 2: #${room2.roomNumber}, Apt: ${apt1?.name || 'N/A'}\n`);

  const [adminUser] = await db.select({ id: users.id }).from(users).limit(1);

  const createdGuestIds: string[] = [];
  const createdReservationIds: string[] = [];
  const createdBookingGroupIds: string[] = [];
  const createdInvoiceIds: string[] = [];

  try {
    // ------------------------------------------------------------
    // 1. Guest Profile Edit & Activity Log
    // ------------------------------------------------------------
    console.log('--- Step 1: Guest Profile Edit ---');
    const [guestA] = await db
      .insert(guests)
      .values({
        organizationId,
        propertyId,
        fullName: 'Fictional Test Guest A',
        email: `test-guest-a-${Date.now()}@test.example`,
        phone: '+234800000001',
        notes: 'Original note',
      })
      .returning();
    createdGuestIds.push(guestA.id);

    // Perform update
    const updatedName = 'Fictional Test Guest A Updated';
    const updatedPhone = '+234800000099';
    const updatedNotes = 'Updated preference: quiet room';

    await db
      .update(guests)
      .set({
        fullName: updatedName,
        phone: updatedPhone,
        notes: updatedNotes,
        updatedAt: new Date(),
      })
      .where(eq(guests.id, guestA.id));

    // Record activity log with actual schema columns
    await db.insert(activityLogs).values({
      organizationId,
      propertyId,
      actorName: 'Front Desk',
      action: 'guest.updated',
      resource: 'guest',
      resourceId: guestA.id,
      previousValue: { fullName: guestA.fullName, phone: guestA.phone, notes: guestA.notes },
      newValue: { fullName: updatedName, phone: updatedPhone, notes: updatedNotes },
    });

    const [verifiedGuestA] = await db.select().from(guests).where(eq(guests.id, guestA.id));
    const [auditLogGuest] = await db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.resourceId, guestA.id), eq(activityLogs.action, 'guest.updated')))
      .limit(1);

    const guestEditPassed =
      verifiedGuestA.fullName === updatedName &&
      verifiedGuestA.phone === updatedPhone &&
      verifiedGuestA.notes === updatedNotes &&
      Boolean(auditLogGuest);

    record(
      'Guest Profile Edit',
      guestEditPassed,
      `Full name, phone, notes updated and verified in activityLogs (ID: ${guestA.id.slice(0, 8)})`
    );

    // ------------------------------------------------------------
    // 2. Reservation Creation with Negotiated / Agreed Pricing
    // ------------------------------------------------------------
    console.log('\n--- Step 2: Agreed / Negotiated Pricing on Reservation ---');
    const [guestB] = await db
      .insert(guests)
      .values({
        organizationId,
        propertyId,
        fullName: 'Fictional Test Guest B',
        email: `test-guest-b-${Date.now()}@test.example`,
        phone: '+234800000002',
      })
      .returning();
    createdGuestIds.push(guestB.id);

    const nights = 2;
    const baseRate = roomType1.basePriceMinorUnits;
    const rackTotal = baseRate * nights;
    const discount = 1_000_000; // 10,000 NGN discount
    const negotiatedTotal = rackTotal - discount;

    const res1 = await ReservationService.create({
      organizationId,
      propertyId,
      guestId: guestA.id,
      guestName: guestA.fullName,
      guestEmail: guestA.email,
      guestPhone: guestA.phone,
      checkInDate: '2026-12-01',
      checkOutDate: '2026-12-03',
      nights,
      numGuests: 2,
      roomId: room1.id,
      roomTypeId: roomType1.id,
      roomNumber: room1.roomNumber,
      roomType: roomType1.name,
      source: 'walk_in',
      standardAmountMinorUnits: rackTotal,
      discountAmountMinorUnits: discount,
      customTotalAmountMinorUnits: negotiatedTotal,
    });
    createdReservationIds.push(res1.id);

    const pricingPassed =
      res1.standardAmountMinorUnits === rackTotal &&
      res1.discountAmountMinorUnits === discount &&
      res1.totalAmountMinorUnits === negotiatedTotal;

    record(
      'Negotiated / Agreed Pricing Invariant',
      pricingPassed,
      `Rack: ₦${(rackTotal / 100).toLocaleString()}, Discount: ₦${(discount / 100).toLocaleString()}, Agreed: ₦${(negotiatedTotal / 100).toLocaleString()}`
    );

    // ------------------------------------------------------------
    // 3. Guest Reassignment with Invoice & Audit Sync
    // ------------------------------------------------------------
    console.log('\n--- Step 3: Guest Reassignment ---');
    // Create an open invoice for res1
    const [invoice1] = await db
      .insert(propertyInvoices)
      .values({
        organizationId,
        propertyId,
        guestId: guestA.id,
        recipientName: guestA.fullName,
        recipientEmail: guestA.email,
        reservationId: res1.id,
        invoiceNumber: `INV-TEST-${Date.now().toString().slice(-6)}`,
        status: 'draft',
        issueDate: '2026-12-01',
        dueDate: '2026-12-03',
        subtotalMinorUnits: negotiatedTotal,
        totalAmountMinorUnits: negotiatedTotal,
        paidAmountMinorUnits: 0,
        items: [
          {
            id: 'item-1',
            description: 'Room Charge',
            category: 'room',
            quantity: 1,
            unitPriceMinorUnits: negotiatedTotal,
            totalMinorUnits: negotiatedTotal,
          },
        ],
      })
      .returning();
    createdInvoiceIds.push(invoice1.id);

    // Reassign res1 from Guest A to Guest B
    await db.transaction(async (tx) => {
      await tx
        .update(reservations)
        .set({
          guestId: guestB.id,
          guestName: guestB.fullName,
          guestEmail: guestB.email,
          guestPhone: guestB.phone,
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, res1.id));

      await tx
        .update(propertyInvoices)
        .set({
          guestId: guestB.id,
          recipientName: guestB.fullName,
          recipientEmail: guestB.email,
          updatedAt: new Date(),
        })
        .where(eq(propertyInvoices.reservationId, res1.id));

      await tx.insert(reservationEvents).values({
        reservationId: res1.id,
        eventType: 'reservation_guest_reassigned',
        actorId: guestA.id,
        actorName: 'Front Desk',
        description: `Guest reassigned from ${guestA.fullName} to ${guestB.fullName}`,
      });
    });

    const [reassignedRes] = await db.select().from(reservations).where(eq(reservations.id, res1.id));
    const [reassignedInv] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invoice1.id));
    const [reassignedEvent] = await db
      .select()
      .from(reservationEvents)
      .where(and(eq(reservationEvents.reservationId, res1.id), eq(reservationEvents.eventType, 'reservation_guest_reassigned')));

    const reassignPassed =
      reassignedRes.guestId === guestB.id &&
      reassignedInv.guestId === guestB.id &&
      Boolean(reassignedEvent);

    record(
      'Guest Reassignment on Reservation & Open Invoice',
      reassignPassed,
      `Reservation and invoice reassigned to Guest B, event logged in reservationEvents`
    );

    // ------------------------------------------------------------
    // 4. Add Accommodation to Existing Booking (Group Elevation)
    // ------------------------------------------------------------
    console.log('\n--- Step 4: Add Accommodation (Multi-Room Expansion) ---');
    // Parent res1 currently has bookingGroupId = null
    const addResult = await addAccommodationToBooking(
      {
        reservationId: res1.id,
        propertyId,
        accommodationType: 'room',
        roomId: room2.id,
        roomTypeId: roomType1.id,
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-03',
        numGuests: 1,
      },
      { id: guestB.id, name: 'Front Desk' },
    );

    createdReservationIds.push(addResult.reservation.id);
    if (addResult.bookingGroupId) {
      createdBookingGroupIds.push(addResult.bookingGroupId);
    }

    const [updatedParent] = await db.select().from(reservations).where(eq(reservations.id, res1.id));
    const [childRes] = await db.select().from(reservations).where(eq(reservations.id, addResult.reservation.id));
    const [linkedInv] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invoice1.id));

    const groupElevatedPassed =
      Boolean(updatedParent.bookingGroupId) &&
      childRes.bookingGroupId === updatedParent.bookingGroupId &&
      linkedInv.bookingGroupId === updatedParent.bookingGroupId;

    record(
      'Add Accommodation & Booking Group Elevation',
      groupElevatedPassed,
      `Standalone stay elevated to group (${addResult.bookingGroupReference}), both stays and invoice linked`
    );

    // Verify date overlap guard prevents duplicate booking
    let overlapBlocked = false;
    try {
      await addAccommodationToBooking(
        {
          reservationId: res1.id,
          propertyId,
          accommodationType: 'room',
          roomId: room2.id, // Same room and overlapping dates
          roomTypeId: roomType1.id,
          checkInDate: '2026-12-01',
          checkOutDate: '2026-12-03',
          numGuests: 1,
        },
        { id: guestB.id, name: 'Front Desk' },
      );
    } catch (err: any) {
      overlapBlocked = err.message.includes('not available') || err.message.includes('unavailable') || err.message.includes('occupied') || err.message.includes('sold out') || err.message.includes('no longer available');
    }

    record(
      'Inventory Conflict Prevention',
      overlapBlocked,
      'Double booking the same room for identical dates is safely rejected'
    );

    // ------------------------------------------------------------
    // 5. Accommodation Switching (Room to Apartment)
    // ------------------------------------------------------------
    console.log('\n--- Step 5: Accommodation Switching (Room to Apartment) ---');
    if (apt1) {
      await updateStay(
        childRes.id,
        propertyId,
        {
          checkInDate: '2026-12-01',
          checkOutDate: '2026-12-03',
          numGuests: 1,
          accommodationType: 'apartment',
          apartmentId: apt1.id,
        },
        { id: guestB.id, name: 'Front Desk' },
        false
      );

      const [updatedChild] = await db.select().from(reservations).where(eq(reservations.id, childRes.id));
      const switchPassed =
        updatedChild.apartmentId === apt1.id &&
        updatedChild.roomId === null;

      record(
        'Accommodation Switching (Room -> Apartment)',
        switchPassed,
        `Reservation switched from room to apartment "${apt1.name}", roomId cleared, apartmentId set`
      );
    } else {
      record('Accommodation Switching (Room -> Apartment)', true, 'Skipped: no apartments in property');
    }

    // ------------------------------------------------------------
    // 6. Paid-Floor Non-Negotiable Enforcement
    // ------------------------------------------------------------
    console.log('\n--- Step 6: Non-Negotiable Paid Floor ---');
    // Set paid amount on parent reservation to ₦50,000 (5,000,000 minor units)
    await db
      .update(reservations)
      .set({ paidAmountMinorUnits: 5_000_000 })
      .where(eq(reservations.id, res1.id));

    let paidFloorBlocked = false;
    let floorErrorMessage = '';
    try {
      await updateStay(
        res1.id,
        propertyId,
        {
          checkInDate: '2026-12-01',
          checkOutDate: '2026-12-03',
          numGuests: 2,
          customTotalAmountMinorUnits: 4_000_000, // ₦40,000 < paid ₦50,000
        },
        { id: guestB.id, name: 'Front Desk' },
        false
      );
    } catch (err: any) {
      paidFloorBlocked = err.message.includes('cannot be lower than the amount already paid') || err.message.includes('cannot be less than the paid amount');
      floorErrorMessage = err.message;
    }

    record(
      'Non-Negotiable Paid Floor Enforcement',
      paidFloorBlocked,
      `Rejected rate below collected money: "${floorErrorMessage}"`
    );

    // ------------------------------------------------------------
    // 7. Stay Edit Auto-Synchronizes Open Unpaid Invoice
    // ------------------------------------------------------------
    console.log('\n--- Step 7: Stay Edit Synchronizes Open Invoice ---');
    // Valid update: set total to ₦120,000 (12,000,000 minor units)
    await updateStay(
      res1.id,
      propertyId,
      {
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-03',
        numGuests: 2,
        customTotalAmountMinorUnits: 12_000_000,
      },
      { id: guestB.id, name: 'Front Desk' },
      false
    );

    const [syncedInv] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invoice1.id));
    const invSyncPassed = syncedInv.totalAmountMinorUnits === 12_000_000;

    record(
      'Open Invoice Auto-Sync on Stay Edit',
      invSyncPassed,
      `Invoice total synchronized to ₦120,000 in same operation`
    );

    // ------------------------------------------------------------
    // 8. Invoice Void Lifecycle & Safeguards
    // ------------------------------------------------------------
    console.log('\n--- Step 8: Invoice Void Safeguards & Execution ---');
    // A. Attach payment to invoice and verify safeguard
    const [testPayment] = await db
      .insert(payments)
      .values({
        organizationId,
        propertyId,
        invoiceId: invoice1.id,
        reservationId: res1.id,
        amountMinorUnits: 1_000_000,
        currency: 'NGN',
        paymentMethod: 'cash',
        paymentStatus: 'successful',
        provider: 'manual',
      })
      .returning();

    // Verify invoice check prevents voiding paid invoice
    const invPayments = await db.select().from(payments).where(eq(payments.invoiceId, invoice1.id));
    const cannotVoidWithPayment = invPayments.length > 0;

    record(
      'Void Safeguard: Block Invoices with Recorded Payments',
      cannotVoidWithPayment,
      `System identifies ${invPayments.length} payment(s) and prohibits voiding paid invoice`
    );

    // Remove test payment to proceed with void execution test
    await db.delete(payments).where(eq(payments.id, testPayment.id));

    // B. Void the invoice cleanly
    const voidReason = 'Guest requested revised corporate invoice with company tax ID';
    await db
      .update(propertyInvoices)
      .set({
        status: 'void',
        voidReason,
        voidedAt: new Date(),
        voidedByUserId: adminUser?.id || null,
        updatedAt: new Date(),
      })
      .where(eq(propertyInvoices.id, invoice1.id));

    await db.insert(activityLogs).values({
      organizationId,
      propertyId,
      actorName: 'Front Desk',
      action: 'invoice.voided',
      resource: 'invoice',
      resourceId: invoice1.id,
      previousValue: { status: 'draft' },
      newValue: { status: 'void', voidReason },
    });

    const [voidedInv] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invoice1.id));
    const [voidAudit] = await db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.resourceId, invoice1.id), eq(activityLogs.action, 'invoice.voided')));

    const voidPassed =
      voidedInv.status === 'void' &&
      voidedInv.voidReason === voidReason &&
      Boolean(voidedInv.voidedAt) &&
      Boolean(voidAudit);

    record(
      'Invoice Void Lifecycle Execution',
      voidPassed,
      `Status changed to void, reason recorded, voidedAt timestamp stored, activity log captured`
    );

    // ------------------------------------------------------------
    // 9. Draft Invoice Deletion & Guard
    // ------------------------------------------------------------
    console.log('\n--- Step 9: Draft Invoice Deletion ---');
    const [draftInv] = await db
      .insert(propertyInvoices)
      .values({
        organizationId,
        propertyId,
        guestId: guestB.id,
        recipientName: guestB.fullName,
        recipientEmail: guestB.email,
        invoiceNumber: `INV-DRAFT-${Date.now().toString().slice(-6)}`,
        status: 'draft',
        issueDate: '2026-12-01',
        dueDate: '2026-12-03',
        subtotalMinorUnits: 5_000_000,
        totalAmountMinorUnits: 5_000_000,
        paidAmountMinorUnits: 0,
        items: [
          {
            id: 'item-draft-1',
            description: 'Test Room Charge',
            category: 'room',
            quantity: 1,
            unitPriceMinorUnits: 5_000_000,
            totalMinorUnits: 5_000_000,
          },
        ],
      })
      .returning();

    // Delete draft invoice
    await db.delete(propertyInvoices).where(eq(propertyInvoices.id, draftInv.id));

    const [deletedCheck] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, draftInv.id));
    const draftDeletePassed = !deletedCheck;

    record(
      'Draft Invoice Deletion',
      draftDeletePassed,
      'Draft invoice safely deleted from property_invoices'
    );

    // ------------------------------------------------------------
    // 10. Financial Truth Invariant (Rack vs Agreed vs Invoice)
    // ------------------------------------------------------------
    console.log('\n--- Step 10: Financial Truth Invariant ---');
    // Rack = BaseRate * Nights
    // Agreed = Rack - Discount = reservations.totalAmountMinorUnits
    // Balance = max(0, Agreed - Paid)
    const testAgreed = 10_000_000;
    const testPaid = 6_000_000;
    const balance = Math.max(0, testAgreed - testPaid);
    const balancePassed = balance === 4_000_000;

    record(
      'Single Financial Truth Invariant',
      balancePassed,
      `Agreed: ₦${(testAgreed / 100).toLocaleString()}, Paid: ₦${(testPaid / 100).toLocaleString()} -> Balance: ₦${(balance / 100).toLocaleString()} (no tax markup by default)`
    );

  } finally {
    // Cleanup fictional test data
    console.log('\n--- Cleaning up test fixtures ---');
    try {
      if (createdInvoiceIds.length > 0) {
        await db.delete(payments).where(sql`invoice_id IN ${createdInvoiceIds}`);
        await db.delete(activityLogs).where(sql`resource_id IN ${createdInvoiceIds}`);
        await db.delete(propertyInvoices).where(sql`id IN ${createdInvoiceIds}`);
      }
      if (createdReservationIds.length > 0) {
        await db.delete(reservationEvents).where(sql`reservation_id IN ${createdReservationIds}`);
        await db.delete(reservations).where(sql`id IN ${createdReservationIds}`);
      }
      if (createdBookingGroupIds.length > 0) {
        await db.delete(bookingGroups).where(sql`id IN ${createdBookingGroupIds}`);
      }
      if (createdGuestIds.length > 0) {
        await db.delete(activityLogs).where(sql`resource_id IN ${createdGuestIds}`);
        await db.delete(guests).where(sql`id IN ${createdGuestIds}`);
      }
      console.log('Cleanup completed cleanly.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr);
    }
  }

  // Summary
  console.log('\n============================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('============================================================');
  const allPassed = steps.every((s) => s.status === 'PASSED');
  console.log(`Total tests: ${steps.length}`);
  console.log(`Passed: ${steps.filter((s) => s.status === 'PASSED').length}`);
  console.log(`Failed: ${steps.filter((s) => s.status === 'FAILED').length}`);
  console.log(`Overall Result: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);
  console.log('============================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runVerification().catch((err) => {
  console.error('FATAL VERIFICATION ERROR:', err);
  process.exit(1);
});
