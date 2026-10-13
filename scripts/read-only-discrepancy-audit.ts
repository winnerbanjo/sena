import { db, sql } from '@sena/database';

async function generateDiscrepancyReport() {
  console.log('======================================================================');
  console.log('  SENA PMS — READ-ONLY INVOICE & STAY EXTENSION DISCREPANCY AUDIT');
  console.log('  Target Customer: Stay Connect (Property: 63c6b4f4-fee4-415c-be16-c064a44edc76)');
  console.log('  Execution Mode: STRICTLY READ-ONLY (SELECT QUERIES ONLY, ZERO MUTATIONS)');
  console.log('======================================================================\n');

  const stayConnectPropId = '63c6b4f4-fee4-415c-be16-c064a44edc76';

  // 1. Audit Standalone Reservation Invoices
  console.log('--- 1. Auditing Standalone Reservation Invoices vs Reservation Totals ---');
  const standaloneDiscrepancies = await db.execute(sql`
    SELECT
      i.id AS invoice_id,
      i.invoice_number,
      i.property_id,
      i.status AS invoice_status,
      i.total_amount_minor_units AS invoice_total,
      i.paid_amount_minor_units AS invoice_paid,
      r.id AS reservation_id,
      r.reference AS reservation_ref,
      r.status AS reservation_status,
      r.check_in_date,
      r.check_out_date,
      r.nights,
      r.total_amount_minor_units AS reservation_total,
      r.paid_amount_minor_units AS reservation_paid,
      (r.total_amount_minor_units - i.total_amount_minor_units) AS variance_minor_units
    FROM property_invoices i
    JOIN reservations r ON i.reservation_id = r.id
    WHERE (i.property_id = ${stayConnectPropId} OR i.property_id IN (
      SELECT id FROM properties WHERE name ILIKE '%Stay Connect%'
    ))
    AND i.total_amount_minor_units != r.total_amount_minor_units
    ORDER BY i.created_at DESC;
  `);

  console.log(`Standalone invoices with financial variance: ${standaloneDiscrepancies.length}`);
  if (standaloneDiscrepancies.length > 0) {
    for (const row of standaloneDiscrepancies) {
      const anonInvId = `${String(row.invoice_id).substring(0, 8)}...${String(row.invoice_id).substring(32)}`;
      const anonResId = `${String(row.reservation_id).substring(0, 8)}...${String(row.reservation_id).substring(32)}`;
      console.log(`  - Invoice [${row.invoice_number} / ${anonInvId}]:`);
      console.log(`    Reservation [${row.reservation_ref} / ${anonResId}]: ${row.check_in_date} to ${row.check_out_date} (${row.nights} nights)`);
      console.log(`    Invoice Total: ₦${(Number(row.invoice_total) / 100).toLocaleString()} | Reservation Total: ₦${(Number(row.reservation_total) / 100).toLocaleString()}`);
      console.log(`    Variance: ₦${(Number(row.variance_minor_units) / 100).toLocaleString()} (Status: ${row.invoice_status})`);
    }
  } else {
    console.log('  No standalone invoice variances found for Stay Connect.');
  }

  // 2. Audit Booking Group Consolidated Invoices
  console.log('\n--- 2. Auditing Booking Group Consolidated Invoices vs Group Reservations ---');
  const groupDiscrepancies = await db.execute(sql`
    WITH group_reservation_totals AS (
      SELECT
        booking_group_id,
        COUNT(id) AS room_count,
        SUM(total_amount_minor_units) AS expected_rooms_total,
        SUM(paid_amount_minor_units) AS total_res_paid
      FROM reservations
      WHERE booking_group_id IS NOT NULL
      GROUP BY booking_group_id
    )
    SELECT
      i.id AS invoice_id,
      i.invoice_number,
      i.property_id,
      i.status AS invoice_status,
      i.total_amount_minor_units AS invoice_total,
      i.paid_amount_minor_units AS invoice_paid,
      g.id AS booking_group_id,
      g.reference AS group_reference,
      grt.room_count,
      grt.expected_rooms_total,
      (grt.expected_rooms_total - i.total_amount_minor_units) AS variance_minor_units
    FROM property_invoices i
    JOIN booking_groups g ON i.booking_group_id = g.id
    JOIN group_reservation_totals grt ON grt.booking_group_id = g.id
    WHERE (i.property_id = ${stayConnectPropId} OR i.property_id IN (
      SELECT id FROM properties WHERE name ILIKE '%Stay Connect%'
    ))
    AND i.total_amount_minor_units != grt.expected_rooms_total
    ORDER BY i.created_at DESC;
  `);

  console.log(`Group invoices with financial variance: ${groupDiscrepancies.length}`);
  if (groupDiscrepancies.length > 0) {
    for (const row of groupDiscrepancies) {
      const anonInvId = `${String(row.invoice_id).substring(0, 8)}...${String(row.invoice_id).substring(32)}`;
      const anonGrpId = `${String(row.booking_group_id).substring(0, 8)}...${String(row.booking_group_id).substring(32)}`;
      console.log(`  - Group Invoice [${row.invoice_number} / ${anonInvId}]:`);
      console.log(`    Booking Group [${row.group_reference} / ${anonGrpId}] (${row.room_count} rooms):`);
      console.log(`    Invoice Total: ₦${(Number(row.invoice_total) / 100).toLocaleString()} | Expected Rooms Total: ₦${(Number(row.expected_rooms_total) / 100).toLocaleString()}`);
      console.log(`    Variance: ₦${(Number(row.variance_minor_units) / 100).toLocaleString()} (Status: ${row.invoice_status})`);
    }
  } else {
    console.log('  No group invoice variances found for Stay Connect.');
  }

  // 3. Audit Stay Extension Events vs Invoice Updates
  console.log('\n--- 3. Auditing Stay Extension Events vs Invoices ---');
  const extensionEvents = await db.execute(sql`
    SELECT
      e.id AS event_id,
      e.reservation_id,
      e.event_type,
      e.created_at,
      r.property_id,
      r.reference AS res_ref,
      r.total_amount_minor_units AS res_total,
      i.id AS invoice_id,
      i.invoice_number,
      i.total_amount_minor_units AS inv_total
    FROM reservation_events e
    JOIN reservations r ON e.reservation_id = r.id
    LEFT JOIN property_invoices i ON (i.reservation_id = r.id OR i.booking_group_id = r.booking_group_id)
    WHERE (r.property_id = ${stayConnectPropId} OR r.property_id IN (
      SELECT id FROM properties WHERE name ILIKE '%Stay Connect%'
    ))
    AND e.event_type ILIKE '%extend%'
    ORDER BY e.created_at DESC;
  `);

  console.log(`Extension events recorded: ${extensionEvents.length}`);

  // 4. Global System-wide Discrepancy Overview
  console.log('\n--- 4. System-wide Invoice-Reservation Discrepancy Overview ---');
  const systemDiscrepancies = await db.execute(sql`
    SELECT
      COUNT(i.id) AS total_invoices,
      COUNT(CASE WHEN i.total_amount_minor_units != r.total_amount_minor_units THEN 1 END) AS mismatched_invoices,
      COALESCE(SUM(CASE WHEN i.total_amount_minor_units != r.total_amount_minor_units THEN ABS(r.total_amount_minor_units - i.total_amount_minor_units) ELSE 0 END), 0) AS total_absolute_variance_minor_units
    FROM property_invoices i
    JOIN reservations r ON i.reservation_id = r.id;
  `);

  console.log('System-wide Standalone Invoices:', systemDiscrepancies[0]);

  console.log('\n======================================================================');
  console.log('  READ-ONLY AUDIT COMPLETE — ZERO DATABASE MUTATIONS EXECUTED');
  console.log('======================================================================\n');
}

generateDiscrepancyReport().catch(console.error);
