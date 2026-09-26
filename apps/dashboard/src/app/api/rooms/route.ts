import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, roomTypes, rooms, reservations, housekeepingTasks, properties, propertyMembers, organizationMembers, users } from '@sena/database';
import { eq, desc, ilike } from 'drizzle-orm';

import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function resolveProperty(session: any, req?: NextRequest): Promise<string | null> {
  const tenant = await resolveTenantForRequest(session, req);
  return tenant?.propertyId || null;
}

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const propertyId = await resolveProperty(session, req);

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
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await auth();
    const propertyId = await resolveProperty(session, req);

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

    if (action === 'create_room' || action === 'create_bulk_rooms') {
      const { roomNumber, roomNumbers, roomTypeId, floor, imageUrl } = body;

      let roomList: string[] = [];
      if (Array.isArray(roomNumbers) && roomNumbers.length > 0) {
        roomList = roomNumbers.map((s: any) => String(s).trim()).filter(Boolean);
      } else if (roomNumber) {
        const raw = String(roomNumber).trim();
        if (raw.includes(',')) {
          roomList = raw.split(',').map((s) => s.trim()).filter(Boolean);
        } else if (/^\d+\s*-\s*\d+$/.test(raw)) {
          const [start, end] = raw.split('-').map((s) => parseInt(s.trim(), 10));
          if (!isNaN(start) && !isNaN(end) && end >= start && end - start <= 100) {
            for (let i = start; i <= end; i++) {
              roomList.push(String(i));
            }
          } else {
            roomList = [raw];
          }
        } else {
          roomList = [raw];
        }
      }

      if (roomList.length === 0) {
        return NextResponse.json({ error: 'At least one room number is required' }, { status: 400 });
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
      const createdRooms: any[] = [];

      for (const num of roomList) {
        let roomFloor = floor;
        if (!roomFloor || roomFloor === 'Floor 1') {
          if (num.length >= 3 && /^\d+$/.test(num)) {
            const digit = num[0];
            roomFloor = `Floor ${digit}`;
          }
        }

        const [newRoom] = await db
          .insert(rooms)
          .values({
            propertyId,
            roomTypeId: targetRoomTypeId,
            roomNumber: num,
            floor: roomFloor || 'Floor 1',
            operationalStatus: 'available',
            housekeepingStatus: 'clean',
            notes: notesPayload,
          })
          .returning();
        createdRooms.push(newRoom);
      }

      // Update room type total inventory
      const count = await db.select().from(rooms).where(eq(rooms.roomTypeId, targetRoomTypeId));
      await db
        .update(roomTypes)
        .set({ totalInventory: count.length })
        .where(eq(roomTypes.id, targetRoomTypeId));

      return NextResponse.json({
        success: true,
        count: createdRooms.length,
        data: createdRooms[0],
        rooms: createdRooms,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error modifying rooms:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handleDELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type'); // 'room' (default) or 'category'

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    return await db.transaction(async (tx) => {
      if (type === 'category') {
        await tx.select({ id: roomTypes.id }).from(roomTypes).where(eq(roomTypes.id, id)).for('update');
        const [room] = await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.roomTypeId, id)).limit(1);
        const [booking] = await tx.select({ id: reservations.id }).from(reservations).where(eq(reservations.roomTypeId, id)).limit(1);
        if (room || booking) return NextResponse.json({ error: 'This category has rooms or reservation history. Keep it to preserve your records.' }, { status: 409 });
        const [deleted] = await tx.delete(roomTypes).where(eq(roomTypes.id, id)).returning();
        return NextResponse.json({ success: true, deleted });
      }
      await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, id)).for('update');
      const [booking] = await tx.select({ id: reservations.id }).from(reservations).where(eq(reservations.roomId, id)).limit(1);
      const [task] = await tx.select({ id: housekeepingTasks.id }).from(housekeepingTasks).where(eq(housekeepingTasks.roomId, id)).limit(1);
      if (booking || task) return NextResponse.json({ error: 'This room has operational history. Mark it out of service instead to preserve your records.' }, { status: 409 });
      const [deleted] = await tx.delete(rooms).where(eq(rooms.id, id)).returning();
      return NextResponse.json({ success: true, deleted });
    });
  } catch (error: any) {
    console.error('Error deleting room/category:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'rooms');

export const POST = withMerchant(handlePOST, 'rooms');

export const DELETE = withMerchant(handleDELETE, 'rooms');
