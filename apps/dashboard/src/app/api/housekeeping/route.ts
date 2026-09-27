import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, roomTypes, eq } from '@sena/database';
import { HousekeepingService } from '@sena/housekeeping';
import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ rooms: [], tasks: [], staff: [], summary: {}, currentUserId: null });
    }

    const [workspace, types] = await Promise.all([
      HousekeepingService.getWorkspace(propertyId),
      db.select({ id: roomTypes.id, name: roomTypes.name }).from(roomTypes).where(eq(roomTypes.propertyId, propertyId)),
    ]);

    const typeName = new Map(types.map((type) => [type.id, type.name]));
    const openTasks = workspace.tasks.filter((task) => task.status === 'dirty' || task.status === 'cleaning');
    const taskByRoom = new Map<string, (typeof openTasks)[number]>();
    for (const task of openTasks) {
      if (!taskByRoom.has(task.roomId)) taskByRoom.set(task.roomId, task);
    }

    const roomsWithWork = workspace.rooms.map((room) => {
      const task = taskByRoom.get(room.id);
      return {
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        operationalStatus: room.operationalStatus,
        housekeepingStatus: room.housekeepingStatus,
        roomTypeId: room.roomTypeId,
        roomTypeName: typeName.get(room.roomTypeId) || 'Room',
        updatedAt: room.updatedAt,
        taskId: task?.id || null,
        assignedToUserId: task?.assignedToUserId || null,
        assignedTo: task?.assignedTo || null,
        taskUpdatedAt: task?.updatedAt || room.updatedAt,
      };
    });

    const summary = {
      clean: roomsWithWork.filter((r) => r.housekeepingStatus === 'clean' || r.housekeepingStatus === 'inspection' || r.housekeepingStatus === 'inspected').length,
      dirty: roomsWithWork.filter((r) => r.housekeepingStatus === 'dirty').length,
      cleaning: roomsWithWork.filter((r) => r.housekeepingStatus === 'cleaning').length,
      assigned: roomsWithWork.filter((r) => (r.housekeepingStatus === 'dirty' || r.housekeepingStatus === 'cleaning') && r.assignedToUserId).length,
      unassigned: roomsWithWork.filter((r) => r.housekeepingStatus === 'dirty' && !r.assignedToUserId).length,
      maintenance: roomsWithWork.filter((r) => r.operationalStatus === 'maintenance').length,
    };

    return NextResponse.json({
      rooms: roomsWithWork,
      tasks: workspace.tasks,
      staff: workspace.staff,
      summary,
      currentUserId: session?.user?.id || null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePATCH(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant?.propertyId) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }

    const body = await req.json();
    const roomId = typeof body.roomId === 'string' ? body.roomId : '';
    const action = typeof body.action === 'string' ? body.action : body.status ? 'status' : '';
    if (!roomId) {
      return NextResponse.json({ error: 'Choose a room.' }, { status: 400 });
    }

    const actor = {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Housekeeping Staff',
    };

    if (action === 'assign') {
      const assignedToUserId = body.assignedToUserId ? String(body.assignedToUserId) : null;
      const updated = await HousekeepingService.assignStaff(tenant.propertyId, roomId, assignedToUserId, actor);
      return NextResponse.json({ success: true, updated });
    }

    if (action === 'send_to_housekeeping' || body.status === 'dirty') {
      const updated = await HousekeepingService.sendToHousekeeping(tenant.propertyId, roomId, actor);
      return NextResponse.json({ success: true, updated });
    }

    const status = typeof body.status === 'string' ? body.status : '';
    if (!status) {
      return NextResponse.json({ error: 'Choose a housekeeping action.' }, { status: 400 });
    }

    const updated = await HousekeepingService.updateStatus(tenant.propertyId, roomId, status, actor);
    return NextResponse.json({ success: true, updated });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'housekeeping');
export const PATCH = withMerchant(handlePATCH, 'housekeeping');
