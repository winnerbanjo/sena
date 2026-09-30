'use client';

import * as React from 'react';
import { useWorkspace } from './workspace-access';
import { calculateNights, formatNaira } from '@sena/config';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@sena/ui';
import type { ReservationItem } from './mock-data';
import { PhysicalRoomSelect } from './physical-room-select';
import type { EligiblePhysicalRoom } from './reservation-room';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface NewReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateReservation: (reservation: ReservationItem) => void;
}

interface RoomTypeOption {
  id: string;
  kind: 'room' | 'apartment';
  name: string;
  price: number;
  available: number;
  maxGuests?: number;
}

export function NewReservationDialog({
  open,
  onOpenChange,
  onCreateReservation,
}: NewReservationDialogProps) {
  const workspace = useWorkspace();
  const t = useTranslations('reservations');
  const tCommon = useTranslations('common');
  const tFront = useTranslations('frontDesk');
  const getTodayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: workspace?.property.timezone || 'Africa/Lagos' }).format(new Date());
  const getTomorrowStr = () => {
    const d = new Date(`${getTodayStr()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [checkIn, setCheckIn] = React.useState(getTodayStr());
  const [checkOut, setCheckOut] = React.useState(getTomorrowStr());
  const [roomOptions, setRoomOptions] = React.useState<RoomTypeOption[]>([]);
  const [accommodationFilter, setAccommodationFilter] = React.useState<'all' | 'rooms' | 'apartments'>('all');
  const [accommodationQuery, setAccommodationQuery] = React.useState('');
  const [loadingRooms, setLoadingRooms] = React.useState(false);
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>('');
  const [physicalRoomId, setPhysicalRoomId] = React.useState<string>('');
  const [eligibleRooms, setEligibleRooms] = React.useState<EligiblePhysicalRoom[]>([]);
  const [loadingEligible, setLoadingEligible] = React.useState(false);
  const [guestName, setGuestName] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [paymentStatus, setPaymentStatus] = React.useState<'paid' | 'part_payment' | 'pay_later'>('pay_later');
  const [source, setSource] = React.useState<'walk_in' | 'phone' | 'direct' | 'whatsapp'>('walk_in');
  const requestKey = React.useRef<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setCheckIn(getTodayStr());
      setCheckOut(getTomorrowStr());
      setPhysicalRoomId('');
      setEligibleRooms([]);
      setLoadingRooms(true);

      Promise.all([
        fetch('/api/rooms').then((res) => (res.ok ? res.json() : null)),
        fetch('/api/apartments').then((res) => (res.ok ? res.json() : null)),
      ])
        .then(([roomsData, apartmentsData]) => {
          const mapped: RoomTypeOption[] = [
            ...((roomsData?.roomTypes || []).map((rt: any) => ({
              id: rt.id,
              kind: 'room' as const,
              name: rt.name,
              price: rt.basePriceMinorUnits,
              available: rt.totalInventory || 0,
            }))),
            ...((apartmentsData?.apartments || []).map((apartment: any) => ({
              id: apartment.id,
              kind: 'apartment' as const,
              name: apartment.name,
              price: apartment.basePriceMinorUnits,
              available: apartment.availability ?? 1,
              maxGuests: apartment.maxGuests,
            }))),
          ];
          setRoomOptions(mapped);
          setAccommodationFilter('all');
          setAccommodationQuery('');
          setSelectedRoomId((prev) => (mapped.some((item) => item.id === prev) ? prev : mapped[0]?.id || ''));
        })
        .catch(() => {
          setRoomOptions([]);
          setSelectedRoomId('');
        })
        .finally(() => setLoadingRooms(false));
    }
  }, [open]);

  React.useEffect(() => {
    const selectedKind = roomOptions.find((option) => option.id === selectedRoomId)?.kind;
    if (!open || selectedKind === 'apartment' || !selectedRoomId || !checkIn || !checkOut || checkOut <= checkIn) {
      setEligibleRooms([]);
      setPhysicalRoomId('');
      return;
    }

    const controller = new AbortController();
    setLoadingEligible(true);
    fetch(`/api/rooms/eligible?roomTypeId=${encodeURIComponent(selectedRoomId)}&checkInDate=${encodeURIComponent(checkIn)}&checkOutDate=${encodeURIComponent(checkOut)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const nextRooms: EligiblePhysicalRoom[] = Array.isArray(data?.rooms) ? data.rooms : [];
        setEligibleRooms(nextRooms);
        setPhysicalRoomId((current) => (nextRooms.some((room) => room.id === current && room.eligible) ? current : ''));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEligibleRooms([]);
          setPhysicalRoomId('');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingEligible(false);
      });

    return () => controller.abort();
  }, [open, selectedRoomId, checkIn, checkOut, roomOptions]);

  const nights = (() => { try { return calculateNights(checkIn, checkOut); } catch { return 0; } })();
  const hasRooms = roomOptions.some((option) => option.kind === 'room');
  const hasApartments = roomOptions.some((option) => option.kind === 'apartment');
  const visibleOptions = roomOptions.filter((option) => {
    if (accommodationFilter === 'rooms' && option.kind !== 'room') return false;
    if (accommodationFilter === 'apartments' && option.kind !== 'apartment') return false;
    const query = accommodationQuery.trim().toLowerCase();
    return !query || option.name.toLowerCase().includes(query);
  });
  const selectedRoomObj = roomOptions.find((r) => r.id === selectedRoomId) || null;
  const totalAmountMinorUnits = selectedRoomObj ? selectedRoomObj.price * nights : 0;


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!guestName.trim() || !selectedRoomId) return;
    if (nights === 0) { setErrorMsg('Check-out must be after check-in.'); return; }

    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey.current },
        body: JSON.stringify({
          ...(selectedRoomObj?.kind === 'apartment'
            ? { apartmentId: selectedRoomId, numGuests: Math.min(2, selectedRoomObj.maxGuests || 2) }
            : { roomTypeId: selectedRoomId, roomId: physicalRoomId || undefined, numGuests: 2 }),
          checkInDate: checkIn,
          checkOutDate: checkOut,
          source,
          paymentStatus,
          paidAmountMinorUnits: paymentStatus === 'paid' ? totalAmountMinorUnits : 0,
          guest: {
            fullName: guestName.trim(),
            email: guestEmail.trim().toLowerCase(),
            phone: guestPhone.trim(),
          },
        }),
      });

      if (!res.ok) {
        let errMsg = 'Failed to create reservation';
        try {
          const err = await res.json();
          if (err.error) errMsg = err.error;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        throw new Error(errMsg);
      }

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      const created = data.reservation;

      onCreateReservation({
        id: created.id,
        reference: created.reference,
        guestName,
        guestEmail: guestEmail || `${guestName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        guestPhone: guestPhone || '+234 800 000 0000',
        roomType: selectedRoomObj?.name || 'Unassigned',
        roomId: physicalRoomId || null,
        roomNumber: eligibleRooms.find((room) => room.id === physicalRoomId)?.roomNumber || 'Unassigned',
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights,
        numGuests: 2,
        source,
        status: 'confirmed',
        paymentStatus,
        totalAmountMinorUnits,
        paidAmountMinorUnits: paymentStatus === 'paid' ? totalAmountMinorUnits : 0,
        timeline: [
          {
            time: 'Just now',
            text: `Reservation ${created.reference} confirmed (${source === 'walk_in' ? 'Walk-in' : 'Direct'})`,
            actor: 'Staff',
          },
        ],
      });

      onOpenChange(false);
      requestKey.current = null;
      setGuestName('');
      setGuestPhone('');
      setGuestEmail('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error creating reservation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onPointerDownOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => { if (submitting) event.preventDefault(); }} className="max-w-lg bg-white border border-[#E8E2DA]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('createTitle')}</DialogTitle>
            <DialogDescription>
              {t('subtitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="reservation-check-in">{t('checkInLabel')}</Label>
                <Input
                  id="reservation-check-in"
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="reservation-check-out">{t('checkOutLabel')}</Label>
                <Input
                  id="reservation-check-out"
                  min={checkIn}
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label>{hasApartments && hasRooms ? t('accommodation') : hasApartments ? t('apartment') : t('roomCategory')}</Label>
              {hasApartments && hasRooms ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {(['all', 'rooms', 'apartments'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setAccommodationFilter(filter)}
                      className={`px-2.5 py-1.5 rounded border text-xs ${accommodationFilter === filter ? 'border-[#B85C3E] bg-[#FAFAFA] text-[#71382D]' : 'border-[#E8E2DA] bg-white text-[#191816]'}`}
                    >
                      {t(filter === 'all' ? 'accommodationAll' : filter === 'rooms' ? 'accommodationRooms' : 'accommodationApartments')}
                    </button>
                  ))}
                </div>
              ) : null}
              {hasApartments && hasRooms ? (
                <Input
                  value={accommodationQuery}
                  onChange={(event) => setAccommodationQuery(event.target.value)}
                  placeholder={t('searchAccommodation')}
                  className="mb-2"
                />
              ) : null}
              <div className={`grid gap-2 ${hasApartments ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
                {loadingRooms ? (
                  <div className="text-xs text-[#7A7267] p-3 bg-[#FAFAFA] rounded border border-[#E8E2DA] flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t('loadingRooms')}
                  </div>
                ) : visibleOptions.length === 0 ? (
                  <div className="p-3 bg-[#FFF8F5] rounded border border-[#F0D5C3] text-xs text-[#71382D]">
                    <strong className="block mb-0.5">{hasApartments ? t('noAccommodation') : t('noCategories')}</strong>
                    {hasApartments ? t('noAccommodationHint') : t('noCategoriesHint')}
                  </div>
                ) : (
                  visibleOptions.map((rm) => (
                    <button
                      key={rm.id}
                      type="button"
                      aria-pressed={selectedRoomId === rm.id}
                      onClick={() => setSelectedRoomId(rm.id)}
                      className={`p-2.5 rounded border text-start text-xs transition-all ${
                        selectedRoomId === rm.id
                          ? 'border-[#B85C3E] bg-[#FAFAFA] ring-1 ring-[#B85C3E]'
                          : 'border-[#E8E2DA] bg-white hover:border-[#7A7267]'
                      }`}
                    >
                      <span className="font-semibold text-[#191816] block truncate">
                        {rm.name}
                      </span>
                      <span className="text-[11px] text-[#7A7267] block">
                        {rm.kind === 'apartment' ? t('apartment') : t('roomCategory')} · {formatNaira(rm.price)}/nt
                      </span>
                      <span className="text-[10px] text-[#2E6B4F] mt-1 block">
                        {rm.kind === 'apartment' ? t('oneUnit') : `${rm.available} in inventory`}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {selectedRoomObj?.kind === 'apartment' ? null : <div>
              <Label id="assign-room-label">{tFront('assignRoom')}</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setPhysicalRoomId('')}
                  aria-pressed={!physicalRoomId}
                  className={`px-2.5 py-1.5 rounded border text-xs ${
                    !physicalRoomId
                      ? 'border-[#B85C3E] bg-[#FAFAFA] text-[#71382D]'
                      : 'border-[#E8E2DA] bg-white text-[#191816] hover:border-[#7A7267]'
                  }`}
                >
                  Assign later
                </button>
              </div>
              <PhysicalRoomSelect
                rooms={eligibleRooms}
                value={physicalRoomId}
                onChange={setPhysicalRoomId}
                loading={loadingEligible}
                labelledBy="assign-room-label"
                emptyLabel="No physical rooms in this category yet. Inventory will still be reserved."
              />
              <p className="text-[11px] text-[#8C8275] mt-1.5">
                Optional. You can reserve the room type now and assign a specific room at check-in.
              </p>
            </div>}

            {/* Guest Details */}
            <div className="pt-2 border-t border-[#E8E2DA] space-y-3">
              <Label>{t('guestInfo')}</Label>
              <div>
                <Input
                  aria-label={t('guestName')} autoComplete="name"
                  placeholder={t('guestName')}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="tel" aria-label={t('guestPhone')} autoComplete="tel"
                  placeholder={t('guestPhone')}
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
                <Input
                  type="email"
                  aria-label={t('guestEmail')} autoComplete="email"
                  placeholder={t('guestEmail')}
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Source & Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="reservation-source">{t('source')}</Label>
                <select id="reservation-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as any)}
                  className="flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 py-2 text-xs text-[#191816]"
                >
                  <option value="walk_in">{t('walkIn')}</option>
                  <option value="phone">{t('sourcePhone')}</option>
                  <option value="whatsapp">{t('sourceWhatsapp')}</option>
                  <option value="direct">{t('sourceWebsite')}</option>
                </select>
              </div>
              <div>
                <Label>{tCommon('actions')}</Label>
                <p className="text-xs text-[#7A7267] mt-2">{t('paymentNote')}</p>
              </div>
            </div>

            {/* Cost summary */}
            <div className="p-3 bg-[#FAFAFA] rounded border border-[#E8E2DA] flex items-center justify-between text-xs">
              <span className="text-[#7A7267]">
                {t('nights', { count: nights })}:
              </span>
              <strong className="text-base font-serif text-[#191816]">
                {formatNaira(totalAmountMinorUnits)}
              </strong>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 mx-6 mb-2 rounded bg-red-50 text-red-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={submitting || roomOptions.length === 0 || !selectedRoomId} className="bg-[#71382D] hover:bg-[#5D2E25] text-white">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('creating')}
                </span>
              ) : (
                t('confirmCreate')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
