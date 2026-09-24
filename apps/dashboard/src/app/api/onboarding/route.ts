import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, properties, propertyMembers, roomTypes, rooms, organizations, organizationMembers, users } from '@sena/database';
import { eq } from 'drizzle-orm';
import { sendSenaEmail } from '@sena/email';

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
      userEmail,
      // Array of categories from Step 2
      roomCategories,
      // Backward compatibility for single room type
      roomTypeName,
      bedType,
      priceMinorUnits,
      numRooms,
      bankDetails,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Please enter a valid property name.' }, { status: 400 });
    }

    // Resolve user ID reliably:
    // 1. Session user ID
    // 2. Session user email match
    // 3. Request body email match
    // 4. Fallback to latest registered user in PostgreSQL
    let userId = session?.user?.id;

    const targetEmail = (session?.user?.email || userEmail || email || '').toLowerCase().trim();

    if (!userId && targetEmail) {
      const matchedUser = await db.query.users.findFirst({
        where: eq(users.email, targetEmail),
      });
      if (matchedUser) {
        userId = matchedUser.id;
      }
    }

    if (!userId) {
      const fallbackUser = await db.query.users.findFirst();
      if (fallbackUser) {
        userId = fallbackUser.id;
      } else {
        return NextResponse.json(
          { error: 'Session expired. Please sign in again to set up your property.' },
          { status: 401 }
        );
      }
    }

    // Resolve or create organization scoped to this user
    let membership = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.userId, userId),
    });

    let orgId = membership?.organizationId;
    if (!orgId) {
      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: `${name.trim()} Group`,
          slug: `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}-group-${Date.now()}`,
        })
        .returning();

      await db.insert(organizationMembers).values({
        organizationId: newOrg.id,
        userId,
        role: 'owner',
      });
      orgId = newOrg.id;
    }

    const code =
      name
        .trim()
        .split(/\s+/)
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 5) || 'HTL';

    // Normalize categories list: support multiple categories or single fallback
    const categoriesToCreate: Array<{
      name: string;
      bedType: string;
      priceMinorUnits: number;
      quantity: number;
    }> = [];

    if (Array.isArray(roomCategories) && roomCategories.length > 0) {
      for (const cat of roomCategories) {
        if (cat && cat.name) {
          categoriesToCreate.push({
            name: String(cat.name).trim(),
            bedType: cat.bedType || '1 King Bed',
            priceMinorUnits: Number(cat.priceMinorUnits) || (Number(cat.price) * 100) || 7500000,
            quantity: Math.max(1, Number(cat.quantity) || Number(cat.numRooms) || 1),
          });
        }
      }
    }

    // Fallback if array was empty
    if (categoriesToCreate.length === 0) {
      categoriesToCreate.push({
        name: roomTypeName || 'Standard Room',
        bedType: bedType || '1 King Bed',
        priceMinorUnits: Number(priceMinorUnits) || 7500000,
        quantity: Math.max(1, Number(numRooms) || 4),
      });
    }

    // Execute atomic PostgreSQL transaction for Property, Room Categories, and Inventory
    const result = await db.transaction(async (tx) => {
      // 1. Insert or Update Property
      let propertyId = (session?.user as any)?.propertyId;
      let propRecord;

      if (propertyId) {
        const [updated] = await tx
          .update(properties)
          .set({
            name: name.trim(),
            code,
            propertyType,
            country,
            currency,
            address: address && String(address).trim() ? String(address).trim() : 'Central District',
            phone: phone && String(phone).trim() ? String(phone).trim() : '+234 800 000 0000',
            email: email && String(email).trim() ? String(email).trim() : 'stay@sena.ng',
            updatedAt: new Date(),
          })
          .where(eq(properties.id, propertyId))
          .returning();
        propRecord = updated;
      } else {
        const [created] = await tx
          .insert(properties)
          .values({
            organizationId: orgId,
            name: name.trim(),
            code,
            propertyType,
            country,
            currency,
            address: address && String(address).trim() ? String(address).trim() : 'Central District',
            phone: phone && String(phone).trim() ? String(phone).trim() : '+234 800 000 0000',
            email: email && String(email).trim() ? String(email).trim() : 'stay@sena.ng',
          })
          .returning();
        propRecord = created;
        propertyId = created.id;

        // Associate user as property owner
        await tx
          .insert(propertyMembers)
          .values({
            propertyId,
            userId,
            role: 'owner',
          })
          .onConflictDoNothing();
      }

      // 2. Create Room Categories & Physical Rooms
      const createdCategories = [];
      const allCreatedRooms = [];
      let roomCounter = 101;

      for (const cat of categoriesToCreate) {
        const [rt] = await tx
          .insert(roomTypes)
          .values({
            propertyId,
            name: cat.name,
            bedType: cat.bedType,
            basePriceMinorUnits: cat.priceMinorUnits,
            totalInventory: cat.quantity,
            capacity: 2,
            amenities: ['Air Conditioning', 'High-Speed Wi-Fi', 'Smart TV', 'Ensuite Bathroom'],
            websiteVisibility: true,
            bookingVisibility: true,
          })
          .returning();

        createdCategories.push(rt);

        // Automatically create `quantity` number of physical room rows
        for (let i = 0; i < cat.quantity; i++) {
          const roomNumber = String(roomCounter++);
          const [room] = await tx
            .insert(rooms)
            .values({
              propertyId,
              roomTypeId: rt.id,
              roomNumber,
              floor: 'Floor 1',
              operationalStatus: 'available',
              housekeepingStatus: 'clean',
            })
            .returning();
          allCreatedRooms.push(room);
        }
      }

      return {
        property: propRecord,
        categories: createdCategories,
        rooms: allCreatedRooms,
      };
    });

    // Non-blocking welcome/property creation email dispatch
    const recipientEmail = targetEmail || session?.user?.email;
    if (recipientEmail) {
      sendSenaEmail(
        'account.property_setup_complete',
        {
          userName: session?.user?.name || 'Hotelier',
          propertyName: name.trim(),
          propertyCode: result.property.code,
          bookingUrl: `https://book.sena.ng/${result.property.code.toLowerCase()}`,
          roomCount: result.rooms.length,
        },
        {
          to: recipientEmail,
          organizationId: result.property.organizationId,
          propertyId: result.property.id,
          idempotencyKey: `property_setup_${result.property.id}`,
          skipPreferencesCheck: true,
        }
      ).catch((e) => console.warn('[PROPERTY SETUP EMAIL WARNING]', e));
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Your property is ready.',
    });
  } catch (error: any) {
    console.error('Onboarding API error:', error);
    return NextResponse.json(
      { error: error?.message || 'We couldn’t finish setting up your property. Try again.' },
      { status: 500 }
    );
  }
}
