'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@sena/ui';
import { GalleryCloseWarning, RoomGalleryEditor, type EditablePhoto, type RoomGalleryEditorHandle } from './room-gallery-editor';
import { closeNeedsUploadWarning, saveBlockedWhileUploading } from '@/lib/gallery-upload-queue';

const AMENITIES = [
  'High-speed Wi-Fi',
  'Air Conditioning',
  'Kitchen',
  'Washer',
  'Smart TV',
  'Work Desk',
  'Balcony',
  'Parking',
  'Generator',
  'Security',
];

export const APARTMENT_TYPE_KEYS = [
  'studio',
  'one_bedroom',
  'two_bedroom',
  'three_bedroom',
  'four_plus',
  'penthouse',
  'duplex',
  'villa',
  'other',
] as const;

export type ApartmentDraft = {
  id?: string;
  name: string;
  description: string;
  apartmentType: (typeof APARTMENT_TYPE_KEYS)[number];
  apartmentTypeCustom: string;
  bedrooms: number;
  bathrooms: number;
  bedConfiguration: string;
  maxGuests: number;
  nightlyRate: string;
  amenities: string[];
  usePropertyAddress: boolean;
  address: string;
  area: string;
  city: string;
  state: string;
  country: string;
  gallery: EditablePhoto[];
};

export const emptyApartmentDraft = (): ApartmentDraft => ({
  name: '',
  description: '',
  apartmentType: 'two_bedroom',
  apartmentTypeCustom: '',
  bedrooms: 2,
  bathrooms: 2,
  bedConfiguration: '1 King, 2 Singles',
  maxGuests: 4,
  nightlyRate: '',
  amenities: ['High-speed Wi-Fi', 'Air Conditioning', 'Kitchen'],
  usePropertyAddress: true,
  address: '',
  area: '',
  city: '',
  state: '',
  country: '',
  gallery: [],
});

export type AddApartmentDialogHandle = RoomGalleryEditorHandle;

export const AddApartmentDialog = React.forwardRef<AddApartmentDialogHandle, {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ApartmentDraft;
  onChange: (draft: ApartmentDraft) => void;
  onSubmit: () => void;
  saving: boolean;
  error: string;
  propertyAddress: string;
}>(function AddApartmentDialog({
  open,
  onOpenChange,
  draft,
  onChange,
  onSubmit,
  saving,
  error,
  propertyAddress,
}, ref) {
  const t = useTranslations('apartments');
  const editing = Boolean(draft.id);
  const editorRef = React.useRef<RoomGalleryEditorHandle>(null);
  const [activity, setActivity] = React.useState({ busy: false, failed: 0 });
  const [confirmClose, setConfirmClose] = React.useState(false);
  React.useImperativeHandle(ref, () => ({
    uploadPending: (target) => editorRef.current?.uploadPending(target) ?? Promise.resolve({ uploaded: 0, failed: 0 }),
    hasPending: () => editorRef.current?.hasPending() ?? false,
    failedCount: () => editorRef.current?.failedCount() ?? 0,
    isBusy: () => editorRef.current?.isBusy() ?? false,
    cancelActiveUploads: () => editorRef.current?.cancelActiveUploads(),
  }));
  function requestClose(next: boolean) {
    if (!next && closeNeedsUploadWarning(activity.busy)) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(next);
  }
  function set<K extends keyof ApartmentDraft>(key: K, value: ApartmentDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          <DialogDescription>{editing ? t('editHelp') : t('createHelp')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs text-[#5C564D] sm:col-span-2">
            {t('name')}
            <Input value={draft.name} onChange={(event) => set('name', event.target.value)} className="mt-1" />
          </label>
          <label className="text-xs text-[#5C564D]">
            {t('type')}
            <select
              value={draft.apartmentType}
              onChange={(event) => set('apartmentType', event.target.value as ApartmentDraft['apartmentType'])}
              className="mt-1 flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 text-sm"
            >
              {APARTMENT_TYPE_KEYS.map((key) => (
                <option key={key} value={key}>{t(`types.${key}`)}</option>
              ))}
            </select>
          </label>
          {draft.apartmentType === 'other' ? (
            <label className="text-xs text-[#5C564D]">
              {t('typeCustom')}
              <Input value={draft.apartmentTypeCustom} onChange={(event) => set('apartmentTypeCustom', event.target.value)} className="mt-1" />
            </label>
          ) : <div />}
          <label className="text-xs text-[#5C564D]">
            {t('bedrooms')}
            <Input type="number" min={0} value={draft.bedrooms} onChange={(event) => set('bedrooms', Number(event.target.value))} className="mt-1" />
          </label>
          <label className="text-xs text-[#5C564D]">
            {t('bathrooms')}
            <Input type="number" min={0} value={draft.bathrooms} onChange={(event) => set('bathrooms', Number(event.target.value))} className="mt-1" />
          </label>
          <label className="text-xs text-[#5C564D]">
            {t('beds')}
            <Input value={draft.bedConfiguration} onChange={(event) => set('bedConfiguration', event.target.value)} className="mt-1" />
          </label>
          <label className="text-xs text-[#5C564D]">
            {t('maxGuests')}
            <Input type="number" min={1} value={draft.maxGuests} onChange={(event) => set('maxGuests', Number(event.target.value))} className="mt-1" />
          </label>
          <label className="text-xs text-[#5C564D] sm:col-span-2">
            {t('nightlyRate')}
            <Input inputMode="decimal" value={draft.nightlyRate} onChange={(event) => set('nightlyRate', event.target.value)} className="mt-1" />
          </label>
          <label className="text-xs text-[#5C564D] sm:col-span-2">
            {t('description')}
            <textarea value={draft.description} onChange={(event) => set('description', event.target.value)} className="mt-1 min-h-20 w-full rounded border border-[#E8E2DA] px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <p className="text-xs text-[#5C564D] mb-2">{t('amenities')}</p>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((amenity) => {
                const selected = draft.amenities.includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => set('amenities', selected ? draft.amenities.filter((item) => item !== amenity) : [...draft.amenities, amenity])}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${selected ? 'border-[#B85C3E] bg-[#FAF0E4] text-[#71382D]' : 'border-[#E8E2DA] text-[#5C564D]'}`}
                  >
                    {amenity}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <p className="text-xs text-[#5C564D]">{t('location')}</p>
            <label className="flex items-start gap-2 text-xs text-[#191816]">
              <input type="radio" checked={draft.usePropertyAddress} onChange={() => set('usePropertyAddress', true)} />
              <span>{t('usePropertyAddress')}{propertyAddress ? ` — ${propertyAddress}` : ''}</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-[#191816]">
              <input type="radio" checked={!draft.usePropertyAddress} onChange={() => set('usePropertyAddress', false)} />
              <span>{t('differentAddress')}</span>
            </label>
            {draft.usePropertyAddress ? null : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input value={draft.address} onChange={(event) => set('address', event.target.value)} placeholder={t('address')} />
                <Input value={draft.area} onChange={(event) => set('area', event.target.value)} placeholder={t('area')} />
                <Input value={draft.city} onChange={(event) => set('city', event.target.value)} placeholder={t('city')} />
                <Input value={draft.state} onChange={(event) => set('state', event.target.value)} placeholder={t('state')} />
                <Input value={draft.country} onChange={(event) => set('country', event.target.value)} placeholder={t('country')} className="sm:col-span-2" />
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <RoomGalleryEditor
              ref={editorRef}
              photos={draft.gallery}
              onChange={(gallery) => set('gallery', gallery)}
              apartmentId={draft.id}
              label={t('photos')}
              help={t('photosHelp')}
              onActivityChange={setActivity}
            />
            <GalleryCloseWarning
              open={confirmClose}
              onKeep={() => setConfirmClose(false)}
              onClose={() => {
                editorRef.current?.cancelActiveUploads();
                setConfirmClose(false);
                onOpenChange(false);
              }}
            />
          </div>
        </div>
        {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => requestClose(false)}>{t('cancel')}</Button>
          <Button type="button" disabled={saving || saveBlockedWhileUploading(activity.busy)} onClick={onSubmit}>{saving ? t('saving') : t('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
