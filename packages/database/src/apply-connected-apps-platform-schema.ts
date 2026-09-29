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
  console.log('Applying Connected Apps platform schema...');

  try {
    const sql = readFileSync(
      resolve(__dirname, '../drizzle/0006_connected_apps_platform.sql'),
      'utf8'
    );
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await client.query(trimmed);
    }
    console.log('Connected Apps platform schema applied.');
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
