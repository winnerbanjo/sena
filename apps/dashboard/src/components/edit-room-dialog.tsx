'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@sena/ui';
import { useTranslations } from 'next-intl';
import type { RoomCategory, RoomItem } from './mock-data';
import { RoomGalleryEditor } from './room-gallery-editor';
import type { GalleryPhoto } from '@/lib/room-gallery';

const FLOORS = ['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Ground Floor', 'Penthouse'];

export function EditRoomDialog({
  open,
  room,
  categories,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  room: RoomItem | null;
  categories: RoomCategory[];
  onOpenChange: (open: boolean) => void;
  onSave: (room: RoomItem) => Promise<{ ok: boolean; error?: string }>;
}) {
  const t = useTranslations('rooms');
  const [number, setNumber] = React.useState('');
  const [roomTypeId, setRoomTypeId] = React.useState('');
  const [floor, setFloor] = React.useState('Floor 1');
  const [operational, setOperational] = React.useState<RoomItem['operational']>('available');
  const [housekeeping, setHousekeeping] = React.useState<RoomItem['housekeeping']>('clean');
  const [description, setDescription] = React.useState('');
  const [photos, setPhotos] = React.useState<GalleryPhoto[]>([]);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !room) return;
    setNumber(room.number);
    setRoomTypeId(room.roomTypeId || categories.find((category) => category.name === room.type)?.id || '');
    setFloor(room.floor || 'Floor 1');
    setOperational(room.operational || 'available');
    setHousekeeping(room.housekeeping || 'clean');
    setDescription(room.description || '');
    setPhotos(room.gallery || []);
    setError('');
    setSaving(false);
  }, [open, room, categories]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!room) return;
    if (!number.trim()) {
      setError(t('roomNumberRequired'));
      return;
    }
    if (!roomTypeId) {
      setError(t('categoryRequired'));
      return;
    }
    setSaving(true);
    setError('');
    const category = categories.find((item) => item.id === roomTypeId);
    const result = await onSave({
      ...room,
      number: number.trim(),
      roomTypeId,
      type: category?.name || room.type,
      floor,
      operational,
      housekeeping,
      description: description.trim(),
      gallery: photos,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error || t('roomUpdateFailed'));
      return;
    }
    onOpenChange(false);
  }

  const floorOptions = FLOORS.includes(floor) ? FLOORS : [floor, ...FLOORS];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#191816]">{t('editRoom')}</DialogTitle>
          <DialogDescription className="text-xs text-[#7A7267]">{t('editRoomHelp')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && <div className="rounded border border-[#F0BCB0] bg-[#FBEBE8] p-2.5 text-[#71382D]">{error}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="font-medium text-[#191816]">{t('roomNumber')}</label>
              <Input value={number} onChange={(event) => setNumber(event.target.value)} className="h-11 font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <label className="font-medium text-[#191816]">{t('floor')}</label>
              <select
                value={floor}
                onChange={(event) => setFloor(event.target.value)}
                className="h-11 w-full rounded border border-[#E8E2DA] bg-white px-2.5 text-xs"
              >
                {floorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="font-medium text-[#191816]">{t('category')}</label>
            <select
              value={roomTypeId}
              onChange={(event) => setRoomTypeId(event.target.value)}
              className="h-11 w-full rounded border border-[#E8E2DA] bg-white px-2.5 text-xs"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="font-medium text-[#191816]">{t('operationalStatus')}</label>
              <select
                value={operational}
                onChange={(event) => setOperational(event.target.value as RoomItem['operational'])}
                className="h-11 w-full rounded border border-[#E8E2DA] bg-white px-2.5 text-xs"
              >
                <option value="available">{t('statusAvailable')}</option>
                <option value="occupied">{t('statusOccupied')}</option>
                <option value="maintenance">{t('statusMaintenance')}</option>
                <option value="blocked">{t('statusBlocked')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-medium text-[#191816]">{t('housekeepingStatus')}</label>
              <select
                value={housekeeping}
                onChange={(event) => setHousekeeping(event.target.value as RoomItem['housekeeping'])}
                className="h-11 w-full rounded border border-[#E8E2DA] bg-white px-2.5 text-xs"
              >
                <option value="clean">{t('statusClean')}</option>
                <option value="dirty">{t('statusDirty')}</option>
                <option value="cleaning">{t('statusCleaning')}</option>
                <option value="inspection">{t('statusInspection')}</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="font-medium text-[#191816]">{t('roomNotes')}</label>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded border border-[#E8E2DA] bg-white p-2.5 text-xs"
            />
          </div>
          {room && (
            <RoomGalleryEditor
              photos={photos}
              onChange={setPhotos}
              roomId={room.id}
              label={t('roomPhotos')}
              help={t('roomGalleryHelp')}
            />
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} className="min-h-11 text-xs">
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving} className="min-h-11 text-xs">
              {saving ? t('saving') : t('saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
