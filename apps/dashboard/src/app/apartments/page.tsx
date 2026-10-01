'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { formatNaira } from '@sena/config';
import { Button } from '@sena/ui';
import { Bath, BedDouble, MapPin, Plus, Users } from 'lucide-react';
import { Topbar } from '../../components/topbar';
import { PageLoadState } from '../../components/page-load-state';
import { AddApartmentDialog, APARTMENT_TYPE_KEYS, emptyApartmentDraft, type AddApartmentDialogHandle, type ApartmentDraft } from '../../components/add-apartment-dialog';
import { APARTMENT_ACTION_PANEL_CLASS, APARTMENT_ACTION_SHEET_CLASS, namesMatchForDeletion } from '../../components/apartment-removal-ui';
import type { EditablePhoto } from '../../components/room-gallery-editor';

type BoardStatus = 'available' | 'occupied' | 'reserved' | 'needs_cleaning' | 'blocked' | 'maintenance';

type RemovalPreview =
  | { action: 'delete' }
  | { action: 'archive' }
  | { action: 'archived' }
  | { action: 'blocked'; code?: string; message?: string };

type ApartmentCard = ApartmentDraft & {
  id: string;
  basePriceMinorUnits: number;
  coverUrl: string;
  location: string;
  boardStatus: BoardStatus;
  availability: number;
  gallery: EditablePhoto[];
  archivedAt?: string | null;
  removal?: RemovalPreview;
};

const FILTERS: Array<'all' | 'available' | 'occupied' | 'reserved' | 'needs_cleaning' | 'archived'> = [
  'all',
  'available',
  'occupied',
  'reserved',
  'needs_cleaning',
  'archived',
];

function toDraft(apartment: ApartmentCard): ApartmentDraft {
  return {
    id: apartment.id,
    name: apartment.name,
    description: apartment.description || '',
    apartmentType: apartment.apartmentType,
    apartmentTypeCustom: apartment.apartmentTypeCustom || '',
    bedrooms: apartment.bedrooms,
    bathrooms: apartment.bathrooms,
    bedConfiguration: apartment.bedConfiguration,
    maxGuests: apartment.maxGuests,
    nightlyRate: String(apartment.basePriceMinorUnits / 100),
    amenities: apartment.amenities || [],
    usePropertyAddress: apartment.usePropertyAddress,
    address: apartment.address || '',
    area: apartment.area || '',
    city: apartment.city || '',
    state: apartment.state || '',
    country: apartment.country || '',
    gallery: apartment.gallery || [],
  };
}

export default function ApartmentsPage() {
  const t = useTranslations('apartments');
  const [apartments, setApartments] = React.useState<ApartmentCard[]>([]);
  const [canEdit, setCanEdit] = React.useState(false);
  const [propertyAddress, setPropertyAddress] = React.useState('');
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>('all');
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<ApartmentCard | null>(null);
  const [draft, setDraft] = React.useState<ApartmentDraft>(emptyApartmentDraft());
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [error, setError] = React.useState('');
  const apartmentDialogRef = React.useRef<AddApartmentDialogHandle>(null);
  const [menuApartment, setMenuApartment] = React.useState<ApartmentCard | null>(null);
  const [confirm, setConfirm] = React.useState<null | { kind: 'delete' | 'archive' | 'blocked'; apartment: ApartmentCard; typed: string; message: string }>(null);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch('/api/apartments', { cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      setApartments(Array.isArray(data.apartments) ? data.apartments : []);
      setCanEdit(Boolean(data.canEdit));
      setPropertyAddress(data.propertyAddress || '');
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const activeApartments = apartments.filter((item) => !item.archivedAt);
  const counts = {
    all: activeApartments.length,
    available: activeApartments.filter((item) => item.boardStatus === 'available').length,
    occupied: activeApartments.filter((item) => item.boardStatus === 'occupied').length,
    reserved: activeApartments.filter((item) => item.boardStatus === 'reserved').length,
    needs_cleaning: activeApartments.filter((item) => item.boardStatus === 'needs_cleaning').length,
    archived: apartments.filter((item) => item.archivedAt).length,
  };
  const visible = filter === 'archived'
    ? apartments.filter((item) => item.archivedAt)
    : activeApartments.filter((item) => filter === 'all' || item.boardStatus === filter);

  function removalMessage(code: string | undefined, fallback: string) {
    if (code === 'active_reservation') return t('activeReservation');
    if (code === 'upcoming_reservations') return t('upcomingReservations');
    if (code === 'active_hold') return t('activeHold');
    if (code === 'active_housekeeping') return t('activeHousekeeping');
    return fallback;
  }

  function askRemoval(apartment: ApartmentCard) {
    setMenuApartment(null);
    if (apartment.removal?.action === 'blocked') {
      setConfirm({
        kind: 'blocked',
        apartment,
        typed: '',
        message: removalMessage(apartment.removal.code, apartment.removal.message || t('activeReservation')),
      });
      return;
    }
    if (apartment.removal?.action === 'archive') {
      setConfirm({ kind: 'archive', apartment, typed: '', message: '' });
      return;
    }
    setConfirm({ kind: 'delete', apartment, typed: '', message: '' });
  }

  async function submitRemoval() {
    if (!confirm || confirm.kind === 'blocked') return;
    setRemoving(true);
    try {
      const response = await fetch(`/api/apartments?id=${encodeURIComponent(confirm.apartment.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirm.kind === 'delete' ? { confirmName: confirm.typed } : {}),
      });
      const data = await response.json().catch(() => ({}));
      if (data.code === 'confirmation_required') {
        setConfirm({ kind: 'delete', apartment: confirm.apartment, typed: '', message: '' });
        return;
      }
      if (!response.ok) {
        setConfirm({
          kind: 'blocked',
          apartment: confirm.apartment,
          typed: '',
          message: removalMessage(data.code, data.error || t('invalid')),
        });
        return;
      }
      setConfirm(null);
      await load();
    } catch (removeError: any) {
      setConfirm((current) => (current ? { ...current, kind: 'blocked', message: removeError.message || t('invalid') } : current));
    } finally {
      setRemoving(false);
    }
  }

  async function restore(apartment: ApartmentCard) {
    setRemoving(true);
    setError('');
    try {
      const response = await fetch('/api/apartments/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apartmentId: apartment.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('invalid'));
      setMenuApartment(null);
      await load();
    } catch (restoreError: any) {
      setError(restoreError.message || t('invalid'));
    } finally {
      setRemoving(false);
    }
  }

  function typeLabel(apartment: { apartmentType: string; apartmentTypeCustom?: string }) {
    if (apartment.apartmentType === 'other' && apartment.apartmentTypeCustom) return apartment.apartmentTypeCustom;
    return APARTMENT_TYPE_KEYS.includes(apartment.apartmentType as (typeof APARTMENT_TYPE_KEYS)[number])
      ? t(`types.${apartment.apartmentType as (typeof APARTMENT_TYPE_KEYS)[number]}`)
      : apartment.apartmentType;
  }

  async function save() {
    const nightly = Number(String(draft.nightlyRate).replace(/,/g, ''));
    if (!draft.name.trim() || !Number.isFinite(nightly) || nightly <= 0) {
      setError(t('invalid'));
      return;
    }
    if (apartmentDialogRef.current?.isBusy()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/apartments', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apartmentId: draft.id,
          name: draft.name,
          description: draft.description,
          apartmentType: draft.apartmentType,
          apartmentTypeCustom: draft.apartmentTypeCustom,
          bedrooms: draft.bedrooms,
          bathrooms: draft.bathrooms,
          bedConfiguration: draft.bedConfiguration,
          maxGuests: draft.maxGuests,
          basePriceMinorUnits: Math.round(nightly * 100),
          amenities: draft.amenities,
          usePropertyAddress: draft.usePropertyAddress,
          address: draft.address,
          area: draft.area,
          city: draft.city,
          state: draft.state,
          country: draft.country,
          websiteVisibility: true,
          bookingVisibility: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('invalid'));
      const apartmentId = data.apartment?.id || draft.id;
      if (apartmentId) setDraft((current) => ({ ...current, id: apartmentId }));
      if (apartmentId && apartmentDialogRef.current?.hasPending()) {
        const outcome = await apartmentDialogRef.current.uploadPending({ apartmentId });
        if (outcome.failed > 0) return;
      }
      if (apartmentDialogRef.current?.failedCount()) return;
      setOpen(false);
      await load();
    } catch (saveError: any) {
      setError(saveError.message || t('invalid'));
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadError) return <PageLoadState title={t('title')} failed={loadError} />;

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden bg-white">
      <Topbar title={t('title')} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-[#E8E2DA] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl text-[#191816]">{t('title')}</h1>
            <p className="mt-1 max-w-xl text-sm text-[#7A7267]">{t('subtitle')}</p>
          </div>
          {canEdit ? (
            <Button
              onClick={() => {
                setDraft(emptyApartmentDraft());
                setError('');
                setOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="me-1 h-4 w-4" />
              {t('add')}
            </Button>
          ) : null}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs ${filter === key ? 'border-[#71382D] bg-[#71382D] text-white' : 'border-[#E8E2DA] text-[#5C564D]'}`}
            >
              {t(key === 'needs_cleaning' ? 'needsCleaning' : key)} ({counts[key]})
            </button>
          ))}
        </div>

        {error && !open ? <p className="mb-4 text-start text-sm text-[#9E382A]">{error}</p> : null}

        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E8E2DA] p-8 text-center text-sm text-[#7A7267]">{filter === 'archived' ? t('emptyArchived') : t('empty')}</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((apartment) => (
              <article key={apartment.id} className="overflow-hidden rounded-lg border border-[#E8E2DA] bg-white">
                <div className="aspect-[16/10] bg-[#F4EFE8]">
                  {apartment.coverUrl ? <img src={apartment.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-lg text-[#191816]">{apartment.name}</h2>
                      <p className="text-xs text-[#7A7267]">{typeLabel(apartment)}</p>
                    </div>
                    <strong className="text-sm text-[#71382D]">{formatNaira(apartment.basePriceMinorUnits)}<span className="block text-[10px] font-normal text-[#7A7267]">{t('perNight')}</span></strong>
                  </div>
                  <p className="flex items-start gap-1.5 text-xs text-[#5C564D]"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{apartment.location || t('propertyAddress')}</p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-[#5C564D]">
                    <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{t('bedroomsShort', { count: apartment.bedrooms })}</span>
                    <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{t('bathroomsShort', { count: apartment.bathrooms })}</span>
                    <span>{apartment.bedConfiguration}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{t('guestsShort', { count: apartment.maxGuests })}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded bg-[#FAF7F2] px-2 py-1">{t('status')}: {apartment.archivedAt ? t('archivedBadge') : t(apartment.boardStatus === 'needs_cleaning' ? 'needsCleaning' : apartment.boardStatus === 'maintenance' || apartment.boardStatus === 'blocked' ? 'unavailable' : apartment.boardStatus)}</span>
                    <span className="rounded bg-[#FAF7F2] px-2 py-1">{t('availability')}: {apartment.availability}</span>
                  </div>
                  {apartment.amenities?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {apartment.amenities.slice(0, 6).map((amenity) => (
                        <span key={amenity} className="rounded border border-[#F0ECE4] bg-[#FAF7F2] px-2 py-0.5 text-[11px] text-[#5C564D]">{amenity}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => setViewing(apartment)}>{t('view')}</Button>
                    {canEdit ? <Button type="button" className="min-h-11 flex-1" onClick={() => { setDraft(toDraft(apartment)); setError(''); setOpen(true); }}>{t('edit')}</Button> : null}
                    {canEdit && apartment.archivedAt ? (
                      <Button type="button" variant="outline" className="min-h-11" disabled={removing} onClick={() => restore(apartment)}>{t('restore')}</Button>
                    ) : null}
                    {canEdit && !apartment.archivedAt ? (
                      <Button type="button" variant="outline" className="min-h-11" onClick={() => setMenuApartment(apartment)}>{t('more')}</Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <AddApartmentDialog
        ref={apartmentDialogRef}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) void load();
        }}
        draft={draft}
        onChange={(next) => setDraft((current) => ({ ...next, id: current.id || next.id }))}
        onSubmit={save}
        saving={saving}
        error={error}
        propertyAddress={propertyAddress}
      />

      {menuApartment ? (
        <div className={APARTMENT_ACTION_SHEET_CLASS} role="dialog" aria-modal="true" data-apartment-removal-sheet="">
          <div className={APARTMENT_ACTION_PANEL_CLASS}>
            <h2 className="font-serif text-xl text-[#191816]">{menuApartment.name}</h2>
            <p className="mt-1 text-sm text-[#7A7267]">{t('more')}</p>
            <div className="mt-4 border-t border-[#E8E2DA] pt-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full border-[#9E382A] text-[#9E382A]"
                onClick={() => askRemoval(menuApartment)}
              >
                {t('deleteApartment')}
              </Button>
            </div>
            <div className="mt-3">
              <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setMenuApartment(null)}>{t('cancel')}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div className={APARTMENT_ACTION_SHEET_CLASS} role="dialog" aria-modal="true" data-apartment-removal-confirm="">
          <div className={APARTMENT_ACTION_PANEL_CLASS}>
            <h2 className="font-serif text-xl text-[#191816]">
              {confirm.kind === 'delete' ? t('deleteTitle') : confirm.kind === 'archive' ? t('archiveTitle') : t('deleteApartment')}
            </h2>
            <p className="mt-3 text-sm text-[#191816]">{confirm.apartment.name}</p>
            <p className="mt-3 text-sm text-[#5C564D]">
              {confirm.kind === 'delete' ? t('deleteBody') : confirm.kind === 'archive' ? t('archiveBody') : confirm.message}
            </p>
            {confirm.kind === 'delete' ? (
              <label className="mt-4 block text-start text-sm text-[#5C564D]">
                {t('typeName', { name: confirm.apartment.name })}
                <input
                  className="mt-2 w-full rounded border border-[#E8E2DA] px-3 py-2 text-start text-[#191816]"
                  value={confirm.typed}
                  autoComplete="off"
                  onChange={(event) => setConfirm({ ...confirm, typed: event.target.value })}
                />
              </label>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => setConfirm(null)}>{confirm.kind === 'blocked' ? t('close') : t('cancel')}</Button>
              {confirm.kind === 'delete' ? (
                <Button
                  type="button"
                  className="min-h-11 w-full border border-[#9E382A] bg-[#9E382A] text-white sm:w-auto"
                  disabled={removing || !namesMatchForDeletion(confirm.typed, confirm.apartment.name)}
                  onClick={submitRemoval}
                >
                  {t('deleteApartment')}
                </Button>
              ) : null}
              {confirm.kind === 'archive' ? (
                <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={removing} onClick={submitRemoval}>{t('archiveAction')}</Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {viewing ? (
        <div className={APARTMENT_ACTION_SHEET_CLASS} role="dialog" aria-modal="true">
          <div className={APARTMENT_ACTION_PANEL_CLASS}>
            <h2 className="font-serif text-xl text-[#191816]">{viewing.name}</h2>
            <p className="mt-1 text-sm text-[#7A7267]">{typeLabel(viewing)} · {viewing.location}</p>
            <p className="mt-3 text-sm text-[#5C564D]">{viewing.description}</p>
            <p className="mt-3 text-sm">{formatNaira(viewing.basePriceMinorUnits)} {t('perNight')}</p>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setViewing(null)}>{t('close')}</Button>
              {canEdit ? <Button type="button" onClick={() => { setDraft(toDraft(viewing)); setViewing(null); setOpen(true); }}>{t('edit')}</Button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
