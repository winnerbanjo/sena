import { inspectRoomImage, ROOM_IMAGE_EXTENSIONS, ROOM_IMAGE_MAX_BYTES } from './room-gallery';

/** Vercel rejects function bodies over 4.5 MB with FUNCTION_PAYLOAD_TOO_LARGE. */
export const GALLERY_REQUEST_SAFE_BYTES = 3_500_000;
export const GALLERY_UPLOAD_CONCURRENCY = 4;

export type GalleryRejection = 'unsupported' | 'too_large' | 'invalid_signature';

export type GalleryTaskStatus = 'waiting' | 'uploading' | 'uploaded' | 'failed';

export type GalleryTask = {
  localId: string;
  filename: string;
  status: GalleryTaskStatus;
  queued: boolean;
  retryable: boolean;
  error?: string;
  partCount: number;
};

export function planGalleryTransfer(byteSize: number): { partCount: number; partSize: number } {
  if (byteSize <= GALLERY_REQUEST_SAFE_BYTES) return { partCount: 1, partSize: byteSize };
  return { partCount: Math.ceil(byteSize / GALLERY_REQUEST_SAFE_BYTES), partSize: GALLERY_REQUEST_SAFE_BYTES };
}

export function classifyGalleryFile(input: {
  name: string;
  mimeType?: string;
  byteSize: number;
  header: Uint8Array;
}): { ok: true; partCount: number } | { ok: false; code: GalleryRejection } {
  const extension = input.name.split('.').pop()?.toLowerCase() || '';
  if (!ROOM_IMAGE_EXTENSIONS.includes(extension as (typeof ROOM_IMAGE_EXTENSIONS)[number])) {
    return { ok: false, code: 'unsupported' };
  }
  if (input.byteSize <= 0 || input.byteSize > ROOM_IMAGE_MAX_BYTES) {
    return { ok: false, code: input.byteSize > ROOM_IMAGE_MAX_BYTES ? 'too_large' : 'unsupported' };
  }
  const mime = (input.mimeType || '').toLowerCase();
  if (mime && !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime)) {
    return { ok: false, code: 'unsupported' };
  }
  const decision = inspectRoomImage({
    filename: input.name,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    bytes: input.header,
  });
  if (!decision.ok) {
    if ((decision.error || '').includes('10 MB')) return { ok: false, code: 'too_large' };
    if ((decision.error || '').includes('not a valid')) return { ok: false, code: 'invalid_signature' };
    return { ok: false, code: 'unsupported' };
  }
  return { ok: true, partCount: planGalleryTransfer(input.byteSize).partCount };
}

export function transferRequestCount(byteSize: number): number {
  const plan = planGalleryTransfer(byteSize);
  return plan.partCount > 1 ? plan.partCount + 1 : 1;
}

export function galleryQueueNotice(input: { uploaded: number; total: number; active: number; failed: number }):
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; count: number }
  | { type: 'partial'; uploaded: number; failed: number }
  | { type: 'none' } {
  if (input.active > 0) return { type: 'progress', done: input.uploaded, total: input.total };
  if (input.failed > 0) return { type: 'partial', uploaded: input.uploaded, failed: input.failed };
  if (input.uploaded > 0) return { type: 'done', count: input.uploaded };
  return { type: 'none' };
}

export function saveBlockedWhileUploading(busy: boolean) {
  return busy;
}

export function closeNeedsUploadWarning(busy: boolean) {
  return busy;
}

export function nextLaunchIds(tasks: GalleryTask[], inflight: number, existingHasCover: boolean, concurrency = GALLERY_UPLOAD_CONCURRENCY): string[] {
  const waiting = tasks.filter((task) => task.status === 'waiting' && task.queued);
  if (waiting.length === 0) return [];
  if (!existingHasCover) {
    if (inflight > 0) return [];
    return [waiting[0].localId];
  }
  if (inflight >= concurrency) return [];
  return waiting.slice(0, concurrency - inflight).map((task) => task.localId);
}

export function retryGalleryTask(tasks: GalleryTask[], localId: string): GalleryTask[] {
  return tasks.map((task) =>
    task.localId === localId && task.status === 'failed' && task.retryable
      ? { ...task, status: 'waiting', error: undefined }
      : task
  );
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onInflight?: (count: number) => void
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let inflight = 0;
  const cap = Math.max(1, limit);
  if (items.length === 0) return results;
  await new Promise<void>((resolve, reject) => {
    const launch = () => {
      if (cursor >= items.length && inflight === 0) {
        resolve();
        return;
      }
      while (inflight < cap && cursor < items.length) {
        const index = cursor++;
        inflight += 1;
        onInflight?.(inflight);
        Promise.resolve(worker(items[index], index)).then(
          (value) => {
            results[index] = value;
            inflight -= 1;
            launch();
          },
          (error) => {
            reject(error);
          }
        );
      }
    };
    launch();
  });
  return results;
}

/** First selected file uploads alone until one succeeds and can become the cover. The rest run at the concurrency cap. */
export async function runCoverAwareQueue<T>(options: {
  items: T[];
  existingHasCover: boolean;
  concurrency?: number;
  run: (item: T) => Promise<boolean>;
}): Promise<void> {
  const rest = [...options.items];
  let cover = options.existingHasCover;
  while (!cover && rest.length > 0) {
    const next = rest.shift();
    if (!next) break;
    if (await options.run(next)) cover = true;
  }
  if (rest.length > 0) {
    await mapWithConcurrency(rest, options.concurrency ?? GALLERY_UPLOAD_CONCURRENCY, (item) => options.run(item));
  }
}
