'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Image as ImageIcon } from 'lucide-react';
import { ROOM_IMAGE_EXTENSIONS, ROOM_IMAGE_MAX_BYTES, galleryDisplayUrls, type GalleryPhoto } from '@/lib/room-gallery';

export type EditablePhoto = GalleryPhoto & { file?: File };

export function RoomGalleryEditor({
  photos,
  onChange,
  roomTypeId,
  roomId,
  apartmentId,
  label,
  help,
}: {
  photos: EditablePhoto[];
  onChange: (photos: EditablePhoto[]) => void;
  roomTypeId?: string;
  roomId?: string;
  apartmentId?: string;
  label: string;
  help: string;
}) {
  const t = useTranslations('rooms');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState('');
  const [error, setError] = React.useState('');
  const persisted = Boolean(roomTypeId || roomId || apartmentId);

  async function upload(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setError('');
    setProgress(t('photosUploading', { count: files.length }));
    if (!persisted) {
      const accepted: EditablePhoto[] = [];
      const rejected: string[] = [];
      for (const file of files) {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        if (!ROOM_IMAGE_EXTENSIONS.includes(extension as (typeof ROOM_IMAGE_EXTENSIONS)[number]) || file.size <= 0 || file.size > ROOM_IMAGE_MAX_BYTES) {
          rejected.push(`${file.name}: ${t('uploadFailed')}`);
          continue;
        }
        accepted.push({
          id: `local-${crypto.randomUUID()}`,
          url: URL.createObjectURL(file),
          file,
          isCover: photos.length + accepted.length === 0,
          sortOrder: photos.length + accepted.length,
        });
      }
      if (accepted.length > 0) onChange([...photos, ...accepted]);
      if (rejected.length > 0) setError(rejected.join(' '));
      setUploading(false);
      setProgress('');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    try {
      const form = new FormData();
      files.forEach((file) => form.append('files', file));
      if (roomTypeId) form.append('roomTypeId', roomTypeId);
      if (roomId) form.append('roomId', roomId);
      if (apartmentId) form.append('apartmentId', apartmentId);
      const response = await fetch('/api/rooms/gallery', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('uploadFailed'));
      if (persisted && Array.isArray(data.gallery)) onChange(data.gallery);
      else if (Array.isArray(data.uploaded)) onChange([...photos, ...data.uploaded]);
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        setError(data.errors.map((item: { filename: string; error: string }) => `${item.filename}: ${item.error}`).join(' '));
      }
    } catch (uploadError: any) {
      setError(uploadError.message || t('uploadFailed'));
    } finally {
      setUploading(false);
      setProgress('');
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function persist(action: 'cover' | 'move' | 'remove', photo: GalleryPhoto, direction?: 'earlier' | 'later') {
    setError('');
    if (!persisted || photo.id.startsWith('legacy-')) {
      if (action === 'remove') {
        const remaining = photos.filter((item) => item.id !== photo.id);
        const cover = remaining.find((item) => item.isCover) || remaining[0];
        onChange(remaining.map((item, sortOrder) => ({ ...item, sortOrder, isCover: cover ? item.id === cover.id : false })));
      } else if (action === 'cover') {
        onChange(photos.map((item) => ({ ...item, isCover: item.id === photo.id })));
      } else if (direction) {
        const sorted = [...photos].sort((a, b) => a.sortOrder - b.sortOrder);
        const index = sorted.findIndex((item) => item.id === photo.id);
        const swap = direction === 'earlier' ? index - 1 : index + 1;
        if (index < 0 || swap < 0 || swap >= sorted.length) return;
        const next = [...sorted];
        const [item] = next.splice(index, 1);
        next.splice(swap, 0, item);
        onChange(next.map((entry, sortOrder) => ({ ...entry, sortOrder })));
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
    if (!response.ok) {
      setError(data.error || t('uploadFailed'));
      return;
    }
    if (Array.isArray(data.gallery)) onChange(data.gallery);
  }

  const ordered = [...photos].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-2">
      <div>
        <p className="font-medium text-[#191816]">{label}</p>
        <p className="text-[11px] text-[#7A7267]">{help}</p>
      </div>
      {error && <p className="text-[11px] text-[#71382D]">{error}</p>}
      {progress && <p className="text-[11px] text-[#B85C3E]">{progress}</p>}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ordered.map((photo, index) => (
          <div key={photo.id} className="w-28 shrink-0 rounded border border-[#E8E2DA] bg-white p-1.5 space-y-1">
            <div className="relative aspect-[4/3] overflow-hidden rounded bg-[#FAF9F6]">
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
              {photo.isCover && (
                <span className="absolute left-1 top-1 rounded bg-[#191816] px-1.5 py-0.5 text-[9px] text-white">{t('cover')}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" className="min-h-11 rounded border border-[#E8E2DA] text-[10px]" onClick={() => persist('move', photo, 'earlier')} disabled={index === 0}>
                {t('moveLeft')}
              </button>
              <button type="button" className="min-h-11 rounded border border-[#E8E2DA] text-[10px]" onClick={() => persist('move', photo, 'later')} disabled={index === ordered.length - 1}>
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
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#E8E2DA] bg-[#FAF8F5] px-3 text-xs text-[#191816]"
      >
        <ImageIcon className="h-4 w-4 text-[#B85C3E]" />
        {uploading ? t('photosUploading', { count: 1 }) : t('addPhotos')}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => upload(Array.from(event.target.files || []))}
      />
    </div>
  );
}

export function coverFirstUrls(photos: GalleryPhoto[]) {
  return galleryDisplayUrls(photos);
}
