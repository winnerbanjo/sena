import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../apps/dashboard/.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}

const isRemoteDb = connectionString.includes('ondigitalocean.com') || connectionString.includes('sslmode=require');
const sql = postgres(connectionString, {
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
  max: 1,
});

async function main() {
  console.log('Running gym enhancements schema migration...');

  await sql`
    CREATE TABLE IF NOT EXISTS gym_leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(255),
      source VARCHAR(100) NOT NULL DEFAULT 'walk_in',
      status VARCHAR(50) NOT NULL DEFAULT 'new',
      trial_date VARCHAR(10),
      assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      loss_reason TEXT,
      converted_member_id UUID REFERENCES gym_members(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log('gym_leads table ensured.');

  await sql`
    CREATE INDEX IF NOT EXISTS gym_leads_prop_status_idx ON gym_leads (property_id, status);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS gym_leads_created_idx ON gym_leads (property_id, created_at);
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS gym_subscription_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      subscription_id UUID NOT NULL REFERENCES gym_subscriptions(id) ON DELETE CASCADE,
      member_id UUID NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
      action VARCHAR(50) NOT NULL,
      details TEXT,
      performed_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log('gym_subscription_history table ensured.');

  await sql`
    CREATE INDEX IF NOT EXISTS gym_sub_hist_sub_idx ON gym_subscription_history (subscription_id);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS gym_sub_hist_member_idx ON gym_subscription_history (member_id);
  `;

  console.log('Migration completed successfully.');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
