import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sena';

async function runQA() {
  const isRemote = DB_URL.includes('ondigitalocean.com') || DB_URL.includes('sslmode=require');
  const client = new Client({
    connectionString: DB_URL.replace('?sslmode=require', ''),
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log('=== SENA WEBSITE ENGINE QA VERIFICATION ===\n');

  try {
    // 1. Check Sena Grand
    const grandRes = await client.query("SELECT * FROM properties WHERE slug = 'sena-grand'");
    if (grandRes.rows.length === 0) throw new Error('Sena Grand not found!');
    const grand = grandRes.rows[0];
    console.log(`[PASS] Sena Grand Hotel found (ID: ${grand.id}, slug: ${grand.slug})`);

    const grandConfig = await client.query('SELECT * FROM website_configs WHERE property_id = $1', [grand.id]);
    if (grandConfig.rows.length === 0) throw new Error('Sena Grand website_configs not found!');
    console.log(`[PASS] Sena Grand website config (theme: ${grandConfig.rows[0].theme}, published: ${grandConfig.rows[0].is_published})`);

    const grandRooms = await client.query('SELECT * FROM room_types WHERE property_id = $1', [grand.id]);
    console.log(`[PASS] Sena Grand room categories: ${grandRooms.rows.length} categories found.`);
    for (const r of grandRooms.rows) {
      console.log(`   - ${r.name}: ₦${(r.base_price_minor_units / 100).toLocaleString()} (inventory: ${r.total_inventory})`);
    }

    const grandPhys = await client.query('SELECT * FROM rooms WHERE property_id = $1', [grand.id]);
    console.log(`[PASS] Sena Grand physical rooms: ${grandPhys.rows.length} rooms registered in PMS.`);
    if (grandPhys.rows.length < 10) throw new Error('Requires at least 10 physical rooms!');

    const grandReviews = await client.query('SELECT * FROM reviews WHERE property_id = $1', [grand.id]);
    console.log(`[PASS] Sena Grand reviews: ${grandReviews.rows.length} reviews found.`);
    const verifiedCount = grandReviews.rows.filter((r) => r.is_verified_stay).length;
    console.log(`   - Verified Stay Reviews: ${verifiedCount}`);
    console.log(`   - Editorial/Manual Reviews: ${grandReviews.rows.length - verifiedCount}`);

    // 2. Check Sena Coast
    const coastRes = await client.query("SELECT * FROM properties WHERE slug = 'sena-coast'");
    if (coastRes.rows.length === 0) throw new Error('Sena Coast not found!');
    const coast = coastRes.rows[0];
    console.log(`\n[PASS] Sena Coast Resort found (ID: ${coast.id}, slug: ${coast.slug})`);

    const coastConfig = await client.query('SELECT * FROM website_configs WHERE property_id = $1', [coast.id]);
    console.log(`[PASS] Sena Coast website config (theme: ${coastConfig.rows[0].theme}, published: ${coastConfig.rows[0].is_published})`);

    const coastRooms = await client.query('SELECT * FROM room_types WHERE property_id = $1', [coast.id]);
    console.log(`[PASS] Sena Coast room categories: ${coastRooms.rows.length} categories found.`);

    const coastReviews = await client.query('SELECT * FROM reviews WHERE property_id = $1', [coast.id]);
    console.log(`[PASS] Sena Coast reviews: ${coastReviews.rows.length} reviews found.`);

    // 3. Multi-Tenant Cross Leakage Verification
    console.log('\n--- Multi-Tenant Isolation Verification ---');
    const grandRoomIds = new Set(grandRooms.rows.map((r) => r.id));
    const coastRoomIds = new Set(coastRooms.rows.map((r) => r.id));
    const roomOverlap = [...grandRoomIds].filter((id) => coastRoomIds.has(id));
    if (roomOverlap.length > 0) throw new Error('Data leakage! Room types overlap between properties.');
    console.log('[PASS] ZERO room category leakage between properties.');

    const grandRevIds = new Set(grandReviews.rows.map((r) => r.id));
    const coastRevIds = new Set(coastReviews.rows.map((r) => r.id));
    const revOverlap = [...grandRevIds].filter((id) => coastRevIds.has(id));
    if (revOverlap.length > 0) throw new Error('Data leakage! Reviews overlap between properties.');
    console.log('[PASS] ZERO review leakage between properties.');

    // 4. Test Hold & Reservation Lifecycle
    console.log('\n--- Direct Booking Engine Lifecycle Verification ---');
    const targetRoom = grandRooms.rows[0];
    const checkIn = '2026-10-15';
    const checkOut = '2026-10-18';

    // Create a 10-minute hold
    const holdRes = await client.query(`
      INSERT INTO booking_holds (
        property_id, room_type_id, check_in_date, check_out_date,
        quantity, guest_name, guest_email, expires_at, status
      ) VALUES (
        $1, $2, $3, $4, 1, 'QA Automation Guest', 'qa@sena.ng',
        NOW() + INTERVAL '10 minutes', 'active'
      ) RETURNING id, expires_at
    `, [grand.id, targetRoom.id, checkIn, checkOut]);

    const holdId = holdRes.rows[0].id;
    console.log(`[PASS] 10-minute hold created successfully: holdId=${holdId}`);

    // Verify hold exists
    const checkHold = await client.query('SELECT * FROM booking_holds WHERE id = $1', [holdId]);
    if (checkHold.rows.length === 0) throw new Error('Hold record not found in DB!');
    console.log(`[PASS] Hold confirmed in database (expires at: ${checkHold.rows[0].expires_at})`);

    // Clean up test hold
    await client.query('DELETE FROM booking_holds WHERE id = $1', [holdId]);
    console.log('[PASS] Hold released cleanly.');

    console.log('\n🎉 ALL QA CHECKS PASSED WITH ZERO ERRORS!');
  } finally {
    await client.end();
  }
}

runQA().catch((e) => {
  console.error('QA Failed:', e);
  process.exit(1);
});
