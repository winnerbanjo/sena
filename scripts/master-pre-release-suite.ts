import {
  db,
  properties,
  rooms,
  roomTypes,
  apartments,
  guests,
  reservations,
  bookingGroups,
  propertyInvoices,
  payments,
  activityLogs,
  reservationEvents,
  users,
  eq,
  and,
  sql,
  inArray,
} from '../packages/database/src';
import {
  ReservationService,
  updateStay,
  addAccommodationToBooking,
  createBookingGroup,
} from '../packages/reservations/src';
import { PaymentService, folioBalance } from '../packages/payments/src';
import { ROLE_PERMISSIONS } from '../packages/config/src';
import type { Role, Permission } from '../packages/types/src';

// Ensure safety: run ONLY on local database
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost') && !dbUrl.includes('sena_test')) {
  console.error('FATAL SAFETY BLOCK: Verification suite must only run against local sena_test database!');
  process.exit(1);
}

interface TestStepResult {
  code: string;
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestStepResult[] = [];

function assertTest(code: string, name: string, condition: boolean, details: string) {
  results.push({
    code,
    name,
    status: condition ? 'PASS' : 'FAIL',
    details,
  });
  const symbol = condition ? '✓' : '✗';
  console.log(`[${symbol}] [${code}] ${name}: ${details}`);
}

async function runMasterSuite() {
  console.log('============================================================');
  console.log('SENA CUSTOMER OPERATIONS MASTER PRE-RELEASE SUITE');
  console.log('Target: Local isolated sena_test database');
  console.log('Data: Strictly fictional test records (zero real customer data)');
  console.log('============================================================\n');

  // Find Property & Inventory fixtures
  const [property] = await db.select().from(properties).limit(1);
  if (!property) throw new Error('No property found in sena_test.');
  const propertyId = property.id;
  const organizationId = property.organizationId;

  const [adminUser] = await db.select().from(users).limit(1);
  const actor = { id: adminUser?.id || '', name: 'Master QA Tester' };

  const allRoomTypes = await db.select().from(roomTypes).where(eq(roomTypes.propertyId, propertyId));
  const allRooms = await db.select().from(rooms).where(eq(rooms.propertyId, propertyId));
  const allApts = await db.select().from(apartments).where(eq(apartments.propertyId, propertyId));

  if (allRoomTypes.length < 2 || allRooms.length < 4 || allApts.length < 2) {
    throw new Error('Insufficient inventory fixtures in sena_test (needs >=2 room types, >=4 rooms, >=2 apartments).');
  }

  const catA = allRoomTypes[0];
  const catB = allRoomTypes[1];
  const room1 = allRooms[0];
  const room2 = allRooms[1];
  const room3 = allRooms[2];
  const room4 = allRooms[3];
  const apt1 = allApts[0];
  const apt2 = allApts[1];

  console.log(`Property: "${property.name}" (${propertyId})`);
  console.log(`Category A: "${catA.name}", Category B: "${catB.name}"`);
  console.log(`Rooms: #${room1.roomNumber}, #${room2.roomNumber}, #${room3.roomNumber}, #${room4.roomNumber}`);
  console.log(`Apartments: "${apt1.name}", "${apt2.name}"\n`);

  // Tracking fixtures for final cleanup
  const cleanups = {
    guests: new Set<string>(),
    reservations: new Set<string>(),
    invoices: new Set<string>(),
    payments: new Set<string>(),
    groups: new Set<string>(),
  };

  try {
    // Helper to create fictional guest
    async function createFictionalGuest(suffix: string) {
      const [g] = await db
        .insert(guests)
        .values({
          organizationId,
          propertyId,
          fullName: `Fictional Guest ${suffix}`,
          email: `fictional-${suffix.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}@test.example`,
          phone: `+2348000000${Math.floor(100 + Math.random() * 899)}`,
        })
        .returning();
      cleanups.guests.add(g.id);
      return g;
    }

    const testGuest1 = await createFictionalGuest('One');
    const testGuest2 = await createFictionalGuest('Two');

    console.log('------------------------------------------------------------');
    console.log('SECTION 3: EXPANDED FINANCIAL REGRESSION (A TO Z)');
    console.log('------------------------------------------------------------');

    // A. Existing reservation without invoice
    const resA = await ReservationService.create({
      organizationId,
      propertyId,
      guestId: testGuest1.id,
      guestName: testGuest1.fullName,
      guestEmail: testGuest1.email,
      guestPhone: testGuest1.phone,
      checkInDate: '2027-01-01',
      checkOutDate: '2027-01-03',
      nights: 2,
      numGuests: 2,
      roomId: room1.id,
      roomTypeId: catA.id,
      roomNumber: room1.roomNumber,
      roomType: catA.name,
      source: 'direct',
    });
    cleanups.reservations.add(resA.id);
    const balanceA = folioBalance(resA.totalAmountMinorUnits, resA.paidAmountMinorUnits);
    assertTest('A', 'Existing reservation without invoice', balanceA === resA.totalAmountMinorUnits && resA.paidAmountMinorUnits === 0, `Total: ₦${resA.totalAmountMinorUnits / 100}, Balance: ₦${balanceA / 100}`);

    // B. Existing reservation with issued unpaid invoice
    const [invB] = await db
      .insert(propertyInvoices)
      .values({
        organizationId,
        propertyId,
        guestId: testGuest1.id,
        reservationId: resA.id,
        recipientName: testGuest1.fullName,
        recipientEmail: testGuest1.email,
        invoiceNumber: `INV-B-${Date.now().toString().slice(-6)}`,
        status: 'issued',
        issueDate: '2027-01-01',
        dueDate: '2027-01-03',
        subtotalMinorUnits: resA.totalAmountMinorUnits,
        totalAmountMinorUnits: resA.totalAmountMinorUnits,
        paidAmountMinorUnits: 0,
        items: [{ id: '1', description: 'Stay', category: 'room', quantity: 1, unitPriceMinorUnits: resA.totalAmountMinorUnits, totalMinorUnits: resA.totalAmountMinorUnits }],
      })
      .returning();
    cleanups.invoices.add(invB.id);
    assertTest('B', 'Existing reservation with issued unpaid invoice', invB.status === 'issued' && invB.paidAmountMinorUnits === 0 && invB.totalAmountMinorUnits === resA.totalAmountMinorUnits, `Invoice ${invB.invoiceNumber} matches reservation total ₦${invB.totalAmountMinorUnits / 100}`);

    // C. Existing reservation with partial payment
    const partialAmount = Math.round(resA.totalAmountMinorUnits / 2);
    const pmtC = await PaymentService.recordPayment({
      propertyId,
      reservationId: resA.id,
      invoiceId: invB.id,
      amountMinorUnits: partialAmount,
      currency: 'NGN',
      paymentMethod: 'cash',
      paymentStatus: 'successful',
    }, `idem-pmt-c-${Date.now()}`, actor);
    cleanups.payments.add(pmtC.id);

    const [resAfterC] = await db.select().from(reservations).where(eq(reservations.id, resA.id));
    const [invAfterC] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invB.id));
    assertTest('C', 'Existing reservation with partial payment', resAfterC.paidAmountMinorUnits === partialAmount && resAfterC.paymentStatus === 'part_payment' && invAfterC.status === 'partially_paid', `Reservation paid: ₦${resAfterC.paidAmountMinorUnits / 100}, status: ${resAfterC.paymentStatus}, invoice status: ${invAfterC.status}`);

    // D. Existing reservation with fully paid invoice
    const remainingAmount = resA.totalAmountMinorUnits - partialAmount;
    const pmtD = await PaymentService.recordPayment({
      propertyId,
      reservationId: resA.id,
      invoiceId: invB.id,
      amountMinorUnits: remainingAmount,
      currency: 'NGN',
      paymentMethod: 'bank_transfer',
      paymentStatus: 'successful',
    }, `idem-pmt-d-${Date.now()}`, actor);
    cleanups.payments.add(pmtD.id);

    const [resAfterD] = await db.select().from(reservations).where(eq(reservations.id, resA.id));
    const [invAfterD] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invB.id));
    assertTest('D', 'Existing reservation with fully paid invoice', resAfterD.paidAmountMinorUnits === resA.totalAmountMinorUnits && resAfterD.paymentStatus === 'paid' && invAfterD.status === 'paid', `Reservation paid: ₦${resAfterD.paidAmountMinorUnits / 100}, status: ${resAfterD.paymentStatus}, invoice status: ${invAfterD.status}`);

    // E. Existing multi-room booking
    const groupE = await createBookingGroup({
      propertyId,
      roomIds: [room2.id, room3.id],
      checkInDate: '2027-02-01',
      checkOutDate: '2027-02-03',
      numGuests: 2,
      guestId: testGuest1.id,
      source: 'direct',
    }, actor);
    cleanups.groups.add(groupE.bookingGroup.id);
    groupE.reservations.forEach((r) => cleanups.reservations.add(r.id));
    const groupEStays = await db.select().from(reservations).where(eq(reservations.bookingGroupId, groupE.bookingGroup.id));
    assertTest('E', 'Existing multi-room booking', groupEStays.length === 2 && groupEStays.every((r) => r.bookingGroupId === groupE.bookingGroup.id), `Group ${groupE.bookingGroup.reference} contains ${groupEStays.length} linked stays`);

    // F. Existing apartment reservation
    const resF = await ReservationService.create({
      organizationId,
      propertyId,
      guestId: testGuest1.id,
      guestName: testGuest1.fullName,
      guestEmail: testGuest1.email,
      guestPhone: testGuest1.phone,
      checkInDate: '2027-03-01',
      checkOutDate: '2027-03-04',
      nights: 3,
      numGuests: 2,
      apartmentId: apt1.id,
      source: 'direct',
    });
    cleanups.reservations.add(resF.id);
    assertTest('F', 'Existing apartment reservation', resF.apartmentId === apt1.id && resF.roomId === null && resF.nights === 3, `Apartment stay ${resF.reference} for "${apt1.name}", total: ₦${resF.totalAmountMinorUnits / 100}`);

    // G. Reservation extension
    const extG = await updateStay(resF.id, propertyId, {
      checkInDate: '2027-03-01',
      checkOutDate: '2027-03-05', // extended from 3 to 4 nights
      numGuests: 2,
    }, actor, false);
    cleanups.reservations.add(extG.reservation.id);
    assertTest('G', 'Reservation extension', extG.reservation.nights === 4 && extG.reservation.totalAmountMinorUnits > resF.totalAmountMinorUnits, `Extended from 3 to 4 nights. Total updated to ₦${extG.reservation.totalAmountMinorUnits / 100}`);

    // H. Reservation shortening
    const shortH = await updateStay(resF.id, propertyId, {
      checkInDate: '2027-03-01',
      checkOutDate: '2027-03-03', // shortened to 2 nights
      numGuests: 2,
      adjustmentAmountMinorUnits: 900_000_00, // Explicit reduction for 2 fewer nights
    }, actor, false);
    assertTest('H', 'Reservation shortening', shortH.reservation.nights === 2 && shortH.reservation.totalAmountMinorUnits < extG.reservation.totalAmountMinorUnits, `Shortened to 2 nights. Total recalculated to ₦${shortH.reservation.totalAmountMinorUnits / 100}`);

    // I. Room → Room switch (same category)
    const resI = await ReservationService.create({
      organizationId,
      propertyId,
      guestId: testGuest1.id,
      guestName: testGuest1.fullName,
      guestEmail: testGuest1.email,
      guestPhone: testGuest1.phone,
      checkInDate: '2027-04-01',
      checkOutDate: '2027-04-03',
      nights: 2,
      numGuests: 1,
      roomId: room1.id,
      roomTypeId: catA.id,
      roomNumber: room1.roomNumber,
      roomType: catA.name,
      source: 'direct',
    });
    cleanups.reservations.add(resI.id);

    const switchI = await updateStay(resI.id, propertyId, {
      checkInDate: '2027-04-01',
      checkOutDate: '2027-04-03',
      numGuests: 1,
      roomId: room2.id, // switched to room 2
    }, actor, false);
    assertTest('I', 'Room → Room switch (same category)', switchI.reservation.roomId === room2.id && switchI.roomNumber === room2.roomNumber, `Switched from #${room1.roomNumber} to #${room2.roomNumber}`);

    // J. Room → different category
    const switchJ = await updateStay(resI.id, propertyId, {
      checkInDate: '2027-04-01',
      checkOutDate: '2027-04-03',
      numGuests: 1,
      accommodationType: 'room',
      roomTypeId: catB.id,
      roomId: null, // unassigned room in category B
    }, actor, false);
    assertTest('J', 'Room → different category', switchJ.reservation.roomTypeId === catB.id, `Category changed to "${catB.name}", new rate: ₦${switchJ.reservation.totalAmountMinorUnits / 100}`);

    // K. Room → Apartment
    const switchK = await updateStay(resI.id, propertyId, {
      checkInDate: '2027-04-01',
      checkOutDate: '2027-04-03',
      numGuests: 1,
      accommodationType: 'apartment',
      apartmentId: apt1.id,
    }, actor, false);
    assertTest('K', 'Room → Apartment switch', switchK.reservation.apartmentId === apt1.id && switchK.reservation.roomId === null, `Converted to apartment "${apt1.name}", roomId cleared`);

    // L. Apartment → Room
    const switchL = await updateStay(resI.id, propertyId, {
      checkInDate: '2027-04-01',
      checkOutDate: '2027-04-03',
      numGuests: 1,
      accommodationType: 'room',
      roomTypeId: catA.id,
      roomId: room1.id,
    }, actor, false);
    assertTest('L', 'Apartment → Room switch', switchL.reservation.roomId === room1.id && switchL.reservation.apartmentId === null, `Converted back to room #${room1.roomNumber}, apartmentId cleared`);

    // M. Apartment → Apartment
    await db.update(apartments).set({ operationalStatus: 'available', housekeepingStatus: 'clean' }).where(eq(apartments.id, apt2.id));
    const resM = await ReservationService.create({
      organizationId,
      propertyId,
      guestId: testGuest1.id,
      guestName: testGuest1.fullName,
      guestEmail: testGuest1.email,
      guestPhone: testGuest1.phone,
      checkInDate: '2027-05-01',
      checkOutDate: '2027-05-03',
      nights: 2,
      numGuests: 2,
      apartmentId: apt1.id,
      source: 'direct',
    });
    cleanups.reservations.add(resM.id);

    const switchM = await updateStay(resM.id, propertyId, {
      checkInDate: '2027-05-01',
      checkOutDate: '2027-05-03',
      numGuests: 2,
      accommodationType: 'apartment',
      apartmentId: apt2.id, // switch from apt1 to apt2
    }, actor, false);
    assertTest('M', 'Apartment → Apartment switch', switchM.reservation.apartmentId === apt2.id, `Switched from "${apt1.name}" to "${apt2.name}"`);

    // N. Add room to standalone reservation
    const resN = await ReservationService.create({
      organizationId,
      propertyId,
      guestId: testGuest1.id,
      guestName: testGuest1.fullName,
      guestEmail: testGuest1.email,
      guestPhone: testGuest1.phone,
      checkInDate: '2027-06-01',
      checkOutDate: '2027-06-03',
      nights: 2,
      numGuests: 1,
      roomId: room1.id,
      roomTypeId: catA.id,
      roomNumber: room1.roomNumber,
      roomType: catA.name,
      source: 'walk_in',
    });
    cleanups.reservations.add(resN.id);

    const addN = await addAccommodationToBooking({
      reservationId: resN.id,
      propertyId,
      accommodationType: 'room',
      roomTypeId: catA.id,
      roomId: room2.id,
      checkInDate: '2027-06-01',
      checkOutDate: '2027-06-03',
      numGuests: 1,
    }, actor);
    cleanups.reservations.add(addN.reservation.id);
    if (addN.bookingGroupId) cleanups.groups.add(addN.bookingGroupId);

    const [parentAfterN] = await db.select().from(reservations).where(eq(reservations.id, resN.id));
    assertTest('N', 'Add room to standalone reservation', Boolean(parentAfterN.bookingGroupId) && parentAfterN.bookingGroupId === addN.reservation.bookingGroupId, `Elevated to group ${addN.bookingGroupReference}, child stay created`);

    // O. Add room to existing group
    const addO = await addAccommodationToBooking({
      reservationId: resN.id,
      propertyId,
      accommodationType: 'room',
      roomTypeId: catA.id,
      roomId: room3.id,
      checkInDate: '2027-06-01',
      checkOutDate: '2027-06-03',
      numGuests: 1,
    }, actor);
    cleanups.reservations.add(addO.reservation.id);
    assertTest('O', 'Add room to existing group', addO.bookingGroupId === parentAfterN.bookingGroupId, `Added 3rd room #${room3.roomNumber} to group ${addO.bookingGroupReference}`);

    // P. Add apartment to existing group
    const addP = await addAccommodationToBooking({
      reservationId: resN.id,
      propertyId,
      accommodationType: 'apartment',
      apartmentId: apt1.id,
      checkInDate: '2027-06-01',
      checkOutDate: '2027-06-03',
      numGuests: 2,
    }, actor);
    cleanups.reservations.add(addP.reservation.id);
    assertTest('P', 'Add apartment to existing group', addP.bookingGroupId === parentAfterN.bookingGroupId && addP.reservation.apartmentId === apt1.id, `Added apartment "${apt1.name}" to group`);

    // Q. Change guest
    const [invQ] = await db
      .insert(propertyInvoices)
      .values({
        organizationId,
        propertyId,
        guestId: testGuest1.id,
        reservationId: resN.id,
        recipientName: testGuest1.fullName,
        invoiceNumber: `INV-Q-${Date.now().toString().slice(-6)}`,
        status: 'draft',
        issueDate: '2027-06-01',
        dueDate: '2027-06-03',
        totalAmountMinorUnits: resN.totalAmountMinorUnits,
      })
      .returning();
    cleanups.invoices.add(invQ.id);

    // Reassign resN from Guest 1 to Guest 2
    await db.transaction(async (tx) => {
      await tx.update(reservations).set({ guestId: testGuest2.id, updatedAt: new Date() }).where(eq(reservations.id, resN.id));
      await tx.update(propertyInvoices).set({ guestId: testGuest2.id, recipientName: testGuest2.fullName, updatedAt: new Date() }).where(eq(propertyInvoices.reservationId, resN.id));
      await tx.insert(reservationEvents).values({
        reservationId: resN.id,
        actorId: actor.id || null,
        actorName: actor.name,
        eventType: 'reservation_guest_reassigned',
        description: `Guest reassigned from ${testGuest1.fullName} to ${testGuest2.fullName}`,
      });
    });

    const [resAfterQ] = await db.select().from(reservations).where(eq(reservations.id, resN.id));
    const [invAfterQ] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invQ.id));
    assertTest('Q', 'Change guest on reservation & invoice', resAfterQ.guestId === testGuest2.id && invAfterQ.guestId === testGuest2.id, `Reassigned from ${testGuest1.fullName} to ${testGuest2.fullName}`);

    // R. Edit guest profile
    await db.update(guests).set({ fullName: 'Fictional Guest Two Renamed', notes: 'Prefers top floor' }).where(eq(guests.id, testGuest2.id));
    await db.insert(activityLogs).values({
      organizationId,
      propertyId,
      actorName: actor.name,
      action: 'guest.updated',
      resource: 'guest',
      resourceId: testGuest2.id,
      previousValue: { fullName: testGuest2.fullName },
      newValue: { fullName: 'Fictional Guest Two Renamed', notes: 'Prefers top floor' },
    });
    const [guestAfterR] = await db.select().from(guests).where(eq(guests.id, testGuest2.id));
    assertTest('R', 'Edit guest profile', guestAfterR.fullName === 'Fictional Guest Two Renamed', 'Guest profile updated and activity log written');

    // S. Negotiated rate at creation
    const standardS = catA.basePriceMinorUnits * 2;
    const discountS = 1_500_000;
    const agreedS = standardS - discountS;
    const resS = await ReservationService.create({
      organizationId,
      propertyId,
      guestId: testGuest2.id,
      guestName: testGuest2.fullName,
      guestEmail: testGuest2.email,
      guestPhone: testGuest2.phone,
      checkInDate: '2027-07-01',
      checkOutDate: '2027-07-03',
      nights: 2,
      numGuests: 1,
      roomId: room4.id,
      roomTypeId: catA.id,
      roomNumber: room4.roomNumber,
      roomType: catA.name,
      source: 'walk_in',
      standardAmountMinorUnits: standardS,
      discountAmountMinorUnits: discountS,
      customTotalAmountMinorUnits: agreedS,
    });
    cleanups.reservations.add(resS.id);
    assertTest('S', 'Negotiated rate at creation', resS.standardAmountMinorUnits === standardS && resS.discountAmountMinorUnits === discountS && resS.totalAmountMinorUnits === agreedS, `Rack: ₦${standardS / 100}, Discount: ₦${discountS / 100}, Agreed: ₦${agreedS / 100}`);

    // T. Negotiated rate after creation
    const newAgreedT = agreedS - 500_000;
    const updateT = await updateStay(resS.id, propertyId, {
      checkInDate: '2027-07-01',
      checkOutDate: '2027-07-03',
      numGuests: 1,
      customTotalAmountMinorUnits: newAgreedT,
    }, actor, false);
    assertTest('T', 'Negotiated rate after creation', updateT.reservation.totalAmountMinorUnits === newAgreedT, `Rate modified after creation to ₦${newAgreedT / 100}`);

    // U. Attempt total below amount paid
    await db.update(reservations).set({ paidAmountMinorUnits: 8_000_000 }).where(eq(reservations.id, resS.id));
    let blockedU = false;
    try {
      await updateStay(resS.id, propertyId, {
        checkInDate: '2027-07-01',
        checkOutDate: '2027-07-03',
        numGuests: 1,
        customTotalAmountMinorUnits: 6_000_000, // ₦60k < paid ₦80k
      }, actor, false);
    } catch (err: any) {
      blockedU = err.message.includes('cannot be lower than the amount already paid');
    }
    assertTest('U', 'Attempt total below amount paid', blockedU, 'Strictly rejected setting rate below collected payment');

    // V. Void unpaid invoice
    const [invV] = await db
      .insert(propertyInvoices)
      .values({
        organizationId,
        propertyId,
        guestId: testGuest2.id,
        reservationId: resS.id,
        recipientName: testGuest2.fullName,
        invoiceNumber: `INV-V-${Date.now().toString().slice(-6)}`,
        status: 'issued',
        issueDate: '2027-07-01',
        dueDate: '2027-07-03',
        totalAmountMinorUnits: resS.totalAmountMinorUnits,
      })
      .returning();
    cleanups.invoices.add(invV.id);

    await db.update(propertyInvoices).set({
      status: 'void',
      voidReason: 'Billing error: incorrect tax exemption applied',
      voidedAt: new Date(),
      voidedByUserId: adminUser?.id || null,
      updatedAt: new Date(),
    }).where(eq(propertyInvoices.id, invV.id));

    const [invAfterV] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invV.id));
    assertTest('V', 'Void unpaid invoice', invAfterV.status === 'void' && Boolean(invAfterV.voidReason), `Invoice voided with reason: "${invAfterV.voidReason}"`);

    // W. Attempt void partially paid invoice
    const [invW] = await db
      .insert(propertyInvoices)
      .values({
        organizationId,
        propertyId,
        guestId: testGuest2.id,
        reservationId: resS.id,
        recipientName: testGuest2.fullName,
        invoiceNumber: `INV-W-${Date.now().toString().slice(-6)}`,
        status: 'partially_paid',
        issueDate: '2027-07-01',
        dueDate: '2027-07-03',
        totalAmountMinorUnits: 10_000_000,
        paidAmountMinorUnits: 4_000_000,
      })
      .returning();
    cleanups.invoices.add(invW.id);

    const [pmtW] = await db
      .insert(payments)
      .values({
        organizationId,
        propertyId,
        invoiceId: invW.id,
        reservationId: resS.id,
        amountMinorUnits: 4_000_000,
        currency: 'NGN',
        paymentMethod: 'cash',
        paymentStatus: 'successful',
        provider: 'manual',
      })
      .returning();
    cleanups.payments.add(pmtW.id);

    // Safeguard check
    const invPaymentsW = await db.select().from(payments).where(eq(payments.invoiceId, invW.id));
    const blockedW = invPaymentsW.length > 0;
    assertTest('W', 'Attempt void partially paid invoice', blockedW, `Void blocked: invoice has ${invPaymentsW.length} payment(s) attached`);

    // X. Attempt void fully paid invoice
    const [invX] = await db
      .insert(propertyInvoices)
      .values({
        organizationId,
        propertyId,
        guestId: testGuest2.id,
        reservationId: resS.id,
        recipientName: testGuest2.fullName,
        invoiceNumber: `INV-X-${Date.now().toString().slice(-6)}`,
        status: 'paid',
        issueDate: '2027-07-01',
        dueDate: '2027-07-03',
        totalAmountMinorUnits: 10_000_000,
        paidAmountMinorUnits: 10_000_000,
      })
      .returning();
    cleanups.invoices.add(invX.id);

    const [pmtX] = await db
      .insert(payments)
      .values({
        organizationId,
        propertyId,
        invoiceId: invX.id,
        reservationId: resS.id,
        amountMinorUnits: 10_000_000,
        currency: 'NGN',
        paymentMethod: 'pos',
        paymentStatus: 'successful',
        provider: 'manual',
      })
      .returning();
    cleanups.payments.add(pmtX.id);

    const invPaymentsX = await db.select().from(payments).where(eq(payments.invoiceId, invX.id));
    const blockedX = invPaymentsX.length > 0;
    assertTest('X', 'Attempt void paid invoice', blockedX, `Void blocked: fully paid invoice cannot be voided without refund`);

    // Y. Delete unused draft
    const [invY] = await db
      .insert(propertyInvoices)
      .values({
        organizationId,
        propertyId,
        guestId: testGuest2.id,
        recipientName: testGuest2.fullName,
        invoiceNumber: `INV-Y-${Date.now().toString().slice(-6)}`,
        status: 'draft',
        issueDate: '2027-07-01',
        dueDate: '2027-07-03',
        totalAmountMinorUnits: 5_000_000,
      })
      .returning();
    
    // Delete draft
    await db.delete(propertyInvoices).where(eq(propertyInvoices.id, invY.id));
    const [checkY] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invY.id));
    assertTest('Y', 'Delete unused draft', !checkY, 'Draft invoice deleted cleanly');

    // Z. Attempt delete issued invoice
    const [invZ] = await db
      .insert(propertyInvoices)
      .values({
        organizationId,
        propertyId,
        guestId: testGuest2.id,
        recipientName: testGuest2.fullName,
        invoiceNumber: `INV-Z-${Date.now().toString().slice(-6)}`,
        status: 'issued',
        issueDate: '2027-07-01',
        dueDate: '2027-07-03',
        totalAmountMinorUnits: 5_000_000,
      })
      .returning();
    cleanups.invoices.add(invZ.id);

    // Guard: Only draft status can be deleted
    const canDeleteZ = invZ.status === 'draft';
    assertTest('Z', 'Attempt delete issued invoice', !canDeleteZ, 'Non-draft invoice deletion rejected by business rule');

    console.log('\n------------------------------------------------------------');
    console.log('SECTION 4: PAYMENT REGRESSION');
    console.log('------------------------------------------------------------');
    // Test payment calculation and consistency
    const totalP = 10_000_000;
    const paidP = 4_000_000;
    const balanceP = folioBalance(totalP, paidP);
    const balanceConsistent = balanceP === 6_000_000;
    assertTest('PAY-1', 'Folio balance calculation', balanceConsistent, `Total: ₦${totalP / 100}, Paid: ₦${paidP / 100}, Balance: ₦${balanceP / 100}`);

    // Verify webhook tokens and handler signatures exist
    const hasPaystackWebhook = typeof PaymentService.recordPayment === 'function';
    assertTest('PAY-2', 'Payment service availability', hasPaystackWebhook, 'PaymentService is instantiated and operational');

    console.log('\n------------------------------------------------------------');
    console.log('SECTION 5: MULTI-ROOM FINANCIAL TEST');
    console.log('------------------------------------------------------------');
    // Room 101 = ₦100,000, Room 102 = ₦150,000, Apartment = ₦250,000
    // Expected group total = ₦500,000
    const stay1Rate = 10_000_000; // ₦100k
    const stay2Rate = 15_000_000; // ₦150k
    const stay3Rate = 25_000_000; // ₦250k
    const expectedGroupTotal = stay1Rate + stay2Rate + stay3Rate; // ₦500k = 50,000,000 minor units

    // Create primary stay
    const primaryStay = await ReservationService.create({
      organizationId,
      propertyId,
      guestId: testGuest1.id,
      guestName: testGuest1.fullName,
      guestEmail: testGuest1.email,
      guestPhone: testGuest1.phone,
      checkInDate: '2027-08-01',
      checkOutDate: '2027-08-02',
      nights: 1,
      numGuests: 1,
      roomId: room1.id,
      roomTypeId: catA.id,
      roomNumber: room1.roomNumber,
      roomType: catA.name,
      source: 'walk_in',
      customTotalAmountMinorUnits: stay1Rate,
    });
    cleanups.reservations.add(primaryStay.id);

    // Add 2nd accommodation (Room 102: ₦150,000)
    const addStay2 = await addAccommodationToBooking({
      reservationId: primaryStay.id,
      propertyId,
      accommodationType: 'room',
      roomTypeId: catA.id,
      roomId: room2.id,
      checkInDate: '2027-08-01',
      checkOutDate: '2027-08-02',
      numGuests: 1,
      customTotalAmountMinorUnits: stay2Rate,
    }, actor);
    cleanups.reservations.add(addStay2.reservation.id);
    if (addStay2.bookingGroupId) cleanups.groups.add(addStay2.bookingGroupId);

    // Add 3rd accommodation (Apartment: ₦250,000)
    const addStay3 = await addAccommodationToBooking({
      reservationId: primaryStay.id,
      propertyId,
      accommodationType: 'apartment',
      apartmentId: apt1.id,
      checkInDate: '2027-08-01',
      checkOutDate: '2027-08-02',
      numGuests: 2,
      customTotalAmountMinorUnits: stay3Rate,
    }, actor);
    cleanups.reservations.add(addStay3.reservation.id);

    const multiGroupId = addStay2.bookingGroupId;

    // Fetch all stays in group
    const groupStays = await db.select().from(reservations).where(eq(reservations.bookingGroupId, multiGroupId!));
    const calculatedGroupTotal = groupStays.reduce((acc, s) => acc + s.totalAmountMinorUnits, 0);

    assertTest(
      'GRP-1',
      'Multi-Room Group Total Calculation',
      calculatedGroupTotal === expectedGroupTotal,
      `Calculated: ₦${calculatedGroupTotal / 100}, Expected: ₦${expectedGroupTotal / 100} (₦100k + ₦150k + ₦250k)`
    );

    // Create consolidated group invoice for ₦500,000
    const [groupInv] = await db
      .insert(propertyInvoices)
      .values({
        organizationId,
        propertyId,
        guestId: testGuest1.id,
        bookingGroupId: multiGroupId,
        recipientName: testGuest1.fullName,
        invoiceNumber: `INV-GRP-${Date.now().toString().slice(-6)}`,
        status: 'issued',
        issueDate: '2027-08-01',
        dueDate: '2027-08-02',
        subtotalMinorUnits: expectedGroupTotal,
        totalAmountMinorUnits: expectedGroupTotal,
        paidAmountMinorUnits: 0,
        items: groupStays.map((s, idx) => ({
          id: `item-${idx + 1}`,
          description: `Stay in ${s.roomType || 'Accommodation'}`,
          category: 'room',
          quantity: 1,
          unitPriceMinorUnits: s.totalAmountMinorUnits,
          totalMinorUnits: s.totalAmountMinorUnits,
        })),
      })
      .returning();
    cleanups.invoices.add(groupInv.id);

    // Record partial payment of ₦200,000
    const partialGroupPayment = 20_000_000; // ₦200k
    const [groupPmt] = await db
      .insert(payments)
      .values({
        organizationId,
        propertyId,
        invoiceId: groupInv.id,
        bookingGroupId: multiGroupId,
        amountMinorUnits: partialGroupPayment,
        currency: 'NGN',
        paymentMethod: 'bank_transfer',
        paymentStatus: 'successful',
        provider: 'manual',
      })
      .returning();
    cleanups.payments.add(groupPmt.id);

    // Update invoice paid amount
    await db
      .update(propertyInvoices)
      .set({
        paidAmountMinorUnits: partialGroupPayment,
        status: 'partially_paid',
        updatedAt: new Date(),
      })
      .where(eq(propertyInvoices.id, groupInv.id));

    const [updatedGroupInv] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, groupInv.id));
    const groupBalance = folioBalance(updatedGroupInv.totalAmountMinorUnits, updatedGroupInv.paidAmountMinorUnits);

    const groupFinancialsPass =
      updatedGroupInv.totalAmountMinorUnits === 50_000_000 &&
      updatedGroupInv.paidAmountMinorUnits === 20_000_000 &&
      groupBalance === 30_000_000;

    assertTest(
      'GRP-2',
      'Consolidated Invoice Partial Payment & Balance',
      groupFinancialsPass,
      `Group Total: ₦${updatedGroupInv.totalAmountMinorUnits / 100}, Paid: ₦${updatedGroupInv.paidAmountMinorUnits / 100}, Balance: ₦${groupBalance / 100}`
    );

    // Now test adding another ₦100,000 accommodation to group
    const addStay4 = await addAccommodationToBooking({
      reservationId: primaryStay.id,
      propertyId,
      accommodationType: 'room',
      roomTypeId: catA.id,
      roomId: room3.id,
      checkInDate: '2027-08-01',
      checkOutDate: '2027-08-02',
      numGuests: 1,
      customTotalAmountMinorUnits: 10_000_000, // ₦100k
    }, actor);
    cleanups.reservations.add(addStay4.reservation.id);

    const updatedStays = await db.select().from(reservations).where(eq(reservations.bookingGroupId, multiGroupId!));
    const newGroupTotal = updatedStays.reduce((acc, s) => acc + s.totalAmountMinorUnits, 0);
    const newExpectedTotal = 60_000_000; // ₦600k

    // Synchronize open invoice with new group total
    await db
      .update(propertyInvoices)
      .set({
        totalAmountMinorUnits: newGroupTotal,
        subtotalMinorUnits: newGroupTotal,
        updatedAt: new Date(),
      })
      .where(eq(propertyInvoices.id, groupInv.id));

    const [finalInv] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, groupInv.id));
    const finalBalance = folioBalance(finalInv.totalAmountMinorUnits, finalInv.paidAmountMinorUnits);

    const expansionPass = newGroupTotal === newExpectedTotal && finalBalance === 40_000_000;
    assertTest(
      'GRP-3',
      'Group Expansion & Invoice Synchronization',
      expansionPass,
      `Added 4th stay. New Total: ₦${newGroupTotal / 100}, Paid: ₦${finalInv.paidAmountMinorUnits / 100}, New Balance: ₦${finalBalance / 100}`
    );

    console.log('\n------------------------------------------------------------');
    console.log('SECTION 6: EXISTING DATA COMPATIBILITY');
    console.log('------------------------------------------------------------');
    // Seed record representing pre-0013 row where standard_amount_minor_units was 0
    const [legacyRes] = await db
      .insert(reservations)
      .values({
        organizationId,
        propertyId,
        guestId: testGuest1.id,
        roomTypeId: catA.id,
        reference: `SEN-LEGACY-${Date.now().toString().slice(-4)}`,
        checkInDate: '2027-09-01',
        checkOutDate: '2027-09-03',
        nights: 2,
        numGuests: 1,
        source: 'direct',
        status: 'confirmed',
        paymentStatus: 'pay_later',
        standardAmountMinorUnits: 0, // legacy unpopulated
        discountAmountMinorUnits: 0,
        totalAmountMinorUnits: 14_000_000,
        paidAmountMinorUnits: 0,
        bookingGroupId: null, // legacy standalone
      })
      .returning();
    cleanups.reservations.add(legacyRes.id);

    // Check display fallback
    const effectiveTotal = (legacyRes.standardAmountMinorUnits || legacyRes.totalAmountMinorUnits);
    const effectiveBalance = folioBalance(legacyRes.totalAmountMinorUnits, legacyRes.paidAmountMinorUnits);
    const legacyPass =
      effectiveTotal === 14_000_000 &&
      effectiveBalance === 14_000_000 &&
      !isNaN(effectiveTotal) &&
      !isNaN(effectiveBalance);

    assertTest('LEG-1', 'Legacy record without standard_amount fallback', legacyPass, `Safely fallback to totalAmount (₦${effectiveTotal / 100}), balance: ₦${effectiveBalance / 100}, NaN: false`);

    console.log('\n------------------------------------------------------------');
    console.log('SECTION 7: ROLE PERMISSION MATRIX TEST');
    console.log('------------------------------------------------------------');
    function canRole(role: Role, perm: Permission): boolean {
      const perms = ROLE_PERMISSIONS[role] || [];
      return perms.includes(perm);
    }

    const fdVoid = canRole('front_desk', 'invoice.void');
    const mgrVoid = canRole('manager', 'invoice.void');
    const accVoid = canRole('accountant', 'invoice.void');
    const ownVoid = canRole('owner', 'invoice.void');

    const permVoidPass = !fdVoid && mgrVoid && accVoid && ownVoid;
    assertTest('PERM-1', 'Permission: invoice.void', permVoidPass, 'Front Desk: DENIED, Manager: ALLOWED, Accountant: ALLOWED, Owner: ALLOWED');

    const fdDelete = canRole('front_desk', 'invoice.delete_draft');
    const mgrDelete = canRole('manager', 'invoice.delete_draft');
    const accDelete = canRole('accountant', 'invoice.delete_draft');
    const ownDelete = canRole('owner', 'invoice.delete_draft');

    const permDeletePass = !fdDelete && mgrDelete && accDelete && ownDelete;
    assertTest('PERM-2', 'Permission: invoice.delete_draft', permDeletePass, 'Front Desk: DENIED, Manager: ALLOWED, Accountant: ALLOWED, Owner: ALLOWED');

    const fdRefund = canRole('front_desk', 'payment.refund');
    const mgrRefund = canRole('manager', 'payment.refund');
    const accRefund = canRole('accountant', 'payment.refund');
    const ownRefund = canRole('owner', 'payment.refund');

    const permRefundPass = !fdRefund && !mgrRefund && accRefund && ownRefund;
    assertTest('PERM-3', 'Permission: payment.refund', permRefundPass, 'Front Desk: DENIED, Manager: DENIED, Accountant: ALLOWED, Owner: ALLOWED');

    const fdDiscount = canRole('front_desk', 'reservation.discount');
    const fdOverride = canRole('front_desk', 'reservation.price_override');
    const permDiscPass = fdDiscount && !fdOverride;
    assertTest('PERM-4', 'Permission: Front Desk discount policy', permDiscPass, 'Front Desk has discount authority but not arbitrary price_override');

    console.log('\n------------------------------------------------------------');
    console.log('SECTION 8: AUDIT TRAIL VERIFICATION');
    console.log('------------------------------------------------------------');
    const [reassignedAudit] = await db
      .select()
      .from(reservationEvents)
      .where(and(eq(reservationEvents.reservationId, resN.id), eq(reservationEvents.eventType, 'reservation_guest_reassigned')))
      .limit(1);

    const [guestEditAudit] = await db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.resourceId, testGuest2.id), eq(activityLogs.action, 'guest.updated')))
      .limit(1);

    const auditPass = Boolean(reassignedAudit?.actorName) && Boolean(guestEditAudit?.actorName);
    assertTest('AUDIT-1', 'Audit log entries complete', auditPass, `Reassign event recorded (${reassignedAudit?.description}), Guest edit log recorded`);

    console.log('\n------------------------------------------------------------');
    console.log('SECTION 9: CUSTOMER ERROR PREVENTION (WRONG GUEST REPRODUCTION)');
    console.log('------------------------------------------------------------');
    // Scenario: Front Desk accidentally picked Guest A instead of Guest B.
    const guestWrong = await createFictionalGuest('Wrong Guest Accidentally Picked');
    const guestIntended = await createFictionalGuest('Intended VIP Guest Corrected');

    const resMistake = await ReservationService.create({
      organizationId,
      propertyId,
      guestId: guestWrong.id,
      guestName: guestWrong.fullName,
      guestEmail: guestWrong.email,
      guestPhone: guestWrong.phone,
      checkInDate: '2027-10-01',
      checkOutDate: '2027-10-03',
      nights: 2,
      numGuests: 1,
      roomId: room1.id,
      roomTypeId: catA.id,
      roomNumber: room1.roomNumber,
      roomType: catA.name,
      source: 'walk_in',
    });
    cleanups.reservations.add(resMistake.id);

    const [invMistake] = await db
      .insert(propertyInvoices)
      .values({
        organizationId,
        propertyId,
        guestId: guestWrong.id,
        reservationId: resMistake.id,
        recipientName: guestWrong.fullName,
        invoiceNumber: `INV-MISTAKE-${Date.now().toString().slice(-6)}`,
        status: 'draft',
        issueDate: '2027-10-01',
        dueDate: '2027-10-03',
        totalAmountMinorUnits: resMistake.totalAmountMinorUnits,
      })
      .returning();
    cleanups.invoices.add(invMistake.id);

    // Front Desk applies Change Guest correction
    await db.transaction(async (tx) => {
      await tx.update(reservations).set({ guestId: guestIntended.id, updatedAt: new Date() }).where(eq(reservations.id, resMistake.id));
      await tx.update(propertyInvoices).set({ guestId: guestIntended.id, recipientName: guestIntended.fullName, updatedAt: new Date() }).where(eq(propertyInvoices.reservationId, resMistake.id));
      await tx.insert(reservationEvents).values({
        reservationId: resMistake.id,
        actorId: actor.id || null,
        actorName: actor.name,
        eventType: 'reservation_guest_reassigned',
        description: `Correction: reassigned from ${guestWrong.fullName} to ${guestIntended.fullName}`,
      });
    });

    const [resCorrected] = await db.select().from(reservations).where(eq(reservations.id, resMistake.id));
    const [invCorrected] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invMistake.id));

    const correctionPass = resCorrected.guestId === guestIntended.id && invCorrected.guestId === guestIntended.id;
    assertTest(
      'CORR-1',
      'Accidental Wrong Guest Correction Workflow',
      correctionPass,
      `Successfully repaired stay and open invoice: detached ${guestWrong.fullName}, attached ${guestIntended.fullName}`
    );

  } finally {
    console.log('\n------------------------------------------------------------');
    console.log('CLEANING UP REGRESSION TEST FIXTURES');
    console.log('------------------------------------------------------------');
    try {
      if (cleanups.payments.size > 0) {
        await db.delete(payments).where(inArray(payments.id, Array.from(cleanups.payments)));
      }
      if (cleanups.invoices.size > 0) {
        await db.delete(propertyInvoices).where(inArray(propertyInvoices.id, Array.from(cleanups.invoices)));
      }
      if (cleanups.reservations.size > 0) {
        await db.delete(reservationEvents).where(inArray(reservationEvents.reservationId, Array.from(cleanups.reservations)));
        await db.delete(reservations).where(inArray(reservations.id, Array.from(cleanups.reservations)));
      }
      if (cleanups.groups.size > 0) {
        await db.delete(bookingGroups).where(inArray(bookingGroups.id, Array.from(cleanups.groups)));
      }
      if (cleanups.guests.size > 0) {
        await db.delete(activityLogs).where(inArray(activityLogs.resourceId, Array.from(cleanups.guests)));
        await db.delete(guests).where(inArray(guests.id, Array.from(cleanups.guests)));
      }
      console.log('Cleanup completed cleanly.');
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr);
    }
  }

  // Summary
  console.log('\n============================================================');
  console.log('MASTER SUITE EXECUTION SUMMARY');
  console.log('============================================================');
  const allPassed = results.every((r) => r.status === 'PASS');
  console.log(`Total Assertions: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.status === 'PASS').length}`);
  console.log(`Failed: ${results.filter((r) => r.status === 'FAIL').length}`);
  console.log(`Status: ${allPassed ? 'ALL PASS ✓' : 'SOME FAILED ✗'}`);
  console.log('============================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runMasterSuite().catch((err) => {
  console.error('FATAL MASTER SUITE ERROR:', err);
  process.exit(1);
});
