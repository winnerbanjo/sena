import { deleteMediaFromSpaces, readPrivateMediaFromSpaces, uploadMediaToSpaces } from '@sena/integrations';
import { and, eq, roomImages, sql, db } from '@sena/database';
import { inspectRoomImage, storageKeyForRoomImage, type GalleryPhoto } from './room-gallery';
import { GALLERY_REQUEST_SAFE_BYTES } from './gallery-upload-queue';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const devBytes = new Map<string, Uint8Array>();

export type PersistedGalleryOwner = {
  apartmentId?: string | null;
  roomId?: string | null;
  roomTypeId?: string | null;
};

function ownerWhere(propertyId: string, owner: PersistedGalleryOwner) {
  if (owner.apartmentId) return and(eq(roomImages.propertyId, propertyId), eq(roomImages.apartmentId, owner.apartmentId));
  if (owner.roomId) return and(eq(roomImages.propertyId, propertyId), eq(roomImages.roomId, owner.roomId));
  return and(eq(roomImages.propertyId, propertyId), eq(roomImages.roomTypeId, owner.roomTypeId!));
}

function lockKey(propertyId: string, owner: PersistedGalleryOwner) {
  return `gallery:${propertyId}:${owner.apartmentId || owner.roomId || owner.roomTypeId || 'none'}`;
}

function partKey(propertyId: string, owner: PersistedGalleryOwner, imageId: string, partNumber: number) {
  return storageKeyForRoomImage({
    propertyId,
    apartmentId: owner.apartmentId,
    roomId: owner.roomId,
    roomTypeId: owner.roomTypeId,
    imageId: `${imageId}-incoming-${partNumber}`,
    extension: 'bin',
  });
}

async function putObject(key: string, body: Uint8Array, contentType: string, acl: 'public-read' | 'private') {
  const stored = await uploadMediaToSpaces({ key, body, contentType, acl });
  if ('simulated' in stored && stored.simulated) devBytes.set(key, body);
  return stored;
}

async function getObject(key: string) {
  const local = devBytes.get(key);
  if (local) return local;
  const read = await readPrivateMediaFromSpaces(key);
  return read?.body ?? null;
}

async function removeObject(key: string) {
  devBytes.delete(key);
  await deleteMediaFromSpaces(key).catch((error) => console.error('Gallery storage delete failed:', error));
}

async function insertGalleryRow(input: {
  propertyId: string;
  userId?: string | null;
  owner: PersistedGalleryOwner;
  imageId: string;
  storageKey: string;
  url: string;
  filename: string;
  contentType: string;
  byteSize: number;
}): Promise<GalleryPhoto> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey(input.propertyId, input.owner)}))`);
    const existing = await tx.select().from(roomImages).where(ownerWhere(input.propertyId, input.owner));
    const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    const isCover = !existing.some((row) => row.isCover);
    const [row] = await tx
      .insert(roomImages)
      .values({
        id: input.imageId,
        propertyId: input.propertyId,
        roomTypeId: input.owner.roomTypeId || null,
        roomId: input.owner.roomId || null,
        apartmentId: input.owner.apartmentId || null,
        storageKey: input.storageKey,
        url: input.url,
        originalFilename: input.filename.slice(0, 255),
        contentType: input.contentType,
        byteSize: input.byteSize,
        sortOrder,
        isCover,
        uploadedByUserId: input.userId || null,
      })
      .returning();
    return { id: row.id, url: row.url, isCover: row.isCover, sortOrder: row.sortOrder };
  });
}

export async function storePersistedGalleryFile(input: {
  propertyId: string;
  userId?: string | null;
  owner: PersistedGalleryOwner;
  filename: string;
  bytes: Uint8Array;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: string;
  imageId: string;
}): Promise<{ ok: true; photo: GalleryPhoto } | { ok: false; error: string }> {
  const [existing] = await db
    .select()
    .from(roomImages)
    .where(and(eq(roomImages.id, input.imageId), eq(roomImages.propertyId, input.propertyId)))
    .limit(1);
  if (existing) {
    return { ok: true, photo: { id: existing.id, url: existing.url, isCover: existing.isCover, sortOrder: existing.sortOrder } };
  }
  const storageKey = storageKeyForRoomImage({
    propertyId: input.propertyId,
    apartmentId: input.owner.apartmentId,
    roomId: input.owner.roomId,
    roomTypeId: input.owner.roomTypeId,
    imageId: input.imageId,
    extension: input.extension,
  });
  let stored: { url: string };
  try {
    stored = await putObject(storageKey, input.bytes, input.contentType, 'public-read');
  } catch (error) {
    console.error('Gallery storage upload failed:', error);
    return { ok: false, error: 'Could not store that photo.' };
  }
  try {
    const photo = await insertGalleryRow({
      propertyId: input.propertyId,
      userId: input.userId,
      owner: input.owner,
      imageId: input.imageId,
      storageKey,
      url: stored.url,
      filename: input.filename,
      contentType: input.contentType,
      byteSize: input.bytes.byteLength,
    });
    return { ok: true, photo };
  } catch (error) {
    console.error('Gallery image row failed:', error);
    await removeObject(storageKey);
    return { ok: false, error: 'Could not store that photo.' };
  }
}

function readPartMeta(form: FormData) {
  const imageId = String(form.get('imageId') || '');
  const partCount = Number(form.get('partCount') || 0);
  const partNumber = Number(form.get('partNumber') || 0);
  if (!UUID.test(imageId)) return { error: 'That photo could not be stored.' as const };
  if (!Number.isInteger(partCount) || partCount < 2 || partCount > 4) return { error: 'That photo could not be stored.' as const };
  return { imageId, partCount, partNumber };
}

export async function saveGalleryPart(input: { propertyId: string; owner: PersistedGalleryOwner; form: FormData }) {
  const meta = readPartMeta(input.form);
  if ('error' in meta) return { status: 400, body: { error: meta.error } };
  if (!Number.isInteger(meta.partNumber) || meta.partNumber < 1 || meta.partNumber > meta.partCount) {
    return { status: 400, body: { error: 'That photo could not be stored.' } };
  }
  const file = input.form.getAll('files').find((entry): entry is File => entry instanceof File);
  if (!file || file.size <= 0 || file.size > Math.min(GALLERY_REQUEST_SAFE_BYTES, 4_000_000)) {
    return { status: 400, body: { error: 'That photo could not be stored.' } };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = partKey(input.propertyId, input.owner, meta.imageId, meta.partNumber);
  try {
    await putObject(key, bytes, 'application/octet-stream', 'private');
  } catch (error) {
    console.error('Gallery part upload failed:', error);
    return { status: 500, body: { error: 'Could not store that photo.' } };
  }
  return { status: 200, body: { ok: true, partNumber: meta.partNumber } };
}

export async function abortGalleryUpload(input: { propertyId: string; owner: PersistedGalleryOwner; form: FormData }) {
  const meta = readPartMeta(input.form);
  if ('error' in meta) return { status: 400, body: { error: meta.error } };
  for (let partNumber = 1; partNumber <= meta.partCount; partNumber += 1) {
    await removeObject(partKey(input.propertyId, input.owner, meta.imageId, partNumber));
  }
  return { status: 200, body: { ok: true } };
}

export async function finishGalleryUpload(input: {
  propertyId: string;
  userId?: string | null;
  owner: PersistedGalleryOwner;
  form: FormData;
}) {
  const meta = readPartMeta(input.form);
  if ('error' in meta) return { status: 400, body: { error: meta.error } };
  const filename = String(input.form.get('filename') || 'photo.jpg');
  const mimeType = String(input.form.get('mimeType') || '');
  const byteSize = Number(input.form.get('byteSize') || 0);
  const parts: Uint8Array[] = [];
  for (let partNumber = 1; partNumber <= meta.partCount; partNumber += 1) {
    const bytes = await getObject(partKey(input.propertyId, input.owner, meta.imageId, partNumber));
    if (!bytes) {
      return { status: 400, body: { error: 'That photo could not be stored.' } };
    }
    parts.push(bytes);
  }
  const combined = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.byteLength;
  }
  const cleanupParts = async () => {
    for (let partNumber = 1; partNumber <= meta.partCount; partNumber += 1) {
      await removeObject(partKey(input.propertyId, input.owner, meta.imageId, partNumber));
    }
  };
  if (combined.byteLength !== byteSize || combined.byteLength <= 0) {
    await cleanupParts();
    return { status: 400, body: { error: 'That photo could not be stored.' } };
  }
  const decision = inspectRoomImage({ filename, mimeType, byteSize: combined.byteLength, bytes: combined });
  if (!decision.ok || !decision.contentType || !decision.extension) {
    await cleanupParts();
    return { status: 422, body: { error: decision.error || 'This file is not a valid photo.' } };
  }
  const stored = await storePersistedGalleryFile({
    propertyId: input.propertyId,
    userId: input.userId,
    owner: input.owner,
    filename,
    bytes: combined,
    contentType: decision.contentType,
    extension: decision.extension,
    imageId: meta.imageId,
  });
  await cleanupParts();
  if (!stored.ok) return { status: 500, body: { error: stored.error } };
  return { status: 200, body: { uploaded: [stored.photo] } };
}
