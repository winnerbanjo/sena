import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, properties, rooms, roomTypes, housekeepingTasks, users , propertyMembers, organizationMembers } from '@sena/database';
import { HousekeepingService } from '@sena/housekeeping';
import { eq, desc } from 'drizzle-orm';

import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ rooms: [], tasks: [], summary: {} });
    }

    const roomList = await db
      .select({
        id: rooms.id,
        roomNumber: rooms.roomNumber,
        floor: rooms.floor,
        operationalStatus: rooms.operationalStatus,
        housekeepingStatus: rooms.housekeepingStatus,
        roomTypeId: rooms.roomTypeId,
        roomTypeName: roomTypes.name,
      })
      .from(rooms)
      .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(rooms.propertyId, propertyId))
      .orderBy(rooms.roomNumber);

    const tasks = await db
      .select({
        id: housekeepingTasks.id,
        roomId: housekeepingTasks.roomId,
        status: housekeepingTasks.status,
        notes: housekeepingTasks.notes,
        createdAt: housekeepingTasks.createdAt,
        roomNumber: rooms.roomNumber,
        assignedTo: users.fullName,
      })
      .from(housekeepingTasks)
      .innerJoin(rooms, eq(housekeepingTasks.roomId, rooms.id))
      .leftJoin(users, eq(housekeepingTasks.assignedToUserId, users.id))
      .where(eq(housekeepingTasks.propertyId, propertyId))
      .orderBy(desc(housekeepingTasks.createdAt));

    const summary = {
      clean: roomList.filter((r) => r.housekeepingStatus === 'clean').length,
      dirty: roomList.filter((r) => r.housekeepingStatus === 'dirty').length,
      cleaning: roomList.filter((r) => r.housekeepingStatus === 'cleaning').length,
      inspected: roomList.filter((r) => r.housekeepingStatus === 'inspected').length,
      maintenance: roomList.filter((r) => r.operationalStatus === 'maintenance').length,
    };

    return NextResponse.json({ rooms: roomList, tasks, summary });
  } catch (error: any) {
    console.error('Housekeeping API error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePATCH(req: NextRequest) {
  try {
    const session = await auth();
    let propertyId = (session?.user as any)?.propertyId;

    if (!propertyId) {
      // Securely fetch property for this user instead of leaking firstProp
      const userId = session?.user?.id;
      if (userId) {
        const membership = await db.query.propertyMembers.findFirst({
          where: eq(propertyMembers.userId, userId)
        });
        if (membership) {
          propertyId = membership.propertyId;
        } else {
          // Try organization fallback
          const orgMembership = await db.query.organizationMembers.findFirst({
            where: eq(organizationMembers.userId, userId)
          });
          if (orgMembership) {
            const orgProp = await db.query.properties.findFirst({
              where: eq(properties.organizationId, orgMembership.organizationId)
            });
            if (orgProp) propertyId = orgProp.id;
          }
        }
      }
    }

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    }

    const body = await req.json();
    const { roomId, status } = body;

    if (!roomId || !status) {
      return NextResponse.json({ error: 'Room ID and status required' }, { status: 400 });
    }

    const actor = {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Housekeeping Staff',
    };

    const updated = await HousekeepingService.updateStatus(propertyId, roomId, status, actor);

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    console.error('Housekeeping update error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'housekeeping');

export const PATCH = withMerchant(handlePATCH, 'housekeeping');
