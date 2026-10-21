import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

let Client: any;
try {
  Client = require('pg').Client;
} catch {
  Client = require(resolve(__dirname, '../packages/database/node_modules/pg')).Client;
}

async function runPreflight() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('FATAL: DATABASE_URL environment variable is required to run preflight check.');
    process.exit(1);
  }

  // Parse connection string safely to display host/database without exposing credentials
  let safeHost = '';
  let safeDb = '';
  try {
    const parsed = new URL(connectionString);
    safeHost = parsed.hostname;
    safeDb = parsed.pathname.replace(/^\//, '');
  } catch {
    safeHost = 'unknown';
  }

  const isRemote =
    connectionString.includes('ondigitalocean.com') ||
    connectionString.includes('sslmode=require') ||
    connectionString.includes('sslmode=verify-full');

  let ssl: any = false;
  if (isRemote) {
    const caCertPath = process.env.CA_CERT_PATH || process.env.PGSSLROOTCERT;
    if (caCertPath && existsSync(caCertPath)) {
      ssl = {
        rejectUnauthorized: true,
        ca: readFileSync(caCertPath, 'utf8'),
      };
    } else {
      ssl = {
        rejectUnauthorized: true,
      };
    }
  }

  const client = new Client({
    connectionString: connectionString.replace(/\?sslmode=(require|verify-full)/, ''),
    ssl,
    statement_timeout: 5000,
  });

  console.log('======================================================================');
  console.log('  SENA PRODUCTION POSTGRESQL — READ-ONLY PREFLIGHT VERIFICATION');
  console.log(`  Target Host: ${safeHost}`);
  console.log('  Mode: STRICTLY READ-ONLY (No Mutations, No DDL)');
  console.log('======================================================================\n');

  await client.connect();

  try {
    // 1. Current Database & Version
    console.log('--- 1. Database Identity ---');
    const dbRes = await client.query('SELECT current_database(), current_user, version();');
    console.table(dbRes.rows);

    // 2. Column definitions for public.reservations & public.users
    console.log('\n--- 2. Schema Columns: public.reservations ---');
    const resCols = await client.query(`
      SELECT column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reservations'
      ORDER BY ordinal_position;
    `);
    console.table(resCols.rows);

    console.log('\n--- 2b. Schema Columns: public.users ---');
    const userCols = await client.query(`
      SELECT column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.table(userCols.rows);

    // 3. Confirm users.id UUID and constraints
    console.log('\n--- 3. Constraints on users.id ---');
    const userConstraints = await client.query(`
      SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = 'users' AND kcu.column_name = 'id';
    `);
    console.table(userConstraints.rows);

    // 4. Confirm no column name collision on reservations
    console.log('\n--- 4. Existing Cancellation Columns on reservations ---');
    const cancelCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reservations'
        AND column_name IN ('cancellation_reason', 'cancelled_at', 'cancelled_by', 'cancelled_by_user_id');
    `);
    if (cancelCols.rows.length === 0) {
      console.log('✓ None of the cancellation audit columns exist yet. Clean migration target.');
    } else {
      console.table(cancelCols.rows);
    }

    // 5. Existing foreign keys on reservations
    console.log('\n--- 5. Foreign Key Constraints on reservations ---');
    const fkRes = await client.query(`
      SELECT conname AS constraint_name, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'reservations' AND c.contype = 'f';
    `);
    console.table(fkRes.rows);

    // 6. Active locking contention / long queries
    console.log('\n--- 6. Active Queries & Potential Locking Contention on reservations ---');
    const lockRes = await client.query(`
      SELECT pid, age(clock_timestamp(), query_start) AS duration, state, query
      FROM pg_stat_activity
      WHERE query ILIKE '%reservations%' AND pid != pg_backend_pid()
      ORDER BY query_start ASC
      LIMIT 10;
    `);
    if (lockRes.rows.length === 0) {
      console.log('✓ No active queries or lock contention on reservations table.');
    } else {
      console.table(lockRes.rows);
    }

    console.log('\n======================================================================');
    console.log('  PREFLIGHT VERIFICATION COMPLETE');
    console.log('======================================================================\n');
  } finally {
    await client.end();
  }
}

runPreflight().catch((err) => {
  console.error('Preflight error:', err?.message || err);
  process.exit(1);
});
