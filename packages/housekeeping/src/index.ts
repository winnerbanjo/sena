import { activityLogs, db, housekeepingTasks, properties, rooms } from '@sena/database';
import type { HousekeepingStatus } from '@sena/types';
import { and, eq } from 'drizzle-orm';

export class HousekeepingService {
  /**
   * Update Room Housekeeping Status
   * Transitions: Dirty -> Cleaning -> Clean -> Inspection
   */
  static async updateStatus(
    propertyId: string,
    roomId: string,
    newStatus: HousekeepingStatus,
    actor = { id: '', name: 'Housekeeper' }
  ) {
    return await db.transaction(async (tx) => {
      // 1. Fetch current room and property organization
      const roomList = await tx
        .select({
          id: rooms.id,
          roomNumber: rooms.roomNumber,
          housekeepingStatus: rooms.housekeepingStatus,
          organizationId: properties.organizationId,
        })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .where(and(eq(rooms.id, roomId), eq(rooms.propertyId, propertyId)))
        .limit(1);

      if (roomList.length === 0) {
        throw new Error('Room not found');
      }

      const room = roomList[0];
      const prevStatus = room.housekeepingStatus;

      // 2. Update Room Housekeeping Status
      await tx
        .update(rooms)
        .set({
          housekeepingStatus: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, roomId));

      // 3. Update or Complete Task
      const now = new Date();
      if (newStatus === 'clean') {
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
              eq(housekeepingTasks.status, 'cleaning')
            )
          );
      } else if (newStatus === 'cleaning') {
        await tx
          .update(housekeepingTasks)
          .set({
            status: 'cleaning',
            assignedToUserId: actor.id || undefined,
            startedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(housekeepingTasks.roomId, roomId),
              eq(housekeepingTasks.status, 'dirty')
            )
          );
      }

      // 4. Activity Log
      await tx.insert(activityLogs).values({
        organizationId: room.organizationId,
        propertyId,
        actorId: actor.id && actor.id.length > 0 ? actor.id : undefined,
        actorName: actor.name,
        action: `Room ${room.roomNumber} marked ${newStatus}`,
        resource: 'rooms',
        resourceId: roomId,
        previousValue: { housekeepingStatus: prevStatus },
        newValue: { housekeepingStatus: newStatus },
      });

      return { roomId, status: newStatus };
    });
  }

  /**
   * Get Housekeeping Counts
   * e.g. 6 Dirty, 3 Cleaning, 18 Clean, 2 Maintenance
   */
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
      } else if (r.housekeepingStatus === 'clean') {
        counts.clean++;
      }
    }

    return counts;
  }
}
