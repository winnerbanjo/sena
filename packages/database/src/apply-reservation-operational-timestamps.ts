import { Client } from 'pg';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const envPath of [
    resolve(__dirname, '../../../apps/booking/.env.local'),
    resolve(__dirname, '../../../.env'),
    resolve(__dirname, '../../.env'),
  ]) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      const match = content.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
      if (match) return match[1];
    }
  }
  throw new Error('DATABASE_URL not found');
}

const connectionString = getDatabaseUrl();

async function migrate() {
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
        rejectUnauthorized: false,
      };
    }
  }

  const client = new Client({
    connectionString: connectionString.replace(/\?sslmode=(require|verify-full)/, ''),
    ssl,
  });

  await client.connect();
  console.log('Applying reservation operational timestamps schema (0015_reservation_operational_timestamps.sql)...');

  try {
    const sql = readFileSync(resolve(__dirname, '../drizzle/0015_reservation_operational_timestamps.sql'), 'utf8');
    await client.query('BEGIN;');
    await client.query("SET LOCAL lock_timeout = '2s';");
    await client.query("SET LOCAL statement_timeout = '5s';");
    await client.query(sql);
    await client.query('COMMIT;');
    console.log('Reservation operational timestamps applied successfully with lock_timeout and statement_timeout safeguards.');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
