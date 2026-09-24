import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, properties, propertyMembers, roomTypes, rooms, organizations, organizationMembers } from '@sena/database';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const {
      name,
      propertyType = 'hotel',
      country = 'Nigeria',
      currency = 'NGN',
      address,
      phone,
      email,
      roomTypeName,
      bedType,
      priceMinorUnits,
      numRooms,
      floorNumber,
      roomsList,
      bankDetails,
    } = body;

    // Resolve user ID from session, or default to demo GM if testing locally
    let userId = session?.user?.id;
    if (!userId) {
      // Find existing user in db
      const existingUser = await db.query.users.findFirst();
      if (existingUser) {
        userId = existingUser.id;
      } else {
        return NextResponse.json({ error: 'Unauthorized and no user found' }, { status: 401 });
      }
    }

    // Resolve or create organization
    let org = await db.query.organizations.findFirst();
    if (!org) {
      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: `${name} Group`,
          slug: `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-group-${Date.now()}`,
        })
        .returning();
      org = newOrg;

      await db.insert(organizationMembers).values({
        organizationId: org.id,
        userId,
        role: 'owner',
      });
    }

    const code = name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 5) || 'HTL';

    // Atomic transaction for property, room type, and individual rooms
    const result = await db.transaction(async (tx) => {
      // 1. Create or update property
      let propertyId = (session?.user as any)?.propertyId;
      let propRecord;

      if (propertyId) {
        const [updated] = await tx
          .update(properties)
          .set({
            name,
            code,
            propertyType,
            country,
            currency,
            address: address || 'Admiralty Way, Lekki',
            phone: phone || '+234 800 000 0000',
            email: email || 'stay@sena.ng',
            updatedAt: new Date(),
          })
          .where(eq(properties.id, propertyId))
          .returning();
        propRecord = updated;
      } else {
        const [created] = await tx
          .insert(properties)
          .values({
            organizationId: org.id,
            name,
            code,
            propertyType,
            country,
            currency,
            address: address || 'Admiralty Way, Lekki',
            phone: phone || '+234 800 000 0000',
            email: email || 'stay@sena.ng',
          })
          .returning();
        propRecord = created;
        propertyId = created.id;

        // Link property member
        await tx
          .insert(propertyMembers)
          .values({
            propertyId,
            userId,
            role: 'owner',
          })
          .onConflictDoNothing();
      }

      // 2. Create Room Type
      const [rt] = await tx
        .insert(roomTypes)
        .values({
          propertyId,
          name: roomTypeName || 'Standard Room',
          bedType: bedType || '1 Queen Bed',
          basePriceMinorUnits: Number(priceMinorUnits) || 8500000,
          totalInventory: Number(numRooms) || (roomsList?.length ?? 1),
          capacity: 2,
          amenities: ['Air Conditioning', 'High-Speed Wi-Fi', 'Smart TV', 'Ensuite Bathroom'],
          websiteVisibility: true,
          bookingVisibility: true,
        })
        .returning();

      // 3. Create individual rooms
      const createdRooms = [];
      const roomNumbers: string[] = roomsList && roomsList.length > 0 ? roomsList : ['101', '102'];

      for (let i = 0; i < roomNumbers.length; i++) {
        const num = roomNumbers[i];
        const [room] = await tx
          .insert(rooms)
          .values({
            propertyId,
            roomTypeId: rt.id,
            roomNumber: num,
            floor: floorNumber ? `Floor ${floorNumber}` : 'Floor 1',
            operationalStatus: 'available',
            housekeepingStatus: i % 4 === 1 ? 'dirty' : 'clean',
          })
          .returning();
        createdRooms.push(room);
      }

      return {
        property: propRecord,
        roomType: rt,
        rooms: createdRooms,
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Property onboarded and saved to PostgreSQL successfully',
    });
  } catch (error: any) {
    console.error('Onboarding API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
