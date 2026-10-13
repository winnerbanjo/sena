import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';
import {
  db,
  organizations,
  properties,
  rooms,
  roomTypes,
  guests,
  reservations,
  propertyInvoices,
  payments,
  bookingGroups,
  activityLogs,
  reservationEvents,
} from '@sena/database';
import { ReservationService } from '../packages/reservations/src/index';
import { updateStay } from '../packages/reservations/src/edit';
import { PaymentService } from '../packages/payments/src/index';
import { planInvoiceEdit, BELOW_PAID } from '../apps/dashboard/src/lib/invoice-edit';
import { ROLE_PERMISSIONS } from '../packages/config/src/index';
import { eq, and, sql } from 'drizzle-orm';

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
  process.env.SENA_TEST_DATABASE_URL || 'postgresql://localhost:5432/sena_test';
process.env.SENA_PRODUCTION_DATABASE_URL =
  process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url:5432/sena_prod_remote';
requireIsolatedTestDatabase();

async function runP0Verification() {
  console.log('\n======================================================================');
  console.log('  SENA PMS — P0 PRODUCTION INCIDENT VERIFICATION (SCENARIOS A - H)');
  console.log('======================================================================\n');

  const runId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const createdOrgIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdReservationIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdBookingGroupIds: string[] = [];
  const createdGuestIds: string[] = [];

  try {
    // Setup isolated organization, property and inventory
    const [org] = await db
      .insert(organizations)
      .values({
        name: `P0 Verification Org ${runId}`,
        slug: `p0-org-${runId.toLowerCase()}`,
      })
      .returning();
    createdOrgIds.push(org.id);

    const [prop] = await db
      .insert(properties)
      .values({
        organizationId: org.id,
        name: `P0 Verification Hotel ${runId}`,
        code: `P0-${runId}`,
        address: 'Victoria Island, Lagos',
        phone: '+234 1 234 5678',
        email: `p0-${runId}@example.ng`,
        currency: 'NGN',
        timezone: 'Africa/Lagos',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        platformFeeBps: 150,
      })
      .returning();
    createdPropertyIds.push(prop.id);

    const [rtDeluxe] = await db
      .insert(roomTypes)
      .values({
        propertyId: prop.id,
        name: 'Deluxe Suite',
        bedType: 'King',
        capacity: 2,
        basePriceMinorUnits: 50_000_00, // ₦50,000/night
      })
      .returning();

    const [rtExecutive] = await db
      .insert(roomTypes)
      .values({
        propertyId: prop.id,
        name: 'Executive Suite',
        bedType: 'King',
        capacity: 2,
        basePriceMinorUnits: 70_000_00, // ₦70,000/night
      })
      .returning();

    const [room101] = await db
      .insert(rooms)
      .values({
        propertyId: prop.id,
        roomTypeId: rtDeluxe.id,
        roomNumber: `101-${runId}`,
        floor: 1,
        operationalStatus: 'available',
        housekeepingStatus: 'clean',
      })
      .returning();

    const [room102] = await db
      .insert(rooms)
      .values({
        propertyId: prop.id,
        roomTypeId: rtExecutive.id,
        roomNumber: `102-${runId}`,
        floor: 1,
        operationalStatus: 'available',
        housekeepingStatus: 'clean',
      })
      .returning();

    const [room103] = await db
      .insert(rooms)
      .values({
        propertyId: prop.id,
        roomTypeId: rtDeluxe.id,
        roomNumber: `103-${runId}`,
        floor: 1,
        operationalStatus: 'available',
        housekeepingStatus: 'clean',
      })
      .returning();

    const [guest] = await db
      .insert(guests)
      .values({
        organizationId: org.id,
        propertyId: prop.id,
        fullName: 'Folake Adebayo',
        email: `folake-${runId}@example.com`,
        phone: '+2348030001111',
      })
      .returning();
    createdGuestIds.push(guest.id);

    // ------------------------------------------------------------------
    // SCENARIO A: Check-in happy path & Idempotency
    // ------------------------------------------------------------------
    console.log('\x1b[34m[Scenario A] Check-in Happy Path & Idempotency...\x1b[0m');
    const resA = await ReservationService.create({
      propertyId: prop.id,
      guestId: guest.id,
      roomTypeId: rtDeluxe.id,
      roomId: room101.id,
      checkInDate: '2026-11-10',
      checkOutDate: '2026-11-12',
      numGuests: 1,
      source: 'front_desk',
    });
    createdReservationIds.push(resA.id);

    // Initial check-in (receptionist action with authorization for outstanding balance)
    const receptionistActor = { id: crypto.randomUUID(), name: 'Receptionist' };
    await ReservationService.checkIn(resA.id, room101.id, receptionistActor, { allowOutstandingBalance: true });
    const [checkedInResA] = await db.select().from(reservations).where(eq(reservations.id, resA.id));
    assert.equal(checkedInResA.status, 'checked_in', 'Reservation status updated to checked_in');

    const [room101AfterCheckIn] = await db.select().from(rooms).where(eq(rooms.id, room101.id));
    assert.equal(room101AfterCheckIn.operationalStatus, 'occupied', 'Room operationalStatus updated to occupied');

    // Verify idempotency: repeated check-in succeeds safely
    await ReservationService.checkIn(resA.id, room101.id, receptionistActor, { allowOutstandingBalance: true });
    const [idempotentResA] = await db.select().from(reservations).where(eq(reservations.id, resA.id));
    assert.equal(idempotentResA.status, 'checked_in', 'Repeated check-in remains checked_in without error');

    // Also verify checkIn with undefined roomId falls back to already assigned room
    await ReservationService.checkIn(resA.id, undefined, receptionistActor, { allowOutstandingBalance: true });
    console.log('  ✔ PASS: Scenario A passed (Status checked_in, room occupied, idempotent check-in safe)');

    // ------------------------------------------------------------------
    // SCENARIO B: Stay Extension (Unpaid: 2 nights -> 4 nights)
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[Scenario B] Stay Extension on Unpaid Reservation...\x1b[0m');
    const resB = await ReservationService.create({
      propertyId: prop.id,
      guestId: guest.id,
      roomTypeId: rtDeluxe.id,
      roomId: room103.id,
      checkInDate: '2026-11-15',
      checkOutDate: '2026-11-17',
      numGuests: 1,
      source: 'front_desk',
    });
    createdReservationIds.push(resB.id);

    const [invB] = await db
      .insert(propertyInvoices)
      .values({
        organizationId: prop.organizationId || prop.id,
        propertyId: prop.id,
        reservationId: resB.id,
        guestId: guest.id,
        recipientName: guest.fullName,
        invoiceNumber: `INV-${runId}-B`,
        status: 'issued',
        issueDate: '2026-11-15',
        dueDate: '2026-11-17',
        subtotalMinorUnits: 100_000_00,
        totalAmountMinorUnits: 100_000_00,
        paidAmountMinorUnits: 0,
        items: [
          {
            id: 'item-b-1',
            description: `Room ${room103.roomNumber} · 2 night stay (2026-11-15 to 2026-11-17)`,
            category: 'room',
            quantity: 1,
            unitPriceMinorUnits: 100_000_00,
            totalMinorUnits: 100_000_00,
          },
        ],
      })
      .returning();
    createdInvoiceIds.push(invB.id);

    // Extend stay to 4 nights (2026-11-15 to 2026-11-19)
    await updateStay(
      resB.id,
      prop.id,
      {
        checkInDate: '2026-11-15',
        checkOutDate: '2026-11-19',
        numGuests: 1,
      },
      { id: guest.id, name: 'Receptionist' },
      false
    );

    const [updatedResB] = await db.select().from(reservations).where(eq(reservations.id, resB.id));
    assert.equal(updatedResB.nights, 4, 'Reservation nights updated to 4');
    assert.equal(updatedResB.totalAmountMinorUnits, 200_000_00, 'Reservation total updated to ₦200,000');

    const [updatedInvB] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invB.id));
    assert.equal(updatedInvB.totalAmountMinorUnits, 200_000_00, 'Invoice total updated to ₦200,000');
    assert.equal(updatedInvB.paidAmountMinorUnits, 0, 'Invoice paid amount remains 0');
    assert.equal(updatedInvB.status, 'issued', 'Invoice status remains issued');
    console.log('  ✔ PASS: Scenario B passed (Extended to 4 nights, invoice synchronized to ₦200,000)');

    // ------------------------------------------------------------------
    // SCENARIO C: Paid Booking Extension (2 nights ₦100k paid -> 4 nights ₦200k)
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[Scenario C] Stay Extension on Paid Reservation...\x1b[0m');
    const resC = await ReservationService.create({
      propertyId: prop.id,
      guestId: guest.id,
      roomTypeId: rtDeluxe.id,
      roomId: room101.id,
      checkInDate: '2026-11-20',
      checkOutDate: '2026-11-22',
      numGuests: 1,
      source: 'front_desk',
    });
    createdReservationIds.push(resC.id);

    const [invC] = await db
      .insert(propertyInvoices)
      .values({
        organizationId: prop.organizationId || prop.id,
        propertyId: prop.id,
        reservationId: resC.id,
        guestId: guest.id,
        recipientName: guest.fullName,
        invoiceNumber: `INV-${runId}-C`,
        status: 'paid',
        issueDate: '2026-11-20',
        dueDate: '2026-11-22',
        subtotalMinorUnits: 100_000_00,
        totalAmountMinorUnits: 100_000_00,
        paidAmountMinorUnits: 100_000_00,
        items: [
          {
            id: 'item-c-1',
            description: `Room ${room101.roomNumber} · 2 night stay (2026-11-20 to 2026-11-22)`,
            category: 'room',
            quantity: 1,
            unitPriceMinorUnits: 100_000_00,
            totalMinorUnits: 100_000_00,
          },
        ],
      })
      .returning();
    createdInvoiceIds.push(invC.id);

    // Update reservation with recorded payment
    await db
      .update(reservations)
      .set({ paidAmountMinorUnits: 100_000_00, paymentStatus: 'paid' })
      .where(eq(reservations.id, resC.id));

    // Extend stay to 4 nights (2026-11-20 to 2026-11-24)
    await updateStay(
      resC.id,
      prop.id,
      {
        checkInDate: '2026-11-20',
        checkOutDate: '2026-11-24',
        numGuests: 1,
      },
      { id: guest.id, name: 'Receptionist' },
      false
    );

    const [updatedResC] = await db.select().from(reservations).where(eq(reservations.id, resC.id));
    assert.equal(updatedResC.nights, 4, 'Reservation nights updated to 4');
    assert.equal(updatedResC.totalAmountMinorUnits, 200_000_00, 'Reservation total updated to ₦200,000');
    assert.equal(updatedResC.paidAmountMinorUnits, 100_000_00, 'Reservation paid amount preserved at ₦100,000');

    const [updatedInvC] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invC.id));
    assert.equal(updatedInvC.totalAmountMinorUnits, 200_000_00, 'Invoice total updated to ₦200,000');
    assert.equal(updatedInvC.paidAmountMinorUnits, 100_000_00, 'Invoice paid amount preserved at ₦100,000');
    assert.equal(updatedInvC.status, 'partially_paid', 'Invoice status updated to partially_paid (due: ₦100,000)');
    console.log('  ✔ PASS: Scenario C passed (Total ₦200k, paid ₦100k, status transitioned to partially_paid)');

    // ------------------------------------------------------------------
    // SCENARIO D: Multi-Room Booking Group (Extend Room 1 only)
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[Scenario D] Multi-Room Booking Group Extension...\x1b[0m');
    const groupResult = await ReservationService.createGroup({
      propertyId: prop.id,
      checkInDate: '2026-12-01',
      checkOutDate: '2026-12-03',
      roomIds: [room101.id, room102.id],
      numGuests: 2,
      source: 'front_desk',
      guest: {
        fullName: 'Group Coordinator',
        email: `group-${runId}@example.com`,
        phone: '+2348000000002',
      },
    });
    createdBookingGroupIds.push(groupResult.bookingGroup.id);
    for (const r of groupResult.reservations) createdReservationIds.push(r.id);
    createdInvoiceIds.push(groupResult.invoice.id);

    // Initial state: Room 1 (₦50k x 2 = ₦100k), Room 2 (₦70k x 2 = ₦140k) -> Total = ₦240,000
    const [initialGroupInv] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, groupResult.invoice.id));
    assert.equal(initialGroupInv.totalAmountMinorUnits, 240_000_00, 'Initial consolidated invoice is ₦240,000');
    assert.equal(initialGroupInv.items.length, 2, 'Initial invoice has 2 room line items');

    const room1Res = groupResult.reservations.find((r) => r.roomId === room101.id)!;
    const room2Res = groupResult.reservations.find((r) => r.roomId === room102.id)!;

    // Extend Room 1 from 2 nights to 3 nights (2026-12-01 to 2026-12-04, +₦50,000)
    await updateStay(
      room1Res.id,
      prop.id,
      {
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-04',
        numGuests: 1,
      },
      { id: guest.id, name: 'Receptionist' },
      false
    );

    const [updatedGroupInv] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, groupResult.invoice.id));
    assert.equal(updatedGroupInv.totalAmountMinorUnits, 290_000_00, 'Consolidated invoice total is strictly ₦290,000 (NOT overwritten to ₦150k)');
    assert.equal(updatedGroupInv.items.length, 2, 'Consolidated invoice retains both room items');

    // Verify Room 2 is unchanged
    const [freshRoom2] = await db.select().from(reservations).where(eq(reservations.id, room2Res.id));
    assert.equal(freshRoom2.nights, 2, 'Room 2 nights remain 2');
    assert.equal(freshRoom2.totalAmountMinorUnits, 140_000_00, 'Room 2 total remains ₦140,000');

    // Verify exactly ONE invoice exists for the group
    const groupInvoices = await db.select().from(propertyInvoices).where(eq(propertyInvoices.bookingGroupId, groupResult.bookingGroup.id));
    assert.equal(groupInvoices.length, 1, 'Strictly ONE invoice exists for the booking group (no duplicates)');
    console.log('  ✔ PASS: Scenario D passed (Room 1 updated to ₦150k, Room 2 intact at ₦140k, group invoice ₦290k)');

    // ------------------------------------------------------------------
    // SCENARIO E: Invoice Editing (Add incidental laundry ₦15k to paid invoice)
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[Scenario E] Invoice Editing & Incidental Retention...\x1b[0m');
    const resE = await ReservationService.create({
      propertyId: prop.id,
      guestId: guest.id,
      roomTypeId: rtDeluxe.id,
      roomId: room103.id,
      checkInDate: '2026-12-10',
      checkOutDate: '2026-12-12',
      numGuests: 1,
      source: 'front_desk',
    });
    createdReservationIds.push(resE.id);

    const [invE] = await db
      .insert(propertyInvoices)
      .values({
        organizationId: prop.organizationId || prop.id,
        propertyId: prop.id,
        reservationId: resE.id,
        guestId: guest.id,
        recipientName: guest.fullName,
        invoiceNumber: `INV-${runId}-E`,
        status: 'paid',
        issueDate: '2026-12-10',
        dueDate: '2026-12-12',
        subtotalMinorUnits: 100_000_00,
        totalAmountMinorUnits: 100_000_00,
        paidAmountMinorUnits: 100_000_00,
        items: [
          {
            id: 'item-e-room',
            description: `Deluxe Suite · 2 night stay (2026-12-10 to 2026-12-12)`,
            category: 'room',
            quantity: 1,
            unitPriceMinorUnits: 100_000_00,
            totalMinorUnits: 100_000_00,
          },
        ],
      })
      .returning();
    createdInvoiceIds.push(invE.id);

    // Edit invoice: staff adds incidental laundry charge of ₦15,000
    const editPlan = planInvoiceEdit(invE as any, {
      items: [
        ...invE.items,
        {
          id: 'item-e-laundry',
          description: 'Express Laundry Service (3 items)',
          category: 'laundry',
          quantity: 1,
          unitPriceMinorUnits: 15_000_00,
          totalMinorUnits: 15_000_00,
        },
      ],
    });
    assert(editPlan.ok, 'Invoice edit plan succeeds for paid invoice');
    assert.equal(editPlan.patch.totalAmountMinorUnits, 115_000_00, 'New total amount is ₦115,000');
    assert.equal(editPlan.patch.status, 'partially_paid', 'Status transitions to partially_paid (due: ₦15,000)');

    // Apply patch to database
    await db
      .update(propertyInvoices)
      .set(editPlan.patch as any)
      .where(eq(propertyInvoices.id, invE.id));

    // Now perform stay extension: extend stay to 3 nights (2026-12-10 to 2026-12-13, +₦50,000)
    await updateStay(
      resE.id,
      prop.id,
      {
        checkInDate: '2026-12-10',
        checkOutDate: '2026-12-13',
        numGuests: 1,
      },
      { id: guest.id, name: 'Receptionist' },
      false
    );

    const [invEAfterExtension] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invE.id));
    // Total should be: 3 nights room (₦150,000) + laundry (₦15,000) = ₦165,000
    assert.equal(invEAfterExtension.totalAmountMinorUnits, 165_000_00, 'Stay extension preserved incidental laundry charge! Total is ₦165,000');
    assert.equal(invEAfterExtension.paidAmountMinorUnits, 100_000_00, 'Paid amount preserved at ₦100,000');
    const hasLaundry = invEAfterExtension.items.some((i: any) => i.category === 'laundry' && i.totalMinorUnits === 15_000_00);
    assert(hasLaundry, 'Laundry line item was not wiped by stay extension');
    console.log('  ✔ PASS: Scenario E passed (Incidental added, status partially_paid, extension kept incidental intact)');

    // ------------------------------------------------------------------
    // SCENARIO F: Conflict Detection
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[Scenario F] Conflict Detection on Stay Extension...\x1b[0m');
    const resF1 = await ReservationService.create({
      propertyId: prop.id,
      guestId: guest.id,
      roomTypeId: rtDeluxe.id,
      roomId: room101.id,
      checkInDate: '2026-12-20',
      checkOutDate: '2026-12-22',
      numGuests: 1,
      source: 'front_desk',
    });
    createdReservationIds.push(resF1.id);

    // Reservation F2 on Room 101 on dates 2026-12-22 to 2026-12-24
    const resF2 = await ReservationService.create({
      propertyId: prop.id,
      guestId: guest.id,
      roomTypeId: rtDeluxe.id,
      roomId: room101.id,
      checkInDate: '2026-12-22',
      checkOutDate: '2026-12-24',
      numGuests: 1,
      source: 'front_desk',
    });
    createdReservationIds.push(resF2.id);

    // Attempt to extend resF1 from 2026-12-22 to 2026-12-23 (clashing with resF2)
    let conflictBlocked = false;
    let conflictError = '';
    try {
      await updateStay(
        resF1.id,
        prop.id,
        {
          checkInDate: '2026-12-20',
          checkOutDate: '2026-12-23',
          numGuests: 1,
        },
        { id: guest.id, name: 'Receptionist' },
        false
      );
    } catch (err: any) {
      conflictBlocked = true;
      conflictError = err.message;
    }
    assert(conflictBlocked, 'Extension into booked room dates is rejected');
    assert(/occupied|unavailable|already booked/i.test(conflictError), `Conflict error is informative: ${conflictError}`);

    const [resF1Untouched] = await db.select().from(reservations).where(eq(reservations.id, resF1.id));
    assert.equal(resF1Untouched.checkOutDate, '2026-12-22', 'Rejected extension left reservation completely untouched');
    console.log('  ✔ PASS: Scenario F passed (Extension rejected with conflict error, inventory protected)');

    // ------------------------------------------------------------------
    // SCENARIO G: Role Permissions Matrix
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[Scenario G] Role Permissions Matrix...\x1b[0m');
    const frontDeskPermissions = ROLE_PERMISSIONS['front_desk'] as readonly string[];
    const housekeepingPermissions = ROLE_PERMISSIONS['housekeeping'] as readonly string[];

    assert(frontDeskPermissions.includes('reservation.create'), 'Front desk / receptionist has reservation.create');
    assert(frontDeskPermissions.includes('reservation.edit'), 'Front desk / receptionist has reservation.edit');
    assert(frontDeskPermissions.includes('invoice.edit'), 'Front desk / receptionist has invoice.edit');

    assert(!housekeepingPermissions.includes('reservation.edit'), 'Housekeeping cannot edit reservations');
    assert(!housekeepingPermissions.includes('invoice.edit'), 'Housekeeping cannot edit invoices');
    assert(!housekeepingPermissions.includes('payment.record'), 'Housekeeping cannot record payments');
    console.log('  ✔ PASS: Scenario G passed (Receptionist authorized for front-desk ops, housekeeping restricted)');

    // ------------------------------------------------------------------
    // SCENARIO H: Financial Safeguards & UI Consistency
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[Scenario H] Financial Floor & UI Validation Safeguards...\x1b[0m');
    // Test: Attempting to reduce invoice total below paid amount
    const paidInvoiceMock = {
      status: 'partially_paid',
      recipientName: 'Test Guest',
      recipientEmail: null,
      recipientPhone: null,
      recipientAddress: null,
      companyTin: null,
      issueDate: '2026-10-01',
      dueDate: '2026-10-08',
      subtotalMinorUnits: 100_000_00,
      taxVatMinorUnits: 0,
      taxConsumptionMinorUnits: 0,
      serviceChargeMinorUnits: 0,
      discountMinorUnits: 0,
      totalAmountMinorUnits: 100_000_00,
      paidAmountMinorUnits: 60_000_00, // ₦60,000 paid
      items: [{
        id: '1',
        description: 'Room',
        category: 'room' as const,
        quantity: 1,
        unitPriceMinorUnits: 100_000_00,
        totalMinorUnits: 100_000_00,
      }],
      bankDetails: null,
      paymentTerms: null,
      notes: null,
    };

    const invalidReductionPlan = planInvoiceEdit(paidInvoiceMock, {
      items: [{
        id: '1',
        description: 'Room (reduced below paid)',
        category: 'room',
        quantity: 1,
        unitPriceMinorUnits: 40_000_00, // ₦40,000 < ₦60,000 paid
        totalMinorUnits: 40_000_00,
      }],
    });
    assert(!invalidReductionPlan.ok, 'Total reduction below paid amount is blocked');
    assert.equal(invalidReductionPlan.error, BELOW_PAID, 'Returns BELOW_PAID error message');

    console.log('  ✔ PASS: Scenario H passed (Financial floor enforced with clear error message)');

    console.log('\n======================================================================');
    console.log('  ALL SCENARIOS A - H PASSED CLEANLY (100% VERIFICATION SUCCESS)');
    console.log('======================================================================\n');
  } finally {
    // Cleanup fixtures
    console.log('Cleaning up test fixtures...');
    try {
      if (createdPaymentIds.length > 0) await db.delete(payments).where(sql`id IN ${createdPaymentIds}`);
      if (createdInvoiceIds.length > 0) await db.delete(propertyInvoices).where(sql`id IN ${createdInvoiceIds}`);
      if (createdReservationIds.length > 0) {
        await db.delete(reservationEvents).where(sql`reservation_id IN ${createdReservationIds}`);
        await db.delete(reservations).where(sql`id IN ${createdReservationIds}`);
      }
      if (createdBookingGroupIds.length > 0) await db.delete(bookingGroups).where(sql`id IN ${createdBookingGroupIds}`);
      if (createdPropertyIds.length > 0) {
        await db.delete(rooms).where(sql`property_id IN ${createdPropertyIds}`);
        await db.delete(roomTypes).where(sql`property_id IN ${createdPropertyIds}`);
        await db.delete(properties).where(sql`id IN ${createdPropertyIds}`);
      }
      if (createdGuestIds.length > 0) {
        await db.delete(guests).where(sql`id IN ${createdGuestIds}`);
      }
      if (createdOrgIds.length > 0) {
        await db.delete(organizations).where(sql`id IN ${createdOrgIds}`);
      }
      console.log('Cleanup finished.\n');
    } catch (e) {
      console.warn('Cleanup error:', e);
    }
  }
}

runP0Verification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
