import { db, sql } from '../packages/database/src';

const dbUrl = process.env.DATABASE_URL || 'postgresql://oyekunle@127.0.0.1:5432/sena_test';

if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost') && !dbUrl.includes('sena_test')) {
  console.error('SAFETY BLOCK: Rehearsal script must only run on local sena_test database!');
  process.exit(1);
}

async function rehearse() {
  console.log('============================================================');
  console.log('MIGRATION 0012 -> 0013 REHEARSAL & IDEMPOTENCY TEST');
  console.log('Target: Local sena_test database (isolated schema)');
  console.log('============================================================\n');

  try {
    // 1. Setup isolated rehearsal schema
    console.log('Step 1: Creating isolated rehearsal schema...');
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS rehearsal_migration;`);

    // 2. Create tables in 0012 state (immediately BEFORE 0013)
    console.log('Step 2: Provisioning pre-0013 (0012) schema tables...');
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rehearsal_migration.booking_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reference VARCHAR(50) NOT NULL
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rehearsal_migration.reservations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reference VARCHAR(50) NOT NULL,
        total_amount_minor_units INTEGER NOT NULL,
        paid_amount_minor_units INTEGER NOT NULL DEFAULT 0,
        booking_group_id UUID REFERENCES rehearsal_migration.booking_groups(id) ON DELETE SET NULL
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rehearsal_migration.property_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'issued',
        total_amount_minor_units INTEGER NOT NULL,
        paid_amount_minor_units INTEGER NOT NULL DEFAULT 0
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rehearsal_migration.payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        amount_minor_units INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'successful'
      );
    `);

    // 3. Seed historical records (simulating existing production records)
    console.log('Step 3: Seeding historical pre-0013 records...');
    const resResult = await db.execute(sql`
      INSERT INTO rehearsal_migration.reservations (reference, total_amount_minor_units, paid_amount_minor_units)
      VALUES ('SEN-HIST01', 15000000, 5000000)
      RETURNING *;
    `);

    const invResult = await db.execute(sql`
      INSERT INTO rehearsal_migration.property_invoices (invoice_number, status, total_amount_minor_units, paid_amount_minor_units)
      VALUES ('INV-HIST01', 'issued', 15000000, 5000000)
      RETURNING *;
    `);

    const pmtResult = await db.execute(sql`
      INSERT INTO rehearsal_migration.payments (amount_minor_units, status)
      VALUES (5000000, 'successful')
      RETURNING *;
    `);

    const resRow = (resResult as any)[0];
    const invRow = (invResult as any)[0];
    const pmtRow = (pmtResult as any)[0];

    console.log(`Historical Reservation: ${resRow.reference}, Total: ₦${resRow.total_amount_minor_units / 100}`);
    console.log(`Historical Invoice: ${invRow.invoice_number}, Total: ₦${invRow.total_amount_minor_units / 100}`);
    console.log(`Historical Payment: ₦${pmtRow.amount_minor_units / 100}\n`);

    // 4. Apply 0013 migration script
    console.log('Step 4: Applying 0013_flexible_invoicing DDL & DML for the first time...');
    
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.property_invoices 
        ADD COLUMN IF NOT EXISTS booking_group_id UUID REFERENCES rehearsal_migration.booking_groups(id) ON DELETE SET NULL;
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.property_invoices 
        ADD COLUMN IF NOT EXISTS void_reason TEXT;
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.property_invoices 
        ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE;
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.property_invoices 
        ADD COLUMN IF NOT EXISTS voided_by_user_id UUID;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS invoices_booking_group_idx 
        ON rehearsal_migration.property_invoices (booking_group_id);
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.reservations 
        ADD COLUMN IF NOT EXISTS standard_amount_minor_units INTEGER DEFAULT 0 NOT NULL;
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.reservations 
        ADD COLUMN IF NOT EXISTS discount_amount_minor_units INTEGER DEFAULT 0 NOT NULL;
    `);
    await db.execute(sql`
      UPDATE rehearsal_migration.reservations 
        SET standard_amount_minor_units = total_amount_minor_units 
        WHERE standard_amount_minor_units = 0 AND total_amount_minor_units > 0;
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.payments 
        ADD COLUMN IF NOT EXISTS booking_group_id UUID REFERENCES rehearsal_migration.booking_groups(id) ON DELETE SET NULL;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS payments_booking_group_idx 
        ON rehearsal_migration.payments (booking_group_id);
    `);

    console.log('✓ Migration applied successfully.\n');

    // 5. Verification of schema and data integrity
    console.log('Step 5: Verifying data integrity of historical records...');
    const resAfterRes = await db.execute(sql`
      SELECT * FROM rehearsal_migration.reservations WHERE id = ${resRow.id};
    `);
    const invAfterRes = await db.execute(sql`
      SELECT * FROM rehearsal_migration.property_invoices WHERE id = ${invRow.id};
    `);
    const pmtAfterRes = await db.execute(sql`
      SELECT * FROM rehearsal_migration.payments WHERE id = ${pmtRow.id};
    `);

    const resAfter = (resAfterRes as any)[0];
    const invAfter = (invAfterRes as any)[0];
    const pmtAfter = (pmtAfterRes as any)[0];

    console.log(`Reservation: standardAmount=${resAfter.standard_amount_minor_units}, discountAmount=${resAfter.discount_amount_minor_units}, totalAmount=${resAfter.total_amount_minor_units}`);
    console.log(`Invoice: bookingGroupId=${invAfter.booking_group_id}, voidReason=${invAfter.void_reason}, voidedAt=${invAfter.voided_at}`);
    console.log(`Payment: bookingGroupId=${pmtAfter.booking_group_id}`);

    const resCheck = resAfter.standard_amount_minor_units === 15000000 && resAfter.discount_amount_minor_units === 0;
    const invCheck = invAfter.booking_group_id === null && invAfter.void_reason === null && invAfter.voided_at === null;
    const pmtCheck = pmtAfter.booking_group_id === null;

    if (!resCheck || !invCheck || !pmtCheck) {
      throw new Error('Historical data integrity check failed!');
    }
    console.log('✓ All existing reservations, invoices, and payments remain readable and correctly mapped.');
    console.log('✓ NULL booking_group_id is valid for historical records.');
    console.log('✓ Non-destructive automatic backfill populated standard_amount_minor_units from total_amount_minor_units.\n');

    // 6. Test accidental second execution (Idempotency)
    console.log('Step 6: Testing accidental duplicate execution (Idempotency test)...');
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.property_invoices 
        ADD COLUMN IF NOT EXISTS booking_group_id UUID REFERENCES rehearsal_migration.booking_groups(id) ON DELETE SET NULL;
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.property_invoices 
        ADD COLUMN IF NOT EXISTS void_reason TEXT;
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.property_invoices 
        ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE;
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.property_invoices 
        ADD COLUMN IF NOT EXISTS voided_by_user_id UUID;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS invoices_booking_group_idx 
        ON rehearsal_migration.property_invoices (booking_group_id);
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.reservations 
        ADD COLUMN IF NOT EXISTS standard_amount_minor_units INTEGER DEFAULT 0 NOT NULL;
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.reservations 
        ADD COLUMN IF NOT EXISTS discount_amount_minor_units INTEGER DEFAULT 0 NOT NULL;
    `);
    await db.execute(sql`
      UPDATE rehearsal_migration.reservations 
        SET standard_amount_minor_units = total_amount_minor_units 
        WHERE standard_amount_minor_units = 0 AND total_amount_minor_units > 0;
    `);
    await db.execute(sql`
      ALTER TABLE rehearsal_migration.payments 
        ADD COLUMN IF NOT EXISTS booking_group_id UUID REFERENCES rehearsal_migration.booking_groups(id) ON DELETE SET NULL;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS payments_booking_group_idx 
        ON rehearsal_migration.payments (booking_group_id);
    `);

    console.log('✓ Second execution succeeded with 0 errors.');

    const resSecondRes = await db.execute(sql`
      SELECT * FROM rehearsal_migration.reservations WHERE id = ${resRow.id};
    `);
    const resSecond = (resSecondRes as any)[0];
    if (resSecond.standard_amount_minor_units !== 15000000) {
      throw new Error('Idempotency corrupted values!');
    }
    console.log('✓ Data intact after duplicate execution.\n');

  } finally {
    console.log('Step 7: Cleaning up rehearsal schema...');
    await db.execute(sql`DROP SCHEMA IF EXISTS rehearsal_migration CASCADE;`);
    console.log('Cleanup complete.');
  }

  console.log('\n============================================================');
  console.log('MIGRATION REHEARSAL RESULT: PASS ✓');
  console.log('============================================================\n');
  process.exit(0);
}

rehearse().catch((err) => {
  console.error('FATAL REHEARSAL FAILURE:', err);
  process.exit(1);
});
