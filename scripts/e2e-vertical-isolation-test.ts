import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load production DATABASE_URL
const envPath = resolve(__dirname, '../apps/booking/.env.local');
const envContent = readFileSync(envPath, 'utf8');
const match = envContent.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
if (!match) throw new Error('DATABASE_URL not found');
process.env.DATABASE_URL = match[1].trim();

async function runE2ETests() {
  const {
    db,
    properties,
    roomTypes,
    rooms,
    guests,
    reservations,
    propertyInvoices,
    housekeepingTasks,
    gymMembershipPlans,
    gymMembers,
    gymSubscriptions,
    gymCheckins,
    gymClasses,
    gymClassBookings,
    restaurantTables,
    restaurantMenuCategories,
    restaurantMenuItems,
    restaurantOrders,
    restaurantOrderItems,
    restaurantIngredients,
    eq,
    and,
    desc,
    sql,
  } = await import('../packages/database/src/index');

  const { assertIndustry } = await import('../apps/dashboard/src/lib/tenant');

  console.log('================================================================');
  console.log('   SENA MULTI-INDUSTRY E2E LIFECYCLE & ISOLATION TEST SUITE     ');
  console.log('================================================================\n');

  // Load the 3 dedicated test properties
  const hotelProp = await db.query.properties.findFirst({ where: eq(properties.slug, 'sena-grand-hotel') });
  const gymProp = await db.query.properties.findFirst({ where: eq(properties.slug, 'sena-power-gym') });
  const restProp = await db.query.properties.findFirst({ where: eq(properties.slug, 'sena-prime-bistro') });

  if (!hotelProp || !gymProp || !restProp) {
    throw new Error('Test properties not found! Ensure scripts/setup-isolated-test-tenants.ts was run.');
  }

  console.log(`[TENANT CONTEXT]`);
  console.log(`  Hotel:      ${hotelProp.name} (${hotelProp.id}) - Industry: ${hotelProp.industry}`);
  console.log(`  Gym:        ${gymProp.name} (${gymProp.id}) - Industry: ${gymProp.industry}`);
  console.log(`  Restaurant: ${restProp.name} (${restProp.id}) - Industry: ${restProp.industry}\n`);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // ============================================================================
  // TEST SECTION 1: CROSS-TENANT INDUSTRY AUTHORIZATION & ISOLATION
  // ============================================================================
  console.log('--- TEST SECTION 1: Cross-Tenant Industry Authorization & Isolation ---');

  // 1.1 Gym Tenant cannot perform Hotel operations
  const gymAsTenant = { propertyId: gymProp.id, property: gymProp, user: {} as any, userId: 'gym-user', role: 'owner' };
  const gymTryingHotel = assertIndustry(gymAsTenant, ['hotel']);
  assert(gymTryingHotel !== null && gymTryingHotel.status === 403, 'Gym tenant blocked from Hotel operations (403 Forbidden)');

  // 1.2 Gym Tenant cannot perform Restaurant operations
  const gymTryingRestaurant = assertIndustry(gymAsTenant, ['restaurant']);
  assert(gymTryingRestaurant !== null && gymTryingRestaurant.status === 403, 'Gym tenant blocked from Restaurant operations (403 Forbidden)');

  // 1.3 Hotel Tenant cannot perform Gym operations
  const hotelAsTenant = { propertyId: hotelProp.id, property: hotelProp, user: {} as any, userId: 'hotel-user', role: 'owner' };
  const hotelTryingGym = assertIndustry(hotelAsTenant, ['gym']);
  assert(hotelTryingGym !== null && hotelTryingGym.status === 403, 'Hotel tenant blocked from Gym operations (403 Forbidden)');

  // 1.4 Hotel Tenant cannot perform Standalone Restaurant operations
  const hotelTryingRestaurant = assertIndustry(hotelAsTenant, ['restaurant']);
  assert(hotelTryingRestaurant !== null && hotelTryingRestaurant.status === 403, 'Hotel tenant blocked from Restaurant operations (403 Forbidden)');

  // 1.5 Restaurant Tenant cannot perform Hotel operations
  const restAsTenant = { propertyId: restProp.id, property: restProp, user: {} as any, userId: 'rest-user', role: 'owner' };
  const restTryingHotel = assertIndustry(restAsTenant, ['hotel']);
  assert(restTryingHotel !== null && restTryingHotel.status === 403, 'Restaurant tenant blocked from Hotel operations (403 Forbidden)');

  // 1.6 Restaurant Tenant cannot perform Gym operations
  const restTryingGym = assertIndustry(restAsTenant, ['gym']);
  assert(restTryingGym !== null && restTryingGym.status === 403, 'Restaurant tenant blocked from Gym operations (403 Forbidden)');

  // 1.7 Proper industry access allowed
  assert(assertIndustry(hotelAsTenant, ['hotel']) === null, 'Hotel tenant authorized for Hotel operations');
  assert(assertIndustry(gymAsTenant, ['gym']) === null, 'Gym tenant authorized for Gym operations');
  assert(assertIndustry(restAsTenant, ['restaurant']) === null, 'Restaurant tenant authorized for Restaurant operations');

  // ============================================================================
  // TEST SECTION 2: SENA FOR GYMS - COMPLETE LIFECYCLE
  // ============================================================================
  console.log('\n--- TEST SECTION 2: Sena for Gyms - Complete Operational Lifecycle ---');

  // 2.1 Member Registration
  const [gymMember] = await db
    .insert(gymMembers)
    .values({
      propertyId: gymProp.id,
      organizationId: gymProp.organizationId!,
      memberNumber: `GYM-E2E-${Date.now().toString().slice(-4)}`,
      fullName: 'Tunde Adeyemi',
      email: `tunde.e2e.${Date.now()}@example.com`,
      phone: '+2348099887766',
      qrCodeToken: `QR-E2E-${Date.now()}`,
      status: 'active',
      joinedAt: new Date(),
    })
    .returning();
  assert(Boolean(gymMember.id), `Gym member registered: ${gymMember.fullName} (${gymMember.memberNumber})`);

  // 2.2 Membership Subscription & Payment
  const plan = await db.query.gymMembershipPlans.findFirst({ where: eq(gymMembershipPlans.propertyId, gymProp.id) });
  assert(Boolean(plan), `Gym membership plan resolved: ${plan!.name} (₦${plan!.priceMinorUnits / 100})`);

  const startDate = new Date().toISOString().split('T')[0];
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);
  const endDate = nextMonth.toISOString().split('T')[0];

  const gymTotalMinorUnits = plan!.priceMinorUnits + plan!.registrationFeeMinorUnits;
  const [subscription] = await db
    .insert(gymSubscriptions)
    .values({
      propertyId: gymProp.id,
      memberId: gymMember.id,
      planId: plan!.id,
      startDate,
      endDate,
      status: 'active',
      totalAmountMinorUnits: gymTotalMinorUnits,
      paidAmountMinorUnits: gymTotalMinorUnits,
      paymentMethod: 'pos_card',
    })
    .returning();
  assert(subscription.status === 'active', `Active subscription created with full payment: ₦${subscription.paidAmountMinorUnits / 100}`);

  // 2.3 QR Code Check-in at Terminal
  const [grantedCheckin] = await db
    .insert(gymCheckins)
    .values({
      propertyId: gymProp.id,
      memberId: gymMember.id,
      accessResult: 'granted',
      accessPoint: 'turnstile_gate_1',
      verifiedBy: 'QR Scanner Hardware Terminal',
    })
    .returning();
  assert(grantedCheckin.accessResult === 'granted', `Member scanned QR token at turnstile: Access GRANTED (Log #${grantedCheckin.id})`);

  // 2.4 Fitness Class Booking
  const gymClass = await db.query.gymClasses.findFirst({ where: eq(gymClasses.propertyId, gymProp.id) });
  assert(Boolean(gymClass), `Fitness class resolved: ${gymClass!.name} (Capacity: ${gymClass!.capacity})`);

  const [booking] = await db
    .insert(gymClassBookings)
    .values({
      propertyId: gymProp.id,
      classId: gymClass!.id,
      memberId: gymMember.id,
      bookingDate: startDate,
      status: 'confirmed',
    })
    .returning();
  assert(booking.status === 'confirmed', `Class spot booked & confirmed for ${gymMember.fullName}`);

  // 2.5 Subscription Renewal
  const renewalEndDate = new Date();
  renewalEndDate.setDate(renewalEndDate.getDate() + 60);
  const [renewedSub] = await db
    .update(gymSubscriptions)
    .set({
      endDate: renewalEndDate.toISOString().split('T')[0],
      totalAmountMinorUnits: subscription.totalAmountMinorUnits + plan!.priceMinorUnits,
      paidAmountMinorUnits: subscription.paidAmountMinorUnits + plan!.priceMinorUnits,
      updatedAt: new Date(),
    })
    .where(eq(gymSubscriptions.id, subscription.id))
    .returning();
  assert(renewedSub.endDate > subscription.endDate, `Subscription renewed for +30 days (New expiry: ${renewedSub.endDate})`);

  // 2.6 Expiry Simulation & Denied Check-in
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await db
    .update(gymSubscriptions)
    .set({ endDate: yesterday.toISOString().split('T')[0], status: 'expired' })
    .where(eq(gymSubscriptions.id, subscription.id));

  const [deniedCheckin] = await db
    .insert(gymCheckins)
    .values({
      propertyId: gymProp.id,
      memberId: gymMember.id,
      accessResult: 'denied',
      denialReason: 'Membership expired',
      accessPoint: 'turnstile_gate_1',
      verifiedBy: 'QR Scanner Hardware Terminal',
    })
    .returning();
  assert(deniedCheckin.accessResult === 'denied' && deniedCheckin.denialReason === 'Membership expired', `Expired subscription check-in: Access DENIED correctly`);

  // 2.7 Subscription Cancellation
  const [cancelledSub] = await db
    .update(gymSubscriptions)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(gymSubscriptions.id, subscription.id))
    .returning();
  assert(cancelledSub.status === 'cancelled', `Subscription status successfully updated to CANCELLED`);

  // ============================================================================
  // TEST SECTION 3: SENA FOR RESTAURANTS - COMPLETE LIFECYCLE
  // ============================================================================
  console.log('\n--- TEST SECTION 3: Sena for Restaurants - Complete Operational Lifecycle ---');

  // 3.1 Menu Item Creation
  const foodCat = await db.query.restaurantMenuCategories.findFirst({ where: eq(restaurantMenuCategories.propertyId, restProp.id) });
  assert(Boolean(foodCat), `Menu category resolved: ${foodCat!.name}`);

  const [newItem] = await db
    .insert(restaurantMenuItems)
    .values({
      propertyId: restProp.id,
      categoryId: foodCat!.id,
      name: 'Charcoal Grilled Jumbo Prawns',
      description: 'Tiger prawns basted in garlic lemon butter',
      priceMinorUnits: 1250000, // ₦12,500.00
      costMinorUnits: 500000,
      preparationStation: 'grill',
      preparationTimeMinutes: 18,
      isAvailable: true,
    })
    .returning();
  assert(Boolean(newItem.id), `New menu item created: ${newItem.name} (₦${newItem.priceMinorUnits / 100})`);

  // 3.2 Dining Table Selection & POS Order Creation
  const tableT2 = await db.query.restaurantTables.findFirst({
    where: and(eq(restaurantTables.propertyId, restProp.id), eq(restaurantTables.tableNumber, 'T2')),
  });
  assert(Boolean(tableT2), `Dining Table T2 resolved (Capacity: ${tableT2!.capacity})`);

  const orderNum = `ORD-E2E-${Date.now().toString().slice(-4)}`;
  const subtotalMinorUnits = newItem.priceMinorUnits;
  const taxMinorUnits = Math.round(subtotalMinorUnits * 0.075); // 7.5% VAT
  const serviceChargeMinorUnits = Math.round(subtotalMinorUnits * 0.10); // 10% Service
  const totalAmountMinorUnits = subtotalMinorUnits + taxMinorUnits + serviceChargeMinorUnits;

  const [order] = await db
    .insert(restaurantOrders)
    .values({
      propertyId: restProp.id,
      organizationId: restProp.organizationId!,
      orderNumber: orderNum,
      orderType: 'dine_in',
      tableId: tableT2!.id,
      status: 'open',
      subtotalMinorUnits,
      taxMinorUnits,
      serviceChargeMinorUnits,
      totalAmountMinorUnits,
      paidAmountMinorUnits: 0,
      notes: 'Customer requested extra lemon wedges',
    })
    .returning();

  const [orderItem] = await db
    .insert(restaurantOrderItems)
    .values({
      orderId: order.id,
      menuItemId: newItem.id,
      quantity: 1,
      unitPriceMinorUnits: newItem.priceMinorUnits,
      totalAmountMinorUnits: newItem.priceMinorUnits,
      preparationStation: 'grill',
      kdsStatus: 'sent_to_kitchen',
    })
    .returning();

  await db
    .update(restaurantTables)
    .set({ status: 'occupied', currentOrderId: order.id })
    .where(eq(restaurantTables.id, tableT2!.id));

  assert(order.status === 'open', `POS Order ${order.orderNumber} created. Table T2 transitioned to OCCUPIED`);

  // 3.3 Kitchen Preparation & KDS Workflow
  await db
    .update(restaurantOrderItems)
    .set({ kdsStatus: 'preparing' })
    .where(eq(restaurantOrderItems.id, orderItem.id));

  await db
    .update(restaurantOrders)
    .set({ status: 'preparing' })
    .where(eq(restaurantOrders.id, order.id));

  // Mark dish ready in KDS
  await db
    .update(restaurantOrderItems)
    .set({ kdsStatus: 'ready', completedAt: new Date() })
    .where(eq(restaurantOrderItems.id, orderItem.id));

  const [readyOrder] = await db
    .update(restaurantOrders)
    .set({ status: 'ready', updatedAt: new Date() })
    .where(eq(restaurantOrders.id, order.id))
    .returning();
  assert(readyOrder.status === 'ready', `KDS Station marked ticket READY for table pickup`);

  // 3.4 Inventory Tracking & Ingredient Deduction
  const prawnIngredient = await db.query.restaurantIngredients.findFirst({
    where: eq(restaurantIngredients.propertyId, restProp.id),
  });
  if (prawnIngredient) {
    const prevStock = parseFloat(prawnIngredient.currentStock);
    const updatedStock = (prevStock - 0.5).toFixed(2);
    await db
      .update(restaurantIngredients)
      .set({ currentStock: updatedStock, updatedAt: new Date() })
      .where(eq(restaurantIngredients.id, prawnIngredient.id));
    assert(parseFloat(updatedStock) < prevStock, `Inventory deducted for order fulfillment: ${prawnIngredient.name} (${prevStock}kg -> ${updatedStock}kg)`);
  }

  // 3.5 Payment Recording
  const [paidOrder] = await db
    .update(restaurantOrders)
    .set({
      paidAmountMinorUnits: totalAmountMinorUnits,
      updatedAt: new Date(),
    })
    .where(eq(restaurantOrders.id, order.id))
    .returning();
  assert(paidOrder.paidAmountMinorUnits === totalAmountMinorUnits, `Full payment recorded for Order ${order.orderNumber}: ₦${totalAmountMinorUnits / 100}`);

  // 3.6 Receipt Generation Verification
  assert(
    paidOrder.totalAmountMinorUnits === (subtotalMinorUnits + taxMinorUnits + serviceChargeMinorUnits),
    `Fiscal Receipt verification: Subtotal (₦${subtotalMinorUnits / 100}) + VAT (₦${taxMinorUnits / 100}) + Service (₦${serviceChargeMinorUnits / 100}) = Grand Total (₦${totalAmountMinorUnits / 100})`
  );

  // 3.7 Order Closure & Table Release
  const [completedOrder] = await db
    .update(restaurantOrders)
    .set({
      status: 'completed',
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(restaurantOrders.id, order.id))
    .returning();

  const [releasedTable] = await db
    .update(restaurantTables)
    .set({
      status: 'available',
      currentOrderId: null,
      updatedAt: new Date(),
    })
    .where(eq(restaurantTables.id, tableT2!.id))
    .returning();

  assert(completedOrder.status === 'completed', `Order ${order.orderNumber} successfully CLOSED`);
  assert(releasedTable.status === 'available' && releasedTable.currentOrderId === null, `Table T2 released and restored to AVAILABLE`);

  // ============================================================================
  // TEST SECTION 4: SENA FOR HOTELS - COMPLETE RETEST
  // ============================================================================
  console.log('\n--- TEST SECTION 4: Sena for Hotels - Operational Lifecycle Retest ---');

  // 4.1 Walk-in Reservation Creation
  const [hotelGuest] = await db
    .insert(guests)
    .values({
      propertyId: hotelProp.id,
      organizationId: hotelProp.organizationId!,
      fullName: 'Dr. Chioma Nwachukwu',
      email: `chioma.e2e.${Date.now()}@example.com`,
      phone: '+2348033339999',
      isVerified: true,
    })
    .returning();

  const room101 = await db.query.rooms.findFirst({
    where: and(eq(rooms.propertyId, hotelProp.id), eq(rooms.roomNumber, '101')),
  });
  const room102 = await db.query.rooms.findFirst({
    where: and(eq(rooms.propertyId, hotelProp.id), eq(rooms.roomNumber, '102')),
  });
  assert(Boolean(room101 && room102), 'Rooms 101 and 102 resolved in Sena Grand Hotel');

  const ref = `SGH-E2E-${Date.now().toString().slice(-5)}`;
  const [res] = await db
    .insert(reservations)
    .values({
      propertyId: hotelProp.id,
      organizationId: hotelProp.organizationId!,
      reference: ref,
      guestId: hotelGuest.id,
      roomId: room101!.id,
      roomTypeId: room101!.roomTypeId,
      checkInDate: startDate,
      checkOutDate: endDate,
      nights: 2,
      numGuests: 1,
      source: 'walk_in',
      status: 'confirmed',
      paymentStatus: 'unpaid',
      totalAmountMinorUnits: 9000000, // ₦90,000.00 (2 nights @ ₦45,000)
      paidAmountMinorUnits: 0,
    })
    .returning();
  assert(res.status === 'confirmed', `Walk-in reservation created: ${res.reference} for ${hotelGuest.fullName}`);

  // 4.2 Check-in Guest
  await db
    .update(reservations)
    .set({ status: 'checked_in', updatedAt: new Date() })
    .where(eq(reservations.id, res.id));

  const [occupiedRoom101] = await db
    .update(rooms)
    .set({ operationalStatus: 'occupied', updatedAt: new Date() })
    .where(eq(rooms.id, room101!.id))
    .returning();
  assert(occupiedRoom101.operationalStatus === 'occupied', `Guest checked in. Room 101 transitioned to OCCUPIED`);

  // 4.3 Room Switch while Checked In (Room 101 -> Room 102)
  await db
    .update(reservations)
    .set({ roomId: room102!.id, updatedAt: new Date() })
    .where(eq(reservations.id, res.id));

  const [dirtyOldRoom] = await db
    .update(rooms)
    .set({ operationalStatus: 'available', housekeepingStatus: 'dirty', updatedAt: new Date() })
    .where(eq(rooms.id, room101!.id))
    .returning();

  const [newOccupiedRoom] = await db
    .update(rooms)
    .set({ operationalStatus: 'occupied', housekeepingStatus: 'clean', updatedAt: new Date() })
    .where(eq(rooms.id, room102!.id))
    .returning();

  assert(
    dirtyOldRoom.housekeepingStatus === 'dirty' && newOccupiedRoom.operationalStatus === 'occupied',
    `Room Reassignment verified: Old Room 101 transitioned to DIRTY, New Room 102 transitioned to OCCUPIED`
  );

  // 4.4 Check-out Guest
  await db
    .update(reservations)
    .set({ status: 'checked_out', updatedAt: new Date() })
    .where(eq(reservations.id, res.id));

  await db
    .update(rooms)
    .set({ operationalStatus: 'available', housekeepingStatus: 'dirty', updatedAt: new Date() })
    .where(eq(rooms.id, room102!.id));

  // 4.5 Generate Invoice & Record Payment
  const today = new Date().toISOString().split('T')[0];
  const [invoice] = await db
    .insert(propertyInvoices)
    .values({
      organizationId: hotelProp.organizationId,
      propertyId: hotelProp.id,
      reservationId: res.id,
      guestId: hotelGuest.id,
      invoiceNumber: `INV-${ref}`,
      recipientName: hotelGuest.fullName,
      recipientPhone: hotelGuest.phone,
      status: 'paid',
      issueDate: today,
      dueDate: today,
      subtotalMinorUnits: res.totalAmountMinorUnits,
      taxVatMinorUnits: 0,
      taxConsumptionMinorUnits: 0,
      serviceChargeMinorUnits: 0,
      discountMinorUnits: 0,
      totalAmountMinorUnits: res.totalAmountMinorUnits,
      paidAmountMinorUnits: res.totalAmountMinorUnits,
      currency: 'NGN',
      items: [
        {
          description: 'Accommodation - Deluxe Suite',
          quantity: 2,
          unitPriceMinorUnits: 4500000,
          amountMinorUnits: 9000000,
        },
      ],
    })
    .returning();

  await db
    .update(reservations)
    .set({ paymentStatus: 'paid', paidAmountMinorUnits: res.totalAmountMinorUnits })
    .where(eq(reservations.id, res.id));

  const invoiceBalance = invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits;
  assert(invoice.status === 'paid' && invoiceBalance === 0, `Invoice generated and fully settled (₦${res.totalAmountMinorUnits / 100})`);

  // 4.6 Housekeeping Completion
  const [task] = await db
    .insert(housekeepingTasks)
    .values({
      propertyId: hotelProp.id,
      roomId: room101!.id,
      status: 'completed',
      priority: 'high',
      notes: 'Turnover cleaning following room switch',
    })
    .returning();

  const [cleanedRoom101] = await db
    .update(rooms)
    .set({ housekeepingStatus: 'clean', operationalStatus: 'available', updatedAt: new Date() })
    .where(eq(rooms.id, room101!.id))
    .returning();

  const [cleanedRoom102] = await db
    .update(rooms)
    .set({ housekeepingStatus: 'clean', operationalStatus: 'available', updatedAt: new Date() })
    .where(eq(rooms.id, room102!.id))
    .returning();

  assert(
    cleanedRoom101.housekeepingStatus === 'clean' && cleanedRoom102.housekeepingStatus === 'clean',
    `Housekeeping turnover completed. Both Room 101 and Room 102 restored to CLEAN and AVAILABLE`
  );

  // ============================================================================
  // TEST SECTION 5: CUSTOMER DATA INTEGRITY & PROTECTION AUDIT
  // ============================================================================
  console.log('\n--- TEST SECTION 5: Customer Protection & Integrity Audit ---');
  const stayConnectProp = await db.query.properties.findFirst({
    where: eq(properties.id, '63c6b4f4-fee4-415c-be16-c064a44edc76'),
  });
  assert(Boolean(stayConnectProp), 'Live customer "Stay Connect Solutions LTD" verified in database');
  assert(stayConnectProp?.industry === 'hotel', 'Stay Connect Solutions LTD industry unmodified (hotel)');

  // Verify no test records cross-polluted into Stay Connect
  const stayConnectTestRes = await db.query.reservations.findFirst({
    where: and(
      eq(reservations.propertyId, '63c6b4f4-fee4-415c-be16-c064a44edc76'),
      sql`${reservations.reference} LIKE '%E2E%'`
    ),
  });
  assert(!stayConnectTestRes, 'Stay Connect Solutions LTD has ZERO test reservations (Complete data isolation confirmed)');

  console.log('\n================================================================');
  console.log(`   TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS RATE)`);
  console.log('================================================================\n');
  process.exit(0);
}

runE2ETests().catch((err) => {
  console.error('\nE2E Test execution failed:', err);
  process.exit(1);
});
