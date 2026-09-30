import { activityLogs, apartments, db, housekeepingTasks, properties, propertyMembers, rooms, users } from '@sena/database';
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
  input: { propertyId: string; roomId?: string; apartmentId?: string; notes?: string }
) {
  if (!input.roomId && !input.apartmentId) throw new Error('Choose a room.');
  const unit = input.apartmentId
    ? eq(housekeepingTasks.apartmentId, input.apartmentId)
    : eq(housekeepingTasks.roomId, input.roomId!);
  const [open] = await tx
    .select()
    .from(housekeepingTasks)
    .where(
      and(
        eq(housekeepingTasks.propertyId, input.propertyId),
        unit,
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
      roomId: input.roomId || null,
      apartmentId: input.apartmentId || null,
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
        apartmentId: housekeepingTasks.apartmentId,
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

    const apartmentList = await db
      .select({
        id: apartments.id,
        name: apartments.name,
        apartmentType: apartments.apartmentType,
        operationalStatus: apartments.operationalStatus,
        housekeepingStatus: apartments.housekeepingStatus,
        updatedAt: apartments.updatedAt,
      })
      .from(apartments)
      .where(eq(apartments.propertyId, propertyId))
      .orderBy(apartments.name);

    return { rooms: roomList, apartments: apartmentList, tasks, staff: eligibleStaff };
  }

  static async sendApartmentToHousekeeping(
    propertyId: string,
    apartmentId: string,
    actor = { id: '', name: 'Staff' },
    notes?: string
  ) {
    return db.transaction(async (tx) => {
      const [apartment] = await tx
        .select({
          id: apartments.id,
          name: apartments.name,
          housekeepingStatus: apartments.housekeepingStatus,
          organizationId: properties.organizationId,
        })
        .from(apartments)
        .innerJoin(properties, eq(apartments.propertyId, properties.id))
        .where(and(eq(apartments.id, apartmentId), eq(apartments.propertyId, propertyId)))
        .limit(1)
        .for('update');
      if (!apartment) throw new Error('Apartment not found');
      const prevStatus = apartment.housekeepingStatus;
      if (apartment.housekeepingStatus !== 'dirty') {
        await tx.update(apartments).set({ housekeepingStatus: 'dirty', updatedAt: new Date() }).where(eq(apartments.id, apartmentId));
      }
      const task = await ensureOpenHousekeepingTask(tx, {
        propertyId,
        apartmentId,
        notes: notes || 'Sent to housekeeping from Apartments.',
      });
      await tx.insert(activityLogs).values({
        organizationId: apartment.organizationId,
        propertyId,
        actorId: actorUserId(actor),
        actorName: actor.name,
        action: `${apartment.name} sent to housekeeping`,
        resource: 'housekeeping',
        resourceId: apartmentId,
        previousValue: { housekeepingStatus: prevStatus },
        newValue: { housekeepingStatus: 'dirty', taskId: task.id },
      });
      return { apartmentId, status: 'dirty' as const, taskId: task.id };
    });
  }

  static async assignApartmentStaff(
    propertyId: string,
    apartmentId: string,
    assignedToUserId: string | null,
    actor = { id: '', name: 'Staff' }
  ) {
    return db.transaction(async (tx) => {
      const [apartment] = await tx
        .select({ id: apartments.id, name: apartments.name, organizationId: properties.organizationId })
        .from(apartments)
        .innerJoin(properties, eq(apartments.propertyId, properties.id))
        .where(and(eq(apartments.id, apartmentId), eq(apartments.propertyId, propertyId)))
        .limit(1)
        .for('update');
      if (!apartment) throw new Error('Apartment not found');
      if (assignedToUserId) {
        if (!UUID.test(assignedToUserId)) throw new Error('Choose a valid staff member.');
        const [member] = await tx
          .select({ userId: propertyMembers.userId, permissions: propertyMembers.permissions })
          .from(propertyMembers)
          .where(and(eq(propertyMembers.propertyId, propertyId), eq(propertyMembers.userId, assignedToUserId)))
          .limit(1);
        if (!member || isRevoked(member.permissions)) throw new Error('This staff member is not available in your property.');
      }
      const task = await ensureOpenHousekeepingTask(tx, { propertyId, apartmentId, notes: 'Opened for staff assignment.' });
      await tx.update(housekeepingTasks).set({ assignedToUserId: assignedToUserId || null, updatedAt: new Date() }).where(eq(housekeepingTasks.id, task.id));
      await tx.insert(activityLogs).values({
        organizationId: apartment.organizationId,
        propertyId,
        actorId: actorUserId(actor),
        actorName: actor.name,
        action: assignedToUserId ? `${apartment.name} housekeeping assigned` : `${apartment.name} housekeeping unassigned`,
        resource: 'housekeeping',
        resourceId: apartmentId,
        newValue: { assignedToUserId: assignedToUserId || null, taskId: task.id },
      });
      return { apartmentId, taskId: task.id, assignedToUserId: assignedToUserId || null };
    });
  }

  static async updateApartmentStatus(
    propertyId: string,
    apartmentId: string,
    newStatus: HousekeepingStatus,
    actor = { id: '', name: 'Housekeeper' }
  ) {
    if (!['clean', 'dirty', 'cleaning', 'inspection'].includes(newStatus)) throw new Error('Choose a valid housekeeping status.');
    if (newStatus === 'dirty') return this.sendApartmentToHousekeeping(propertyId, apartmentId, actor);
    return db.transaction(async (tx) => {
      const [apartment] = await tx
        .select({
          id: apartments.id,
          name: apartments.name,
          housekeepingStatus: apartments.housekeepingStatus,
          operationalStatus: apartments.operationalStatus,
          organizationId: properties.organizationId,
        })
        .from(apartments)
        .innerJoin(properties, eq(apartments.propertyId, properties.id))
        .where(and(eq(apartments.id, apartmentId), eq(apartments.propertyId, propertyId)))
        .limit(1)
        .for('update');
      if (!apartment) throw new Error('Apartment not found');
      const now = new Date();
      const assignee = actorUserId(actor);
      await tx.update(apartments).set({ housekeepingStatus: newStatus, updatedAt: now }).where(eq(apartments.id, apartmentId));
      if (newStatus === 'cleaning') {
        const task = await ensureOpenHousekeepingTask(tx, { propertyId, apartmentId, notes: 'Cleaning started.' });
        await tx.update(housekeepingTasks).set({
          status: 'cleaning',
          assignedToUserId: task.assignedToUserId || assignee,
          startedAt: task.startedAt || now,
          updatedAt: now,
        }).where(eq(housekeepingTasks.id, task.id));
      } else if (newStatus === 'clean' || newStatus === 'inspection') {
        await tx.update(housekeepingTasks).set({ status: 'clean', completedAt: now, updatedAt: now }).where(
          and(eq(housekeepingTasks.propertyId, propertyId), eq(housekeepingTasks.apartmentId, apartmentId), inArray(housekeepingTasks.status, ['dirty', 'cleaning']))
        );
      }
      await tx.insert(activityLogs).values({
        organizationId: apartment.organizationId,
        propertyId,
        actorId: assignee,
        actorName: actor.name,
        action: `${apartment.name} marked ${newStatus}`,
        resource: 'apartments',
        resourceId: apartmentId,
        previousValue: { housekeepingStatus: apartment.housekeepingStatus },
        newValue: { housekeepingStatus: newStatus },
      });
      return { apartmentId, status: newStatus, operationalStatus: apartment.operationalStatus };
    });
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
