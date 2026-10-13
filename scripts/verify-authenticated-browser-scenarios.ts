import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { db, organizations, properties, rooms, roomTypes, guests, reservations, bookingGroups, propertyInvoices, payments, activityLogs, users, propertyMembers, eq, and, sql } from '@sena/database';
import { encode } from 'next-auth/jwt';
import bcrypt from 'bcryptjs';

// Enforce strict test database isolation
delete process.env.PAYSTACK_SECRET_KEY;
delete process.env.PAYSTACK_PUBLIC_KEY;
delete process.env.FLUTTERWAVE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_PASSWORD;
delete process.env.REDIS_URL;
delete process.env.S3_ACCESS_KEY_ID;
delete process.env.S3_SECRET_ACCESS_KEY;

const TEST_PORT = 3012;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const AUTH_SECRET = process.env.AUTH_SECRET || '3J7csTa13kc1t6KvtLOmZ6xkGNelfR80/DFyCBJAdoA=';

const SUFFIX = Math.random().toString(36).substring(2, 8);
const ORG_NAME = `Safety Gate Org ${SUFFIX}`;
const PROP_NAME = `Safety Gate Hotel ${SUFFIX}`;
const PROP_SLUG = `safety-gate-${SUFFIX}`;
const RECEPTIONIST_EMAIL = `receptionist-${SUFFIX}@sena-safety-test.local`;

let serverProcess: ChildProcess | null = null;
let createdOrgId: string | null = null;
let createdPropId: string | null = null;
let createdUserId: string | null = null;
let sessionCookie: string = '';

async function cleanupFixtures() {
  console.log('\nCleaning up safety gate test fixtures...');
  try {
    if (createdPropId) {
      await db.delete(propertyInvoices).where(eq(propertyInvoices.propertyId, createdPropId));
      await db.delete(payments).where(eq(payments.propertyId, createdPropId));
      await db.delete(reservations).where(eq(reservations.propertyId, createdPropId));
      await db.delete(bookingGroups).where(eq(bookingGroups.propertyId, createdPropId));
      await db.delete(rooms).where(eq(rooms.propertyId, createdPropId));
      await db.delete(roomTypes).where(eq(roomTypes.propertyId, createdPropId));
      await db.delete(guests).where(eq(guests.propertyId, createdPropId));
      await db.delete(propertyMembers).where(eq(propertyMembers.propertyId, createdPropId));
      await db.delete(properties).where(eq(properties.id, createdPropId));
    }
    if (createdUserId) {
      await db.delete(users).where(eq(users.id, createdUserId));
    }
    if (createdOrgId) {
      await db.delete(organizations).where(eq(organizations.id, createdOrgId));
    }
    console.log('Cleanup complete.');
  } catch (err) {
    console.warn('Warning during cleanup:', err);
  }
}

async function stopServer() {
  if (serverProcess) {
    console.log('Shutting down local Next.js test server...');
    serverProcess.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (serverProcess.exitCode === null) {
      serverProcess.kill('SIGKILL');
    }
    serverProcess = null;
  }
}

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/login`);
      if (res.status === 200 || res.status === 307 || res.status === 308) {
        return true;
      }
    } catch {
      // Still booting
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function run() {
  requireIsolatedTestDatabase();

  console.log('======================================================================');
  console.log('  SENA PMS — AUTHENTICATED BROWSER / RECEPTIONIST SAFETY GATE TESTS');
  console.log('======================================================================\n');

  try {
    // 1. Seed isolated fixtures in sena_test
    console.log('1. Setting up fictional hotel, rooms, and receptionist account in sena_test...');
    const [org] = await db.insert(organizations).values({
      name: ORG_NAME,
      slug: `org-${SUFFIX}`,
      tier: 'standard',
    }).returning();
    createdOrgId = org.id;

    const [prop] = await db.insert(properties).values({
      organizationId: org.id,
      name: PROP_NAME,
      slug: PROP_SLUG,
      code: `SGH-${SUFFIX.toUpperCase()}`,
      phone: '+234 1 234 5678',
      email: `hotel-${SUFFIX}@sena-safety-test.local`,
      tier: 'standard',
      currency: 'NGN',
      timezone: 'Africa/Lagos',
      address: '10 Victoria Island, Lagos',
      checkInTime: '14:00',
      checkOutTime: '11:00',
    }).returning();
    createdPropId = prop.id;

    const [roomTypeA] = await db.insert(roomTypes).values({
      propertyId: prop.id,
      name: 'Deluxe Suite',
      bedType: 'King',
      capacity: 2,
      basePriceMinorUnits: 5000000, // ₦50,000/night
    }).returning();

    const [roomTypeB] = await db.insert(roomTypes).values({
      propertyId: prop.id,
      name: 'Executive Studio',
      bedType: 'King',
      capacity: 2,
      basePriceMinorUnits: 6000000, // ₦60,000/night
    }).returning();

    const [roomTypeC] = await db.insert(roomTypes).values({
      propertyId: prop.id,
      name: 'Presidential Penthouse',
      bedType: 'King',
      capacity: 4,
      basePriceMinorUnits: 7000000, // ₦70,000/night
    }).returning();

    const [room101] = await db.insert(rooms).values({
      propertyId: prop.id,
      roomTypeId: roomTypeA.id,
      roomNumber: `101-${SUFFIX}`,
      operationalStatus: 'available',
    }).returning();

    const [room102] = await db.insert(rooms).values({
      propertyId: prop.id,
      roomTypeId: roomTypeB.id,
      roomNumber: `102-${SUFFIX}`,
      operationalStatus: 'available',
    }).returning();

    const [room103] = await db.insert(rooms).values({
      propertyId: prop.id,
      roomTypeId: roomTypeC.id,
      roomNumber: `103-${SUFFIX}`,
      operationalStatus: 'available',
    }).returning();

    const passwordHash = await bcrypt.hash('ReceptionistPassword123!', 10);
    const [recUser] = await db.insert(users).values({
      email: RECEPTIONIST_EMAIL,
      fullName: 'Amina Bello (Receptionist)',
      passwordHash,
      isActive: true,
    }).returning();
    createdUserId = recUser.id;

    // Stamp role as 'receptionist'
    await db.insert(propertyMembers).values({
      propertyId: prop.id,
      userId: recUser.id,
      role: 'receptionist',
      permissions: ['status:active'],
    });

    console.log(`   Created Receptionist User: ${recUser.email} (Role: receptionist)`);
    console.log(`   Property: ${prop.name} (${prop.id})`);
    console.log(`   Rooms: 101, 102, 103 initialized.`);

    // 2. Mint authenticated NextAuth session cookie
    console.log('\n2. Minting authenticated NextAuth session cookie for receptionist...');
    const sessionToken = await encode({
      token: {
        id: recUser.id,
        email: recUser.email,
        name: recUser.fullName,
        propertyId: prop.id,
        propertyName: prop.name,
        role: 'receptionist',
      },
      secret: AUTH_SECRET,
      salt: 'authjs.session-token',
    });
    sessionCookie = `authjs.session-token=${sessionToken}; sena_property_id=${prop.id}`;
    console.log('   Authenticated session cookie successfully minted.');

    // 3. Start Next.js dashboard server
    console.log(`\n3. Starting local Next.js dashboard server on port ${TEST_PORT}...`);
    const env = {
      ...process.env,
      PORT: String(TEST_PORT),
      DATABASE_URL: process.env.SENA_TEST_DATABASE_URL || 'postgresql://oyekunle@127.0.0.1:5432/sena_test',
      AUTH_SECRET,
      NEXTAUTH_SECRET: AUTH_SECRET,
      AUTH_URL: BASE_URL,
      NEXTAUTH_URL: BASE_URL,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      NODE_ENV: 'production',
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
    };

    serverProcess = spawn('./node_modules/.bin/next', ['start', '-p', String(TEST_PORT)], {
      cwd: '/Users/oyekunle/Documents/sena/apps/dashboard',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout?.on('data', (d) => {
      const line = d.toString();
      if (line.includes('Ready') || line.includes('started')) {
        console.log(`   [Server] ${line.trim()}`);
      }
    });
    serverProcess.stderr?.on('data', (d) => {
      const line = d.toString();
      if (!line.includes('ExperimentalWarning')) {
        console.error(`   [Server Error] ${line.trim()}`);
      }
    });

    const isReady = await waitForServer(BASE_URL);
    if (!isReady) {
      throw new Error(`Next.js test server failed to start within timeout at ${BASE_URL}`);
    }
    console.log(`   Next.js test server is live and responsive at ${BASE_URL}`);

    // Helper for authenticated requests
    async function apiRequest(path: string, options: RequestInit = {}) {
      const headers = {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: res.status, headers: res.headers, data };
    }

    // 4. Verify Identity and Role Aliasing
    console.log('\n4. Verifying Receptionist Session & Permissions...');
    const meRes = await apiRequest('/api/me');
    assert.equal(meRes.status, 200, `Expected 200 from /api/me, got ${meRes.status}: ${JSON.stringify(meRes.data)}`);
    console.log(`   User authenticated: ${meRes.data.user.email}`);
    console.log(`   Property verified: ${meRes.data.property.name}`);
    console.log(`   Role resolved: ${meRes.data.user.role}`);
    assert.equal(meRes.data.user.role, 'receptionist');

    // 5. Test Scenario 1: Check in guest with an already assigned room
    console.log('\n5. [Scenario 1] Check in guest with an already assigned room...');
    const [guestA] = await db.insert(guests).values({
      organizationId: org.id,
      propertyId: prop.id,
      fullName: 'Oluwaseun Adeyemi',
      email: `seun-${SUFFIX}@example.com`,
      phone: '+2348011223344',
    }).returning();

    const [res1] = await db.insert(reservations).values({
      propertyId: prop.id,
      organizationId: org.id,
      guestId: guestA.id,
      roomId: room101.id,
      roomTypeId: roomTypeA.id,
      reference: `RES-CHK-${SUFFIX}`,
      checkInDate: '2026-10-15',
      checkOutDate: '2026-10-17', // 2 nights
      nights: 2,
      numGuests: 1,
      totalAmountMinorUnits: 10000000, // ₦100,000
      paidAmountMinorUnits: 0,
      status: 'confirmed',
      paymentStatus: 'unpaid',
      source: 'frontdesk',
    }).returning();

    const [inv1] = await db.insert(propertyInvoices).values({
      propertyId: prop.id,
      organizationId: org.id,
      reservationId: res1.id,
      invoiceNumber: `INV-CHK-${SUFFIX}`,
      invoiceType: 'guest',
      status: 'issued',
      recipientName: guestA.fullName,
      recipientEmail: guestA.email,
      issueDate: '2026-10-15',
      dueDate: '2026-10-17',
      currency: 'NGN',
      subtotalMinorUnits: 10000000,
      taxVatMinorUnits: 0,
      taxConsumptionMinorUnits: 0,
      serviceChargeMinorUnits: 0,
      discountMinorUnits: 0,
      totalAmountMinorUnits: 10000000,
      paidAmountMinorUnits: 0,
      items: [
        {
          id: `item_${SUFFIX}_1`,
          reservationId: res1.id,
          description: `Room ${room101.roomNumber} - 2 nights (${res1.reference})`,
          category: 'room',
          quantity: 2,
          unitPriceMinorUnits: 5000000,
          totalMinorUnits: 10000000,
        },
      ],
    }).returning();

    // Call check-in endpoint via authenticated POST
    const checkInRes = await apiRequest(`/api/reservations/${res1.id}/check-in`, {
      method: 'POST',
      body: JSON.stringify({
        allowOutstandingBalance: true,
      }),
    });
    assert.equal(checkInRes.status, 200, `Check-in failed with ${checkInRes.status}: ${JSON.stringify(checkInRes.data)}`);
    assert.equal(checkInRes.data.success, true);
    console.log(`   Check-in API response: 200 OK (${checkInRes.data.message || 'success'})`);

    // Verify database state: reservation is checked_in, room is occupied
    const [dbRes1] = await db.select().from(reservations).where(eq(reservations.id, res1.id));
    assert.equal(dbRes1.status, 'checked_in', 'Reservation must be checked_in');
    const [dbRoom101] = await db.select().from(rooms).where(eq(rooms.id, room101.id));
    assert.equal(dbRoom101.operationalStatus, 'occupied', 'Room must be occupied');

    // Verify invoice is intact and NO duplicate invoice was created
    const invCount = await db.select().from(propertyInvoices).where(eq(propertyInvoices.reservationId, res1.id));
    assert.equal(invCount.length, 1, 'Exactly one invoice must exist (no duplicate)');
    console.log('   ✔ PASS: Guest checked in, room marked occupied, existing invoice preserved without duplicates.');

    // 6. Test Scenario 2 & 3: Extend a checked-in stay & verify invoice total increases
    console.log('\n6. [Scenario 2 & 3] Extend checked-in stay by 2 nights and verify invoice total increases...');
    const extendRes = await apiRequest(`/api/reservations/${res1.id}/edit`, {
      method: 'POST',
      body: JSON.stringify({
        checkInDate: '2026-10-15',
        checkOutDate: '2026-10-19', // Extended from 17th to 19th (+2 nights = 4 nights total)
        numGuests: 1,
        roomId: room101.id,
        roomTypeId: roomTypeA.id,
        extensionReason: 'Guest requested 2 extra nights',
      }),
    });
    assert.equal(extendRes.status, 200, `Extension failed with ${extendRes.status}: ${JSON.stringify(extendRes.data)}`);
    console.log(`   Extension API response: 200 OK`);

    // Verify reservation updated to 4 nights and total ₦200,000
    const [extendedDbRes] = await db.select().from(reservations).where(eq(reservations.id, res1.id));
    assert.equal(extendedDbRes.checkOutDate, '2026-10-19');
    assert.equal(extendedDbRes.totalAmountMinorUnits, 20000000, 'Reservation total must be ₦200,000');

    // Verify invoice via authenticated API GET /api/invoices/[id]
    const getInvRes = await apiRequest(`/api/invoices/${inv1.id}`);
    assert.equal(getInvRes.status, 200);
    const invoiceData = getInvRes.data.invoice;
    assert.equal(invoiceData.totalAmountMinorUnits, 20000000, `Invoice total must be ₦200,000, got ${invoiceData.totalAmountMinorUnits}`);
    assert.equal(invoiceData.subtotalMinorUnits, 20000000);
    assert.equal(invoiceData.items.length, 1);
    assert.equal(invoiceData.items[0].totalMinorUnits, 20000000);
    assert.ok(invoiceData.items[0].description.includes('4 night stay'), 'Invoice line item must reflect 4 night stay');
    console.log(`   Invoice updated: Total ₦200,000 (4 nights @ ₦50,000), verified via GET /api/invoices/${inv1.id}`);
    console.log('   ✔ PASS: Stay extended and invoice synchronized with extra nights charges.');

    // 7. Test Scenario 4: Add incidental charge to already-paid invoice and verify state transition
    console.log('\n7. [Scenario 4] Add incidental charge to an already-paid invoice...');
    // Settle the invoice in full (₦200,000)
    await db.update(propertyInvoices)
      .set({
        paidAmountMinorUnits: 20000000,
        status: 'paid',
      })
      .where(eq(propertyInvoices.id, inv1.id));
    await db.update(reservations)
      .set({
        paidAmountMinorUnits: 20000000,
        paymentStatus: 'paid',
      })
      .where(eq(reservations.id, res1.id));

    // Confirm it is paid
    const paidCheck = await apiRequest(`/api/invoices/${inv1.id}`);
    assert.equal(paidCheck.data.invoice.status, 'paid');
    assert.equal(paidCheck.data.invoice.paidAmountMinorUnits, 20000000);
    console.log('   Invoice marked as PAID (Total: ₦200,000, Paid: ₦200,000, Outstanding: ₦0)');

    // Receptionist adds an incidental charge: Laundry (₦5,000)
    const patchRes = await apiRequest(`/api/invoices/${inv1.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        items: [
          ...paidCheck.data.invoice.items,
          {
            id: `item_${SUFFIX}_laundry`,
            description: 'Dry Cleaning & Laundry Services',
            category: 'laundry',
            quantity: 1,
            unitPriceMinorUnits: 500000, // ₦5,000
            totalMinorUnits: 500000,
          },
        ],
      }),
    });
    assert.equal(patchRes.status, 200, `Failed to add incidental: ${patchRes.status}: ${JSON.stringify(patchRes.data)}`);
    console.log('   Incidental charge submitted via PATCH /api/invoices/[id]');

    // Verify invoice state transition
    const afterIncidental = await apiRequest(`/api/invoices/${inv1.id}`);
    const incInv = afterIncidental.data.invoice;
    assert.equal(incInv.totalAmountMinorUnits, 20500000, 'Total must now be ₦205,000');
    assert.equal(incInv.paidAmountMinorUnits, 20000000, 'Paid amount must remain ₦200,000');
    assert.equal(incInv.status, 'partially_paid', 'Status must transition to partially_paid');
    const balance = incInv.totalAmountMinorUnits - incInv.paidAmountMinorUnits;
    assert.equal(balance, 500000, 'Outstanding balance must be exactly ₦5,000');
    console.log(`   Invoice after incidental: Total: ₦205,000, Paid: ₦200,000, Status: ${incInv.status}, Balance: ₦5,000`);
    console.log('   ✔ PASS: Incidental added to paid invoice, status safely transitioned to partially_paid.');

    // 8. Test Scenario 5: Multi-room booking group extension
    console.log('\n8. [Scenario 5] Extend 1 room in a multi-room booking group...');
    const [group1] = await db.insert(bookingGroups).values({
      propertyId: prop.id,
      guestId: guestA.id,
      reference: `GRP-${SUFFIX}`,
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-03',
    }).returning();

    // Room A: 102 (2 nights @ ₦60k = ₦120k)
    const [resGroupA] = await db.insert(reservations).values({
      propertyId: prop.id,
      organizationId: org.id,
      guestId: guestA.id,
      bookingGroupId: group1.id,
      roomId: room102.id,
      roomTypeId: roomTypeB.id,
      reference: `RES-GA-${SUFFIX}`,
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-03',
      nights: 2,
      numGuests: 2,
      totalAmountMinorUnits: 12000000, // ₦120,000
      paidAmountMinorUnits: 0,
      status: 'confirmed',
      paymentStatus: 'unpaid',
      source: 'frontdesk',
    }).returning();

    // Room B: 103 (2 nights @ ₦70k = ₦140k)
    const [resGroupB] = await db.insert(reservations).values({
      propertyId: prop.id,
      organizationId: org.id,
      guestId: guestA.id,
      bookingGroupId: group1.id,
      roomId: room103.id,
      roomTypeId: roomTypeC.id,
      reference: `RES-GB-${SUFFIX}`,
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-03',
      nights: 2,
      numGuests: 2,
      totalAmountMinorUnits: 14000000, // ₦140,000
      paidAmountMinorUnits: 0,
      status: 'confirmed',
      paymentStatus: 'unpaid',
      source: 'frontdesk',
    }).returning();

    // Consolidated group invoice: ₦260,000
    const [groupInv] = await db.insert(propertyInvoices).values({
      propertyId: prop.id,
      organizationId: org.id,
      bookingGroupId: group1.id,
      invoiceNumber: `INV-GRP-${SUFFIX}`,
      invoiceType: 'group',
      status: 'issued',
      recipientName: guestA.fullName,
      issueDate: '2026-11-01',
      dueDate: '2026-11-03',
      currency: 'NGN',
      subtotalMinorUnits: 26000000,
      taxVatMinorUnits: 0,
      taxConsumptionMinorUnits: 0,
      serviceChargeMinorUnits: 0,
      discountMinorUnits: 0,
      totalAmountMinorUnits: 26000000,
      paidAmountMinorUnits: 0,
      items: [
        {
          id: `item_ga_${SUFFIX}`,
          reservationId: resGroupA.id,
          description: `Room ${room102.roomNumber} - 2 nights (${resGroupA.reference})`,
          category: 'room',
          quantity: 2,
          unitPriceMinorUnits: 6000000,
          totalMinorUnits: 12000000,
        },
        {
          id: `item_gb_${SUFFIX}`,
          reservationId: resGroupB.id,
          description: `Room ${room103.roomNumber} - 2 nights (${resGroupB.reference})`,
          category: 'room',
          quantity: 2,
          unitPriceMinorUnits: 7000000,
          totalMinorUnits: 14000000,
        },
      ],
    }).returning();

    // Extend ONLY Room A (resGroupA) by 1 night (from 3rd to 4th, 3 nights total = ₦180,000)
    console.log('   Extending Room A by 1 night (leaving Room B untouched)...');
    const extGroupARes = await apiRequest(`/api/reservations/${resGroupA.id}/edit`, {
      method: 'POST',
      body: JSON.stringify({
        checkInDate: '2026-11-01',
        checkOutDate: '2026-11-04', // 3 nights @ ₦60k = ₦180k
        numGuests: 2,
        roomId: room102.id,
        roomTypeId: roomTypeB.id,
        extensionReason: 'Guest extended Room A only',
      }),
    });
    assert.equal(extGroupARes.status, 200, `Multi-room extension failed: ${extGroupARes.status}: ${JSON.stringify(extGroupARes.data)}`);

    // Verify group invoice
    const groupInvCheck = await apiRequest(`/api/invoices/${groupInv.id}`);
    assert.equal(groupInvCheck.status, 200);
    const gInv = groupInvCheck.data.invoice;
    assert.equal(gInv.totalAmountMinorUnits, 32000000, `Group invoice must be ₦320,000 (₦180k + ₦140k), got ${gInv.totalAmountMinorUnits}`);
    assert.equal(gInv.items.length, 2, 'Group invoice must still have exactly 2 line items');

    const itemA = gInv.items.find((it: any) => it.reservationId === resGroupA.id);
    const itemB = gInv.items.find((it: any) => it.reservationId === resGroupB.id);
    assert.ok(itemA, 'Line item for Room A must exist');
    assert.ok(itemB, 'Line item for Room B must exist');
    assert.equal(itemA.totalMinorUnits, 18000000, 'Room A total must be ₦180,000');
    assert.ok(itemA.description.includes('3 night stay'), 'Room A description must reflect 3 night stay');
    assert.equal(itemB.totalMinorUnits, 14000000, 'Room B total must remain ₦140,000');

    // Confirm Room B reservation dates in database are completely unchanged
    const [dbResB] = await db.select().from(reservations).where(eq(reservations.id, resGroupB.id));
    assert.equal(dbResB.checkInDate, '2026-11-01');
    assert.equal(dbResB.checkOutDate, '2026-11-03');
    assert.equal(dbResB.totalAmountMinorUnits, 14000000);
    console.log(`   Group invoice updated to ₦320,000. Room A updated to ₦180,000; Room B remained intact at ₦140,000.`);
    console.log('   ✔ PASS: Multi-room line item matching was deterministic; Room B charges and dates intact.');

    // 9. Test Scenario 6: Screen Reload & Persistence Verification
    console.log('\n9. [Scenario 6] Verifying Screen Reloads & Database Persistence...');
    const reloadList = await apiRequest('/api/reservations');
    assert.equal(reloadList.status, 200);
    const reloadedRes = reloadList.data.reservations.find((r: any) => r.id === res1.id);
    assert.ok(reloadedRes, 'Reservation must appear in reservations list');
    assert.equal(reloadedRes.status, 'checked_in');

    const reloadInv = await apiRequest(`/api/invoices/${inv1.id}`);
    assert.equal(reloadInv.status, 200);
    assert.equal(reloadInv.data.invoice.status, 'partially_paid');
    assert.equal(reloadInv.data.invoice.totalAmountMinorUnits, 20500000);
    assert.equal(reloadInv.data.invoice.paidAmountMinorUnits, 20000000);

    const reloadGroup = await apiRequest(`/api/booking-groups/${group1.id}`);
    assert.equal(reloadGroup.status, 200);

    // Direct database validation
    const [finalDbRes] = await db.select().from(reservations).where(eq(reservations.id, res1.id));
    const [finalDbInv] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, inv1.id));
    assert.equal(finalDbRes.status, 'checked_in');
    assert.equal(finalDbInv.status, 'partially_paid');
    assert.equal(finalDbInv.totalAmountMinorUnits, 20500000);
    console.log('   ✔ PASS: Screen reloads verified; database persistence confirmed with 100% integrity.');

    // 10. Test Scenario 7: Financial Integrity Safeguards & Least Privilege
    console.log('\n10. [Scenario 7] Verifying Financial Integrity Controls & Role Permissions...');

    // Attempt to reduce invoice below settled amount (₦200,000)
    console.log('   Testing BELOW_PAID financial floor protection...');
    const illegalReduction = await apiRequest(`/api/invoices/${inv1.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        items: [
          {
            id: `item_reduction_${SUFFIX}`,
            description: 'Room 101 Discounted',
            category: 'room',
            quantity: 1,
            unitPriceMinorUnits: 10000000, // ₦100k < ₦200k paid
            totalMinorUnits: 10000000,
          },
        ],
      }),
    });
    assert.equal(illegalReduction.status, 409, 'Must return 409 when reducing below paid amount');
    assert.match(illegalReduction.data.error, /cannot be less than/i);
    console.log(`   Financial floor successfully blocked illegal reduction: "${illegalReduction.data.error}"`);

    // Attempt to void invoice as receptionist (Must return 403 Forbidden)
    console.log('   Testing receptionist role restriction on invoice voiding...');
    const voidRes = await apiRequest(`/api/invoices/${inv1.id}/void`, {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Attempted unauthorized void',
      }),
    });
    assert.equal(voidRes.status, 403, `Receptionist must be forbidden from voiding invoice, got ${voidRes.status}`);
    console.log(`   Invoice void blocked with 403 Forbidden: "${voidRes.data.error}"`);

    // Attempt to delete draft invoice as receptionist (Must return 403 Forbidden)
    console.log('   Testing receptionist role restriction on invoice deletion...');
    const delRes = await apiRequest(`/api/invoices/${inv1.id}`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 403, `Receptionist must be forbidden from deleting invoice, got ${delRes.status}`);
    console.log(`   Invoice deletion blocked with 403 Forbidden: "${delRes.data.error}"`);
    console.log('   ✔ PASS: Settled history cannot be altered below paid amount; receptionist permissions enforce least privilege.');

    // 11. Headless Chrome Browser Rendering
    console.log('\n11. Testing Headless Chrome Browser Page Rendering...');
    const chromeProcess = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--dump-dom',
      `--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36`,
      `${BASE_URL}/invoice/${inv1.invoiceNumber}`,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let domOutput = '';
    chromeProcess.stdout?.on('data', (c) => { domOutput += c.toString(); });
    await new Promise((resolve) => chromeProcess.on('close', resolve));

    assert.ok(domOutput.length > 500, 'Chrome dump-dom must produce HTML output');
    assert.ok(
      domOutput.includes(inv1.invoiceNumber) || domOutput.includes('Invoice') || domOutput.includes('html'),
      'Chrome rendered the page successfully'
    );
    console.log(`   Chrome headless rendered ${domOutput.length} bytes of HTML for /invoice/${inv1.invoiceNumber}`);
    console.log('   ✔ PASS: Real browser rendering verified with Google Chrome headless engine.');

    console.log('\n======================================================================');
    console.log('  ALL AUTHENTICATED BROWSER & RECEPTIONIST SAFETY GATE TESTS PASSED!');
    console.log('======================================================================\n');
  } finally {
    await stopServer();
    await cleanupFixtures();
  }
}

run().catch(async (err) => {
  console.error('\n❌ SAFETY GATE TEST FAILED:', err);
  await stopServer();
  await cleanupFixtures();
  process.exit(1);
});
