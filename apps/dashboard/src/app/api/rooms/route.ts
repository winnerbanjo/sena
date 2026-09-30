import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { categoryUpdateFields, galleryDisplayUrls, type GalleryPhoto } from '@/lib/room-gallery';
import { mergeRoomNotes, roomUpdateFields } from '@/lib/room-edit';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { activityLogs, db, roomImages, roomTypes, rooms, reservations, housekeepingTasks, properties, propertyMembers, organizationMembers, users } from '@sena/database';
import { and, asc, eq, desc, ilike, inArray } from 'drizzle-orm';

import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function resolveProperty(session: any, req?: NextRequest): Promise<string | null> {
  const tenant = await resolveTenantForRequest(session, req);
  return tenant?.propertyId || null;
}

async function handleGET(req: NextRequest) {
  try {
    const propertyId = getMerchantRequest(req)?.tenant.propertyId || (await resolveProperty(await auth(), req));

    if (!propertyId) {
      return NextResponse.json({ roomTypes: [], rooms: [] });
    }

    const [fetchedRoomTypes, fetchedRooms, openTasks, galleryRows] = await Promise.all([
      db
        .select()
        .from(roomTypes)
        .where(eq(roomTypes.propertyId, propertyId))
        .orderBy(desc(roomTypes.createdAt)),
      db
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
        .orderBy(rooms.roomNumber),
      db
        .select({
          roomId: housekeepingTasks.roomId,
          taskId: housekeepingTasks.id,
          taskStatus: housekeepingTasks.status,
          assignedToUserId: housekeepingTasks.assignedToUserId,
          assignedTo: users.fullName,
          updatedAt: housekeepingTasks.updatedAt,
        })
        .from(housekeepingTasks)
        .leftJoin(users, eq(housekeepingTasks.assignedToUserId, users.id))
        .where(and(eq(housekeepingTasks.propertyId, propertyId), inArray(housekeepingTasks.status, ['dirty', 'cleaning']))),
      db.select().from(roomImages).where(eq(roomImages.propertyId, propertyId)).orderBy(asc(roomImages.sortOrder)),
    ]);

    const toPhoto = (row: (typeof galleryRows)[number]): GalleryPhoto => ({
      id: row.id,
      url: row.url,
      isCover: row.isCover,
      sortOrder: row.sortOrder,
    });
    const categoryGallery = (roomTypeId: string) => galleryRows.filter((row) => row.roomTypeId === roomTypeId).map(toPhoto);
    const roomGallery = (roomId: string) => galleryRows.filter((row) => row.roomId === roomId).map(toPhoto);

    const taskByRoom = new Map<string, (typeof openTasks)[number]>();
    for (const task of openTasks) {
      if (task.roomId && !taskByRoom.has(task.roomId)) taskByRoom.set(task.roomId, task);
    }

    return NextResponse.json({
      roomTypes: fetchedRoomTypes.map((roomType) => {
        const gallery = categoryGallery(roomType.id);
        const images = gallery.length > 0 ? galleryDisplayUrls(gallery) : roomType.images || [];
        return { ...roomType, images, gallery };
      }),
      rooms: fetchedRooms.map((room) => {
        const task = taskByRoom.get(room.id);
        const gallery = roomGallery(room.id);
        const category = categoryGallery(room.roomTypeId);
        return {
          ...room,
          gallery,
          categoryGallery: category,
          categoryImages: category.length > 0 ? galleryDisplayUrls(category) : room.categoryImages,
          housekeepingTaskId: task?.taskId || null,
          housekeepingAssigneeId: task?.assignedToUserId || null,
          housekeepingAssignee: task?.assignedTo || null,
        };
      }),
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
      const categoryImages = (Array.isArray(images) && images.length > 0 ? images : imageUrl ? [imageUrl] : [])
        .map((entry: unknown) => {
          if (entry && typeof entry === 'object' && 'url' in entry) {
            const url = String((entry as { url?: string }).url || '').trim();
            const storageKey = String((entry as { storageKey?: string }).storageKey || url).trim();
            return { url, storageKey };
          }
          const url = String(entry || '').trim();
          return { url, storageKey: url };
        })
        .filter((entry: { url: string }) => entry.url.length > 0 && !entry.url.startsWith('data:'));

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
          images: categoryImages.map((entry) => entry.url),
          totalInventory: 0,
        })
        .returning();

      if (categoryImages.length > 0) {
        await db.insert(roomImages).values(
          categoryImages.map((entry, sortOrder) => ({
            propertyId,
            roomTypeId: newType.id,
            storageKey: entry.storageKey,
            url: entry.url,
            contentType: 'image/jpeg',
            byteSize: 0,
            sortOrder,
            isCover: sortOrder === 0,
            uploadedByUserId: session?.user?.id,
          }))
        );
      }

      return NextResponse.json({ success: true, data: newType });
    }

    if (action === 'update_category') {
      const decision = categoryUpdateFields(body);
      if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: 400 });
      const categoryId = String(body.id || '');
      const [current] = await db
        .select()
        .from(roomTypes)
        .where(and(eq(roomTypes.id, categoryId), eq(roomTypes.propertyId, propertyId)))
        .limit(1);
      if (!current) return NextResponse.json({ error: 'That category could not be found for this property.' }, { status: 404 });

      const [updated] = await db
        .update(roomTypes)
        .set({ ...decision.fields, updatedAt: new Date() })
        .where(and(eq(roomTypes.id, current.id), eq(roomTypes.propertyId, propertyId)))
        .returning();

      const merchant = getMerchantRequest(req);
      const organizationId =
        merchant?.tenant.property.organizationId ||
        (
          await db
            .select({ organizationId: properties.organizationId })
            .from(properties)
            .where(eq(properties.id, propertyId))
            .limit(1)
        )[0]?.organizationId;
      if (!organizationId) return NextResponse.json({ success: true, data: updated });
      await db.insert(activityLogs).values({
        organizationId,
        propertyId,
        actorId: merchant?.tenant.userId || session?.user?.id,
        actorName: merchant?.tenant.user.fullName || 'Staff',
        action: 'room_category.updated',
        resource: 'room_type',
        resourceId: updated.id,
        previousValue: {
          name: current.name,
          bedType: current.bedType,
          basePriceMinorUnits: current.basePriceMinorUnits,
          description: current.description,
          capacity: current.capacity,
          amenities: current.amenities,
        },
        newValue: decision.fields,
      });

      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'update_room') {
      const decision = roomUpdateFields(body);
      if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: 400 });
      const roomId = String(body.id || '');
      const [current] = await db
        .select()
        .from(rooms)
        .where(and(eq(rooms.id, roomId), eq(rooms.propertyId, propertyId)))
        .limit(1);
      if (!current) return NextResponse.json({ error: 'That room could not be found for this property.' }, { status: 404 });

      const [category] = await db
        .select({ id: roomTypes.id })
        .from(roomTypes)
        .where(and(eq(roomTypes.id, decision.fields.roomTypeId), eq(roomTypes.propertyId, propertyId)))
        .limit(1);
      if (!category) return NextResponse.json({ error: 'That category could not be found for this property.' }, { status: 404 });

      const [clash] = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(and(eq(rooms.propertyId, propertyId), eq(rooms.roomNumber, decision.fields.roomNumber)))
        .limit(1);
      if (clash && clash.id !== current.id) {
        return NextResponse.json({ error: 'That room number is already in use.' }, { status: 409 });
      }

      const [updated] = await db
        .update(rooms)
        .set({
          roomNumber: decision.fields.roomNumber,
          roomTypeId: decision.fields.roomTypeId,
          floor: decision.fields.floor,
          operationalStatus: decision.fields.operationalStatus,
          housekeepingStatus: decision.fields.housekeepingStatus,
          notes: mergeRoomNotes(current.notes, decision.fields.description),
          updatedAt: new Date(),
        })
        .where(and(eq(rooms.id, current.id), eq(rooms.propertyId, propertyId)))
        .returning();

      if (current.roomTypeId !== updated.roomTypeId) {
        for (const typeId of [current.roomTypeId, updated.roomTypeId]) {
          const assigned = await db
            .select({ id: rooms.id })
            .from(rooms)
            .where(and(eq(rooms.roomTypeId, typeId), eq(rooms.propertyId, propertyId)));
          await db
            .update(roomTypes)
            .set({ totalInventory: assigned.length })
            .where(and(eq(roomTypes.id, typeId), eq(roomTypes.propertyId, propertyId)));
        }
      }

      const merchant = getMerchantRequest(req);
      const organizationId =
        merchant?.tenant.property.organizationId ||
        (
          await db
            .select({ organizationId: properties.organizationId })
            .from(properties)
            .where(eq(properties.id, propertyId))
            .limit(1)
        )[0]?.organizationId;
      if (organizationId) {
        await db.insert(activityLogs).values({
          organizationId,
          propertyId,
          actorId: merchant?.tenant.userId || session?.user?.id,
          actorName: merchant?.tenant.user.fullName || 'Staff',
          action: 'room.updated',
          resource: 'room',
          resourceId: updated.id,
          previousValue: {
            roomNumber: current.roomNumber,
            roomTypeId: current.roomTypeId,
            floor: current.floor,
            operationalStatus: current.operationalStatus,
            housekeepingStatus: current.housekeepingStatus,
          },
          newValue: {
            roomNumber: updated.roomNumber,
            roomTypeId: updated.roomTypeId,
            floor: updated.floor,
            operationalStatus: updated.operationalStatus,
            housekeepingStatus: updated.housekeepingStatus,
          },
        });
      }

      return NextResponse.json({ success: true, data: updated });
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

      const roomImageUrls: { url: string; storageKey: string }[] =
        roomList.length === 1 && Array.isArray(body.images)
          ? body.images
              .map((entry: unknown) => {
                if (entry && typeof entry === 'object' && 'url' in entry) {
                  const url = String((entry as { url?: string }).url || '').trim();
                  return { url, storageKey: String((entry as { storageKey?: string }).storageKey || url) };
                }
                const url = String(entry || '').trim();
                return { url, storageKey: url };
              })
              .filter((entry: { url: string }) => entry.url && !entry.url.startsWith('data:'))
          : [];
      const singleLegacyUrl =
        roomList.length === 1 && roomImageUrls.length === 0 && imageUrl && !String(imageUrl).startsWith('data:')
          ? String(imageUrl)
          : '';
      const coverUrl = roomImageUrls[0]?.url || singleLegacyUrl;
      const notesPayload = coverUrl ? JSON.stringify({ imageUrl: coverUrl }) : null;
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

      if (createdRooms.length === 1 && roomImageUrls.length > 0) {
        await db.insert(roomImages).values(
          roomImageUrls.map((entry, sortOrder) => ({
            propertyId,
            roomId: createdRooms[0].id,
            storageKey: entry.storageKey,
            url: entry.url,
            contentType: 'image/jpeg',
            byteSize: 0,
            sortOrder,
            isCover: sortOrder === 0,
            uploadedByUserId: session?.user?.id,
          }))
        );
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
