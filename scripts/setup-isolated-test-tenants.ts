import { readFileSync } from 'fs';
import { resolve } from 'path';
import bcrypt from 'bcryptjs';

// 1. Read DATABASE_URL
if (!process.env.DATABASE_URL) {
  try {
    const envPath = resolve(__dirname, '../apps/dashboard/.env.local');
    const envContent = readFileSync(envPath, 'utf8');
    const match = envContent.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
    if (match) process.env.DATABASE_URL = match[1].trim();
  } catch {}
}
if (!process.env.DATABASE_URL) {
  try {
    const envPath = resolve(__dirname, '../.env');
    const envContent = readFileSync(envPath, 'utf8');
    const match = envContent.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
    if (match) process.env.DATABASE_URL = match[1].trim();
  } catch {}
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not found');

async function main() {
  const {
    db,
    users,
    organizations,
    organizationMembers,
    properties,
    propertyMembers,
    roomTypes,
    rooms,
    gymMembershipPlans,
    gymTrainers,
    gymClasses,
    restaurantTables,
    restaurantMenuCategories,
    restaurantMenuItems,
    restaurantIngredients,
    eq,
  } = await import('../packages/database/src/index');

  console.log('--- Initializing Dedicated Isolated Test Tenants in Production DB ---');
  const passwordHash = await bcrypt.hash('SenaTest2026!', 10);

  // 1. HOTEL TENANT
  console.log('\n[1/3] Setting up Hotel Tenant...');
  let hotelUser = await db.query.users.findFirst({ where: eq(users.email, 'hotel.tester@sena.ng') });
  if (!hotelUser) {
    [hotelUser] = await db
      .insert(users)
      .values({
        email: 'hotel.tester@sena.ng',
        fullName: 'Hotel Operations Lead',
        passwordHash,
        isActive: true,
        emailVerified: new Date(),
      })
      .returning();
    console.log('Created user hotel.tester@sena.ng:', hotelUser.id);
  } else {
    await db.update(users).set({ passwordHash, isActive: true }).where(eq(users.id, hotelUser.id));
    console.log('Updated existing user hotel.tester@sena.ng:', hotelUser.id);
  }

  let hotelOrg = await db.query.organizations.findFirst({ where: eq(organizations.name, 'Sena Grand Hotel Org') });
  if (!hotelOrg) {
    [hotelOrg] = await db.insert(organizations).values({ name: 'Sena Grand Hotel Org', slug: 'sena-grand-hotel-org' }).returning();
  }

  let hotelProp = await db.query.properties.findFirst({ where: eq(properties.slug, 'sena-grand-hotel') });
  if (!hotelProp) {
    [hotelProp] = await db
      .insert(properties)
      .values({
        organizationId: hotelOrg.id,
        name: 'Sena Grand Hotel',
        slug: 'sena-grand-hotel',
        code: 'SGH',
        address: '14 Admiralty Way, Lekki Phase 1, Lagos',
        industry: 'hotel',
        country: 'Nigeria',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
        phone: '+2348011112222',
        email: 'hotel.tester@sena.ng',
      })
      .returning();
    console.log('Created property Sena Grand Hotel:', hotelProp.id);
  } else {
    await db.update(properties).set({ industry: 'hotel' }).where(eq(properties.id, hotelProp.id));
    console.log('Found property Sena Grand Hotel:', hotelProp.id);
  }

  // Ensure memberships
  const hotelOrgMem = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, hotelUser.id),
  });
  if (!hotelOrgMem) {
    await db.insert(organizationMembers).values({
      organizationId: hotelOrg.id,
      userId: hotelUser.id,
      role: 'owner',
    });
  }

  const hotelPropMem = await db.query.propertyMembers.findFirst({
    where: eq(propertyMembers.userId, hotelUser.id),
  });
  if (!hotelPropMem) {
    await db.insert(propertyMembers).values({
      propertyId: hotelProp.id,
      userId: hotelUser.id,
      role: 'owner',
      permissions: ['*'],
    });
  }

  // Ensure Hotel has room types and rooms
  let deluxeType = await db.query.roomTypes.findFirst({ where: eq(roomTypes.propertyId, hotelProp.id) });
  if (!deluxeType) {
    [deluxeType] = await db
      .insert(roomTypes)
      .values({
        propertyId: hotelProp.id,
        name: 'Deluxe Suite',
        basePriceMinorUnits: 4500000, // ₦45,000.00
        maxGuests: 2,
        bedType: 'King',
        published: true,
      })
      .returning();

    await db.insert(rooms).values([
      {
        propertyId: hotelProp.id,
        roomTypeId: deluxeType.id,
        roomNumber: '101',
        floor: '1',
        operationalStatus: 'available',
        housekeepingStatus: 'clean',
      },
      {
        propertyId: hotelProp.id,
        roomTypeId: deluxeType.id,
        roomNumber: '102',
        floor: '1',
        operationalStatus: 'available',
        housekeepingStatus: 'clean',
      },
    ]);
    console.log('Seeded rooms 101 and 102 for Sena Grand Hotel');
  }

  // 2. GYM TENANT
  console.log('\n[2/3] Setting up Gym Tenant...');
  let gymUser = await db.query.users.findFirst({ where: eq(users.email, 'gym.tester@sena.ng') });
  if (!gymUser) {
    [gymUser] = await db
      .insert(users)
      .values({
        email: 'gym.tester@sena.ng',
        fullName: 'Gym General Manager',
        passwordHash,
        isActive: true,
        emailVerified: new Date(),
      })
      .returning();
    console.log('Created user gym.tester@sena.ng:', gymUser.id);
  } else {
    await db.update(users).set({ passwordHash, isActive: true }).where(eq(users.id, gymUser.id));
    console.log('Updated existing user gym.tester@sena.ng:', gymUser.id);
  }

  let gymOrg = await db.query.organizations.findFirst({ where: eq(organizations.name, 'Sena Power Fitness Org') });
  if (!gymOrg) {
    [gymOrg] = await db.insert(organizations).values({ name: 'Sena Power Fitness Org', slug: 'sena-power-fitness-org' }).returning();
  }

  let gymProp = await db.query.properties.findFirst({ where: eq(properties.slug, 'sena-power-gym') });
  if (!gymProp) {
    [gymProp] = await db
      .insert(properties)
      .values({
        organizationId: gymOrg.id,
        name: 'Sena Power Gym & Fitness',
        slug: 'sena-power-gym',
        code: 'SPG',
        address: '22 Adeola Odeku Street, Victoria Island, Lagos',
        industry: 'gym',
        country: 'Nigeria',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
        phone: '+2348022223333',
        email: 'gym.tester@sena.ng',
      })
      .returning();
    console.log('Created property Sena Power Gym & Fitness:', gymProp.id);
  } else {
    await db.update(properties).set({ industry: 'gym' }).where(eq(properties.id, gymProp.id));
    console.log('Found property Sena Power Gym & Fitness:', gymProp.id);
  }

  const gymOrgMem = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, gymUser.id),
  });
  if (!gymOrgMem) {
    await db.insert(organizationMembers).values({
      organizationId: gymOrg.id,
      userId: gymUser.id,
      role: 'owner',
    });
  }

  const gymPropMem = await db.query.propertyMembers.findFirst({
    where: eq(propertyMembers.userId, gymUser.id),
  });
  if (!gymPropMem) {
    await db.insert(propertyMembers).values({
      propertyId: gymProp.id,
      userId: gymUser.id,
      role: 'owner',
      permissions: ['*'],
    });
  }

  // Ensure Gym Plans exist
  let gymPlan = await db.query.gymMembershipPlans.findFirst({ where: eq(gymMembershipPlans.propertyId, gymProp.id) });
  if (!gymPlan) {
    [gymPlan] = await db
      .insert(gymMembershipPlans)
      .values({
        propertyId: gymProp.id,
        name: 'Monthly Gold Unlimited',
        description: 'Unlimited access to all gym equipment and fitness studios',
        durationMonths: 1,
        priceMinorUnits: 2500000, // ₦25,000.00
        registrationFeeMinorUnits: 500000, // ₦5,000.00
        accessHours: 'all_hours',
        status: 'active',
      })
      .returning();
    console.log('Seeded gym plan Monthly Gold Unlimited:', gymPlan.id);
  }

  // Ensure Gym Trainer exists
  let trainer = await db.query.gymTrainers.findFirst({ where: eq(gymTrainers.propertyId, gymProp.id) });
  if (!trainer) {
    [trainer] = await db
      .insert(gymTrainers)
      .values({
        propertyId: gymProp.id,
        fullName: 'Coach Samuel Okon',
        phone: '+2348077778888',
        email: 'samuel.coach@sena.ng',
        specializations: ['HIIT', 'Strength Training', 'Bodybuilding'],
        hourlyRateMinorUnits: 1000000,
        status: 'active',
      })
      .returning();
    console.log('Seeded trainer Coach Samuel Okon:', trainer.id);
  }

  // Ensure Gym Class exists
  let gymClass = await db.query.gymClasses.findFirst({ where: eq(gymClasses.propertyId, gymProp.id) });
  if (!gymClass) {
    [gymClass] = await db
      .insert(gymClasses)
      .values({
        propertyId: gymProp.id,
        trainerId: trainer.id,
        name: 'Morning HIIT Intensity',
        description: 'High intensity interval training for maximum cardiovascular endurance',
        dayOfWeek: 1, // Monday
        startTime: '07:00',
        durationMinutes: 45,
        capacity: 25,
        locationRoom: 'Aerobics Studio 1',
        priceMinorUnits: 300000, // ₦3,000
        status: 'active',
      })
      .returning();
    console.log('Seeded gym class Morning HIIT Intensity:', gymClass.id);
  }

  // 3. RESTAURANT TENANT
  console.log('\n[3/3] Setting up Restaurant Tenant...');
  let restUser = await db.query.users.findFirst({ where: eq(users.email, 'restaurant.tester@sena.ng') });
  if (!restUser) {
    [restUser] = await db
      .insert(users)
      .values({
        email: 'restaurant.tester@sena.ng',
        fullName: 'Bistro General Manager',
        passwordHash,
        isActive: true,
        emailVerified: new Date(),
      })
      .returning();
    console.log('Created user restaurant.tester@sena.ng:', restUser.id);
  } else {
    await db.update(users).set({ passwordHash, isActive: true }).where(eq(users.id, restUser.id));
    console.log('Updated existing user restaurant.tester@sena.ng:', restUser.id);
  }

  let restOrg = await db.query.organizations.findFirst({ where: eq(organizations.name, 'Sena Prime Bistro Org') });
  if (!restOrg) {
    [restOrg] = await db.insert(organizations).values({ name: 'Sena Prime Bistro Org', slug: 'sena-prime-bistro-org' }).returning();
  }

  let restProp = await db.query.properties.findFirst({ where: eq(properties.slug, 'sena-prime-bistro') });
  if (!restProp) {
    [restProp] = await db
      .insert(properties)
      .values({
        organizationId: restOrg.id,
        name: 'Sena Prime Bistro & Lounge',
        slug: 'sena-prime-bistro',
        code: 'SPB',
        address: '8 Sanusi Fafunwa Street, Victoria Island, Lagos',
        industry: 'restaurant',
        country: 'Nigeria',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
        phone: '+2348033334444',
        email: 'restaurant.tester@sena.ng',
      })
      .returning();
    console.log('Created property Sena Prime Bistro & Lounge:', restProp.id);
  } else {
    await db.update(properties).set({ industry: 'restaurant' }).where(eq(properties.id, restProp.id));
    console.log('Found property Sena Prime Bistro & Lounge:', restProp.id);
  }

  const restOrgMem = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, restUser.id),
  });
  if (!restOrgMem) {
    await db.insert(organizationMembers).values({
      organizationId: restOrg.id,
      userId: restUser.id,
      role: 'owner',
    });
  }

  const restPropMem = await db.query.propertyMembers.findFirst({
    where: eq(propertyMembers.userId, restUser.id),
  });
  if (!restPropMem) {
    await db.insert(propertyMembers).values({
      propertyId: restProp.id,
      userId: restUser.id,
      role: 'owner',
      permissions: ['*'],
    });
  }

  // Ensure Restaurant Tables exist
  let table = await db.query.restaurantTables.findFirst({ where: eq(restaurantTables.propertyId, restProp.id) });
  if (!table) {
    await db.insert(restaurantTables).values([
      { propertyId: restProp.id, tableNumber: 'T1', capacity: 2, section: 'indoor', status: 'available' },
      { propertyId: restProp.id, tableNumber: 'T2', capacity: 4, section: 'indoor', status: 'available' },
      { propertyId: restProp.id, tableNumber: 'T3', capacity: 4, section: 'terrace', status: 'available' },
      { propertyId: restProp.id, tableNumber: 'Bar-1', capacity: 1, section: 'bar', status: 'available' },
    ]);
    console.log('Seeded dining tables T1, T2, T3, Bar-1');
  }

  // Ensure Menu Categories & Items exist
  let cat = await db.query.restaurantMenuCategories.findFirst({ where: eq(restaurantMenuCategories.propertyId, restProp.id) });
  if (!cat) {
    const [foodCat] = await db
      .insert(restaurantMenuCategories)
      .values({
        propertyId: restProp.id,
        name: 'Chef Specialties',
        description: 'Main culinary dishes prepared fresh to order',
        displayOrder: 1,
        isActive: true,
      })
      .returning();

    const [drinksCat] = await db
      .insert(restaurantMenuCategories)
      .values({
        propertyId: restProp.id,
        name: 'Beverages & Mocktails',
        description: 'Refreshing signature beverages',
        displayOrder: 2,
        isActive: true,
      })
      .returning();

    await db.insert(restaurantMenuItems).values([
      {
        propertyId: restProp.id,
        categoryId: foodCat.id,
        name: 'Smoked Jollof Rice with Grilled Chicken',
        description: 'Signature party-style firewood smoked jollof with quarter chicken and plantain',
        priceMinorUnits: 650000, // ₦6,500.00
        costMinorUnits: 250000,
        preparationStation: 'kitchen',
        preparationTimeMinutes: 20,
        isAvailable: true,
      },
      {
        propertyId: restProp.id,
        categoryId: drinksCat.id,
        name: 'Classic Lagos Chapman',
        description: 'Refreshing citrus blend with bitters, cucumber and lime wheels',
        priceMinorUnits: 250000, // ₦2,500.00
        costMinorUnits: 80000,
        preparationStation: 'bar',
        preparationTimeMinutes: 5,
        isAvailable: true,
      },
    ]);
    console.log('Seeded menu items: Smoked Jollof Rice and Lagos Chapman');
  }

  // Ensure Ingredients exist
  let ingredient = await db.query.restaurantIngredients.findFirst({ where: eq(restaurantIngredients.propertyId, restProp.id) });
  if (!ingredient) {
    await db.insert(restaurantIngredients).values([
      {
        propertyId: restProp.id,
        name: 'Long Grain Basmati Rice',
        unitOfMeasure: 'kg',
        currentStock: '50.00',
        minimumStockAlert: '10.00',
        costPerUnitMinorUnits: 350000, // ₦3,500/kg
        supplierName: 'Agro Allied Staples Ltd',
      },
      {
        propertyId: restProp.id,
        name: 'Whole Dressed Chicken',
        unitOfMeasure: 'kg',
        currentStock: '30.00',
        minimumStockAlert: '5.00',
        costPerUnitMinorUnits: 400000,
        supplierName: 'Premier Poultry Farms',
      },
    ]);
    console.log('Seeded ingredients: Basmati Rice and Whole Chicken');
  }

  console.log('\n=== DEDICATED TENANTS CONFIGURED SUCCESSFULLY ===');
  console.log(`HOTEL:
  Property: ${hotelProp.name} (ID: ${hotelProp.id}, Industry: ${hotelProp.industry})
  Email: hotel.tester@sena.ng
  Password: SenaTest2026!

GYM:
  Property: ${gymProp.name} (ID: ${gymProp.id}, Industry: ${gymProp.industry})
  Email: gym.tester@sena.ng
  Password: SenaTest2026!

RESTAURANT:
  Property: ${restProp.name} (ID: ${restProp.id}, Industry: ${restProp.industry})
  Email: restaurant.tester@sena.ng
  Password: SenaTest2026!
`);
}

main().catch((e) => {
  console.error('Setup failed:', e);
  process.exit(1);
});
