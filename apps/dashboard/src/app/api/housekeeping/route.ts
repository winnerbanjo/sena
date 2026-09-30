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
      if (task.roomId && !taskByRoom.has(task.roomId)) taskByRoom.set(task.roomId, task);
    }

    const taskByApartment = new Map<string, (typeof openTasks)[number]>();
    for (const task of openTasks) {
      if (task.apartmentId && !taskByApartment.has(task.apartmentId)) taskByApartment.set(task.apartmentId, task);
    }

    const roomsWithWork = [
      ...workspace.rooms.map((room) => {
        const task = taskByRoom.get(room.id);
        return {
          id: room.id,
          kind: 'room' as const,
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
      }),
      ...workspace.apartments.map((apartment) => {
        const task = taskByApartment.get(apartment.id);
        return {
          id: apartment.id,
          kind: 'apartment' as const,
          roomNumber: apartment.name,
          floor: '',
          operationalStatus: apartment.operationalStatus,
          housekeepingStatus: apartment.housekeepingStatus,
          roomTypeId: null,
          roomTypeName: apartment.apartmentType,
          updatedAt: apartment.updatedAt,
          taskId: task?.id || null,
          assignedToUserId: task?.assignedToUserId || null,
          assignedTo: task?.assignedTo || null,
          taskUpdatedAt: task?.updatedAt || apartment.updatedAt,
        };
      }),
    ];

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
    const apartmentId = typeof body.apartmentId === 'string' ? body.apartmentId : '';
    const action = typeof body.action === 'string' ? body.action : body.status ? 'status' : '';
    const actor = {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Housekeeping Staff',
    };
    if (!roomId && !apartmentId) {
      return NextResponse.json({ error: 'Choose a room.' }, { status: 400 });
    }
    if (apartmentId) {
      if (action === 'assign') {
        const updated = await HousekeepingService.assignApartmentStaff(tenant.propertyId, apartmentId, body.assignedToUserId ? String(body.assignedToUserId) : null, actor);
        return NextResponse.json({ success: true, updated });
      }
      if (action === 'send_to_housekeeping' || body.status === 'dirty') {
        const updated = await HousekeepingService.sendApartmentToHousekeeping(tenant.propertyId, apartmentId, actor);
        return NextResponse.json({ success: true, updated });
      }
      const apartmentStatus = typeof body.status === 'string' ? body.status : '';
      if (!apartmentStatus) return NextResponse.json({ error: 'Choose a housekeeping action.' }, { status: 400 });
      const updated = await HousekeepingService.updateApartmentStatus(tenant.propertyId, apartmentId, apartmentStatus as 'clean' | 'dirty' | 'cleaning' | 'inspection', actor);
      return NextResponse.json({ success: true, updated });
    }

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
