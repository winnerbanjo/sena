import { Client } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sena';

async function migrate() {
  if (connectionString.includes('ondigitalocean.com') || connectionString.includes('sslmode=require')) {
    throw new Error('Refusing to apply booking groups schema to a remote database from this script.');
  }

  const client = new Client({ connectionString, ssl: false });
  await client.connect();
  console.log('Applying booking groups schema to the local database...');
  try {
    const sql = readFileSync(resolve(__dirname, '../drizzle/0012_booking_groups.sql'), 'utf8');
    await client.query(sql);
    console.log('Booking groups schema applied.');
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Booking groups schema failed.');
  process.exit(1);
});
