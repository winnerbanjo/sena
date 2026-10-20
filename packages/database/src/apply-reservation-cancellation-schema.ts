import { Client } from 'pg';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const envPath of [resolve(__dirname, '../../../.env'), resolve(__dirname, '../../.env')]) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      const match = content.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
      if (match) return match[1];
    }
  }
  return 'postgresql://postgres:postgres@localhost:5432/sena';
}

const connectionString = getDatabaseUrl();

async function migrate() {
  const isRemote =
    connectionString.includes('ondigitalocean.com') ||
    connectionString.includes('sslmode=require');

  const client = new Client({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log('Applying reservation cancellation schema (0014_reservation_cancellation.sql)...');

  try {
    const sql = readFileSync(resolve(__dirname, '../drizzle/0014_reservation_cancellation.sql'), 'utf8');
    await client.query('BEGIN;');
    await client.query("SET LOCAL lock_timeout = '2s';");
    await client.query("SET LOCAL statement_timeout = '5s';");
    await client.query(sql);
    await client.query('COMMIT;');
    console.log('Reservation cancellation schema applied successfully with lock_timeout and statement_timeout safeguards.');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Reservation cancellation schema failed.');
  process.exit(1);
});
