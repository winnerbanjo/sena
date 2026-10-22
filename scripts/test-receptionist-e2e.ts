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
import { db, users, propertyMembers, properties, guests, reservations, roomTypes, rooms, inventory, eq, and } from '@sena/database';
import { ReservationService } from '@sena/reservations';
import { mapReservationItem } from '../apps/dashboard/src/components/reservation-room';
import { encode } from 'next-auth/jwt';
import { authConfig } from '../apps/dashboard/src/auth.config';

const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3015';

async function runReceptionistE2ETest() {
  console.log('======================================================================');
  console.log('  STAY CONNECT RECEPTIONIST UI / API WORKFLOW INTEGRATION TEST');
  console.log('======================================================================');

  // Find Stay Connect Receptionist user
  const [receptionistUser] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: propertyMembers.role,
      propertyId: propertyMembers.propertyId,
    })
    .from(propertyMembers)
    .innerJoin(users, eq(propertyMembers.userId, users.id))
    .where(eq(users.email, 'receptionist@stayconnect.local'))
    .limit(1);

  assert(receptionistUser, 'Stay Connect receptionist user must exist');
  console.log(`[USER] Receptionist: ${receptionistUser.fullName} (${receptionistUser.email})`);
  console.log(`[PROPERTY] Property ID: ${receptionistUser.propertyId}, Role: ${receptionistUser.role}`);

  const [property] = await db.select().from(properties).where(eq(properties.id, receptionistUser.propertyId)).limit(1);
  assert(property, 'Property must exist');

  const [roomType] = await db.select().from(roomTypes).where(eq(roomTypes.propertyId, property.id)).limit(1);
  assert(roomType, 'Room type must exist');

  // Create a guest for this test
  const [guest] = await db
    .insert(guests)
    .values({
      organizationId: property.organizationId,
      propertyId: property.id,
      fullName: 'Babatunde Customer',
      email: 'babatunde@example.com',
      phone: '+2348033334444',
    })
    .returning();

  // Create a confirmed reservation with unique dates
  const randOffset = Math.floor(Math.random() * 300) + 200;
  const d1 = new Date(Date.now() + randOffset * 86400000);
  const d2 = new Date(d1.getTime() + 3 * 86400000);
  const checkInDate = d1.toISOString().slice(0, 10);
  const checkOutDate = d2.toISOString().slice(0, 10);

  const reservation = await ReservationService.create({
    propertyId: property.id,
    guestId: guest.id,
    roomTypeId: roomType.id,
    checkInDate,
    checkOutDate,
    numGuests: 2,
    source: 'direct',
  });

  console.log(`[RESERVATION] Created: ${reservation.reference} (ID: ${reservation.id})`);

  // =========================================================================
  // STEP 1: UI Data Mapping Verification
  // =========================================================================
  console.log('\n--- STEP 1: UI Data Mapping Verification (Task A Root Cause) ---');
  const apiPayload = {
    id: reservation.id,
    reference: reservation.reference,
    guestId: reservation.guestId,
    guestName: guest.fullName,
    guestEmail: guest.email,
    guestPhone: guest.phone,
    roomTypeName: roomType.name,
    roomTypeId: reservation.roomTypeId,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    nights: reservation.nights,
    status: reservation.status as any,
    paymentStatus: reservation.paymentStatus as any,
    totalAmountMinorUnits: reservation.totalAmountMinorUnits,
    paidAmountMinorUnits: reservation.paidAmountMinorUnits,
  };

  const uiItem = mapReservationItem(apiPayload);
  assert.strictEqual(uiItem.guestId, guest.id, 'UI item MUST retain guestId');
  console.log('✓ UI mapping produces non-null guestId:', uiItem.guestId);
  console.log('✓ ReservationDrawer can now open EditGuestDialog with guest profile data');

  // Generate valid authenticated session cookie for receptionist
  const secret = (authConfig.secret || process.env.AUTH_SECRET) as string;
  const salt = 'authjs.session-token';
  const sessionToken = await encode({
    token: {
      id: receptionistUser.id,
      sub: receptionistUser.id,
      name: receptionistUser.fullName,
      email: receptionistUser.email,
      propertyId: receptionistUser.propertyId,
      propertyName: property.name,
      role: receptionistUser.role,
    },
    secret,
    salt,
  });
  const cookieHeader = `${salt}=${sessionToken}; sena_property_id=${property.id}`;

  // =========================================================================
  // STEP 2: Authenticated Receptionist Guest Profile Update (Task A API)
  // =========================================================================
  console.log('\n--- STEP 2: Authenticated Receptionist Profile Edit (Task A) ---');
  const patchUrl = `${BASE_URL}/api/guests/${guest.id}`;
  const patchResponse = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader,
    },
    body: JSON.stringify({
      fullName: 'Babatunde O. Customer Updated',
      email: 'babatunde.updated@example.com',
      phone: '+2348077778888',
      propertyId: property.id,
    }),
  });

  const patchBody = await patchResponse.json();
  console.log(`PATCH /api/guests/${guest.id} response status:`, patchResponse.status);

  assert.strictEqual(patchResponse.status, 200, `Profile update must return 200. Got: ${JSON.stringify(patchBody)}`);
  assert(patchBody.success, 'Profile update must be successful');
  assert.strictEqual(patchBody.guest.fullName, 'Babatunde O. Customer Updated');
  assert.strictEqual(patchBody.guest.email, 'babatunde.updated@example.com');
  console.log('✓ Receptionist successfully updated guest profile via API');

  // Check invalid email validation
  const invalidRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader,
    },
    body: JSON.stringify({ email: 'not-an-email-address', propertyId: property.id }),
  });
  assert.strictEqual(invalidRes.status, 400, 'Invalid email format must return 400');
  console.log('✓ Invalid email format correctly rejected with 400');

  // =========================================================================
  // STEP 3: Authenticated Receptionist Reservation Cancellation (Task B API)
  // =========================================================================
  console.log('\n--- STEP 3: Authenticated Receptionist Cancellation (Task B) ---');
  
  // Check inventory count before cancel
  const [invBefore] = await db
    .select()
    .from(inventory)
    .where(and(eq(inventory.propertyId, property.id), eq(inventory.roomTypeId, roomType.id), eq(inventory.date, checkInDate)));
  const reservedBefore = invBefore?.reservedInventory || 0;
  console.log(`Reserved rooms before cancellation: ${reservedBefore}`);

  const cancelUrl = `${BASE_URL}/api/reservations/${reservation.id}/cancel`;
  const cancelResponse = await fetch(cancelUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader,
    },
    body: JSON.stringify({
      reason: 'Stay Connect customer booking entered by mistake',
      propertyId: property.id,
    }),
  });

  const cancelBody = await cancelResponse.json();
  console.log(`POST /api/reservations/${reservation.id}/cancel response status:`, cancelResponse.status);

  assert.strictEqual(cancelResponse.status, 200, `Cancel must return 200. Got: ${JSON.stringify(cancelBody)}`);
  assert(cancelBody.success, 'Cancellation must succeed');
  console.log('✓ Receptionist successfully cancelled reservation via API:', cancelBody.message);

  // Verify DB state
  const [dbRes] = await db.select().from(reservations).where(eq(reservations.id, reservation.id));
  assert.strictEqual(dbRes.status, 'cancelled');
  assert.strictEqual(dbRes.cancellationReason, 'Stay Connect customer booking entered by mistake');
  assert(dbRes.cancelledAt, 'cancelledAt must be present');
  console.log('✓ Database record confirmed cancelled with reason');

  // Verify inventory restored
  const [invAfter] = await db
    .select()
    .from(inventory)
    .where(and(eq(inventory.propertyId, property.id), eq(inventory.roomTypeId, roomType.id), eq(inventory.date, checkInDate)));
  const reservedAfter = invAfter?.reservedInventory || 0;
  assert.strictEqual(reservedAfter, reservedBefore - 1, 'Inventory must be restored');
  console.log(`✓ Inventory decremented: ${reservedBefore} -> ${reservedAfter}`);

  // =========================================================================
  // STEP 4: Property Isolation Check
  // =========================================================================
  console.log('\n--- STEP 4: Property Isolation Check ---');
  // Find another property
  const otherProperties = await db.select().from(properties).where(eq(properties.organizationId, property.organizationId));
  const otherProperty = otherProperties.find((p) => p.id !== property.id);
  if (otherProperty) {
    const [otherRoomType] = await db.select().from(roomTypes).where(eq(roomTypes.propertyId, otherProperty.id)).limit(1);
    if (otherRoomType) {
      const otherRes = await ReservationService.create({
        propertyId: otherProperty.id,
        guestId: guest.id,
        roomTypeId: otherRoomType.id,
        checkInDate: '2026-11-20',
        checkOutDate: '2026-11-22',
        numGuests: 1,
        source: 'direct',
      });

      // Attempt to cancel other property's reservation with this receptionist
      const crossRes = await fetch(`${BASE_URL}/api/reservations/${otherRes.id}/cancel`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader,
        },
        body: JSON.stringify({ reason: 'Malicious cross-property cancel', propertyId: property.id }),
      });
      assert(crossRes.status === 404 || crossRes.status === 403, 'Cross-property cancellation must be rejected with 403 or 404');
      console.log(`✓ Cross-property cancellation successfully blocked with status ${crossRes.status}`);
    }
  }

  console.log('\n======================================================================');
  console.log('  RECEPTIONIST WORKFLOW INTEGRATION CERTIFIED (100% PASS)');
  console.log('======================================================================\n');
  process.exit(0);
}

runReceptionistE2ETest().catch((err) => {
  console.error('\n❌ RECEPTIONIST E2E TEST FAILED:', err);
  process.exit(1);
});
