import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, roomTypes, rooms, properties, propertyMembers, organizationMembers } from '@sena/database';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function resolveProperty(session: any): Promise<string | null> {
  let propertyId = (session?.user as any)?.propertyId;

  if (!propertyId) {
    const userId = session?.user?.id;
    if (userId) {
      const membership = await db.query.propertyMembers.findFirst({
        where: eq(propertyMembers.userId, userId),
      });
      if (membership) {
        propertyId = membership.propertyId;
      } else {
        const orgMembership = await db.query.organizationMembers.findFirst({
          where: eq(organizationMembers.userId, userId),
        });
        if (orgMembership) {
          const orgProp = await db.query.properties.findFirst({
            where: eq(properties.organizationId, orgMembership.organizationId),
          });
          if (orgProp) propertyId = orgProp.id;
        }
      }
    }
  }

  // Canonical fallback to primary property
  if (!propertyId) {
    const firstProp = await db.query.properties.findFirst();
    if (firstProp) propertyId = firstProp.id;
  }

  return propertyId || null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const propertyId = await resolveProperty(session);

    if (!propertyId) {
      return NextResponse.json({ roomTypes: [], rooms: [] });
    }

    const fetchedRoomTypes = await db
      .select()
      .from(roomTypes)
      .where(eq(roomTypes.propertyId, propertyId))
      .orderBy(desc(roomTypes.createdAt));

    const fetchedRooms = await db
      .select({
        id: rooms.id,
        roomNumber: rooms.roomNumber,
        roomTypeId: rooms.roomTypeId,
        floor: rooms.floor,
        operationalStatus: rooms.operationalStatus,
        housekeepingStatus: rooms.housekeepingStatus,
        notes: rooms.notes,
        roomTypeName: roomTypes.name,
        priceMinorUnits: roomTypes.basePriceMinorUnits,
        bedType: roomTypes.bedType,
        categoryImages: roomTypes.images,
      })
      .from(rooms)
      .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(rooms.propertyId, propertyId))
      .orderBy(rooms.roomNumber);

    return NextResponse.json({
      roomTypes: fetchedRoomTypes,
      rooms: fetchedRooms,
    });
  } catch (error: any) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const propertyId = await resolveProperty(session);

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'create_category') {
      const { name, bedType, basePriceMinorUnits, description, capacity, amenities, images, imageUrl } = body;
      const categoryImages: string[] = Array.isArray(images) && images.length > 0
        ? images
        : imageUrl
        ? [imageUrl]
        : [];

      const [newType] = await db
        .insert(roomTypes)
        .values({
          propertyId,
          name: name ? String(name).trim() : 'Deluxe Room',
          bedType: bedType || '1 King Bed',
          basePriceMinorUnits: Number(basePriceMinorUnits) || 7500000,
          description: description || '',
          capacity: Number(capacity) || 2,
          amenities: amenities || ['Air Conditioning', 'Wi-Fi'],
          images: categoryImages,
          totalInventory: 0,
        })
        .returning();

      return NextResponse.json({ success: true, data: newType });
    }

    if (action === 'create_room') {
      const { roomNumber, roomTypeId, floor, imageUrl } = body;

      if (!roomNumber) {
        return NextResponse.json({ error: 'Room number is required' }, { status: 400 });
      }

      let targetRoomTypeId = roomTypeId;
      if (!targetRoomTypeId) {
        const defaultType = await db.query.roomTypes.findFirst({
          where: eq(roomTypes.propertyId, propertyId),
        });
        if (defaultType) {
          targetRoomTypeId = defaultType.id;
        } else {
          const [autoType] = await db
            .insert(roomTypes)
            .values({
              propertyId,
              name: 'Deluxe Room',
              bedType: '1 King Bed',
              basePriceMinorUnits: 7500000,
              description: 'Elegantly appointed guest room.',
              capacity: 2,
              amenities: ['Air Conditioning', 'Wi-Fi', 'Smart TV'],
              totalInventory: 0,
            })
            .returning();
          targetRoomTypeId = autoType.id;
        }
      }

      const notesPayload = imageUrl ? JSON.stringify({ imageUrl }) : null;

      const [newRoom] = await db
        .insert(rooms)
        .values({
          propertyId,
          roomTypeId: targetRoomTypeId,
          roomNumber: String(roomNumber).trim(),
          floor: floor || 'Floor 1',
          operationalStatus: 'available',
          housekeepingStatus: 'clean',
          notes: notesPayload,
        })
        .returning();

      // Update room type total inventory
      const count = await db.select().from(rooms).where(eq(rooms.roomTypeId, targetRoomTypeId));
      await db
        .update(roomTypes)
        .set({ totalInventory: count.length })
        .where(eq(roomTypes.id, targetRoomTypeId));

      return NextResponse.json({ success: true, data: newRoom });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error modifying rooms:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
    }

    const [deleted] = await db.delete(rooms).where(eq(rooms.id, id)).returning();
    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Error deleting room:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
