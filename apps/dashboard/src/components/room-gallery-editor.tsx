'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Image as ImageIcon } from 'lucide-react';
import { galleryDisplayUrls, type GalleryPhoto } from '@/lib/room-gallery';
import { uploadGalleryFile, type GalleryUploadTarget } from '@/lib/gallery-upload-client';
import {
  classifyGalleryFile,
  closeNeedsUploadWarning,
  galleryQueueNotice,
  nextLaunchIds,
  retryGalleryTask,
  saveBlockedWhileUploading,
  type GalleryRejection,
  type GalleryTask,
} from '@/lib/gallery-upload-queue';

export type EditablePhoto = GalleryPhoto & { file?: File };

export type GalleryUploadActivity = { busy: boolean; failed: number };

export type RoomGalleryEditorHandle = {
  uploadPending: (target: GalleryUploadTarget) => Promise<{ uploaded: number; failed: number }>;
  hasPending: () => boolean;
  failedCount: () => number;
  isBusy: () => boolean;
  cancelActiveUploads: () => void;
};

type QueueItem = GalleryTask & { file?: File; previewUrl?: string };

export const RoomGalleryEditor = React.forwardRef<RoomGalleryEditorHandle, {
  photos: EditablePhoto[];
  onChange: (photos: EditablePhoto[]) => void;
  roomTypeId?: string;
  roomId?: string;
  apartmentId?: string;
  label: string;
  help: string;
  onActivityChange?: (activity: GalleryUploadActivity) => void;
}>(function RoomGalleryEditor({ photos, onChange, roomTypeId, roomId, apartmentId, label, help, onActivityChange }, ref) {
  const t = useTranslations('rooms');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const itemsRef = React.useRef<QueueItem[]>([]);
  const [items, setItems] = React.useState<QueueItem[]>([]);
  const [notice, setNotice] = React.useState<ReturnType<typeof galleryQueueNotice>>({ type: 'none' });
  const photosRef = React.useRef(photos);
  const onChangeRef = React.useRef(onChange);
  const onActivityRef = React.useRef(onActivityChange);
  const overrideRef = React.useRef<GalleryUploadTarget | null>(null);
  const inflight = React.useRef(0);
  const controllers = React.useRef(new Map<string, AbortController>());
  const drains = React.useRef<Array<(result: { uploaded: number; failed: number }) => void>>([]);
  const batchRef = React.useRef({ accepted: 0, uploaded: 0 });
  const coverLatch = React.useRef(false);
  const mounted = React.useRef(true);
  const noticeTimer = React.useRef<number | null>(null);

  photosRef.current = photos;
  onChangeRef.current = onChange;
  onActivityRef.current = onActivityChange;

  function currentTarget(): GalleryUploadTarget {
    return {
      apartmentId: overrideRef.current?.apartmentId || apartmentId,
      roomId: overrideRef.current?.roomId || roomId,
      roomTypeId: overrideRef.current?.roomTypeId || roomTypeId,
    };
  }

  function targetReady() {
    const target = currentTarget();
    return Boolean(target.apartmentId || target.roomId || target.roomTypeId);
  }

  function hasCover() {
    return coverLatch.current || photosRef.current.some((photo) => photo.isCover && !photo.file && !photo.id.startsWith('local-'));
  }

  function isBusy() {
    const active = itemsRef.current.some((item) => item.status === 'uploading' || (targetReady() && item.status === 'waiting' && item.queued));
    return saveBlockedWhileUploading(active);
  }

  function publish() {
    if (!mounted.current) return;
    setItems([...itemsRef.current]);
    onActivityRef.current?.({
      busy: isBusy(),
      failed: itemsRef.current.filter((item) => item.status === 'failed').length,
    });
    const active = itemsRef.current.some((item) => item.status === 'uploading' || (item.status === 'waiting' && item.queued && targetReady()));
    const failed = itemsRef.current.filter((item) => item.status === 'failed' && item.queued).length;
    const next = galleryQueueNotice({
      uploaded: batchRef.current.uploaded,
      total: batchRef.current.accepted,
      active: active ? 1 : 0,
      failed,
    });
    setNotice(next);
    if (next.type === 'progress' && noticeTimer.current) {
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = null;
    }
    if (next.type === 'done') {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => {
        if (!mounted.current) return;
        const stillActive = itemsRef.current.some((item) => item.status === 'uploading' || item.status === 'waiting');
        if (!stillActive) {
          batchRef.current = { accepted: 0, uploaded: 0 };
          setNotice({ type: 'none' });
        }
      }, 1600);
    }
  }

  function settle() {
    const waiting = itemsRef.current.some((item) => item.status === 'waiting' && item.queued && targetReady());
    if (waiting || inflight.current > 0) return;
    const failed = itemsRef.current.filter((item) => item.status === 'failed' && item.retryable).length;
    const resolvers = drains.current.splice(0);
    resolvers.forEach((resolve) => resolve({ uploaded: batchRef.current.uploaded, failed }));
  }

  function mirrorLocal() {
    const persisted = photosRef.current.filter((photo) => !photo.id.startsWith('local-') && !photo.file);
    const local = itemsRef.current
      .filter((item) => item.file)
      .map((item, index) => ({
        id: item.localId,
        url: item.previewUrl || '',
        file: item.file,
        isCover: false,
        sortOrder: persisted.length + index,
      }));
    onChangeRef.current([...persisted, ...local]);
  }

  function errorText(code: GalleryRejection | string) {
    if (code === 'too_large') return t('uploadTooLarge');
    if (code === 'unsupported') return t('uploadUnsupported');
    if (code === 'invalid_signature') return t('uploadInvalid');
    if (code === 'FUNCTION_PAYLOAD_TOO_LARGE') return 'FUNCTION_PAYLOAD_TOO_LARGE';
    return t('uploadFailed');
  }

  function pump() {
    if (!targetReady()) {
      settle();
      return;
    }
    const ids = nextLaunchIds(itemsRef.current, inflight.current, hasCover());
    if (ids.length === 0) {
      settle();
      publish();
      return;
    }
    for (const localId of ids) {
      const item = itemsRef.current.find((entry) => entry.localId === localId);
      if (!item?.file || item.status !== 'waiting') continue;
      item.status = 'uploading';
      inflight.current += 1;
      const controller = new AbortController();
      controllers.current.set(localId, controller);
      const target = currentTarget();
      void uploadGalleryFile({ file: item.file, target, signal: controller.signal })
        .then((result) => {
          inflight.current = Math.max(0, inflight.current - 1);
          controllers.current.delete(localId);
          const current = itemsRef.current.find((entry) => entry.localId === localId);
          if (!current || controller.signal.aborted) {
            settle();
            publish();
            return;
          }
          if (result.ok) {
            if (result.photo.isCover || result.gallery.some((photo) => photo.isCover)) coverLatch.current = true;
            batchRef.current.uploaded += 1;
            if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
            itemsRef.current = itemsRef.current.filter((entry) => entry.localId !== localId);
            photosRef.current = result.gallery;
            onChangeRef.current(result.gallery);
          } else {
            current.status = 'failed';
            current.error = errorText(result.code || result.error);
          }
          publish();
          pump();
        })
        .catch((error) => {
          inflight.current = Math.max(0, inflight.current - 1);
          controllers.current.delete(localId);
          const current = itemsRef.current.find((entry) => entry.localId === localId);
          if (current && !controller.signal.aborted) {
            current.status = 'failed';
            current.error = error?.name === 'AbortError' ? t('uploadFailed') : t('uploadFailed');
          }
          publish();
          pump();
        });
    }
    publish();
  }

  React.useImperativeHandle(ref, () => ({
    uploadPending(target) {
      overrideRef.current = { ...currentTarget(), ...target };
      pump();
      return new Promise((resolve) => {
        drains.current.push(resolve);
        settle();
      });
    },
    hasPending() {
      return itemsRef.current.some((item) => item.status === 'waiting' && item.queued && item.file);
    },
    failedCount() {
      return itemsRef.current.filter((item) => item.status === 'failed').length;
    },
    isBusy,
    cancelActiveUploads() {
      controllers.current.forEach((controller) => controller.abort());
    },
  }));

  React.useEffect(() => {
    mounted.current = true;
    const liveControllers = controllers.current;
    return () => {
      mounted.current = false;
      liveControllers.forEach((controller) => controller.abort());
      itemsRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  React.useEffect(() => {
    if (photos.some((photo) => photo.isCover && !photo.file)) coverLatch.current = true;
  }, [photos]);

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    const next: QueueItem[] = [];
    for (const file of files) {
      const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const classified = classifyGalleryFile({ name: file.name, mimeType: file.type, byteSize: file.size, header });
      const localId = `local-${crypto.randomUUID()}`;
      const previewUrl = URL.createObjectURL(file);
      if (!classified.ok) {
        next.push({
          localId,
          filename: file.name,
          status: 'failed',
          queued: false,
          retryable: false,
          error: errorText(classified.code),
          partCount: 0,
          previewUrl,
        });
      } else {
        batchRef.current.accepted += 1;
        next.push({
          localId,
          filename: file.name,
          status: 'waiting',
          queued: true,
          retryable: true,
          partCount: classified.partCount,
          file,
          previewUrl,
        });
      }
    }
    itemsRef.current = [...itemsRef.current, ...next];
    if (!targetReady()) mirrorLocal();
    publish();
    pump();
    if (inputRef.current) inputRef.current.value = '';
  }

  function retry(localId: string) {
    itemsRef.current = retryGalleryTask(itemsRef.current, localId) as QueueItem[];
    publish();
    pump();
  }

  async function persist(action: 'cover' | 'move' | 'remove', photo: GalleryPhoto, direction?: 'earlier' | 'later') {
    const persisted = Boolean(roomTypeId || roomId || apartmentId);
    if (!persisted || photo.id.startsWith('local-') || photo.id.startsWith('legacy-')) {
      if (action === 'remove') {
        const removed = itemsRef.current.find((item) => item.localId === photo.id);
        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
        itemsRef.current = itemsRef.current.filter((item) => item.localId !== photo.id);
        const remaining = photosRef.current.filter((item) => item.id !== photo.id);
        onChangeRef.current(remaining.map((item, sortOrder) => ({ ...item, sortOrder, isCover: false })));
        publish();
      }
      return;
    }
    const response =
      action === 'remove'
        ? await fetch(`/api/rooms/gallery?id=${encodeURIComponent(photo.id)}`, { method: 'DELETE' })
        : await fetch('/api/rooms/gallery', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageId: photo.id, action, direction }),
          });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return;
    if (Array.isArray(data.gallery)) {
      photosRef.current = data.gallery;
      coverLatch.current = data.gallery.some((item: GalleryPhoto) => item.isCover);
      onChangeRef.current(data.gallery);
    }
  }

  const persistedPhotos = [...photos]
    .filter((photo) => !photo.id.startsWith('local-') && !photo.file)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const busy = items.some((item) => item.status === 'uploading' || (item.status === 'waiting' && item.queued && targetReady()));

  return (
    <div className="space-y-2">
      <div>
        <p className="text-start font-medium text-[#191816]">{label}</p>
        <p className="text-start text-[11px] text-[#7A7267]">{help}</p>
      </div>
      {notice.type === 'progress' ? (
        <div aria-live="polite" className="space-y-1">
          <p className="text-start text-[11px] text-[#B85C3E]">{t('uploadProgress', { done: notice.done, total: notice.total })}</p>
          <div
            className="h-1.5 w-full overflow-hidden rounded bg-[#E8E2DA]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={notice.total}
            aria-valuenow={notice.done}
            aria-valuetext={t('uploadCount', { done: notice.done, total: notice.total })}
          >
            <div className="h-full bg-[#B85C3E]" style={{ width: `${notice.total ? (notice.done / notice.total) * 100 : 0}%` }} />
          </div>
        </div>
      ) : null}
      {notice.type === 'done' ? <p className="text-start text-[11px] text-[#1F6B4A]">{t('uploadAllDone', { count: notice.count })}</p> : null}
      {notice.type === 'partial' ? (
        <p className="text-start text-[11px] text-[#71382D]">{t('uploadPartial', { uploaded: notice.uploaded, failed: notice.failed })}</p>
      ) : null}
      {busy ? <p className="text-start text-[11px] text-[#71382D]">{t('uploadWait')}</p> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {persistedPhotos.map((photo, index) => (
          <div key={photo.id} className="min-w-0 rounded border border-[#E8E2DA] bg-white p-1.5">
            <div className="relative aspect-[4/3] overflow-hidden rounded bg-[#FAF9F6]">
              <img src={photo.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              {photo.isCover ? (
                <span className="absolute start-1 top-1 rounded bg-[#191816] px-1.5 py-0.5 text-[9px] text-white">{t('cover')}</span>
              ) : null}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <button type="button" className="min-h-11 rounded border border-[#E8E2DA] text-[10px]" onClick={() => persist('move', photo, 'earlier')} disabled={index === 0}>
                {t('moveLeft')}
              </button>
              <button type="button" className="min-h-11 rounded border border-[#E8E2DA] text-[10px]" onClick={() => persist('move', photo, 'later')} disabled={index === persistedPhotos.length - 1}>
                {t('moveRight')}
              </button>
              <button type="button" className="min-h-11 rounded border border-[#E8E2DA] text-[10px]" onClick={() => persist('cover', photo)} disabled={photo.isCover}>
                {t('setAsCover')}
              </button>
              <button type="button" className="min-h-11 rounded border border-[#F0BCB0] text-[10px] text-[#71382D]" onClick={() => persist('remove', photo)}>
                {t('removePhoto')}
              </button>
            </div>
          </div>
        ))}
        {items.map((item) => (
          <div key={item.localId} className="min-w-0 rounded border border-[#E8E2DA] bg-white p-1.5">
            <div className="relative aspect-[4/3] overflow-hidden rounded bg-[#FAF9F6]">
              {item.previewUrl ? <img src={item.previewUrl} alt={item.filename} className="h-full w-full object-cover" /> : null}
            </div>
            <p className="mt-1 truncate text-start text-[10px] text-[#191816]" title={item.filename}>{item.filename}</p>
            <p className="text-start text-[10px] text-[#7A7267]">
              {item.status === 'waiting' ? t('uploadWaiting') : item.status === 'uploading' ? t('uploadUploading') : item.status === 'failed' ? item.error || t('uploadFailedStatus') : t('uploadUploaded')}
            </p>
            {item.status === 'failed' && item.retryable ? (
              <button type="button" className="mt-1 min-h-11 w-full rounded border border-[#E8E2DA] text-[10px]" onClick={() => retry(item.localId)}>
                {t('uploadRetry')}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#E8E2DA] bg-[#FAF8F5] px-3 text-xs text-[#191816]"
      >
        <ImageIcon className="h-4 w-4 text-[#B85C3E]" />
        {t('addPhotos')}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => void addFiles(Array.from(event.target.files || []))}
      />
    </div>
  );
});

export function GalleryCloseWarning({ open, onKeep, onClose }: { open: boolean; onKeep: () => void; onClose: () => void }) {
  const t = useTranslations('rooms');
  if (!open || !closeNeedsUploadWarning(true)) return null;
  return (
    <div className="rounded border border-[#E8E2DA] bg-[#FAF7F2] p-3 text-start" role="alertdialog">
      <p className="text-start text-xs text-[#191816]">{t('uploadCloseWarning')}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="min-h-11 rounded border border-[#E8E2DA] px-3 text-xs" onClick={onKeep}>
          {t('uploadKeep')}
        </button>
        <button type="button" className="min-h-11 rounded bg-[#71382D] px-3 text-xs text-white" onClick={onClose}>
          {t('uploadCloseAnyway')}
        </button>
      </div>
    </div>
  );
}

export function coverFirstUrls(photos: GalleryPhoto[]) {
  return galleryDisplayUrls(photos);
}
