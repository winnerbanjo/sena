import type { GalleryPhoto } from './room-gallery';
import { classifyGalleryFile, planGalleryTransfer } from './gallery-upload-queue';

export type GalleryUploadTarget = {
  apartmentId?: string;
  roomId?: string;
  roomTypeId?: string;
};

export type GalleryUploadResult =
  | { ok: true; photo: GalleryPhoto; gallery: GalleryPhoto[] }
  | { ok: false; status: number; error: string; code?: 'unsupported' | 'too_large' | 'invalid_signature' };

function appendTarget(form: FormData, target: GalleryUploadTarget) {
  if (target.apartmentId) form.append('apartmentId', target.apartmentId);
  if (target.roomId) form.append('roomId', target.roomId);
  if (target.roomTypeId) form.append('roomTypeId', target.roomTypeId);
}

async function readBody(response: Response): Promise<{ error?: string; uploaded?: GalleryPhoto[]; gallery?: GalleryPhoto[]; errors?: { error?: string }[] }> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    if (response.status === 413 || text.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
      return { error: 'FUNCTION_PAYLOAD_TOO_LARGE' };
    }
    return { error: text.slice(0, 180) };
  }
}

function failure(status: number, error: string): GalleryUploadResult {
  return { ok: false, status, error };
}

export async function uploadGalleryFile(input: {
  file: File;
  target: GalleryUploadTarget;
  signal?: AbortSignal;
}): Promise<GalleryUploadResult> {
  const header = new Uint8Array(await input.file.slice(0, 16).arrayBuffer());
  const classified = classifyGalleryFile({
    name: input.file.name,
    mimeType: input.file.type,
    byteSize: input.file.size,
    header,
  });
  if (!classified.ok) {
    return { ok: false, status: 0, error: classified.code, code: classified.code };
  }

  const plan = planGalleryTransfer(input.file.size);
  if (plan.partCount === 1) {
    const form = new FormData();
    form.append('files', input.file, input.file.name);
    appendTarget(form, input.target);
    const response = await fetch('/api/rooms/gallery', { method: 'POST', body: form, signal: input.signal });
    const data = await readBody(response);
    const photo = Array.isArray(data.uploaded) ? data.uploaded[0] : undefined;
    if (!response.ok || !photo) return failure(response.status, data.error || data.errors?.[0]?.error || 'upload_failed');
    return { ok: true, photo, gallery: Array.isArray(data.gallery) ? data.gallery : [photo] };
  }

  const imageId = crypto.randomUUID();
  let finished = false;
  try {
    for (let partNumber = 1; partNumber <= plan.partCount; partNumber += 1) {
      const start = (partNumber - 1) * plan.partSize;
      const chunk = input.file.slice(start, Math.min(start + plan.partSize, input.file.size));
      const form = new FormData();
      form.append('phase', 'part');
      form.append('files', chunk, input.file.name);
      form.append('imageId', imageId);
      form.append('partNumber', String(partNumber));
      form.append('partCount', String(plan.partCount));
      appendTarget(form, input.target);
      const response = await fetch('/api/rooms/gallery', { method: 'POST', body: form, signal: input.signal });
      const data = await readBody(response);
      if (!response.ok) return failure(response.status, data.error || 'upload_failed');
    }
    const finish = new FormData();
    finish.append('phase', 'finish');
    finish.append('imageId', imageId);
    finish.append('partCount', String(plan.partCount));
    finish.append('filename', input.file.name);
    finish.append('mimeType', input.file.type);
    finish.append('byteSize', String(input.file.size));
    appendTarget(finish, input.target);
    const response = await fetch('/api/rooms/gallery', { method: 'POST', body: finish, signal: input.signal });
    const data = await readBody(response);
    const photo = Array.isArray(data.uploaded) ? data.uploaded[0] : undefined;
    if (!response.ok || !photo) return failure(response.status, data.error || data.errors?.[0]?.error || 'upload_failed');
    finished = true;
    return { ok: true, photo, gallery: Array.isArray(data.gallery) ? data.gallery : [photo] };
  } finally {
    if (!finished) {
      const abort = new FormData();
      abort.append('phase', 'abort');
      abort.append('imageId', imageId);
      abort.append('partCount', String(plan.partCount));
      appendTarget(abort, input.target);
      await fetch('/api/rooms/gallery', { method: 'POST', body: abort }).catch(() => undefined);
    }
  }
}
