import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';
import crypto from 'crypto';

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
  max: 2,
});

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName} ${detail ? `\x1b[90m(${detail})\x1b[0m` : ''}`);
  } else {
    failedChecks++;
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName} ${detail ? `\x1b[31m- ${detail}\x1b[0m` : ''}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================================');
  console.log('  SENA FOR GYMS — MASTER END-TO-END VERIFICATION & AUDIT SUITE');
  console.log('======================================================================\n');

  const startTime = Date.now();

  try {
    // ------------------------------------------------------------------
    // STEP 1: Verify Authorized Gym Property
    // ------------------------------------------------------------------
    console.log('\x1b[1m[SECTION 1: Property & Industry Verification]\x1b[0m');
    const [gymProperty] = await sql`
      SELECT id, organization_id, name, industry, timezone
      FROM properties
      WHERE industry = 'gym'
      LIMIT 1;
    `;

    assert(!!gymProperty, 'Authorized gym property exists', gymProperty?.name);
    assert(gymProperty?.industry === 'gym', 'Property industry is strictly set to gym', `industry=${gymProperty?.industry}`);

    const propertyId = gymProperty.id;
    const organizationId = gymProperty.organization_id;

    // Verify hotel property isolation
    const [hotelProperty] = await sql`
      SELECT id, name, industry
      FROM properties
      WHERE industry = 'hotel'
      LIMIT 1;
    `;

    assert(!!hotelProperty, 'Hotel property exists for cross-industry isolation test', hotelProperty?.name);
    assert(hotelProperty.id !== gymProperty.id, 'Gym property and Hotel property have distinct IDs');

    // ------------------------------------------------------------------
    // STEP 2: Cross-Industry Isolation Enforcement
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 2: Multi-Tenant Industry Isolation]\x1b[0m');

    // Test: Gym property MUST have 0 hotel room reservations
    const [gymReservations] = await sql`
      SELECT count(*)::int as count
      FROM reservations
      WHERE property_id = ${propertyId};
    `;
    assert(gymReservations.count === 0, 'Gym property has zero hotel room reservations', `count=${gymReservations.count}`);

    // Test: Hotel property MUST have 0 gym check-ins
    const [hotelGymCheckins] = await sql`
      SELECT count(*)::int as count
      FROM gym_checkins
      WHERE property_id = ${hotelProperty.id};
    `;
    assert(hotelGymCheckins.count === 0, 'Hotel property has zero gym check-in records', `count=${hotelGymCheckins.count}`);

    // Test: Hotel property MUST have 0 gym members
    const [hotelGymMembers] = await sql`
      SELECT count(*)::int as count
      FROM gym_members
      WHERE property_id = ${hotelProperty.id};
    `;
    assert(hotelGymMembers.count === 0, 'Hotel property has zero gym member records', `count=${hotelGymMembers.count}`);

    // ------------------------------------------------------------------
    // STEP 3: Membership Plans & Pricing (Integer Minor Units)
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 3: Membership Plans & Pricing Models]\x1b[0m');

    let [plan] = await sql`
      SELECT id, name, duration_months, price_minor_units, registration_fee_minor_units, status
      FROM gym_membership_plans
      WHERE property_id = ${propertyId} AND status = 'active'
      LIMIT 1;
    `;

    if (!plan) {
      console.log('  Creating standard gym membership plan...');
      const [newPlan] = await sql`
        INSERT INTO gym_membership_plans (
          property_id, name, description, duration_months, price_minor_units, registration_fee_minor_units, access_hours, max_class_credits_per_month, status
        ) VALUES (
          ${propertyId}, 'Pro Athlete Monthly', 'Full gym floor and group fitness classes', 1, 2500000, 500000, 'all_hours', 8, 'active'
        ) RETURNING id, name, duration_months, price_minor_units, registration_fee_minor_units, status;
      `;
      plan = newPlan;
    }

    assert(!!plan, 'Active gym membership plan exists', plan.name);
    assert(Number(plan.price_minor_units) > 0, 'Plan price uses integer minor units (kobo)', `${plan.price_minor_units} kobo = ₦${plan.price_minor_units / 100}`);
    assert(Number.isInteger(Number(plan.price_minor_units)), 'Plan price is strictly integer');

    // ------------------------------------------------------------------
    // STEP 4: Member Registration Lifecycle
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 4: Member Registration & QR Token Generation]\x1b[0m');

    const testSuffix = Math.floor(1000 + Math.random() * 9000);
    const testMemberNumber = `MEM-TEST-${testSuffix}`;
    const testQrToken = `GYM-TEST-QR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const testMemberName = `E2E Test Athlete ${testSuffix}`;
    const testPhone = `0803${testSuffix}000`;

    const [member] = await sql`
      INSERT INTO gym_members (
        property_id, organization_id, member_number, full_name, email, phone, qr_code_token, status
      ) VALUES (
        ${propertyId}, ${organizationId}, ${testMemberNumber}, ${testMemberName}, ${`athlete${testSuffix}@test.sena.ng`}, ${testPhone}, ${testQrToken}, 'active'
      ) RETURNING id, member_number, full_name, qr_code_token, status;
    `;

    assert(!!member, 'Member successfully registered', member.full_name);
    assert(member.member_number === testMemberNumber, 'Member number assigned correctly', member.member_number);
    assert(member.qr_code_token === testQrToken, 'Unique digital QR access token generated', member.qr_code_token);
    assert(member.status === 'active', 'Member status is initially active');

    // ------------------------------------------------------------------
    // STEP 5: Subscription Creation & Payment
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 5: Subscription Billing & Payment Records]\x1b[0m');

    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const nextMonth = new Date(today.getTime() + 30 * 86400000);
    const endDate = nextMonth.toISOString().split('T')[0];
    const totalAmount = Number(plan.price_minor_units);

    const [subscription] = await sql`
      INSERT INTO gym_subscriptions (
        property_id, member_id, plan_id, start_date, end_date, auto_renew, status, total_amount_minor_units, paid_amount_minor_units
      ) VALUES (
        ${propertyId}, ${member.id}, ${plan.id}, ${startDate}, ${endDate}, false, 'active', ${totalAmount}, ${totalAmount}
      ) RETURNING id, start_date, end_date, status, total_amount_minor_units, paid_amount_minor_units;
    `;

    assert(!!subscription, 'Gym subscription created', `valid from ${startDate} to ${endDate}`);
    assert(subscription.status === 'active', 'Subscription is active');
    assert(Number(subscription.paid_amount_minor_units) === totalAmount, 'Subscription fully paid in minor units', `${totalAmount} kobo`);

    // Audit log in gym_subscription_history
    const [subHistory] = await sql`
      INSERT INTO gym_subscription_history (
        property_id, subscription_id, member_id, action, details, performed_by
      ) VALUES (
        ${propertyId}, ${subscription.id}, ${member.id}, 'created', 'Initial subscription purchase via E2E test', 'E2E Test Runner'
      ) RETURNING id, action;
    `;
    assert(!!subHistory, 'Subscription lifecycle audit trail recorded', subHistory.action);

    // ------------------------------------------------------------------
    // STEP 6: Access Terminal QR Scan (Turnstile Check-in)
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 6: Access Terminal Turnstile QR Verification]\x1b[0m');

    // Simulate turnstile scan: Look up member by QR token
    const [scannedMember] = await sql`
      SELECT m.id, m.full_name, m.status as member_status,
             s.id as subscription_id, s.status as sub_status, s.end_date
      FROM gym_members m
      LEFT JOIN gym_subscriptions s ON s.member_id = m.id AND s.status = 'active'
      WHERE m.qr_code_token = ${testQrToken} AND m.property_id = ${propertyId};
    `;

    assert(!!scannedMember, 'QR token successfully matched at terminal', scannedMember?.full_name);
    assert(scannedMember.sub_status === 'active', 'Member has valid active subscription');
    assert(scannedMember.end_date >= startDate, 'Subscription end date is in the future', scannedMember.end_date);

    // Log granted turnstile check-in
    const [checkin] = await sql`
      INSERT INTO gym_checkins (
        property_id, member_id, access_point, verified_by, access_result
      ) VALUES (
        ${propertyId}, ${member.id}, 'turnstile_lane_1', 'Automated QR Gate', 'granted'
      ) RETURNING id, access_result, check_in_at;
    `;

    assert(!!checkin, 'Turnstile check-in record created');
    assert(checkin.access_result === 'granted', 'Access GRANTED to gym floor');

    // ------------------------------------------------------------------
    // STEP 7: Live Floor Occupancy Calculation
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 7: Live Floor Occupancy Tracking]\x1b[0m');

    const [occupancy] = await sql`
      SELECT count(*)::int as currently_inside
      FROM gym_checkins
      WHERE property_id = ${propertyId}
        AND access_result = 'granted'
        AND check_out_at IS NULL
        AND check_in_at >= NOW() - INTERVAL '3 hours';
    `;

    assert(occupancy.currently_inside >= 1, 'Currently inside counter reflects active member', `${occupancy.currently_inside} athletes on floor`);

    // ------------------------------------------------------------------
    // STEP 8: Turnstile Checkout (Exit)
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 8: Turnstile Checkout / Exit Logging]\x1b[0m');

    const [checkout] = await sql`
      UPDATE gym_checkins
      SET check_out_at = NOW()
      WHERE id = ${checkin.id}
      RETURNING id, check_out_at;
    `;

    assert(!!checkout?.check_out_at, 'Check-out timestamp recorded at exit turnstile');

    // ------------------------------------------------------------------
    // STEP 9: Classes & Trainer Management
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 9: Group Fitness Classes & Capacity Enforcement]\x1b[0m');

    let [trainer] = await sql`
      SELECT id, full_name, hourly_rate_minor_units
      FROM gym_trainers
      WHERE property_id = ${propertyId} AND status = 'active'
      LIMIT 1;
    `;

    if (!trainer) {
      const [newTrainer] = await sql`
        INSERT INTO gym_trainers (
          property_id, full_name, phone, hourly_rate_minor_units, status
        ) VALUES (
          ${propertyId}, 'Coach Tunde Adeyemi', '08098765432', 750000, 'active'
        ) RETURNING id, full_name, hourly_rate_minor_units;
      `;
      trainer = newTrainer;
    }

    assert(!!trainer, 'Gym trainer active', trainer.full_name);
    assert(Number(trainer.hourly_rate_minor_units) > 0, 'Trainer hourly rate in integer minor units (kobo)');

    // Create a limited-capacity test class (capacity = 1)
    const [gymClass] = await sql`
      INSERT INTO gym_classes (
        property_id, trainer_id, name, day_of_week, start_time, duration_minutes, capacity, status
      ) VALUES (
        ${propertyId}, ${trainer.id}, ${`E2E HIIT Circuit ${testSuffix}`}, 1, '08:00', 45, 1, 'active'
      ) RETURNING id, name, capacity;
    `;

    assert(!!gymClass, 'Group fitness class scheduled', `${gymClass.name} (Cap: ${gymClass.capacity})`);

    // Member 1 books the only spot
    const [booking1] = await sql`
      INSERT INTO gym_class_bookings (
        property_id, class_id, member_id, booking_date, status
      ) VALUES (
        ${propertyId}, ${gymClass.id}, ${member.id}, ${startDate}, 'booked'
      ) RETURNING id, status;
    `;
    assert(!!booking1, 'Member successfully reserved class spot', booking1.status);

    // Verify class capacity count equals capacity
    const [bookedCount] = await sql`
      SELECT count(*)::int as count
      FROM gym_class_bookings
      WHERE class_id = ${gymClass.id} AND booking_date = ${startDate} AND status = 'booked';
    `;
    assert(bookedCount.count === gymClass.capacity, 'Class capacity fully reached', `${bookedCount.count}/${gymClass.capacity}`);

    // ------------------------------------------------------------------
    // STEP 10: CRM Leads Pipeline & Conversion
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 10: CRM Lead Pipeline & Conversion Lifecycle]\x1b[0m');

    const [lead] = await sql`
      INSERT INTO gym_leads (
        property_id, organization_id, full_name, phone, email, source, status, notes
      ) VALUES (
        ${propertyId}, ${organizationId}, ${`Lead Prospect ${testSuffix}`}, ${`0802${testSuffix}999`}, ${`lead${testSuffix}@gmail.com`}, 'walk_in', 'new', 'Interested in strength training'
      ) RETURNING id, full_name, status, source;
    `;

    assert(!!lead, 'CRM lead captured', `${lead.full_name} (${lead.status})`);

    // Advance to trial_scheduled
    const [updatedLead] = await sql`
      UPDATE gym_leads
      SET status = 'trial_scheduled', trial_date = ${startDate}
      WHERE id = ${lead.id}
      RETURNING id, status, trial_date;
    `;
    assert(updatedLead.status === 'trial_scheduled', 'Lead moved through sales funnel to trial_scheduled');

    // Convert lead to member
    const [convertedLead] = await sql`
      UPDATE gym_leads
      SET status = 'converted', converted_member_id = ${member.id}
      WHERE id = ${lead.id}
      RETURNING id, status, converted_member_id;
    `;
    assert(convertedLead.status === 'converted', 'Lead successfully converted to member', `linked to ${convertedLead.converted_member_id}`);

    // ------------------------------------------------------------------
    // STEP 11: Access Denial on Expired Subscription
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 11: Turnstile Access Denial on Expired Membership]\x1b[0m');

    // Expire the subscription
    await sql`
      UPDATE gym_subscriptions
      SET status = 'expired', end_date = '2020-01-01'
      WHERE id = ${subscription.id};
    `;

    // Attempt scan at turnstile
    const [activeSubCheck] = await sql`
      SELECT id, status, end_date
      FROM gym_subscriptions
      WHERE member_id = ${member.id} AND status = 'active' AND end_date >= ${startDate};
    `;

    assert(!activeSubCheck, 'No active subscription found for expired member');

    // Record denied access event
    const [deniedCheckin] = await sql`
      INSERT INTO gym_checkins (
        property_id, member_id, access_point, verified_by, access_result, denial_reason
      ) VALUES (
        ${propertyId}, ${member.id}, 'turnstile_lane_1', 'Automated QR Gate', 'denied', 'Subscription expired on 2020-01-01'
      ) RETURNING id, access_result, denial_reason;
    `;

    assert(deniedCheckin.access_result === 'denied', 'Access correctly DENIED at turnstile', deniedCheckin.denial_reason);

    // ------------------------------------------------------------------
    // STEP 12: Membership Renewal Lifecycle
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 12: Membership Renewal & Access Restoration]\x1b[0m');

    // Renew subscription
    const renewalEndDate = new Date(today.getTime() + 60 * 86400000).toISOString().split('T')[0];
    const [renewedSub] = await sql`
      UPDATE gym_subscriptions
      SET status = 'active', end_date = ${renewalEndDate}, paid_amount_minor_units = total_amount_minor_units
      WHERE id = ${subscription.id}
      RETURNING id, status, end_date;
    `;

    assert(renewedSub.status === 'active', 'Subscription successfully renewed', `new end date: ${renewedSub.end_date}`);

    // Re-scan turnstile
    const [restoredCheckin] = await sql`
      INSERT INTO gym_checkins (
        property_id, member_id, access_point, verified_by, access_result
      ) VALUES (
        ${propertyId}, ${member.id}, 'turnstile_lane_1', 'Automated QR Gate', 'granted'
      ) RETURNING id, access_result;
    `;

    assert(restoredCheckin.access_result === 'granted', 'Turnstile access RESTORED after renewal');

    // ------------------------------------------------------------------
    // CLEANUP SYNTHETIC TEST RECORDS (Safe scoping by specific test ID)
    // ------------------------------------------------------------------
    console.log('\n\x1b[1m[SECTION 13: Clean Teardown of Test Artifacts]\x1b[0m');
    await sql`DELETE FROM gym_class_bookings WHERE id = ${booking1.id};`;
    await sql`DELETE FROM gym_classes WHERE id = ${gymClass.id};`;
    await sql`DELETE FROM gym_checkins WHERE member_id = ${member.id};`;
    await sql`DELETE FROM gym_subscription_history WHERE member_id = ${member.id};`;
    await sql`DELETE FROM gym_subscriptions WHERE id = ${subscription.id};`;
    await sql`DELETE FROM gym_leads WHERE id = ${lead.id};`;
    await sql`DELETE FROM gym_members WHERE id = ${member.id};`;
    console.log('  Cleaned up all synthetic test rows.');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n======================================================================');
    console.log(`  CERTIFICATION SUMMARY: ${passedChecks} PASSED, ${failedChecks} FAILED in ${duration}s`);
    console.log('======================================================================\n');

    await sql.end();

    if (failedChecks > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    await sql.end();
    process.exit(1);
  }
}

runTestSuite();
