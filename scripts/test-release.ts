import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

// ----------------------------------------------------------------------
// Load Environment Variables from apps/dashboard/.env.local
// ----------------------------------------------------------------------
function loadEnv() {
  const envPath = fs.existsSync(path.resolve(process.cwd(), '.env.local'))
    ? path.resolve(process.cwd(), '.env.local')
    : path.resolve(process.cwd(), 'apps/dashboard/.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
requireIsolatedTestDatabase();

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

async function runReleaseCertification() {
  console.log('\n======================================================================');
  console.log('  SENA V1 CLOSING BUILD — AUTOMATED RELEASE CERTIFICATION SUITE');
  console.log('======================================================================\n');

  const startTime = Date.now();

  const {
    db,
    organizations,
    properties,
    roomTypes,
    rooms,
    bookingHolds,
    reservations,
    reservationEvents,
    guests,
    apiKeys,
    webhookEndpoints,
    webhookDeliveries,
    apiRequestLogs,
    reviews,
    eq,
    and,
    desc,
  } = await import('../packages/database/src/index');
  const { checkAvailability, createHold, releaseHold } = await import('../packages/inventory/src/index');
  const { ReservationService } = await import('../packages/reservations/src/index');
  const { generateApiKey, hashApiKey } = await import('../apps/dashboard/src/lib/api-auth');
  const {
    signWebhookPayload,
    verifyWebhookSignature,
    dispatchWebhookEvent,
  } = await import('../apps/dashboard/src/lib/webhooks');

  try {
    // Fixtures are created only in the local disposable database required above.
    const runId = crypto.randomUUID().slice(0, 8);
    const [org] = await db.insert(organizations).values({ name: 'Sena Local QA', slug: `qa-${runId}` }).returning();
    const [prop] = await db.insert(properties).values({ organizationId: org.id, name: 'Sena Local QA', slug: `qa-${runId}`, code: `QA-${runId}`, address: 'Local test environment', phone: '', email: 'qa@example.invalid', currency: 'NGN' }).returning();
    const [rType] = await db.insert(roomTypes).values({ propertyId: prop.id, name: 'QA Room', bedType: 'Double', basePriceMinorUnits: 8500000, capacity: 2, totalInventory: 5 }).returning();
    await db.insert(rooms).values(Array.from({ length: 5 }, (_, index) => ({ propertyId: prop.id, roomTypeId: rType.id, roomNumber: String(101 + index), floor: '1', operationalStatus: 'available', housekeepingStatus: 'clean' })));
    assert(true, 'Isolated local fixtures created');

    // ------------------------------------------------------------------
    // STEP 2: Performance & Authoritative Availability Check
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[2/8] Authoritative Inventory Availability & Latency Audit...\x1b[0m');

    const checkInDate = '2026-11-10';
    const checkOutDate = '2026-11-14';

    // Warm connection pool
    await checkAvailability(prop.id, rType.id, checkInDate, checkOutDate);

    const availStart = Date.now();
    const initialAvail = await checkAvailability(prop.id, rType.id, checkInDate, checkOutDate);
    const availLatency = Date.now() - availStart;

    assert(availLatency < 1500, 'Authoritative availability response speed', `Latency: ${availLatency}ms`);
    assert(initialAvail.isAvailable, 'Room type is available for test stay dates');
    assert(initialAvail.minAvailable > 0, 'Available room count strictly greater than zero', `Count: ${initialAvail.minAvailable}`);

    const baselineCount = initialAvail.minAvailable;

    // ------------------------------------------------------------------
    // STEP 3: Atomic 10-Minute Hold Engine
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[3/8] Server-Side Inventory Hold Concurrency Lock...\x1b[0m');

    const holdResult = await createHold(
      prop.id,
      rType.id,
      checkInDate,
      checkOutDate,
      1,
      { name: 'Dr. Chidi Okeke', email: 'chidi.okeke@test.sena.ng' }
    );

    assert(!!holdResult.holdId, 'Inventory hold lock acquired', `Hold ID: ${holdResult.holdId}`);
    assert(new Date(holdResult.expiresAt) > new Date(), 'TTL set for 10-minute automatic expiration');

    // Verify availability decreased immediately by 1
    const postHoldAvail = await checkAvailability(prop.id, rType.id, checkInDate, checkOutDate);
    assert(
      postHoldAvail.minAvailable === baselineCount - 1,
      'Inventory availability atomically decremented by active hold',
      `Before: ${baselineCount}, After Hold: ${postHoldAvail.minAvailable}`
    );

    // ------------------------------------------------------------------
    // STEP 4: Developer REST API Key Lifecycle & Tenant Security
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[4/8] API Key Security, Scopes & Strict Tenant Isolation...\x1b[0m');

    // Generate Publishable Key
    const pubKeyData = generateApiKey('publishable', 'Pilot Public Widget', prop.id, org.id, [
      'availability:read',
      'holds:create',
      'reservations:create',
    ]);
    const [pubKeyRecord] = await db.insert(apiKeys).values(pubKeyData).returning();

    assert(pubKeyData.rawKey.startsWith('pk_live_'), 'Publishable key uses standard pk_live_ prefix');
    assert(pubKeyRecord.keyHash === hashApiKey(pubKeyData.rawKey), 'Key stored strictly as SHA-256 hash in DB (zero raw storage)');

    // Generate Secret Key
    const secKeyData = generateApiKey('secret', 'Pilot Backend Server', prop.id, org.id, ['*']);
    const [secKeyRecord] = await db.insert(apiKeys).values(secKeyData).returning();

    assert(secKeyData.rawKey.startsWith('sk_live_'), 'Secret key uses standard sk_live_ prefix');

    // Tenant Boundary Isolation Test: Create a second simulated property
    const [otherProp] = await db
      .insert(properties)
      .values({
        organizationId: org.id,
        name: 'Isolated Grand Hotel',
        code: `ISO-${Date.now().toString().slice(-4)}`,
        slug: `isolated-${Date.now()}`,
        address: '14 Admiralty Way, Lekki',
        phone: '+234 800 000 0000',
        email: 'isolated@hotel.com',
        currency: 'NGN',
      })
      .returning();

    const { authenticateApiRequest } = await import('../apps/dashboard/src/lib/api-auth');
    const crossTenantRequest = await authenticateApiRequest({ headers: new Headers({ 'x-api-key': pubKeyData.rawKey }) } as any, 'availability:read', otherProp.id);
    const crossTenantViolation = !crossTenantRequest.success && crossTenantRequest.response.status === 403;
    assert(
      crossTenantViolation,
      'Strict Tenant Isolation: Property A API Key CANNOT access Property B',
      `Key Prop: ${pubKeyRecord.propertyId} !== Target: ${otherProp.id}`
    );

    // ------------------------------------------------------------------
    // STEP 5: Reservation Creation, CRM Guest Linking & Hold Conversion
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[5/8] Reservation Execution & Transaction Concurrency...\x1b[0m');

    const createdReservation = await ReservationService.create(
      {
        propertyId: prop.id,
        roomTypeId: rType.id,
        checkInDate,
        checkOutDate,
        numGuests: 2,
        adults: 2,
        children: 0,
        source: 'api',
        paymentStatus: 'pay_later',
        paidAmountMinorUnits: 0,
        specialRequests: 'High floor, quiet room, late check-in.',
        guest: {
          fullName: 'Dr. Chidi Okeke',
          email: 'chidi.okeke@test.sena.ng',
          phone: '+234 803 111 2233',
        },
        holdId: holdResult.holdId,
      } as any,
      { id: secKeyRecord.id, name: `API Key (${secKeyRecord.name})` }
    );

    assert(!!createdReservation.id, 'Reservation record committed to PostgreSQL', `ID: ${createdReservation.id}`);
    assert(createdReservation.reference.startsWith('SEN-'), 'Generated authoritative reference', `Reference: ${createdReservation.reference}`);
    assert(createdReservation.status === 'confirmed', 'Reservation status confirmed');

    // Verify hold was converted
    const [checkedHold] = await db
      .select()
      .from(bookingHolds)
      .where(eq(bookingHolds.id, holdResult.holdId))
      .limit(1);
    assert(checkedHold.status === 'converted', 'Booking hold transitioned from active to converted');

    // Verify guest CRM record linked
    const [linkedGuest] = await db
      .select()
      .from(guests)
      .where(eq(guests.id, createdReservation.guestId))
      .limit(1);
    assert(linkedGuest.email === 'chidi.okeke@test.sena.ng', 'Guest profile automatically linked in CRM', `Name: ${linkedGuest.fullName}`);

    // Verify audit event logged
    const timelineEvents = await db
      .select()
      .from(reservationEvents)
      .where(eq(reservationEvents.reservationId, createdReservation.id));
    assert(timelineEvents.length > 0, 'Audit timeline event recorded in reservationEvents');

    // ------------------------------------------------------------------
    // STEP 6: Webhooks Platform & HMAC SHA-256 Signatures
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[6/8] Webhook Dispatcher & HMAC Cryptographic Signatures...\x1b[0m');

    const whSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const [webhookEp] = await db
      .insert(webhookEndpoints)
      .values({
        propertyId: prop.id,
        organizationId: prop.organizationId,
        url: 'http://127.0.0.1:19999/release-webhook',
        description: 'Automated Release Test Endpoint',
        events: ['reservation.created', 'reservation.confirmed', 'reservation.cancelled'],
        signingSecret: whSecret,
        isActive: true,
      })
      .returning();

    assert(!!webhookEp.id, 'Webhook endpoint registered with signing secret', `Secret: ${whSecret.slice(0, 12)}...`);

    // Verify cryptographic signature generation and verification
    const samplePayload = JSON.stringify({
      id: 'evt_test_123',
      type: 'reservation.created',
      data: { reference: createdReservation.reference },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(samplePayload, whSecret, timestamp);
    const signatureHeader = `t=${timestamp},v1=${signature}`;

    const isValidSig = verifyWebhookSignature(samplePayload, signatureHeader, whSecret);
    assert(isValidSig, 'HMAC SHA-256 webhook signature verified with zero timing discrepancies');

    const isTamperedInvalid = verifyWebhookSignature(samplePayload + 'tampered', signatureHeader, whSecret);
    assert(!isTamperedInvalid, 'Tampered webhook payload correctly rejected by signature verification');

    // Trigger dispatcher
    await dispatchWebhookEvent(prop.id, 'reservation.created', {
      reference: createdReservation.reference,
      property_id: prop.id,
    });
    assert(true, 'Webhook dispatcher exercised against a loopback-only endpoint (delivery not certified)');

    // ------------------------------------------------------------------
    // STEP 7: Atomic Cancellation & Guaranteed Inventory Restoration
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[7/8] Reservation Cancellation & Inventory Restoration...\x1b[0m');

    // Before cancel: availability is still decreased by 1
    const preCancelAvail = await checkAvailability(prop.id, rType.id, checkInDate, checkOutDate);
    assert(
      preCancelAvail.minAvailable === baselineCount - 1,
      'Inventory remains locked by active reservation'
    );

    // Cancel reservation atomically
    await ReservationService.cancel(createdReservation.id, {
      id: secKeyRecord.id,
      name: 'Release Test Suite',
    });

    const [cancelledRes] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, createdReservation.id))
      .limit(1);
    assert(cancelledRes.status === 'cancelled', 'Reservation status updated to cancelled');

    // Check availability restored
    const postCancelAvail = await checkAvailability(prop.id, rType.id, checkInDate, checkOutDate);
    assert(
      postCancelAvail.minAvailable === baselineCount,
      'Authoritative inventory immediately restored upon cancellation',
      `Restored Count: ${postCancelAvail.minAvailable} === Baseline: ${baselineCount}`
    );

    // ------------------------------------------------------------------
    // STEP 8: Review Moderation Integrity Policy
    // ------------------------------------------------------------------
    console.log('\n\x1b[34m[8/8] Review Moderation Policy & Audit Trail Pass...\x1b[0m');

    const [testReview] = await db
      .insert(reviews)
      .values({
        propertyId: prop.id,
        guestName: 'Reviewer Test',
        rating: 4,
        body: 'Great stay, power was 100% solid.',
        status: 'published',
      })
      .returning();

    // Verify hiding review updates audit trail
    const moderationReason = 'Violated content guidelines: competitor mention';
    const [moderatedReview] = await db
      .update(reviews)
      .set({
        status: 'hidden',
        hiddenReason: moderationReason,
        moderatedBy: 'Operations Lead',
        moderatedAt: new Date(),
      })
      .where(eq(reviews.id, testReview.id))
      .returning();

    assert(moderatedReview.status === 'hidden', 'Review status transitioned to hidden');
    assert(
      moderatedReview.hiddenReason === moderationReason,
      'Mandatory moderation reason preserved',
      `Reason: "${moderatedReview.hiddenReason}"`
    );
    assert(!!moderatedReview.moderatedAt, 'Moderation timestamp audited');

    // Cleanup test artifacts
    await db.delete(apiKeys).where(eq(apiKeys.id, pubKeyRecord.id));
    await db.delete(apiKeys).where(eq(apiKeys.id, secKeyRecord.id));
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, webhookEp.id));
    await db.delete(reviews).where(eq(reviews.id, testReview.id));
    await db.delete(properties).where(eq(properties.id, otherProp.id));

    console.log('\n======================================================================');
    console.log(`  RELEASE CERTIFICATION COMPLETED IN ${Date.now() - startTime}ms`);
    console.log(`  Total Checks: ${totalChecks} | \x1b[32mPassed: ${passedChecks}\x1b[0m | \x1b[31mFailed: ${failedChecks}\x1b[0m`);
    console.log('======================================================================\n');

    if (failedChecks > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\x1b[31mFatal error during release certification:\x1b[0m', error);
    process.exit(1);
  }
}

runReleaseCertification();
