import { Client } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sena';

async function migrate() {
  const isRemote =
    connectionString.includes('ondigitalocean.com') ||
    connectionString.includes('sslmode=require');

  const client = new Client({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log('Applying apartment archive schema...');

  try {
    const sql = readFileSync(resolve(__dirname, '../drizzle/0010_apartment_archive.sql'), 'utf8');
    await client.query(sql);
    console.log('Apartment archive schema applied.');
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Apartment archive schema failed.');
  process.exit(1);
});
