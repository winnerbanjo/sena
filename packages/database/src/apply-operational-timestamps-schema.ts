import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from './index';

async function main() {
  console.log('Applying additive columns for operational timestamps...');
  await db.execute(sql`
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS actual_check_in_at TIMESTAMP WITH TIME ZONE;
  `);
  await db.execute(sql`
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS actual_check_out_at TIMESTAMP WITH TIME ZONE;
  `);
  console.log('Operational timestamps columns ensured successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to apply schema migration:', err);
  process.exit(1);
});
