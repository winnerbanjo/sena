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
  eq,
} from '@sena/database';
import { planInvoiceEdit, calculateInvoiceAmounts, type EditableInvoice, BELOW_PAID } from '../apps/dashboard/src/lib/invoice-edit';
import { fromMinorUnits, toMinorUnits } from '@sena/config';

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

async function runReproductionAndVerification() {
  console.log('\n======================================================================');
  console.log('  STAY CONNECT — FAVOUR ABRAHAM 30-NIGHT INVOICE LOCAL REPRODUCTION');
  console.log('======================================================================\n');

  const runId = Math.random().toString(36).substring(2, 8).toUpperCase();
  let testOrgId = '';
  let testPropId = '';
  let testResId = '';
  let testInvoiceId = '';
  let testGuestId = '';

  try {
    // 1. Create test fixtures in sena_test
    const [org] = await db
      .insert(organizations)
      .values({
        name: `Stay Connect QA ${runId}`,
        slug: `stay-connect-${runId.toLowerCase()}`,
      })
      .returning();
    testOrgId = org.id;

    const [prop] = await db
      .insert(properties)
      .values({
        organizationId: org.id,
        name: `Stay Connect Serviced Apartments ${runId}`,
        slug: `stay-connect-${runId.toLowerCase()}`,
        code: `SC${runId}`,
        address: 'Admiralty Way, Lekki Phase 1, Lagos',
        phone: '+234 803 123 4567',
        email: `stayconnect-${runId.toLowerCase()}@example.ng`,
        currency: 'NGN',
        timezone: 'Africa/Lagos',
      })
      .returning();
    testPropId = prop.id;

    const [rt] = await db
      .insert(roomTypes)
      .values({
        propertyId: prop.id,
        name: 'Deluxe 1-Bedroom Apartment',
        bedType: 'King',
        basePriceMinorUnits: 3500000,
        capacity: 2,
      })
      .returning();

    const [rm] = await db
      .insert(rooms)
      .values({
        propertyId: prop.id,
        roomTypeId: rt.id,
        roomNumber: `APT-${runId}`,
        operationalStatus: 'occupied',
        housekeepingStatus: 'clean',
      })
      .returning();

    const [guest] = await db
      .insert(guests)
      .values({
        organizationId: org.id,
        propertyId: prop.id,
        fullName: 'Favour Abraham',
        email: `favour.abraham.${runId.toLowerCase()}@example.invalid`,
        phone: '+2348039990001',
      })
      .returning();
    testGuestId = guest.id;

    // 30-night stay: October 10 to November 9, 2026.
    // Agreed total stay amount: ₦1,000,000 (100,000,000 kobo)
    const checkInDate = '2026-10-10';
    const checkOutDate = '2026-11-09';
    const totalAmountMinorUnits = 100000000; // ₦1,000,000
    const paidAmountMinorUnits = 100000000; // Fully paid

    const [res] = await db
      .insert(reservations)
      .values({
        propertyId: prop.id,
        guestId: guest.id,
        roomTypeId: rt.id,
        roomId: rm.id,
        reference: `SEN-${runId}`,
        checkInDate,
        checkOutDate,
        nights: 30,
        numGuests: 1,
        adults: 1,
        children: 0,
        status: 'checked_in',
        paymentStatus: 'paid',
        standardAmountMinorUnits: 3500000 * 30, // ₦1,050,000
        discountAmountMinorUnits: 5000000,
        totalAmountMinorUnits,
        paidAmountMinorUnits,
      })
      .returning();
    testResId = res.id;

    // Create invoice matching production scenario:
    // 30 nights with unitPriceMinorUnits = Math.round(100,000,000 / 30) = 3,333,333
    // Note: 30 * 3,333,333 = 99,999,990 kobo (10 kobo remainder)
    const [inv] = await db
      .insert(propertyInvoices)
      .values({
        propertyId: prop.id,
        organizationId: org.id,
        reservationId: res.id,
        invoiceNumber: `INV-2026-${runId}FAVOUR`,
        invoiceType: 'guest_folio',
        status: 'paid',
        recipientName: 'Favour Abraham',
        recipientEmail: guest.email,
        recipientPhone: guest.phone,
        recipientAddress: 'Admiralty Way, Lekki Phase 1, Lagos',
        issueDate: checkInDate,
        dueDate: checkOutDate,
        currency: 'NGN',
        subtotalMinorUnits: totalAmountMinorUnits,
        taxVatMinorUnits: 0,
        taxConsumptionMinorUnits: 0,
        serviceChargeMinorUnits: 0,
        discountMinorUnits: 0,
        totalAmountMinorUnits,
        paidAmountMinorUnits,
        items: [
          {
            id: `item_${runId}_stay`,
            description: `Deluxe 1-Bedroom Apartment (Room APT-${runId}) · 30 night stay (${checkInDate} to ${checkOutDate})`,
            category: 'room',
            quantity: 30,
            unitPriceMinorUnits: 3333333,
            totalMinorUnits: totalAmountMinorUnits,
            reservationId: res.id,
          },
        ],
        notes: 'Stay Connect - Month-long executive stay',
        paymentTerms: 'Paid in Full',
      })
      .returning();
    testInvoiceId = inv.id;

    // Insert payment record
    await db.insert(payments).values({
      propertyId: prop.id,
      invoiceId: inv.id,
      amountMinorUnits: paidAmountMinorUnits,
      currency: 'NGN',
      method: 'bank_transfer',
      status: 'success',
      reference: `PAY-${runId}-FULL`,
    });

    console.log(`[SETUP SUCCESS] Created 30-night fully paid invoice ${inv.invoiceNumber} for Favour Abraham in sena_test.`);
    console.log(`  Stored subtotal: ${inv.subtotalMinorUnits} kobo`);
    console.log(`  Stored total:    ${inv.totalAmountMinorUnits} kobo`);
    console.log(`  Stored paid:     ${inv.paidAmountMinorUnits} kobo`);
    console.log(`  Item quantity:   ${inv.items[0].quantity}, unit price: ${inv.items[0].unitPriceMinorUnits} kobo`);
    console.log(`  Quantity * UnitPrice: ${inv.items[0].quantity * inv.items[0].unitPriceMinorUnits} kobo`);
    const currentFormPayload = {
      recipientName: inv.recipientName,
      recipientEmail: inv.recipientEmail,
      recipientPhone: inv.recipientPhone,
      recipientAddress: inv.recipientAddress,
      companyTin: inv.companyTin,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      paymentTerms: inv.paymentTerms,
      notes: inv.notes,
      bankDetails: null,
      items: [
        {
          id: inv.items[0].id,
          description: inv.items[0].description,
          category: inv.items[0].category,
          quantity: inv.items[0].quantity,
          unitPriceMinorUnits: inv.items[0].unitPriceMinorUnits,
          reservationId: inv.items[0].reservationId,
        },
      ],
      discountMinorUnits: inv.discountMinorUnits,
      applyVat: false,
      applyConsumptionTax: false,
      applyServiceCharge: false,
    };

    // TEST 1: Saving unchanged invoice details
    const planUnchanged = planInvoiceEdit(inv as unknown as EditableInvoice, currentFormPayload);
    console.log('[TEST 1: UNCHANGED SAVE]');
    console.log('Result ok:', planUnchanged.ok);
    assert.equal(planUnchanged.ok, true, 'Unchanged invoice save must succeed');
    if (planUnchanged.ok) {
      assert.equal(planUnchanged.changes.length, 0, 'No financial changes on unchanged save');
    }
    console.log('=> TEST 1 PASSED: Unchanged invoice details save cleanly with 0 changes!\n');

    // TEST 2: Editing guest details (customer name & phone)
    const payloadEditGuest = {
      ...currentFormPayload,
      recipientName: 'Favour Abraham (VIP)',
      recipientPhone: '+2348099998888',
    };
    const planEditGuest = planInvoiceEdit(inv as unknown as EditableInvoice, payloadEditGuest);
    console.log('[TEST 2: EDITING GUEST DETAILS]');
    console.log('Result ok:', planEditGuest.ok);
    assert.equal(planEditGuest.ok, true, 'Editing guest details must succeed');
    if (planEditGuest.ok) {
      assert.equal(planEditGuest.patch.recipientName, 'Favour Abraham (VIP)');
      assert.equal(planEditGuest.patch.recipientPhone, '+2348099998888');
      assert.equal(planEditGuest.patch.totalAmountMinorUnits, undefined, 'Financial amounts untouched');
    }
    console.log('=> TEST 2 PASSED: Guest details update cleanly while financial fields remain untouched!\n');

    // TEST 3: Changing dates (dueDate extended to Nov 15)
    const payloadChangeDates = {
      ...currentFormPayload,
      dueDate: '2026-11-15',
    };
    const planChangeDates = planInvoiceEdit(inv as unknown as EditableInvoice, payloadChangeDates);
    console.log('[TEST 3: CHANGING DATES]');
    console.log('Result ok:', planChangeDates.ok);
    assert.equal(planChangeDates.ok, true, 'Changing dates must succeed');
    if (planChangeDates.ok) {
      assert.equal(planChangeDates.patch.dueDate, '2026-11-15');
      assert.equal(planChangeDates.patch.totalAmountMinorUnits, undefined, 'Financial amounts untouched');
    }
    console.log('=> TEST 3 PASSED: Due date updated cleanly without financial distortion!\n');

    // TEST 4: Adding a charge (Airport Transfer ₦25,000)
    const payloadAddCharge = {
      ...currentFormPayload,
      items: [
        ...currentFormPayload.items,
        {
          id: `item_${runId}_transport`,
          description: 'Airport Transfer Service',
          category: 'transport',
          quantity: 1,
          unitPriceMinorUnits: 2500000, // ₦25,000
        },
      ],
    };
    const planAddCharge = planInvoiceEdit(inv as unknown as EditableInvoice, payloadAddCharge);
    console.log('[TEST 4: ADDING A CHARGE]');
    console.log('Result ok:', planAddCharge.ok);
    assert.equal(planAddCharge.ok, true, 'Adding a charge must succeed');
    if (planAddCharge.ok) {
      assert.equal(planAddCharge.patch.totalAmountMinorUnits, 102500000, 'New total should be exactly ₦1,025,000');
      assert.equal(planAddCharge.patch.subtotalMinorUnits, 102500000, 'Subtotal should be exactly ₦1,025,000');
      assert.equal(planAddCharge.patch.status, 'partially_paid', 'Status should move to partially_paid');
    }
    console.log('=> TEST 4 PASSED: Added charge reflects on total (₦1,025,000) with zero rounding loss!\n');

    // TEST 5A: Deliberate large reduction below amount already paid
    const payloadReduceLarge = {
      ...currentFormPayload,
      items: [
        {
          id: inv.items[0].id,
          description: inv.items[0].description,
          category: inv.items[0].category,
          quantity: 30,
          unitPriceMinorUnits: 2000000, // ₦20,000/night = ₦600,000 total (< ₦1,000,000 paid)
        },
      ],
    };
    const planReduceLarge = planInvoiceEdit(inv as unknown as EditableInvoice, payloadReduceLarge);
    console.log('[TEST 5A: DELIBERATE LARGE REDUCTION BELOW PAID]');
    console.log('Result ok:', planReduceLarge.ok);
    assert.equal(planReduceLarge.ok, false, 'Large reduction below paid must be rejected');
    if (!planReduceLarge.ok) {
      assert.equal(planReduceLarge.error, BELOW_PAID);
      assert.equal(planReduceLarge.status, 409);
    }
    console.log('=> TEST 5A PASSED: Large reduction below paid is strictly rejected with 409 BELOW_PAID!\n');

    // TEST 5B: Small price reduction via unit rate reduction of just 1 Kobo (unit price 3,333,332)
    // 30 * 3,333,332 = 99,999,960 kobo (a 40 kobo reduction below 100,000,000 kobo paid)
    const payloadReduce1Kobo = {
      ...currentFormPayload,
      items: [
        {
          id: inv.items[0].id,
          description: inv.items[0].description,
          category: inv.items[0].category,
          quantity: 30,
          unitPriceMinorUnits: 3333332,
        },
      ],
    };
    const planReduce1Kobo = planInvoiceEdit(inv as unknown as EditableInvoice, payloadReduce1Kobo);
    console.log('[TEST 5B: SMALL 1-KOBO UNIT RATE REDUCTION]');
    console.log('Result ok:', planReduce1Kobo.ok);
    assert.equal(planReduce1Kobo.ok, false, '1-kobo rate reduction below paid must be rejected');
    if (!planReduce1Kobo.ok) {
      assert.equal(planReduce1Kobo.error, BELOW_PAID);
      assert.equal(planReduce1Kobo.status, 409);
    }
    console.log('=> TEST 5B PASSED: 1-kobo unit rate reduction below paid is strictly rejected with 409 BELOW_PAID!\n');

    // TEST 5C: Small price reduction via 10-Kobo discount on settled invoice
    const payloadReduce10KoboDiscount = {
      ...currentFormPayload,
      discountMinorUnits: 10, // 10 kobo discount -> total 99,999,990 kobo (< 100,000,000 kobo paid)
    };
    const planReduce10KoboDiscount = planInvoiceEdit(inv as unknown as EditableInvoice, payloadReduce10KoboDiscount);
    console.log('[TEST 5C: SMALL 10-KOBO DISCOUNT ON SETTLED INVOICE]');
    console.log('Result ok:', planReduce10KoboDiscount.ok);
    assert.equal(planReduce10KoboDiscount.ok, false, '10-kobo discount below paid must be rejected');
    if (!planReduce10KoboDiscount.ok) {
      assert.equal(planReduce10KoboDiscount.error, BELOW_PAID);
      assert.equal(planReduce10KoboDiscount.status, 409);
    }
    console.log('=> TEST 5C PASSED: 10-kobo discount below paid is strictly rejected with 409 BELOW_PAID!\n');

    // TEST 5D: Small price reduction via 100-Kobo (₦1) discount
    const payloadReduce100KoboDiscount = {
      ...currentFormPayload,
      discountMinorUnits: 100, // ₦1 discount -> total 99,999,900 kobo (< 100,000,000 kobo paid)
    };
    const planReduce100KoboDiscount = planInvoiceEdit(inv as unknown as EditableInvoice, payloadReduce100KoboDiscount);
    console.log('[TEST 5D: SMALL 100-KOBO (₦1) DISCOUNT ON SETTLED INVOICE]');
    console.log('Result ok:', planReduce100KoboDiscount.ok);
    assert.equal(planReduce100KoboDiscount.ok, false, '100-kobo discount below paid must be rejected');
    if (!planReduce100KoboDiscount.ok) {
      assert.equal(planReduce100KoboDiscount.error, BELOW_PAID);
      assert.equal(planReduce100KoboDiscount.status, 409);
    }
    console.log('=> TEST 5D PASSED: 100-kobo discount below paid is strictly rejected with 409 BELOW_PAID!\n');

    // TEST 5E: Shortening stay by 1 night (quantity 29 instead of 30)
    const payloadShortenStay = {
      ...currentFormPayload,
      items: [
        {
          id: inv.items[0].id,
          description: inv.items[0].description,
          category: inv.items[0].category,
          quantity: 29,
          unitPriceMinorUnits: 3333333,
        },
      ],
    };
    const planShortenStay = planInvoiceEdit(inv as unknown as EditableInvoice, payloadShortenStay);
    console.log('[TEST 5E: SHORTENING STAY BY 1 NIGHT]');
    console.log('Result ok:', planShortenStay.ok);
    assert.equal(planShortenStay.ok, false, 'Shortening stay below paid must be rejected');
    if (!planShortenStay.ok) {
      assert.equal(planShortenStay.error, BELOW_PAID);
      assert.equal(planShortenStay.status, 409);
    }
    console.log('=> TEST 5E PASSED: Shortening stay below paid is strictly rejected with 409 BELOW_PAID!\n');

    // TEST 5F: Client attempt to submit forged totalMinorUnits lower than paid
    const payloadForgedTotal = {
      ...currentFormPayload,
      items: [
        {
          id: inv.items[0].id,
          description: inv.items[0].description,
          category: inv.items[0].category,
          quantity: 30,
          unitPriceMinorUnits: 3333332,
          totalMinorUnits: 99999960,
        },
      ],
    };
    const planForgedTotal = planInvoiceEdit(inv as unknown as EditableInvoice, payloadForgedTotal);
    console.log('[TEST 5F: CLIENT ATTEMPT TO SUBMIT REDUCED TOTAL]');
    console.log('Result ok:', planForgedTotal.ok);
    assert.equal(planForgedTotal.ok, false, 'Client forged total below paid must be rejected');
    if (!planForgedTotal.ok) {
      assert.equal(planForgedTotal.error, BELOW_PAID);
      assert.equal(planForgedTotal.status, 409);
    }
    console.log('=> TEST 5F PASSED: Client forged total below paid is strictly rejected with 409 BELOW_PAID!\n');

    // TEST 6: Real DB update in sena_test transaction
    console.log('[TEST 6: DATABASE TRANSACTION EXECUTION]');
    const [updatedRow] = await db
      .update(propertyInvoices)
      .set(planAddCharge.ok ? planAddCharge.patch : {})
      .where(eq(propertyInvoices.id, inv.id))
      .returning();
    assert.equal(updatedRow.totalAmountMinorUnits, 102500000);
    assert.equal(updatedRow.status, 'partially_paid');
    console.log(`=> TEST 6 PASSED: Database row updated successfully. New total: ${updatedRow.totalAmountMinorUnits} kobo, Status: ${updatedRow.status}\n`);

  } finally {
    // Clean up test data
    if (testInvoiceId) {
      await db.delete(payments).where(eq(payments.invoiceId, testInvoiceId));
      await db.delete(propertyInvoices).where(eq(propertyInvoices.id, testInvoiceId));
    }
    if (testResId) {
      await db.delete(reservations).where(eq(reservations.id, testResId));
    }
    if (testGuestId) {
      await db.delete(guests).where(eq(guests.id, testGuestId));
    }
    if (testPropId) {
      await db.delete(rooms).where(eq(rooms.propertyId, testPropId));
      await db.delete(roomTypes).where(eq(roomTypes.propertyId, testPropId));
      await db.delete(properties).where(eq(properties.id, testPropId));
    }
    if (testOrgId) {
      await db.delete(organizations).where(eq(organizations.id, testOrgId));
    }
    console.log('[CLEANUP COMPLETE] Test records removed.');
  }
}

runReproductionAndVerification().catch((err) => {
  console.error('[FATAL REPRODUCTION ERROR]', err);
  process.exit(1);
});
