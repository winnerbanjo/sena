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
  console.log('Applying flexible invoicing schema (0013_flexible_invoicing.sql)...');

  try {
    const sql = readFileSync(resolve(__dirname, '../drizzle/0013_flexible_invoicing.sql'), 'utf8');
    await client.query(sql);
    console.log('Flexible invoicing schema applied successfully.');
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Flexible invoicing schema failed.');
  process.exit(1);
});
