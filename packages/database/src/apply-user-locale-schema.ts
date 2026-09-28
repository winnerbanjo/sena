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
  console.log('Applying user locale schema...');

  try {
    const sql = readFileSync(resolve(__dirname, '../drizzle/0004_user_locale.sql'), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await client.query(trimmed);
    }
    console.log('User locale schema applied.');
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
