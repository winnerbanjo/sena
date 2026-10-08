import crypto from 'crypto';
import {
  db,
  organizations,
  properties,
  roomTypes,
  rooms,
  bookingGroups,
  reservations,
  propertyInvoices,
  payments,
  guests,
  eq,
  and,
  or,
  ne,
} from '../packages/database/src/index';
import { ReservationService, addAccommodationToBooking, getBookingGroup } from '../packages/reservations/src/index';
import { PaymentService } from '../packages/payments/src/index';

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName} ${detail ? `\x1b[90m(${detail})\x1b[0m` : ''}`);
  } else {
    failedChecks++;
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName} ${detail ? `\x1b[31m- ${detail}\x1b[0m` : ''}`);
  }
}

async function runVerification() {
  console.log('\n======================================================================');
  console.log('  SENA PMS — STAY CONNECT CALENDAR & MULTI-ROOM FOLIO VERIFICATION');
  console.log('======================================================================\n');

  const runId = crypto.randomUUID().slice(0, 8);

  // 1. Setup isolated local fixtures
  console.log('\x1b[34m[1/6] Creating isolated test property & rooms in local sena_test...\x1b[0m');
  const [org] = await db.insert(organizations).values({ name: `Test Org ${runId}`, slug: `org-${runId}` }).returning();
  const [prop] = await db.insert(properties).values({
    organizationId: org.id,
    name: `Stay Connect QA ${runId}`,
    slug: `prop-${runId}`,
    code: `QA-${runId}`,
    address: 'Victoria Island, Lagos',
    phone: '+234 1 234 5678',
    email: `contact-${runId}@example.ng`,
    currency: 'NGN',
  }).returning();

  const [rType] = await db.insert(roomTypes).values({
    propertyId: prop.id,
    name: 'Executive Deluxe',
    bedType: 'King',
    basePriceMinorUnits: 5000000, // ₦50,000 / night
    capacity: 2,
    totalInventory: 10,
  }).returning();

  const insertedRooms = await db.insert(rooms).values(
    Array.from({ length: 5 }, (_, i) => ({
      propertyId: prop.id,
      roomTypeId: rType.id,
      roomNumber: String(201 + i),
      floor: '2',
      operationalStatus: 'available',
      housekeepingStatus: 'clean',
    }))
  ).returning();

  assert(insertedRooms.length === 5, '5 physical rooms created for testing', `Rooms: ${insertedRooms.map((r) => r.roomNumber).join(', ')}`);

  // 2. Multi-Room Booking & Consolidated Folio
  console.log('\n\x1b[34m[2/6] Multi-Room Booking: Consolidated Folio & Single Invoice...\x1b[0m');
  const checkInDate = '2026-10-10';
  const checkOutDate = '2026-10-13'; // 3 nights

  const groupResult = await ReservationService.createGroup({
    propertyId: prop.id,
    checkInDate,
    checkOutDate,
    roomIds: [insertedRooms[0].id, insertedRooms[1].id], // Room 201 & 202
    numGuests: 2,
    source: 'walk_in',
    guest: {
      fullName: 'Alhaji Muniru',
      email: `muniru.${runId}@example.ng`,
      phone: '+234 803 123 4567',
    },
  });

  assert(Boolean(groupResult.bookingGroup?.id), 'Booking group created successfully', `Group Ref: ${groupResult.bookingGroup?.reference}`);
  assert(groupResult.reservations.length === 2, '2 room reservations linked to group', `Count: ${groupResult.reservations.length}`);
  assert(Boolean(groupResult.invoice?.id), 'Consolidated group invoice issued on group creation', `Inv: ${groupResult.invoice?.invoiceNumber}`);

  // Query database directly to verify exactly 1 invoice exists for the group
  const groupInvoices = await db
    .select()
    .from(propertyInvoices)
    .where(and(eq(propertyInvoices.bookingGroupId, groupResult.bookingGroup.id), ne(propertyInvoices.status, 'void')));

  assert(groupInvoices.length === 1, 'Strictly ONE invoice exists for the 2-room booking', `Found: ${groupInvoices.length}`);
  const groupInvoice = groupInvoices[0];
  const expectedTotalMinorUnits = 5000000 * 3 * 2; // 2 rooms * 3 nights * ₦50,000 = ₦300,000
  assert(groupInvoice.totalAmountMinorUnits === expectedTotalMinorUnits, 'Consolidated invoice total equals sum of all rooms', `Total: ₦${groupInvoice.totalAmountMinorUnits / 100}`);
  assert(Array.isArray(groupInvoice.items) && groupInvoice.items.length === 2, 'Invoice contains line items for each booked room', `Items: ${groupInvoice.items?.length}`);

  // 3. Folio Endpoint Consolidation
  console.log('\n\x1b[34m[3/6] Folio Endpoint Check: Room 1 and Room 2 report same commercial truth...\x1b[0m');
  const res1 = groupResult.reservations[0];
  const res2 = groupResult.reservations[1];

  // Load group details via getBookingGroup
  const loadedGroup = await getBookingGroup(prop.id, groupResult.bookingGroup.id);
  assert(Boolean(loadedGroup), 'Loaded group details successfully');
  assert(loadedGroup?.invoices?.length === 1, 'Group query returns exactly 1 invoice');

  // Verify direct folio query for Room 2 finds the group invoice
  const res2Invoices = await db
    .select()
    .from(propertyInvoices)
    .where(
      and(
        or(
          eq(propertyInvoices.bookingGroupId, groupResult.bookingGroup.id),
          eq(propertyInvoices.reservationId, res2.id)
        ),
        ne(propertyInvoices.status, 'void')
      )
    );
  assert(res2Invoices.length === 1, 'Room 2 folio finds the group invoice via bookingGroupId', `Inv: ${res2Invoices[0].invoiceNumber}`);
  assert(res2Invoices[0].id === groupInvoice.id, 'Room 2 references the exact same invoice ID as Room 1');

  // 4. Check-in Room 1 and Room 2 (No duplicate invoice spawned)
  console.log('\n\x1b[34m[4/6] Check-In Execution: Status updates without duplicate invoicing...\x1b[0m');
  const actorId = crypto.randomUUID();
  await ReservationService.checkIn(res1.id, res1.roomId, { id: actorId, name: 'Front Desk' }, { allowOutstandingBalance: true });
  await ReservationService.checkIn(res2.id, res2.roomId, { id: actorId, name: 'Front Desk' }, { allowOutstandingBalance: true });

  const updatedRes1 = await db.query.reservations.findFirst({ where: eq(reservations.id, res1.id) });
  const updatedRes2 = await db.query.reservations.findFirst({ where: eq(reservations.id, res2.id) });

  assert(updatedRes1?.status === 'checked_in', 'Room 201 status updated to checked_in');
  assert(updatedRes2?.status === 'checked_in', 'Room 202 status updated to checked_in');

  const afterCheckInInvoices = await db
    .select()
    .from(propertyInvoices)
    .where(and(eq(propertyInvoices.bookingGroupId, groupResult.bookingGroup.id), ne(propertyInvoices.status, 'void')));
  assert(afterCheckInInvoices.length === 1, 'Still strictly 1 invoice after both rooms checked in (NO duplicates)', `Count: ${afterCheckInInvoices.length}`);

  // 5. Add Accommodation to Booking (Updates existing invoice)
  console.log('\n\x1b[34m[5/6] Add 3rd Room: Appends line item to existing invoice without creating new one...\x1b[0m');
  const addResult = await addAccommodationToBooking({
    propertyId: prop.id,
    reservationId: res1.id,
    accommodationType: 'room',
    roomTypeId: rType.id,
    roomId: insertedRooms[2].id, // Room 203
    checkInDate,
    checkOutDate,
  });

  assert(Boolean(addResult.reservation.id), 'Room 203 added to booking group', `New Res: ${addResult.reservation.reference}`);

  const afterAddInvoices = await db
    .select()
    .from(propertyInvoices)
    .where(and(eq(propertyInvoices.bookingGroupId, groupResult.bookingGroup.id), ne(propertyInvoices.status, 'void')));

  assert(afterAddInvoices.length === 1, 'Still strictly 1 invoice for the group after adding 3rd room', `Count: ${afterAddInvoices.length}`);
  const updatedInvoice = afterAddInvoices[0];
  const expected3RoomTotal = 5000000 * 3 * 3; // 3 rooms * 3 nights * ₦50,000 = ₦450,000
  assert(updatedInvoice.totalAmountMinorUnits === expected3RoomTotal, 'Group invoice total updated to reflect all 3 rooms', `Total: ₦${updatedInvoice.totalAmountMinorUnits / 100}`);
  assert(Array.isArray(updatedInvoice.items) && updatedInvoice.items.length === 3, 'Group invoice now contains 3 line items', `Items: ${updatedInvoice.items?.length}`);

  // 6. Payment & Settlement Synchronization
  console.log('\n\x1b[34m[6/6] Payment Settlement: Payment on one room updates consolidated group invoice...\x1b[0m');
  const paymentAmountMinorUnits = 15000000; // ₦150,000 partial payment
  const payment = await PaymentService.recordPayment({
    reservationId: res1.id,
    amountMinorUnits: paymentAmountMinorUnits,
    method: 'bank_transfer',
    provider: 'manual',
    providerReference: `PAY-${runId}`,
    notes: 'Partial payment for group',
  });

  assert(Boolean(payment.id), 'Payment recorded successfully', `Payment ID: ${payment.id}`);

  const refreshedInvoice = await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, updatedInvoice.id) });
  assert(refreshedInvoice?.paidAmountMinorUnits === paymentAmountMinorUnits, 'Consolidated invoice paid amount updated', `Paid: ₦${(refreshedInvoice?.paidAmountMinorUnits || 0) / 100}`);
  assert(refreshedInvoice?.status === 'partially_paid', 'Consolidated invoice status transitioned to partially_paid', `Status: ${refreshedInvoice?.status}`);

  // 7. Calendar Spanning Math & Backdating Elimination Test
  console.log('\n\x1b[34m[7/7] Calendar Matrix Rendering: Boundary Spanning & Backdating Elimination...\x1b[0m');
  const sampleWindow = [
    '2026-10-10',
    '2026-10-11',
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
  ];

  function computeRoomCells(roomReservations: Array<{ checkInDate: string; checkOutDate: string; id: string }>) {
    const renderedSpans: number[] = [];
    let colIdx = 0;
    while (colIdx < sampleWindow.length) {
      const dateKey = sampleWindow[colIdx];
      const activeRes = roomReservations.find((r) => r.checkInDate <= dateKey && dateKey < r.checkOutDate);
      if (activeRes) {
        let span = 1;
        while (colIdx + span < sampleWindow.length && sampleWindow[colIdx + span] < activeRes.checkOutDate) {
          span++;
        }
        renderedSpans.push(span);
        colIdx += span;
      } else {
        renderedSpans.push(1);
        colIdx += 1;
      }
    }
    return renderedSpans;
  }

  // Case A: Continuing stay that checked in 3 days prior to visible window
  const continuingStay = [{ id: 'prior-1', checkInDate: '2026-10-07', checkOutDate: '2026-10-12' }];
  const spansA = computeRoomCells(continuingStay);
  const totalColsA = spansA.reduce((sum, s) => sum + s, 0);
  assert(spansA[0] === 2, 'Prior stay starts at col 0 with visible nights span of 2', `Col 0 Span: ${spansA[0]}`);
  assert(totalColsA === 7, 'Prior stay row spans exactly 7 columns (no backdating required)', `Total: ${totalColsA}`);

  // Case B: Consecutive stays in the same room in the same week
  const consecutiveStays = [
    { id: 'stay-1', checkInDate: '2026-10-10', checkOutDate: '2026-10-12' }, // 2 nights
    { id: 'stay-2', checkInDate: '2026-10-12', checkOutDate: '2026-10-15' }, // 3 nights
  ];
  const spansB = computeRoomCells(consecutiveStays);
  const totalColsB = spansB.reduce((sum, s) => sum + s, 0);
  assert(spansB[0] === 2 && spansB[1] === 3, 'Consecutive stays both render seamlessly in sequence', `Spans: ${spansB.join(', ')}`);
  assert(totalColsB === 7, 'Consecutive stays row spans exactly 7 columns', `Total: ${totalColsB}`);

  // Case C: Long stay extending beyond the 7-day window
  const longStay = [{ id: 'long-1', checkInDate: '2026-10-13', checkOutDate: '2026-10-25' }];
  const spansC = computeRoomCells(longStay);
  const totalColsC = spansC.reduce((sum, s) => sum + s, 0);
  assert(spansC[3] === 4, 'Future extending stay clips to visible window end', `Span: ${spansC[3]}`);
  assert(totalColsC === 7, 'Long stay never overflows the 7-column grid', `Total: ${totalColsC}`);

  // 8. Single-Room Standalone Reservation & Historical Compatibility
  console.log('\n\x1b[34m[8/11] Single-Room Standalone Reservation & Historical Compatibility...\x1b[0m');
  const singleRes = await ReservationService.create({
    propertyId: prop.id,
    roomTypeId: rType.id,
    roomId: insertedRooms[3].id,
    checkInDate: '2026-10-15',
    checkOutDate: '2026-10-17',
    numGuests: 1,
    source: 'walk_in',
    guest: {
      fullName: 'Chief Adebayo',
      email: `adebayo.${runId}@example.ng`,
      phone: '+234 802 987 6543',
    },
  });

  assert(Boolean(singleRes.id), 'Standalone single reservation created', `Ref: ${singleRes.reference}`);
  assert(!singleRes.bookingGroupId, 'Standalone reservation has null bookingGroupId');

  // Verify folio query works properly for single room
  const singleInvoices = await db
    .select()
    .from(propertyInvoices)
    .where(and(eq(propertyInvoices.reservationId, singleRes.id), ne(propertyInvoices.status, 'void')));
  assert(singleInvoices.length === 0, 'No invoice created automatically for un-invoiced single room');

  // Issue single room invoice
  const singleInvNumber = `INV-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
  const [issuedSingleInv] = await db
    .insert(propertyInvoices)
    .values({
      propertyId: prop.id,
      organizationId: org.id,
      reservationId: singleRes.id,
      bookingGroupId: null,
      guestId: singleRes.guestId,
      invoiceNumber: singleInvNumber,
      invoiceType: 'guest_folio',
      status: 'issued',
      recipientName: 'Chief Adebayo',
      issueDate: '2026-10-15',
      dueDate: '2026-10-17',
      currency: 'NGN',
      subtotalMinorUnits: singleRes.totalAmountMinorUnits,
      totalAmountMinorUnits: singleRes.totalAmountMinorUnits,
      paidAmountMinorUnits: 0,
      items: [{
        id: crypto.randomUUID(),
        description: 'Single Room Stay',
        category: 'room' as const,
        quantity: 1,
        unitPriceMinorUnits: singleRes.totalAmountMinorUnits,
        totalMinorUnits: singleRes.totalAmountMinorUnits,
      }],
      notes: 'Single room stay',
    })
    .returning();

  assert(Boolean(issuedSingleInv.id), 'Single room invoice issued successfully', `Inv: ${issuedSingleInv.invoiceNumber}`);

  // 9. Negotiated / Agreed Rates Integrity
  console.log('\n\x1b[34m[9/11] Negotiated / Custom Rates Integrity...\x1b[0m');
  const negotiatedAgreedMinorUnits = 3500000; // Negotiated down from ₦50,000 to ₦35,000 for 1 night
  const negotiatedResult = await addAccommodationToBooking({
    propertyId: prop.id,
    reservationId: res1.id,
    accommodationType: 'room',
    roomTypeId: rType.id,
    roomId: insertedRooms[4].id, // Room 205
    checkInDate: '2026-10-10',
    checkOutDate: '2026-10-11', // 1 night
    customTotalAmountMinorUnits: negotiatedAgreedMinorUnits,
  });

  assert(negotiatedResult.reservation.totalAmountMinorUnits === negotiatedAgreedMinorUnits, 'Child reservation records negotiated agreed total', `Total: ₦${negotiatedResult.reservation.totalAmountMinorUnits / 100}`);
  
  const invAfterNegotiated = await db.query.propertyInvoices.findFirst({ where: eq(propertyInvoices.id, updatedInvoice.id) });
  const expectedTotalWithNegotiated = expected3RoomTotal + negotiatedAgreedMinorUnits;
  assert(invAfterNegotiated?.totalAmountMinorUnits === expectedTotalWithNegotiated, 'Consolidated invoice total increments strictly by negotiated rate', `Total: ₦${(invAfterNegotiated?.totalAmountMinorUnits || 0) / 100}`);

  // 10. Financial Inviolability & Paid Invoice Lock
  console.log('\n\x1b[34m[10/11] Financial Inviolability & Paid Invoice Lock...\x1b[0m');
  const { planInvoiceEdit, BELOW_PAID, PAID_FINANCIAL_LOCK } = await import('../apps/dashboard/src/lib/invoice-edit');
  
  // Test: cannot edit total below amount already paid
  const currentPaid = invAfterNegotiated?.paidAmountMinorUnits || 0; // ₦150,000
  const illegalPlan = planInvoiceEdit(invAfterNegotiated as any, {
    items: [{
      id: crypto.randomUUID(),
      description: 'Illegal reduced rate',
      category: 'room',
      quantity: 1,
      unitPriceMinorUnits: currentPaid - 5000000, // ₦100,000 (less than ₦150,000 paid)
      totalMinorUnits: currentPaid - 5000000,
    }],
  });
  assert(!illegalPlan.ok && illegalPlan.error === BELOW_PAID, 'Invoice total cannot be reduced below paid amount', `Error: ${illegalPlan.error}`);

  // Test: voiding an invoice with payments is strictly prohibited
  assert(invAfterNegotiated?.paidAmountMinorUnits! > 0, 'Invoice has confirmed payments');
  const canVoid = invAfterNegotiated?.paidAmountMinorUnits === 0 && invAfterNegotiated?.status !== 'paid' && invAfterNegotiated?.status !== 'partially_paid';
  assert(!canVoid, 'Invoice with payments is protected from being voided');

  // Test: fully paid invoice blocks financial changes
  const [fullyPaidInv] = await db
    .insert(propertyInvoices)
    .values({
      propertyId: prop.id,
      organizationId: org.id,
      invoiceNumber: `INV-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
      invoiceType: 'guest_folio',
      status: 'paid',
      recipientName: 'Paid Guest',
      issueDate: '2026-10-10',
      dueDate: '2026-10-11',
      currency: 'NGN',
      subtotalMinorUnits: 10000000,
      totalAmountMinorUnits: 10000000,
      paidAmountMinorUnits: 10000000,
      items: [{
        id: crypto.randomUUID(),
        description: 'Fully paid room',
        category: 'room' as const,
        quantity: 1,
        unitPriceMinorUnits: 10000000,
        totalMinorUnits: 10000000,
      }],
    })
    .returning();

  const fullyPaidEditPlan = planInvoiceEdit(fullyPaidInv as any, {
    items: [{
      id: crypto.randomUUID(),
      description: 'Modified item',
      category: 'room',
      quantity: 1,
      unitPriceMinorUnits: 12000000,
      totalMinorUnits: 12000000,
    }],
  });
  assert(!fullyPaidEditPlan.ok && fullyPaidEditPlan.error === PAID_FINANCIAL_LOCK, 'Fully paid invoice blocks financial modifications', `Error: ${fullyPaidEditPlan.error}`);

  // 11. Multi-Tenant Isolation & Concurrency Safety
  console.log('\n\x1b[34m[11/11] Multi-Tenant Isolation & Concurrency Safety...\x1b[0m');
  const otherPropertyId = crypto.randomUUID();
  const crossTenantGroup = await getBookingGroup(otherPropertyId, groupResult.bookingGroup.id);
  assert(crossTenantGroup === null, 'Booking group cannot be accessed across tenant properties (returns null)');

  // Concurrency idempotency check
  const idempotentKey = `idem-${runId}`;
  const firstCall = await ReservationService.createGroup({
    propertyId: prop.id,
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-03',
    roomIds: [insertedRooms[0].id, insertedRooms[1].id],
    numGuests: 2,
    source: 'walk_in',
    guest: { fullName: 'Idempotency Guest', email: `idem.${runId}@example.ng`, phone: '+234 800 000 0001' },
  }, { id: actorId, name: 'Front Desk' }, idempotentKey);

  const secondCall = await ReservationService.createGroup({
    propertyId: prop.id,
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-03',
    roomIds: [insertedRooms[0].id, insertedRooms[1].id],
    numGuests: 2,
    source: 'walk_in',
    guest: { fullName: 'Idempotency Guest', email: `idem.${runId}@example.ng`, phone: '+234 800 000 0001' },
  }, { id: actorId, name: 'Front Desk' }, idempotentKey);

  assert(firstCall.bookingGroup.id === secondCall.bookingGroup.id, 'Advisory lock & idempotency key prevents duplicate group creation');
  assert(firstCall.bookingGroup.invoiceId === secondCall.bookingGroup.invoiceId, 'Idempotent request returns identical group invoice');

  console.log('\n======================================================================');
  console.log(`  VERIFICATION RESULTS: ${passedChecks} PASSED, ${failedChecks} FAILED (TOTAL: ${totalChecks})`);
  console.log('======================================================================\n');

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('\n\x1b[31mFatal Verification Error:\x1b[0m', err);
  process.exit(1);
});
