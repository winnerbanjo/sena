import path from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import bcrypt from 'bcryptjs';
import { assertLocalDatabase } from './safety-guard';
import * as schema from './schema';

const DEFAULT_LOCAL_DB = 'postgresql://oyekunle@127.0.0.1:5432/sena_test';

export async function setupLocalDatabase(dbUrl?: string) {
  const connectionString = dbUrl || process.env.DATABASE_URL || DEFAULT_LOCAL_DB;

  // 1. HARD ENFORCED SAFETY GUARD
  const { host, database } = assertLocalDatabase(connectionString, 'local database setup & seed');

  if (database !== 'sena_test' && database !== 'sena_dev') {
    throw new Error(
      `[SAFETY GUARD] setupLocalDatabase can only be run on 'sena_test' or 'sena_dev', got '${database}'.`
    );
  }

  console.log(`\n============================================================`);
  console.log(`[LOCAL SENA DB SETUP] Starting clean setup on: ${host}/${database}`);
  console.log(`============================================================\n`);

  const sql = postgres(connectionString, {
    max: 1,
    ssl: false,
  });

  try {
    // 2. RESET PUBLIC AND DRIZZLE SCHEMAS
    console.log('1. Resetting public and drizzle schemas on local database...');
    await sql.unsafe(`DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`);
    console.log('   Schemas reset successfully.');

    // 3. RUN ALL DRIZZLE MIGRATIONS
    console.log('2. Running Drizzle migration chain (0000 - 0012)...');
    const db = drizzle(sql, { schema });
    const migrationsFolder = path.resolve(__dirname, '../drizzle');
    await migrate(db, { migrationsFolder });
    console.log('   All migrations applied successfully.');

    // 4. CREATE PERMANENT LOCAL QA USER
    console.log('3. Creating permanent local QA user (qa-local@sena.ng)...');
    const qaEmail = 'qa-local@sena.ng';
    const qaPassword = 'SenaLocal2026!';
    const passwordHash = await bcrypt.hash(qaPassword, 10);

    const [qaUser] = await db
      .insert(schema.users)
      .values({
        email: qaEmail,
        fullName: 'Sena QA',
        passwordHash,
        phone: '+234 800 000 0001',
        isActive: true,
        emailVerified: new Date(),
        locale: 'en',
      })
      .returning();

    console.log(`   Local QA user created with ID: ${qaUser.id}`);

    // 5. CREATE LOCAL DEMO ORGANIZATION
    console.log('4. Creating demo organization...');
    const [org] = await db
      .insert(schema.organizations)
      .values({
        name: 'Sena Hospitality Group',
        slug: 'sena-hospitality-group',
      })
      .returning();

    await db.insert(schema.organizationMembers).values({
      organizationId: org.id,
      userId: qaUser.id,
      role: 'owner',
    });

    // 6. CREATE REALISTIC DEMO PROPERTY (Sena House Lagos)
    console.log('5. Creating demo property (Sena House Lagos)...');
    const [property] = await db
      .insert(schema.properties)
      .values({
        organizationId: org.id,
        name: 'Sena House Lagos',
        slug: 'sena-house-lagos',
        code: 'SHL',
        propertyType: 'boutique_hotel',
        country: 'Nigeria',
        address: '14 Cooper Road, Ikoyi, Lagos',
        phone: '+234 1 234 5678',
        email: 'stay@sena.ng',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        checkInPaymentPolicy: 'allow_outstanding',
        checkOutPaymentPolicy: 'require_full_payment',
      })
      .returning();

    await db.insert(schema.propertyMembers).values({
      propertyId: property.id,
      userId: qaUser.id,
      role: 'owner',
      permissions: ['status:active', 'all:manage'],
    });

    // 7. CREATE ROOM CATEGORIES
    console.log('6. Creating room categories...');
    const [standardCat] = await db
      .insert(schema.roomTypes)
      .values({
        propertyId: property.id,
        name: 'Standard Room',
        bedType: 'King Bed',
        capacity: 2,
        description: 'Comfortable king-bed room with workspace and rain shower.',
        basePriceMinorUnits: 8500000, // ₦85,000
        totalInventory: 4,
      })
      .returning();

    const [deluxeCat] = await db
      .insert(schema.roomTypes)
      .values({
        propertyId: property.id,
        name: 'Deluxe Room',
        bedType: 'King Bed',
        capacity: 2,
        description: 'Spacious room with balcony, lounge seating, and city views.',
        basePriceMinorUnits: 12500000, // ₦125,000
        totalInventory: 4,
      })
      .returning();

    const [suiteCat] = await db
      .insert(schema.roomTypes)
      .values({
        propertyId: property.id,
        name: 'Executive Suite',
        bedType: 'Super King Bed',
        capacity: 3,
        description: 'Top-tier luxury suite with separate living room and marble bath.',
        basePriceMinorUnits: 21000000, // ₦210,000
        totalInventory: 4,
      })
      .returning();

    // 8. CREATE 12 PHYSICAL ROOMS
    console.log('7. Creating 12 physical rooms...');
    const roomDefs = [
      // Standard Rooms (Floor 1)
      { number: '101', cat: standardCat.id, floor: 'Floor 1', op: 'available', hk: 'clean' }, // Assigned to arrival Chinedu Eze (pending arrival today)
      { number: '102', cat: standardCat.id, floor: 'Floor 1', op: 'occupied', hk: 'clean' },
      { number: '103', cat: standardCat.id, floor: 'Floor 1', op: 'occupied', hk: 'inspected' },
      { number: '104', cat: standardCat.id, floor: 'Floor 1', op: 'available', hk: 'clean' },

      // Deluxe Rooms (Floor 2)
      { number: '201', cat: deluxeCat.id, floor: 'Floor 2', op: 'available', hk: 'dirty' }, // Assigned to arrival Amina Yusuf (dirty room with arrival due)
      { number: '202', cat: deluxeCat.id, floor: 'Floor 2', op: 'occupied', hk: 'clean' },
      { number: '203', cat: deluxeCat.id, floor: 'Floor 2', op: 'available', hk: 'dirty' }, // Departed today
      { number: '204', cat: deluxeCat.id, floor: 'Floor 2', op: 'available', hk: 'clean' },

      // Executive Suites (Floor 3)
      { number: '301', cat: suiteCat.id, floor: 'Floor 3', op: 'occupied', hk: 'clean' }, // Checked in today
      { number: '302', cat: suiteCat.id, floor: 'Floor 3', op: 'occupied', hk: 'inspected' }, // Overdue departure
      { number: '303', cat: suiteCat.id, floor: 'Floor 3', op: 'available', hk: 'clean' },
      { number: '304', cat: suiteCat.id, floor: 'Floor 3', op: 'available', hk: 'clean' },
    ];

    const insertedRooms: Record<string, any> = {};
    for (const r of roomDefs) {
      const [row] = await db
        .insert(schema.rooms)
        .values({
          propertyId: property.id,
          roomTypeId: r.cat,
          roomNumber: r.number,
          floor: r.floor,
          operationalStatus: r.op as any,
          housekeepingStatus: r.hk as any,
          notes: r.op === 'occupied' ? 'Guest in residence' : null,
        })
        .returning();
      insertedRooms[r.number] = row;
    }

    // 9. CREATE 2 SERVICED APARTMENTS
    console.log('8. Creating 2 serviced apartments...');
    const [apt401] = await db
      .insert(schema.apartments)
      .values({
        propertyId: property.id,
        name: 'Penthouse Residence 401',
        apartmentType: 'penthouse',
        bedConfiguration: '3 King Beds',
        operationalStatus: 'available',
        housekeepingStatus: 'clean',
        bedrooms: 3,
        maxGuests: 6,
        basePriceMinorUnits: 45000000, // ₦450,000 / night
        description: 'Full-floor serviced penthouse with private terrace and chef kitchen.',
      })
      .returning();

    const [apt402] = await db
      .insert(schema.apartments)
      .values({
        propertyId: property.id,
        name: 'Executive Residence 402',
        apartmentType: 'two_bedroom',
        bedConfiguration: '2 Queen Beds',
        operationalStatus: 'maintenance', // 1 OUT-OF-SERVICE UNIT
        housekeepingStatus: 'dirty',
        bedrooms: 2,
        maxGuests: 4,
        basePriceMinorUnits: 32000000, // ₦320,000 / night
        description: 'Modern two-bedroom serviced apartment currently undergoing HVAC maintenance.',
      })
      .returning();

    // 10. CREATE FICTIONAL GUESTS
    console.log('9. Creating fictional guests...');
    const guestData = [
      { name: 'Chinedu Eze', email: 'chinedu.eze@example.test', phone: '+234 802 111 2233' },
      { name: 'Amina Yusuf', email: 'amina.yusuf@example.test', phone: '+234 803 222 3344' },
      { name: 'Dr. Babatunde Lawal', email: 'babatunde.lawal@example.test', phone: '+234 805 333 4455' },
      { name: 'Folake Adeleke', email: 'folake.adeleke@example.test', phone: '+234 807 444 5566' },
      { name: 'Emeka Obi', email: 'emeka.obi@example.test', phone: '+234 809 555 6677' },
      { name: 'Zainab Bello', email: 'zainab.bello@example.test', phone: '+234 812 666 7788' },
      { name: 'Kelechi Nwosu', email: 'kelechi.nwosu@example.test', phone: '+234 814 777 8899' },
      { name: 'Tariq Al-Mansoor', email: 'tariq.mansoor@example.test', phone: '+234 816 888 9900' },
      { name: 'Ngozi Okonjo', email: 'ngozi.okonjo@example.test', phone: '+234 818 999 0011' },
      { name: 'David Adeleke', email: 'david.adeleke@example.test', phone: '+234 802 000 1122' },
      { name: 'Simi Kosoko', email: 'simi.kosoko@example.test', phone: '+234 803 111 2244' },
      { name: 'Femi Otedola', email: 'femi.otedola@example.test', phone: '+234 805 222 3355' },
      { name: 'Aliko Dangote', email: 'aliko.dangote@example.test', phone: '+234 807 333 4466' },
    ];

    const insertedGuests: Record<string, any> = {};
    for (const g of guestData) {
      const [row] = await db
        .insert(schema.guests)
        .values({
          organizationId: org.id,
          propertyId: property.id,
          fullName: g.name,
          email: g.email,
          phone: g.phone,
        })
        .returning();
      insertedGuests[g.name] = row;
    }

    // 11. SEED REALISTIC OPERATIONAL RESERVATIONS
    // Today's date in Lagos is 2026-10-03
    const todayIso = '2026-10-03';
    console.log(`10. Seeding operational reservations for today (${todayIso})...`);

    // A. ARRIVALS TODAY:
    // 1. Chinedu Eze - Standard Room 101, 2 nights (2026-10-03 to 2026-10-05), pending arrival, partial payment
    const [res1] = await db
      .insert(schema.reservations)
      .values({
        propertyId: property.id,
        guestId: insertedGuests['Chinedu Eze'].id,
        roomTypeId: standardCat.id,
        roomId: insertedRooms['101'].id,
        reference: 'RES-SHL-1001',
        status: 'confirmed',
        paymentStatus: 'partially_paid',
        checkInDate: '2026-10-03',
        checkOutDate: '2026-10-05',
        nights: 2,
        numGuests: 1,
        source: 'direct',
        totalAmountMinorUnits: 17000000, // ₦170,000
        paidAmountMinorUnits: 8500000,   // ₦85,000 (₦85,000 uncollected balance)
        specialRequests: 'Quiet room away from elevator',
      })
      .returning();

    // Pending bank transfer proof for Chinedu Eze
    await db.insert(schema.transferProofs).values({
      propertyId: property.id,
      reservationId: res1.id,
      amountMinorUnits: 8500000,
      currency: 'NGN',
      payerName: 'Chinedu Eze',
      transferReference: 'TRF-GTB-9481920',
      proofUrl: '/assets/demo-transfer-receipt.png',
      status: 'pending',
      staffNote: 'Transferred via GTBank mobile app, pending desk confirmation',
    });

    // 2. Amina Yusuf - Deluxe Room (Unassigned Room), 3 nights (2026-10-03 to 2026-10-06), unpaid
    const [res2] = await db
      .insert(schema.reservations)
      .values({
        propertyId: property.id,
        guestId: insertedGuests['Amina Yusuf'].id,
        roomTypeId: deluxeCat.id,
        roomId: null, // UNASSIGNED ARRIVAL (Triggers desk priority card!)
        reference: 'RES-SHL-1002',
        status: 'confirmed',
        paymentStatus: 'unpaid',
        checkInDate: '2026-10-03',
        checkOutDate: '2026-10-06',
        nights: 3,
        numGuests: 2,
        source: 'direct',
        totalAmountMinorUnits: 37500000, // ₦375,000
        paidAmountMinorUnits: 0,         // ₦375,000 uncollected balance
        specialRequests: 'High floor preferred, late arrival around 6pm',
      })
      .returning();

    // 3. Dr. Babatunde Lawal - Executive Suite 301, 1 night (2026-10-03 to 2026-10-04), checked in today, fully paid
    const [res3] = await db
      .insert(schema.reservations)
      .values({
        propertyId: property.id,
        guestId: insertedGuests['Dr. Babatunde Lawal'].id,
        roomTypeId: suiteCat.id,
        roomId: insertedRooms['301'].id,
        reference: 'RES-SHL-1003',
        status: 'checked_in',
        paymentStatus: 'paid',
        checkInDate: '2026-10-03',
        checkOutDate: '2026-10-04',
        nights: 1,
        numGuests: 1,
        source: 'direct',
        totalAmountMinorUnits: 21000000, // ₦210,000
        paidAmountMinorUnits: 21000000,  // ₦210,000 (fully paid)
        specialRequests: 'Airport transfer requested',
      })
      .returning();

    await db.insert(schema.payments).values({
      propertyId: property.id,
      reservationId: res3.id,
      amountMinorUnits: 21000000,
      currency: 'NGN',
      provider: 'paystack',
      providerReference: 'pstk_ref_99218274',
      method: 'card',
      status: 'successful',
      source: 'booking_engine',
      paidAt: new Date('2026-10-03T11:30:00Z'),
      notes: 'Direct online payment via Paystack checkout',
    });

    // B. IN HOUSE GUESTS (Already checked in prior to today):
    // 4. Folake Adeleke - Deluxe Room 202, 4 nights (2026-10-01 to 2026-10-05), checked in, fully paid
    const [res4] = await db
      .insert(schema.reservations)
      .values({
        propertyId: property.id,
        guestId: insertedGuests['Folake Adeleke'].id,
        roomTypeId: deluxeCat.id,
        roomId: insertedRooms['202'].id,
        reference: 'RES-SHL-1004',
        status: 'checked_in',
        paymentStatus: 'paid',
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-05',
        nights: 4,
        numGuests: 2,
        source: 'direct',
        totalAmountMinorUnits: 50000000, // ₦500,000
        paidAmountMinorUnits: 50000000,
        specialRequests: 'Extra pillows',
      })
      .returning();

    await db.insert(schema.payments).values({
      propertyId: property.id,
      reservationId: res4.id,
      amountMinorUnits: 50000000,
      currency: 'NGN',
      provider: 'flutterwave',
      providerReference: 'flw_ref_44810293',
      method: 'bank_transfer',
      status: 'successful',
      source: 'booking_engine',
      paidAt: new Date('2026-10-01T09:15:00Z'),
      notes: 'Payment settled via Flutterwave',
    });

    // 5. Emeka Obi - Standard Room 102, 3 nights (2026-10-02 to 2026-10-05), checked in, partial payment
    const [res5] = await db
      .insert(schema.reservations)
      .values({
        propertyId: property.id,
        guestId: insertedGuests['Emeka Obi'].id,
        roomTypeId: standardCat.id,
        roomId: insertedRooms['102'].id,
        reference: 'RES-SHL-1005',
        status: 'checked_in',
        paymentStatus: 'partially_paid',
        checkInDate: '2026-10-02',
        checkOutDate: '2026-10-05',
        nights: 3,
        numGuests: 1,
        source: 'walk_in',
        totalAmountMinorUnits: 25500000, // ₦255,000
        paidAmountMinorUnits: 15000000,  // ₦150,000 (₦105,000 uncollected balance)
        specialRequests: 'Desk invoice requested',
      })
      .returning();

    await db.insert(schema.payments).values({
      propertyId: property.id,
      reservationId: res5.id,
      amountMinorUnits: 15000000,
      currency: 'NGN',
      provider: 'manual',
      method: 'pos',
      status: 'successful',
      source: 'front_desk',
      paidAt: new Date('2026-10-02T14:40:00Z'),
      notes: 'Initial deposit paid by card at front desk POS',
    });

    // C. DEPARTURES TODAY:
    // 6. Zainab Bello - Standard Room 103, stay 2026-09-30 to 2026-10-03, checked_in (Departure due / pending checkout today)
    const [res6] = await db
      .insert(schema.reservations)
      .values({
        propertyId: property.id,
        guestId: insertedGuests['Zainab Bello'].id,
        roomTypeId: standardCat.id,
        roomId: insertedRooms['103'].id,
        reference: 'RES-SHL-1006',
        status: 'checked_in', // STILL IN HOUSE (Departure pending!)
        paymentStatus: 'paid',
        checkInDate: '2026-09-30',
        checkOutDate: '2026-10-03',
        nights: 3,
        numGuests: 1,
        source: 'direct',
        totalAmountMinorUnits: 25500000, // ₦255,000
        paidAmountMinorUnits: 25500000,
        specialRequests: '11:00 checkout scheduled',
      })
      .returning();

    // 7. Kelechi Nwosu - Deluxe Room 203, stay 2026-10-01 to 2026-10-03, checked_out (Departure completed this morning)
    const [res7] = await db
      .insert(schema.reservations)
      .values({
        propertyId: property.id,
        guestId: insertedGuests['Kelechi Nwosu'].id,
        roomTypeId: deluxeCat.id,
        roomId: insertedRooms['203'].id,
        reference: 'RES-SHL-1007',
        status: 'checked_out', // CHECKED OUT TODAY
        paymentStatus: 'paid',
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-03',
        nights: 2,
        numGuests: 2,
        source: 'direct',
        totalAmountMinorUnits: 25000000, // ₦250,000
        paidAmountMinorUnits: 25000000,
        specialRequests: 'Early departure completed at 08:30',
      })
      .returning();

    // D. OVERDUE DEPARTURE (Checked in, checkout was yesterday 2026-10-02):
    // 8. Tariq Al-Mansoor - Suite 302, stay 2026-09-29 to 2026-10-02, checked_in (OVERDUE DEPARTURE!)
    const [res8] = await db
      .insert(schema.reservations)
      .values({
        propertyId: property.id,
        guestId: insertedGuests['Tariq Al-Mansoor'].id,
        roomTypeId: suiteCat.id,
        roomId: insertedRooms['302'].id,
        reference: 'RES-SHL-1008',
        status: 'checked_in', // Overdue departure!
        paymentStatus: 'partially_paid',
        checkInDate: '2026-09-29',
        checkOutDate: '2026-10-02', // ELAPSED YESTERDAY!
        nights: 3,
        numGuests: 2,
        source: 'direct',
        totalAmountMinorUnits: 63000000, // ₦630,000
        paidAmountMinorUnits: 42000000,  // ₦420,000 (₦210,000 uncollected balance)
        specialRequests: 'Stay extension pending confirmation',
      })
      .returning();

    // E. FUTURE RESERVATIONS (MUST NOT count as today's arrivals!):
    // 9. Tomorrow: Ngozi Okonjo - Deluxe Room, 2026-10-04 to 2026-10-07
    await db.insert(schema.reservations).values({
      propertyId: property.id,
      guestId: insertedGuests['Ngozi Okonjo'].id,
      roomTypeId: deluxeCat.id,
      roomId: insertedRooms['204'].id,
      reference: 'RES-SHL-1009',
      status: 'confirmed',
      paymentStatus: 'paid',
      checkInDate: '2026-10-04',
      checkOutDate: '2026-10-07',
      nights: 3,
      numGuests: 1,
      source: 'direct',
      totalAmountMinorUnits: 37500000,
      paidAmountMinorUnits: 37500000,
    });

    // 10. Next week: David Adeleke - Suite, 2026-10-10 to 2026-10-15
    await db.insert(schema.reservations).values({
      propertyId: property.id,
      guestId: insertedGuests['David Adeleke'].id,
      roomTypeId: suiteCat.id,
      roomId: insertedRooms['303'].id,
      reference: 'RES-SHL-1010',
      status: 'confirmed',
      paymentStatus: 'paid',
      checkInDate: '2026-10-10',
      checkOutDate: '2026-10-15',
      nights: 5,
      numGuests: 2,
      source: 'direct',
      totalAmountMinorUnits: 105000000,
      paidAmountMinorUnits: 105000000,
    });

    // 11. Next month: Simi Kosoko - Standard Room, 2026-11-01 to 2026-11-05
    await db.insert(schema.reservations).values({
      propertyId: property.id,
      guestId: insertedGuests['Simi Kosoko'].id,
      roomTypeId: standardCat.id,
      roomId: insertedRooms['104'].id,
      reference: 'RES-SHL-1011',
      status: 'confirmed',
      paymentStatus: 'unpaid',
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-05',
      nights: 4,
      numGuests: 1,
      source: 'direct',
      totalAmountMinorUnits: 34000000,
      paidAmountMinorUnits: 0,
    });

    // F. CANCELLED AND NO-SHOW:
    // 12. Femi Otedola - Cancelled
    await db.insert(schema.reservations).values({
      propertyId: property.id,
      guestId: insertedGuests['Femi Otedola'].id,
      roomTypeId: suiteCat.id,
      roomId: null,
      reference: 'RES-SHL-1012',
      status: 'cancelled',
      paymentStatus: 'unpaid',
      checkInDate: '2026-10-03',
      checkOutDate: '2026-10-05',
      nights: 2,
      numGuests: 1,
      source: 'direct',
      totalAmountMinorUnits: 42000000,
      paidAmountMinorUnits: 0,
    });

    // 13. Aliko Dangote - No show
    await db.insert(schema.reservations).values({
      propertyId: property.id,
      guestId: insertedGuests['Aliko Dangote'].id,
      roomTypeId: deluxeCat.id,
      roomId: null,
      reference: 'RES-SHL-1013',
      status: 'no_show',
      paymentStatus: 'unpaid',
      checkInDate: '2026-10-02',
      checkOutDate: '2026-10-04',
      nights: 2,
      numGuests: 1,
      source: 'direct',
      totalAmountMinorUnits: 25000000,
      paidAmountMinorUnits: 0,
    });

    // 12. SEED REALISTIC INVOICES
    console.log('11. Seeding realistic invoices...');
    // Paid invoice for Dr. Babatunde Lawal
    await db.insert(schema.propertyInvoices).values({
      propertyId: property.id,
      organizationId: org.id,
      reservationId: res3.id,
      guestId: insertedGuests['Dr. Babatunde Lawal'].id,
      invoiceNumber: 'INV-2026-0001',
      invoiceType: 'guest_folio',
      status: 'paid',
      recipientName: 'Dr. Babatunde Lawal',
      recipientEmail: 'babatunde.lawal@example.test',
      issueDate: '2026-10-03',
      dueDate: '2026-10-04',
      currency: 'NGN',
      subtotalMinorUnits: 21000000,
      totalAmountMinorUnits: 21000000,
      paidAmountMinorUnits: 21000000,
      items: [
        {
          id: 'item-1',
          category: 'room',
          description: 'Executive Suite - 1 Night',
          quantity: 1,
          unitPriceMinorUnits: 21000000,
          totalMinorUnits: 21000000,
        },
      ],
    });

    // Unpaid invoice for Amina Yusuf
    await db.insert(schema.propertyInvoices).values({
      propertyId: property.id,
      organizationId: org.id,
      reservationId: res2.id,
      guestId: insertedGuests['Amina Yusuf'].id,
      invoiceNumber: 'INV-2026-0002',
      invoiceType: 'guest_folio',
      status: 'issued',
      recipientName: 'Amina Yusuf',
      recipientEmail: 'amina.yusuf@example.test',
      issueDate: '2026-10-03',
      dueDate: '2026-10-06',
      currency: 'NGN',
      subtotalMinorUnits: 37500000,
      totalAmountMinorUnits: 37500000,
      paidAmountMinorUnits: 0,
      items: [
        {
          id: 'item-1',
          category: 'room',
          description: 'Deluxe Room - 3 Nights',
          quantity: 3,
          unitPriceMinorUnits: 12500000,
          totalMinorUnits: 37500000,
        },
      ],
    });

    // Partially paid invoice for Chinedu Eze
    await db.insert(schema.propertyInvoices).values({
      propertyId: property.id,
      organizationId: org.id,
      reservationId: res1.id,
      guestId: insertedGuests['Chinedu Eze'].id,
      invoiceNumber: 'INV-2026-0003',
      invoiceType: 'guest_folio',
      status: 'partially_paid',
      recipientName: 'Chinedu Eze',
      recipientEmail: 'chinedu.eze@example.test',
      issueDate: '2026-10-03',
      dueDate: '2026-10-05',
      currency: 'NGN',
      subtotalMinorUnits: 17000000,
      totalAmountMinorUnits: 17000000,
      paidAmountMinorUnits: 8500000,
      items: [
        {
          id: 'item-1',
          category: 'room',
          description: 'Standard Room - 2 Nights',
          quantity: 2,
          unitPriceMinorUnits: 8500000,
          totalMinorUnits: 17000000,
        },
      ],
    });

    // Draft corporate invoice
    await db.insert(schema.propertyInvoices).values({
      propertyId: property.id,
      organizationId: org.id,
      invoiceNumber: 'INV-2026-0004',
      invoiceType: 'corporate',
      status: 'draft',
      recipientName: 'Aegis Energy Lagos Ltd',
      recipientEmail: 'accounts@aegisenergy.example.test',
      issueDate: '2026-10-03',
      dueDate: '2026-10-17',
      currency: 'NGN',
      subtotalMinorUnits: 85000000,
      totalAmountMinorUnits: 85000000,
      paidAmountMinorUnits: 0,
      items: [
        {
          id: 'item-1',
          category: 'service',
          description: 'Corporate Board Retreat - Room Package Deposit',
          quantity: 1,
          unitPriceMinorUnits: 85000000,
          totalMinorUnits: 85000000,
        },
      ],
    });

    console.log(`\n============================================================`);
    console.log(`[LOCAL SENA DB SETUP] Successfully completed!`);
    console.log(`Property:        Sena House Lagos (${property.id})`);
    console.log(`QA User:         ${qaEmail} / ${qaPassword}`);
    console.log(`Rooms:           12 physical rooms across 3 categories`);
    console.log(`Apartments:      2 serviced apartments (1 available, 1 maintenance/OOO)`);
    console.log(`Reservations:    13 operational stays (Arrivals, Departures, In House)`);
    console.log(`Guests:          13 fictional guest profiles`);
    console.log(`============================================================\n`);

    return {
      propertyId: property.id,
      qaUser: { email: qaEmail, password: qaPassword },
    };
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  setupLocalDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Fatal Setup Error:', err.message);
      process.exit(1);
    });
}
