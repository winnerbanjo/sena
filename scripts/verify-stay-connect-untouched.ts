/**
 * Read-only proof that Stay Connect production data was not touched by the
 * accommodation switching or reservation removal work.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

function productionUrl(): string {
  const explicit = process.env.SENA_PRODUCTION_DATABASE_URL;
  if (explicit) return explicit;
  const envPath = '/Users/oyekunle/Documents/Documents - Oyekunle’s MacBook Pro/sena/.env';
  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((entry) => entry.trim().startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL not found');
  return line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
}

async function run() {
  const requireFromDatabase = createRequire(`${process.cwd()}/packages/database/package.json`);
  const postgres = requireFromDatabase('postgres');

  const url = productionUrl();
  if (!url.includes('sslmode=require')) throw new Error('expected the read-only production URL');

  const sql = postgres(url, { max: 1, connect_timeout: 20 });
  try {
    // Belt and braces: this session refuses to write anything.
    await sql`SET default_transaction_read_only = on`;

    const [counts] = await sql`
      SELECT
        (SELECT count(*)::int FROM reservations) AS reservations,
        (SELECT count(*)::int FROM reservations WHERE property_id = '63c6b4f4-fee4-415c-be16-c064a44edc76'::uuid) AS stay_connect,
        (SELECT count(*)::int FROM payments) AS payments,
        (SELECT count(*)::int FROM property_invoices) AS invoices,
        (SELECT count(*)::int FROM reservations WHERE status = 'voided') AS voided
    `;
    const [nalsa] = await sql`SELECT id, room_id, status FROM reservations WHERE reference = 'SEN-NALSAU'`;
    const [room3022] = await sql`SELECT room_number, operational_status, housekeeping_status FROM rooms WHERE room_number = '3022'`;

    console.log('Stay Connect read-only verification');
    console.log(`  reservations         ${counts.reservations}`);
    console.log(`  stay_connect source  ${counts.stay_connect}`);
    console.log(`  payments             ${counts.payments}`);
    console.log(`  invoices             ${counts.invoices}`);
    console.log(`  voided               ${counts.voided}`);
    console.log(`  SEN-NALSAU room_id   ${nalsa.room_id === null ? 'NULL (unchanged)' : nalsa.room_id}`);
    console.log(`  Room 3022            ${room3022.operational_status}/${room3022.housekeeping_status}`);

    assert.equal(counts.reservations, 47, 'production reservation count must be unchanged');
    assert.equal(counts.stay_connect, 19, 'Stay Connect reservation count must be unchanged');
    assert.equal(counts.payments, 32, 'production payment count must be unchanged');
    assert.equal(counts.invoices, 21, 'production invoice count must be unchanged');
    assert.equal(counts.voided, 0, 'no production reservation may be voided');
    assert.equal(nalsa.room_id, null, 'SEN-NALSAU must still be unassigned');
    console.log('\nSTAY CONNECT MUTATED: NO');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});