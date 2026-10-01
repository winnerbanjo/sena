import { and, db, eq, inArray, reservationNotes, sql, users } from '@sena/database';

const MAX_NOTE_LENGTH = 2000;

export function normalizeReservationNote(value: unknown): { ok: true; body: string } | { ok: false; error: string } {
  if (typeof value !== 'string') return { ok: false, error: 'Write the note before saving it.' };
  const body = value.trim();
  if (!body) return { ok: false, error: 'Write the note before saving it.' };
  if (body.length > MAX_NOTE_LENGTH) return { ok: false, error: 'A note can be up to 2000 characters.' };
  return { ok: true, body };
}

export async function listReservationNotes(propertyId: string, reservationId: string) {
  const rows = await db
    .select({
      id: reservationNotes.id,
      body: reservationNotes.body,
      createdAt: reservationNotes.createdAt,
      authorUserId: reservationNotes.authorUserId,
      authorName: users.fullName,
    })
    .from(reservationNotes)
    .leftJoin(users, eq(reservationNotes.authorUserId, users.id))
    .where(and(eq(reservationNotes.propertyId, propertyId), eq(reservationNotes.reservationId, reservationId)))
    .orderBy(reservationNotes.createdAt);
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    authorUserId: row.authorUserId,
    authorName: row.authorName || 'Staff',
  }));
}

export async function addReservationNote(input: {
  propertyId: string;
  reservationId: string;
  authorUserId: string;
  authorName: string;
  body: string;
}) {
  const [note] = await db
    .insert(reservationNotes)
    .values({
      propertyId: input.propertyId,
      reservationId: input.reservationId,
      authorUserId: input.authorUserId,
      body: input.body,
    })
    .returning();
  return {
    id: note.id,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
    authorUserId: note.authorUserId,
    authorName: input.authorName || 'Staff',
  };
}

export async function noteCountsByReservation(propertyId: string, reservationIds: string[]) {
  const counts = new Map<string, number>();
  if (!reservationIds.length) return counts;
  const rows = await db
    .select({
      reservationId: reservationNotes.reservationId,
      noteCount: sql<number>`count(*)::int`,
    })
    .from(reservationNotes)
    .where(and(eq(reservationNotes.propertyId, propertyId), inArray(reservationNotes.reservationId, reservationIds)))
    .groupBy(reservationNotes.reservationId);
  for (const row of rows) counts.set(row.reservationId, Number(row.noteCount) || 0);
  return counts;
}
