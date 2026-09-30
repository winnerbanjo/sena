export const ROOM_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const ROOM_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

export type GalleryPhoto = {
  id: string;
  url: string;
  isCover: boolean;
  sortOrder: number;
  storageKey?: string;
};

export type RoomImageDecision = {
  ok: boolean;
  contentType?: 'image/jpeg' | 'image/png' | 'image/webp';
  extension?: string;
  error?: string;
};

export function inspectRoomImage(input: {
  filename: string;
  mimeType?: string;
  byteSize: number;
  bytes: Uint8Array;
}): RoomImageDecision {
  const extension = input.filename.split('.').pop()?.toLowerCase() || '';
  if (!ROOM_IMAGE_EXTENSIONS.includes(extension as (typeof ROOM_IMAGE_EXTENSIONS)[number])) {
    return { ok: false, error: 'Use a JPG, PNG, or WEBP photo.' };
  }
  if (input.byteSize <= 0 || input.byteSize > ROOM_IMAGE_MAX_BYTES) {
    return { ok: false, error: 'Each photo must be 10 MB or smaller.' };
  }
  const mime = (input.mimeType || '').toLowerCase();
  if (mime && !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime)) {
    return { ok: false, error: 'Use a JPG, PNG, or WEBP photo.' };
  }
  const bytes = input.bytes;
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (isJpeg && (extension === 'jpg' || extension === 'jpeg')) {
    return { ok: true, contentType: 'image/jpeg', extension: extension === 'jpeg' ? 'jpeg' : 'jpg' };
  }
  if (isPng && extension === 'png') return { ok: true, contentType: 'image/png', extension: 'png' };
  if (isWebp && extension === 'webp') return { ok: true, contentType: 'image/webp', extension: 'webp' };
  return { ok: false, error: 'This file is not a valid photo.' };
}

export function orderedGallery<T extends GalleryPhoto>(images: T[]): T[] {
  return [...images].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/** Cover first, then the remaining photos in sort order. */
export function galleryDisplayUrls(images: GalleryPhoto[]): string[] {
  const sorted = orderedGallery(images);
  const cover = sorted.find((image) => image.isCover) ?? sorted[0];
  if (!cover) return [];
  return [cover, ...sorted.filter((image) => image.id !== cover.id)].map((image) => image.url);
}

export function coverAfterRemoval(images: GalleryPhoto[], removedId: string): string | null {
  const removed = images.find((image) => image.id === removedId);
  const remaining = orderedGallery(images.filter((image) => image.id !== removedId));
  if (remaining.length === 0) return null;
  if (!removed?.isCover) return remaining.find((image) => image.isCover)?.id ?? remaining[0].id;
  return remaining[0].id;
}

export function moveGalleryItem<T extends GalleryPhoto>(
  images: T[],
  id: string,
  direction: 'earlier' | 'later'
): T[] {
  const sorted = orderedGallery(images);
  const index = sorted.findIndex((image) => image.id === id);
  const swapWith = direction === 'earlier' ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= sorted.length) {
    return sorted.map((image, sortOrder) => ({ ...image, sortOrder }));
  }
  const next = [...sorted];
  const [item] = next.splice(index, 1);
  next.splice(swapWith, 0, item);
  return next.map((image, sortOrder) => ({ ...image, sortOrder }));
}

export function displayImage(input: {
  roomGallery: GalleryPhoto[];
  roomLegacyUrl?: string | null;
  categoryGallery: GalleryPhoto[];
  categoryLegacyUrls?: string[] | null;
}): string {
  const roomUrls = galleryDisplayUrls(input.roomGallery);
  if (roomUrls[0]) return roomUrls[0];
  if (input.roomLegacyUrl) return input.roomLegacyUrl;
  const categoryUrls = galleryDisplayUrls(input.categoryGallery);
  if (categoryUrls[0]) return categoryUrls[0];
  return input.categoryLegacyUrls?.[0] || '';
}

export function categoryUpdateFields(input: {
  name?: string;
  bedType?: string;
  basePriceMinorUnits?: number;
  description?: string;
  capacity?: number;
  amenities?: string[];
}): { ok: true; fields: { name: string; bedType: string; basePriceMinorUnits: number; description: string | null; capacity: number; amenities: string[] } } | { ok: false; error: string } {
  const name = String(input.name || '').trim();
  if (!name) return { ok: false, error: 'Category name is required.' };
  const price = Number(input.basePriceMinorUnits);
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: 'Enter a valid nightly rate.' };
  const capacity = Number(input.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) {
    return { ok: false, error: 'Maximum guests must be between 1 and 20.' };
  }
  return {
    ok: true,
    fields: {
      name,
      bedType: String(input.bedType || 'Double').trim() || 'Double',
      basePriceMinorUnits: Math.round(price),
      description: input.description ? String(input.description).trim() : null,
      capacity,
      amenities: Array.isArray(input.amenities) ? input.amenities.map(String) : [],
    },
  };
}

export function galleryBelongsToProperty(imagePropertyId: string | null | undefined, propertyId: string) {
  return Boolean(imagePropertyId && imagePropertyId === propertyId);
}

export function storageKeyForRoomImage(input: {
  propertyId: string;
  roomTypeId?: string | null;
  roomId?: string | null;
  imageId: string;
  extension: string;
}) {
  const folder = input.roomId
    ? `rooms/${input.propertyId}/rooms/${input.roomId}`
    : `rooms/${input.propertyId}/categories/${input.roomTypeId || 'pending'}`;
  return `${folder}/${input.imageId}.${input.extension}`;
}

export function canDeleteStoredRoomImage(storageKey: string, propertyId: string) {
  return storageKey.startsWith(`rooms/${propertyId}/`);
}
