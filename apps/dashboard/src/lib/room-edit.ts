const OPERATIONAL_STATUSES = ['available', 'occupied', 'blocked', 'maintenance'] as const;
const HOUSEKEEPING_STATUSES = ['clean', 'dirty', 'cleaning', 'inspection'] as const;

export function roomDescriptionFromNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return typeof parsed.description === 'string' ? parsed.description : '';
    }
  } catch {
    return notes;
  }
  return '';
}

/** Keep a legacy room photo URL stored in notes while saving a staff note. */
export function mergeRoomNotes(existingNotes: string | null | undefined, description: string): string | null {
  let imageUrl = '';
  if (existingNotes) {
    try {
      const parsed = JSON.parse(existingNotes);
      if (parsed && typeof parsed === 'object' && typeof parsed.imageUrl === 'string') imageUrl = parsed.imageUrl;
    } catch {
      // A plain-text note is replaced by the description the staff just saved.
    }
  }
  const text = description.trim();
  if (imageUrl) return JSON.stringify(text ? { imageUrl, description: text } : { imageUrl });
  return text || null;
}

export function roomUpdateFields(input: {
  roomNumber?: string;
  roomTypeId?: string;
  floor?: string | null;
  operationalStatus?: string;
  housekeepingStatus?: string;
  description?: string;
}):
  | {
      ok: true;
      fields: {
        roomNumber: string;
        roomTypeId: string;
        floor: string | null;
        operationalStatus: (typeof OPERATIONAL_STATUSES)[number];
        housekeepingStatus: (typeof HOUSEKEEPING_STATUSES)[number];
        description: string;
      };
    }
  | { ok: false; error: string } {
  const roomNumber = String(input.roomNumber || '').trim();
  if (!roomNumber || roomNumber.length > 50) return { ok: false, error: 'Enter a room number.' };
  const roomTypeId = String(input.roomTypeId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(roomTypeId)) return { ok: false, error: 'Choose a room category.' };
  const operationalStatus = String(input.operationalStatus || 'available');
  if (!OPERATIONAL_STATUSES.includes(operationalStatus as (typeof OPERATIONAL_STATUSES)[number])) {
    return { ok: false, error: 'Choose a valid operational status.' };
  }
  const housekeepingStatus = String(input.housekeepingStatus || 'clean');
  if (!HOUSEKEEPING_STATUSES.includes(housekeepingStatus as (typeof HOUSEKEEPING_STATUSES)[number])) {
    return { ok: false, error: 'Choose a valid housekeeping status.' };
  }
  const floor = input.floor == null ? '' : String(input.floor).trim();
  if (floor.length > 50) return { ok: false, error: 'Floor is too long.' };
  const description = String(input.description || '').trim();
  if (description.length > 2000) return { ok: false, error: 'Notes are too long.' };
  return {
    ok: true,
    fields: {
      roomNumber,
      roomTypeId,
      floor: floor || null,
      operationalStatus: operationalStatus as (typeof OPERATIONAL_STATUSES)[number],
      housekeepingStatus: housekeepingStatus as (typeof HOUSEKEEPING_STATUSES)[number],
      description,
    },
  };
}
