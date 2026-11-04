import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  properties,
  propertyMembers,
  roomTypes,
  rooms,
  organizations,
  organizationMembers,
  users,
  gymMembershipPlans,
  restaurantTables,
  restaurantMenuCategories,
  restaurantMenuItems,
  eq,
  sql,
} from '@sena/database';
import { apiError } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to set up your property.' }, { status: 401 });
  try {
    const body = await req.json();
    const { name, country = 'Nigeria', currency = 'NGN' } = body;
    const rawIndustry = typeof body.industry === 'string' ? body.industry.toLowerCase().trim() : 'hotel';
    const industry = ['hotel', 'gym', 'restaurant'].includes(rawIndustry) ? rawIndustry : 'hotel';
    const propertyType = typeof body.propertyType === 'string' ? body.propertyType : industry;

    if (typeof name !== 'string' || !name.trim() || name.length > 255 || typeof country !== 'string' || country.length > 100 || !['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'].includes(currency)) {
      return NextResponse.json({ error: 'Check your property details.' }, { status: 400 });
    }

    const categories = body.roomCategories || [];
    if (industry === 'hotel' && (!Array.isArray(categories) || categories.length > 100 || categories.some((cat: any) => typeof cat.name !== 'string' || !cat.name.trim() || !Number.isSafeInteger(cat.priceMinorUnits) || cat.priceMinorUnits < 0 || !Number.isInteger(cat.quantity) || cat.quantity < 1 || cat.quantity > 1000 || typeof cat.bedType !== 'string' || !cat.bedType.trim()))) {
      return NextResponse.json({ error: 'Enter a name, bed type, valid price and room quantity for each category.' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const userId = session.user!.id!;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`onboarding:${userId}`}))`);
      const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user?.isActive) return { error: 'Please sign in with an active account.', status: 401 };
      const member = await tx.query.propertyMembers.findFirst({ where: eq(propertyMembers.userId, userId) });
      if (member) return { error: 'Your account already belongs to an active business location.', status: 409 };
      const membership = await tx.query.organizationMembers.findFirst({ where: eq(organizationMembers.userId, userId) });
      if (membership && membership.role.toLowerCase() !== 'owner') return { error: 'Only an owner can set up a business.', status: 403 };
      let orgId = membership?.organizationId;
      if (orgId && (await tx.query.properties.findFirst({ where: eq(properties.organizationId, orgId) }))) {
        return { error: 'Your property is already set up. Open your dashboard.', status: 409 };
      }
      if (!orgId) {
        const [org] = await tx.insert(organizations).values({ name: name.trim(), slug: `business-${crypto.randomUUID()}` }).returning();
        orgId = org.id;
        await tx.insert(organizationMembers).values({ organizationId: orgId, userId, role: 'owner' });
      }
      const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'property'}-${crypto.randomUUID().slice(0, 8)}`;
      const [property] = await tx
        .insert(properties)
        .values({
          organizationId: orgId,
          name: name.trim(),
          slug,
          code: crypto.randomUUID().slice(0, 8).toUpperCase(),
          industry,
          propertyType,
          country,
          currency,
          address: typeof body.address === 'string' ? body.address.trim() : '',
          phone: typeof body.phone === 'string' ? body.phone.trim() : '',
          email: typeof body.email === 'string' ? body.email.trim() : user.email,
        })
        .returning();

      await tx.insert(propertyMembers).values({ propertyId: property.id, userId, role: 'owner' });

      const createdCategories = [];
      const createdRooms = [];

      if (industry === 'hotel') {
        let roomNumber = 101;
        for (const cat of categories) {
          const [category] = await tx
            .insert(roomTypes)
            .values({
              propertyId: property.id,
              name: cat.name.trim(),
              bedType: cat.bedType.trim(),
              basePriceMinorUnits: cat.priceMinorUnits,
              totalInventory: cat.quantity,
              capacity: 2,
              amenities: [],
              websiteVisibility: false,
              bookingVisibility: false,
            })
            .returning();
          createdCategories.push(category);
          createdRooms.push(
            ...(await tx
              .insert(rooms)
              .values(
                Array.from({ length: cat.quantity }, () => ({
                  propertyId: property.id,
                  roomTypeId: category.id,
                  roomNumber: String(roomNumber++),
                  operationalStatus: 'available',
                  housekeepingStatus: 'dirty',
                }))
              )
              .returning())
          );
        }
      } else if (industry === 'gym') {
        await tx.insert(gymMembershipPlans).values({
          propertyId: property.id,
          name: 'Standard Monthly Pass',
          description: 'Full gym and cardio floor access',
          durationMonths: 1,
          priceMinorUnits: 2500000,
          registrationFeeMinorUnits: 500000,
          accessHours: 'all_hours',
          maxClassCreditsPerMonth: 4,
          status: 'active',
        });
      } else if (industry === 'restaurant') {
        await tx.insert(restaurantTables).values([
          { propertyId: property.id, tableNumber: 'T1', capacity: 2, section: 'indoor' },
          { propertyId: property.id, tableNumber: 'T2', capacity: 4, section: 'indoor' },
          { propertyId: property.id, tableNumber: 'T3', capacity: 4, section: 'indoor' },
          { propertyId: property.id, tableNumber: 'T4', capacity: 6, section: 'patio' },
        ]);
        const [cat] = await tx
          .insert(restaurantMenuCategories)
          .values({
            propertyId: property.id,
            name: 'Main Dishes',
            description: 'House specialties and entrees',
            displayOrder: 1,
            isActive: true,
          })
          .returning();
        await tx.insert(restaurantMenuItems).values({
          propertyId: property.id,
          categoryId: cat.id,
          name: 'Chef Special Jollof Rice & Grilled Chicken',
          description: 'Smoky firewood jollof rice served with plantain and tender peppered chicken',
          priceMinorUnits: 650000,
          costMinorUnits: 250000,
          preparationStation: 'kitchen',
          isAvailable: true,
        });
      }

      return { property, categories: createdCategories, rooms: createdRooms };
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Business workspace initialized successfully.',
    });
  } catch (error) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}
