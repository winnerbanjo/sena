import { Client } from 'pg';

const PROD_URL = 'https://app.sena.ng';
const DB_URL = process.env.DATABASE_URL || '';

async function verifyProductionE2E() {
  console.log('====================================================');
  console.log('  SENA WEBSITE ENGINE V1: PRODUCTION E2E VERIFICATION ');
  console.log('====================================================\n');

  // Connect to DB to fetch IDs
  const isRemote = DB_URL.includes('ondigitalocean.com') || DB_URL.includes('sslmode=require');
  const client = new Client({
    connectionString: DB_URL.replace('?sslmode=require', ''),
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  try {
    // 1. Fetch Property Details
    const grandRes = await client.query("SELECT * FROM properties WHERE slug = 'sena-grand'");
    const grand = grandRes.rows[0];
    const coastRes = await client.query("SELECT * FROM properties WHERE slug = 'sena-coast'");
    const coast = coastRes.rows[0];

    const grandRooms = await client.query('SELECT * FROM room_types WHERE property_id = $1', [grand.id]);
    const coastRooms = await client.query('SELECT * FROM room_types WHERE property_id = $1', [coast.id]);

    console.log(`[TARGET 1] Sena Grand Hotel (ID: ${grand.id})`);
    console.log(`[TARGET 2] Sena Coast Resort (ID: ${coast.id})`);

    // 2. Fetch and verify Sena Grand Website HTML
    console.log('\n--- 1. VERIFY SENA GRAND PUBLIC WEBSITE ---');
    const grandHtmlRes = await fetch(`${PROD_URL}/site/sena-grand`);
    if (grandHtmlRes.status !== 200) {
      throw new Error(`Expected 200 on /site/sena-grand, got ${grandHtmlRes.status}`);
    }
    const grandHtml = await grandHtmlRes.text();
    console.log(`[PASS] HTTP 200 received from ${PROD_URL}/site/sena-grand (${grandHtml.length} bytes)`);

    if (!grandHtml.includes('Sena Grand Hotel')) throw new Error('Missing "Sena Grand Hotel"');
    if (!grandHtml.includes('An Editorial Sanctuary of Quiet Luxury')) throw new Error('Missing headline');
    if (!grandHtml.includes('Deluxe King Room')) throw new Error('Missing room category');
    if (!grandHtml.includes('Babatunde Fashola')) throw new Error('Missing verified review');
    console.log('[PASS] Sena Grand branding, rooms, and reviews rendered accurately.');

    // Cross-tenant Isolation check
    if (grandHtml.includes('Sena Coast Resort') || grandHtml.includes('Oceanview Pool Villa')) {
      throw new Error('ISOLATION FAILURE: Sena Coast Resort leaked into Sena Grand!');
    }
    console.log('[PASS] ZERO leakage of Sena Coast content in Sena Grand.');

    // 3. Fetch and verify Sena Coast Website HTML
    console.log('\n--- 2. VERIFY SENA COAST PUBLIC WEBSITE ---');
    const coastHtmlRes = await fetch(`${PROD_URL}/site/sena-coast`);
    if (coastHtmlRes.status !== 200) {
      throw new Error(`Expected 200 on /site/sena-coast, got ${coastHtmlRes.status}`);
    }
    const coastHtml = await coastHtmlRes.text();
    console.log(`[PASS] HTTP 200 received from ${PROD_URL}/site/sena-coast (${coastHtml.length} bytes)`);

    if (!coastHtml.includes('Sena Coast Resort')) throw new Error('Missing "Sena Coast Resort"');
    if (!coastHtml.includes('Where Coastal Calm Meets Modern Craft')) throw new Error('Missing headline');
    if (!coastHtml.includes('Oceanview Pool Villa')) throw new Error('Missing villa room');
    if (!coastHtml.includes('Kemi Adeleke')) throw new Error('Missing coastal review');
    console.log('[PASS] Sena Coast branding, rooms, and reviews rendered accurately.');

    if (coastHtml.includes('Sena Grand Hotel') || coastHtml.includes('Deluxe King Room')) {
      throw new Error('ISOLATION FAILURE: Sena Grand leaked into Sena Coast!');
    }
    console.log('[PASS] ZERO leakage of Sena Grand content in Sena Coast.');

    // 4. Verify Sub-Pages
    console.log('\n--- 3. VERIFY SUB-PAGES ---');
    for (const sub of ['rooms', 'about', 'reviews', 'gallery', 'contact']) {
      const res = await fetch(`${PROD_URL}/site/sena-grand/${sub}`);
      if (res.status !== 200) throw new Error(`Subpage /site/sena-grand/${sub} returned ${res.status}`);
      console.log(`[PASS] Subpage /site/sena-grand/${sub} -> HTTP 200`);
    }

    // 5. Test Live Booking Hold API in Production
    console.log('\n--- 4. TEST LIVE 10-MINUTE HOLD API ---');
    const targetRoom = grandRooms.rows[0];
    const checkInDate = '2026-11-10';
    const checkOutDate = '2026-11-12';

    const holdApiRes = await fetch(`${PROD_URL}/api/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: grand.id,
        roomTypeId: targetRoom.id,
        checkInDate,
        checkOutDate,
        quantity: 1,
        guestName: 'Production E2E Guest',
        guestEmail: 'e2e@sena.ng',
      }),
    });

    const holdData = await holdApiRes.json();
    if (!holdApiRes.ok || !holdData.success || !holdData.holdId) {
      throw new Error(`Hold API failed: ${JSON.stringify(holdData)}`);
    }
    console.log(`[PASS] Hold created successfully: holdId=${holdData.holdId}, expiresAt=${holdData.expiresAt}`);

    // 6. Test Live Checkout API in Production
    console.log('\n--- 5. TEST LIVE CHECKOUT API ---');
    const checkoutRes = await fetch(`${PROD_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        holdId: holdData.holdId,
        propertyId: grand.id,
        roomTypeId: targetRoom.id,
        checkInDate,
        checkOutDate,
        numGuests: 2,
        guestName: 'Production E2E Guest',
        guestEmail: 'e2e-guest@sena.ng',
        guestPhone: '+234 802 000 1234',
        paymentMethod: 'direct',
      }),
    });

    const checkoutData = await checkoutRes.json();
    if (!checkoutRes.ok || !checkoutData.success || !checkoutData.reservation) {
      throw new Error(`Checkout API failed: ${JSON.stringify(checkoutData)}`);
    }
    console.log(`[PASS] Direct booking completed! Reference: ${checkoutData.reservation.reference}`);

    // Verify in database that reservation exists and payment was recorded
    const resvCheck = await client.query('SELECT * FROM reservations WHERE reference = $1', [checkoutData.reservation.reference]);
    if (resvCheck.rows.length === 0) throw new Error('Reservation not found in DB!');
    console.log(`[PASS] Database confirms reservation ID: ${resvCheck.rows[0].id} (Total: ₦${(resvCheck.rows[0].total_amount_minor_units / 100).toLocaleString()})`);

    const payCheck = await client.query('SELECT * FROM payments WHERE reservation_id = $1', [resvCheck.rows[0].id]);
    if (payCheck.rows.length === 0) throw new Error('Payment not recorded!');
    console.log(`[PASS] Database confirms payment record: Ref: ${payCheck.rows[0].provider_reference}, Status: ${payCheck.rows[0].status}`);

    // 7. Test Review Submission API in Production
    console.log('\n--- 6. TEST LIVE REVIEW SUBMISSION API ---');
    const reviewRes = await fetch(`${PROD_URL}/api/reviews/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'sena-grand',
        guestName: 'Production QA Tester',
        rating: 5,
        title: 'Verified E2E Direct Stay',
        body: 'Smooth booking engine experience, instant hold confirmation, and flawless website rendering.',
      }),
    });

    const reviewData = await reviewRes.json();
    if (!reviewRes.ok || !reviewData.success) {
      throw new Error(`Review submit failed: ${JSON.stringify(reviewData)}`);
    }
    console.log(`[PASS] Review submitted successfully! ID: ${reviewData.review.id}`);

    // Verify review in DB
    const revCheck = await client.query('SELECT * FROM reviews WHERE id = $1', [reviewData.review.id]);
    if (revCheck.rows.length === 0) throw new Error('Review not found in DB!');
    console.log(`[PASS] Database confirms review status: ${revCheck.rows[0].status}`);

    // Clean up QA test data
    await client.query('DELETE FROM payments WHERE reservation_id = $1', [resvCheck.rows[0].id]);
    await client.query('DELETE FROM reservations WHERE id = $1', [resvCheck.rows[0].id]);
    await client.query('DELETE FROM reviews WHERE id = $1', [reviewData.review.id]);
    console.log('[PASS] Test fixtures cleaned up from DB cleanly.');

    console.log('\n🎉 ALL PRODUCTION END-TO-END VERIFICATIONS PASSED WITH ZERO DEFECTS!');
  } finally {
    await client.end();
  }
}

verifyProductionE2E().catch((err) => {
  console.error('Production Verification Failed:', err);
  process.exit(1);
});
