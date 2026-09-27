import { activityLogs, db, housekeepingTasks, properties, propertyMembers, rooms, users } from '@sena/database';
import type { HousekeepingStatus } from '@sena/types';
import { and, desc, eq, inArray } from 'drizzle-orm';

const OPEN_TASK_STATUSES = ['dirty', 'cleaning'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function actorUserId(actor: { id?: string }) {
  return actor.id && UUID.test(actor.id) ? actor.id : undefined;
}

function isRevoked(permissions: unknown) {
  return Array.isArray(permissions) && permissions.includes('status:revoked');
}

export async function ensureOpenHousekeepingTask(
  tx: any,
  input: { propertyId: string; roomId: string; notes?: string }
) {
  const [open] = await tx
    .select()
    .from(housekeepingTasks)
    .where(
      and(
        eq(housekeepingTasks.propertyId, input.propertyId),
        eq(housekeepingTasks.roomId, input.roomId),
        inArray(housekeepingTasks.status, [...OPEN_TASK_STATUSES])
      )
    )
    .orderBy(desc(housekeepingTasks.createdAt))
    .limit(1)
    .for('update');

  if (open) return open;

  const [created] = await tx
    .insert(housekeepingTasks)
    .values({
      propertyId: input.propertyId,
      roomId: input.roomId,
      status: 'dirty',
      notes: input.notes,
    })
    .returning();

  return created;
}

export class HousekeepingService {
  static async sendToHousekeeping(
    propertyId: string,
    roomId: string,
    actor = { id: '', name: 'Staff' },
    notes?: string
  ) {
    return await db.transaction(async (tx) => {
      const [room] = await tx
        .select({
          id: rooms.id,
          roomNumber: rooms.roomNumber,
          housekeepingStatus: rooms.housekeepingStatus,
          operationalStatus: rooms.operationalStatus,
          organizationId: properties.organizationId,
        })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .where(and(eq(rooms.id, roomId), eq(rooms.propertyId, propertyId)))
        .limit(1)
        .for('update');

      if (!room) throw new Error('Room not found');

      const prevStatus = room.housekeepingStatus;
      if (room.housekeepingStatus !== 'dirty') {
        await tx
          .update(rooms)
          .set({ housekeepingStatus: 'dirty', updatedAt: new Date() })
          .where(eq(rooms.id, roomId));
      }

      const task = await ensureOpenHousekeepingTask(tx, {
        propertyId,
        roomId,
        notes: notes || `Sent to housekeeping from Rooms.`,
      });

      await tx.insert(activityLogs).values({
        organizationId: room.organizationId,
        propertyId,
        actorId: actorUserId(actor),
        actorName: actor.name,
        action: `Room ${room.roomNumber} sent to housekeeping`,
        resource: 'housekeeping',
        resourceId: roomId,
        previousValue: { housekeepingStatus: prevStatus },
        newValue: { housekeepingStatus: 'dirty', taskId: task.id },
      });

      return { roomId, status: 'dirty' as const, taskId: task.id };
    });
  }

  static async assignStaff(
    propertyId: string,
    roomId: string,
    assignedToUserId: string | null,
    actor = { id: '', name: 'Staff' }
  ) {
    return await db.transaction(async (tx) => {
      const [room] = await tx
        .select({
          id: rooms.id,
          roomNumber: rooms.roomNumber,
          organizationId: properties.organizationId,
        })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .where(and(eq(rooms.id, roomId), eq(rooms.propertyId, propertyId)))
        .limit(1)
        .for('update');

      if (!room) throw new Error('Room not found');

      if (assignedToUserId) {
        if (!UUID.test(assignedToUserId)) throw new Error('Choose a valid staff member.');
        const [member] = await tx
          .select({
            userId: propertyMembers.userId,
            permissions: propertyMembers.permissions,
            name: users.fullName,
          })
          .from(propertyMembers)
          .innerJoin(users, eq(propertyMembers.userId, users.id))
          .where(and(eq(propertyMembers.propertyId, propertyId), eq(propertyMembers.userId, assignedToUserId)))
          .limit(1);
        if (!member || isRevoked(member.permissions)) {
          throw new Error('This staff member is not available in your property.');
        }
      }

      const task = await ensureOpenHousekeepingTask(tx, { propertyId, roomId, notes: 'Opened for staff assignment.' });
      const now = new Date();
      await tx
        .update(housekeepingTasks)
        .set({
          assignedToUserId: assignedToUserId || null,
          updatedAt: now,
        })
        .where(eq(housekeepingTasks.id, task.id));

      await tx.insert(activityLogs).values({
        organizationId: room.organizationId,
        propertyId,
        actorId: actorUserId(actor),
        actorName: actor.name,
        action: assignedToUserId
          ? `Room ${room.roomNumber} housekeeping assigned`
          : `Room ${room.roomNumber} housekeeping unassigned`,
        resource: 'housekeeping',
        resourceId: roomId,
        newValue: { assignedToUserId: assignedToUserId || null, taskId: task.id },
      });

      return { roomId, taskId: task.id, assignedToUserId: assignedToUserId || null };
    });
  }

  static async updateStatus(
    propertyId: string,
    roomId: string,
    newStatus: HousekeepingStatus,
    actor = { id: '', name: 'Housekeeper' }
  ) {
    if (!['clean', 'dirty', 'cleaning', 'inspection'].includes(newStatus)) {
      throw new Error('Choose a valid housekeeping status.');
    }
    if (newStatus === 'dirty') {
      return this.sendToHousekeeping(propertyId, roomId, actor);
    }

    return await db.transaction(async (tx) => {
      const roomList = await tx
        .select({
          id: rooms.id,
          roomNumber: rooms.roomNumber,
          housekeepingStatus: rooms.housekeepingStatus,
          operationalStatus: rooms.operationalStatus,
          organizationId: properties.organizationId,
        })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .where(and(eq(rooms.id, roomId), eq(rooms.propertyId, propertyId)))
        .limit(1)
        .for('update');

      if (roomList.length === 0) {
        throw new Error('Room not found');
      }

      const room = roomList[0];
      const prevStatus = room.housekeepingStatus;
      const now = new Date();
      const assignee = actorUserId(actor);

      await tx
        .update(rooms)
        .set({
          housekeepingStatus: newStatus,
          updatedAt: now,
        })
        .where(eq(rooms.id, roomId));

      if (newStatus === 'cleaning') {
        const task = await ensureOpenHousekeepingTask(tx, { propertyId, roomId, notes: 'Cleaning started.' });
        await tx
          .update(housekeepingTasks)
          .set({
            status: 'cleaning',
            assignedToUserId: task.assignedToUserId || assignee,
            startedAt: task.startedAt || now,
            updatedAt: now,
          })
          .where(eq(housekeepingTasks.id, task.id));
      } else if (newStatus === 'clean' || newStatus === 'inspection') {
        await tx
          .update(housekeepingTasks)
          .set({
            status: 'clean',
            completedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(housekeepingTasks.roomId, roomId),
              eq(housekeepingTasks.propertyId, propertyId),
              inArray(housekeepingTasks.status, [...OPEN_TASK_STATUSES])
            )
          );
      }

      await tx.insert(activityLogs).values({
        organizationId: room.organizationId,
        propertyId,
        actorId: assignee,
        actorName: actor.name,
        action: `Room ${room.roomNumber} marked ${newStatus}`,
        resource: 'rooms',
        resourceId: roomId,
        previousValue: { housekeepingStatus: prevStatus, operationalStatus: room.operationalStatus },
        newValue: { housekeepingStatus: newStatus, operationalStatus: room.operationalStatus },
      });

      return { roomId, status: newStatus, operationalStatus: room.operationalStatus };
    });
  }

  static async getWorkspace(propertyId: string) {
    const roomList = await db
      .select({
        id: rooms.id,
        roomNumber: rooms.roomNumber,
        floor: rooms.floor,
        operationalStatus: rooms.operationalStatus,
        housekeepingStatus: rooms.housekeepingStatus,
        roomTypeId: rooms.roomTypeId,
        updatedAt: rooms.updatedAt,
      })
      .from(rooms)
      .where(eq(rooms.propertyId, propertyId))
      .orderBy(rooms.roomNumber);

    const tasks = await db
      .select({
        id: housekeepingTasks.id,
        roomId: housekeepingTasks.roomId,
        status: housekeepingTasks.status,
        notes: housekeepingTasks.notes,
        assignedToUserId: housekeepingTasks.assignedToUserId,
        assignedTo: users.fullName,
        startedAt: housekeepingTasks.startedAt,
        completedAt: housekeepingTasks.completedAt,
        createdAt: housekeepingTasks.createdAt,
        updatedAt: housekeepingTasks.updatedAt,
      })
      .from(housekeepingTasks)
      .leftJoin(users, eq(housekeepingTasks.assignedToUserId, users.id))
      .where(eq(housekeepingTasks.propertyId, propertyId))
      .orderBy(desc(housekeepingTasks.createdAt));

    const staff = await db
      .select({
        userId: users.id,
        name: users.fullName,
        role: propertyMembers.role,
        permissions: propertyMembers.permissions,
      })
      .from(propertyMembers)
      .innerJoin(users, eq(propertyMembers.userId, users.id))
      .where(eq(propertyMembers.propertyId, propertyId));

    const eligibleStaff = staff
      .filter((member) => !isRevoked(member.permissions) && !(Array.isArray(member.permissions) && member.permissions.includes('status:invited')))
      .map((member) => ({ userId: member.userId, name: member.name, role: member.role }));

    return { rooms: roomList, tasks, staff: eligibleStaff };
  }

  static async getSummary(propertyId: string) {
    const allRooms = await db
      .select({
        housekeepingStatus: rooms.housekeepingStatus,
        operationalStatus: rooms.operationalStatus,
      })
      .from(rooms)
      .where(eq(rooms.propertyId, propertyId));

    const counts = {
      dirty: 0,
      cleaning: 0,
      clean: 0,
      maintenance: 0,
      total: allRooms.length,
    };

    for (const r of allRooms) {
      if (r.operationalStatus === 'maintenance') {
        counts.maintenance++;
      } else if (r.housekeepingStatus === 'dirty') {
        counts.dirty++;
      } else if (r.housekeepingStatus === 'cleaning') {
        counts.cleaning++;
      } else if (r.housekeepingStatus === 'clean' || r.housekeepingStatus === 'inspection' || r.housekeepingStatus === 'inspected') {
        counts.clean++;
      }
    }

    return counts;
  }
}
