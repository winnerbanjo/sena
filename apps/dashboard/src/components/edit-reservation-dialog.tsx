'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
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

type EligibleApartment = { id: string; name: string; apartmentType: string; maxGuests: number; eligible: boolean; reason?: string };
type RoomCategory = { id: string; name: string };

type Quote = {
  mode: 'unchanged' | 'extension' | 'shortening';
  previousTotalMinorUnits: number;
  additionalNights: number;
  configuredNightlyRateMinorUnits: number | null;
  suggestedAmountMinorUnits: number | null;
  appliedAmountMinorUnits: number;
  nextTotalMinorUnits: number;
  paidAmountMinorUnits: number;
  invoiceCount: number;
  requiresOperatorAction: string | null;
  note: string | null;
};

const REASONS = [
  'Standard update',
  'Standard extension',
  'Negotiated extension',
  'Management approved',
  'Corporate rate',
  'Agreed rate discount',
  'Long stay rate',
  'Other',
] as const;

const nairaToMinor = (value: string): number | null => {
  if (value.trim() === '') return null;
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
};

const minorToNaira = (minor: number | null | undefined) =>
  minor == null ? '' : String(minor / 100);

export function EditReservationDialog({
  reservation,
  open,
  onOpenChange,
  onSaved,
}: {
  reservation: ReservationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (reservation: ReservationItem) => void;
}) {
  const [checkIn, setCheckIn] = React.useState('');
  const [checkOut, setCheckOut] = React.useState('');
  const [guests, setGuests] = React.useState(1);
  const [roomId, setRoomId] = React.useState('');
  const [rooms, setRooms] = React.useState<EligiblePhysicalRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = React.useState(false);
  const [accommodationType, setAccommodationType] = React.useState<'room' | 'apartment'>('room');
  const [roomTypeId, setRoomTypeId] = React.useState('');
  const [categories, setCategories] = React.useState<RoomCategory[]>([]);
  const [apartments, setApartments] = React.useState<EligibleApartment[]>([]);
  const [apartmentId, setApartmentId] = React.useState('');
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [extensionAmount, setExtensionAmount] = React.useState('');
  const [customTotalInput, setCustomTotalInput] = React.useState('');
  const [overridePrice, setOverridePrice] = React.useState(false);
  const [reason, setReason] = React.useState<string>(REASONS[0]);
  const seededFor = React.useRef<string>('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const checkedIn = reservation?.status === 'checked_in';

  React.useEffect(() => {
    if (!open || !reservation) return;
    setCheckIn(reservation.checkInDate);
    setCheckOut(reservation.checkOutDate);
    setGuests(reservation.numGuests || 1);
    setRoomId(reservation.roomId || '');
    setAccommodationType(reservation.apartmentId ? 'apartment' : 'room');
    setRoomTypeId(reservation.roomTypeId || '');
    setApartmentId(reservation.apartmentId || '');
    setQuote(null);
    setError(null);
    setExtensionAmount('');
    setCustomTotalInput('');
    setOverridePrice(false);
    setReason(REASONS[0]);
    seededFor.current = '';
  }, [open, reservation]);

  // Room categories for this property, so an operator can switch between them.
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch('/api/rooms', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list: RoomCategory[] = Array.isArray(data?.roomTypes)
          ? data.roomTypes.map((rt: { id: string; name: string }) => ({ id: rt.id, name: rt.name }))
          : [];
        setCategories(list);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [open]);

  // Eligible physical rooms for the category and dates being edited.
  React.useEffect(() => {
    if (!open || accommodationType !== 'room' || !roomTypeId) {
      if (accommodationType !== 'room') setRooms([]);
      return;
    }
    const controller = new AbortController();
    setLoadingRooms(true);
    const params = new URLSearchParams({
      roomTypeId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      excludeReservationId: reservation?.id || '',
    });
    fetch(`/api/rooms/eligible?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRooms(Array.isArray(data?.rooms) ? data.rooms : []))
      .catch(() => {
        if (!controller.signal.aborted) setRooms([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingRooms(false);
      });
    return () => controller.abort();
  }, [open, reservation, roomTypeId, checkIn, checkOut, accommodationType]);

  // Apartments available for the dates being edited.
  React.useEffect(() => {
    if (!open || accommodationType !== 'apartment' || checkOut <= checkIn) {
      setApartments([]);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      checkInDate: checkIn,
      checkOutDate: checkOut,
      excludeReservationId: reservation?.id || '',
    });
    fetch(`/api/apartments/eligible?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setApartments(Array.isArray(data?.apartments) ? data.apartments : []))
      .catch(() => {
        if (!controller.signal.aborted) setApartments([]);
      });
    return () => controller.abort();
  }, [open, reservation, checkIn, checkOut, accommodationType]);

  React.useEffect(() => {
    if (!open || !reservation || checkOut <= checkIn) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const customMinor = overridePrice ? nairaToMinor(customTotalInput) : null;
      fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          preview: true,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numGuests: guests,
          roomId: accommodationType === 'room' ? roomId || null : null,
          accommodationType,
          roomTypeId: accommodationType === 'room' ? roomTypeId : undefined,
          apartmentId: accommodationType === 'apartment' ? apartmentId || null : undefined,
          customTotalAmountMinorUnits: customMinor,
        }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Could not preview this change.');
          const next: Quote | null = data.financial || null;
          setQuote(next);
          const seedKey = next ? `${next.mode}:${next.additionalNights}:${next.suggestedAmountMinorUnits}` : '';
          if (next && seedKey && seededFor.current !== seedKey) {
            seededFor.current = seedKey;
            setExtensionAmount(minorToNaira(next.suggestedAmountMinorUnits));
          }
          if (!next || next.mode !== 'extension') {
            seededFor.current = '';
            setExtensionAmount('');
          }
          setError(null);
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setQuote(null);
            setError(err.message);
          }
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, reservation, checkIn, checkOut, guests, roomId, roomTypeId, apartmentId, accommodationType, customTotalInput, overridePrice]);

  if (!reservation) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!reservation || saving) return;
    setSaving(true);
    setError(null);
    try {
      const customMinor = overridePrice ? nairaToMinor(customTotalInput) : null;
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numGuests: guests,
          roomId: accommodationType === 'room' ? roomId || null : null,
          accommodationType,
          roomTypeId: accommodationType === 'room' ? roomTypeId : undefined,
          apartmentId: accommodationType === 'apartment' ? apartmentId || null : undefined,
          extensionAmountMinorUnits: quote?.mode === 'extension' && !overridePrice ? nairaToMinor(extensionAmount) : null,
          customTotalAmountMinorUnits: customMinor,
          extensionReason: reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save this reservation.');
      const room = rooms.find((item) => item.id === roomId);
      const apartment = apartments.find((item) => item.id === apartmentId);
      const nextCategory = categories.find((item) => item.id === roomTypeId);

      onSaved({
        ...reservation,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights: data.reservation?.nights || reservation.nights,
        numGuests: guests,
        roomId: accommodationType === 'room' ? roomId || null : null,
        apartmentId: accommodationType === 'apartment' ? apartmentId || null : null,
        apartmentName: accommodationType === 'apartment' ? (apartment?.name || reservation.apartmentName) : undefined,
        roomTypeId: accommodationType === 'room' ? roomTypeId : undefined,
        roomType: accommodationType === 'room' ? (nextCategory?.name || reservation.roomType) : (apartment?.name || reservation.roomType),
        roomNumber: accommodationType === 'room' ? (room?.roomNumber || reservation.roomNumber) : (reservation.roomNumber || ''),
        totalAmountMinorUnits: data.reservation?.totalAmountMinorUnits ?? reservation.totalAmountMinorUnits,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this reservation.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white border border-[#E8E2DA]">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Edit stay details</DialogTitle>
            <DialogDescription>
              {reservation.reference} · Modify dates, room assignment, or agreed pricing.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-check-in">Check-in</Label>
                <Input id="edit-check-in" type="date" value={checkIn} disabled={checkedIn} onChange={(event) => setCheckIn(event.target.value)} required />
              </div>
              <div>
                <Label htmlFor="edit-check-out">Check-out</Label>
                <Input id="edit-check-out" type="date" value={checkOut} min={checkIn} onChange={(event) => setCheckOut(event.target.value)} required />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-guests">Guests</Label>
              <Input id="edit-guests" type="number" min={1} value={guests} onChange={(event) => setGuests(Number(event.target.value))} required />
            </div>

            <fieldset className="rounded border border-[#E8E2DA] p-3 space-y-3">
              <legend className="px-1 text-xs font-medium text-[#191816]">Accommodation</legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-accommodation-type">Type</Label>
                  <select
                    id="edit-accommodation-type"
                    value={accommodationType}
                    onChange={(event) => setAccommodationType(event.target.value as 'room' | 'apartment')}
                    className="w-full rounded border border-[#E8E2DA] bg-white px-2 py-2 text-sm text-[#191816]"
                  >
                    <option value="room">Hotel Room</option>
                    <option value="apartment">Serviced Apartment</option>
                  </select>
                </div>
                {accommodationType === 'room' ? (
                  <div>
                    <Label id="edit-category-label">Category</Label>
                    <select
                      aria-labelledby="edit-category-label"
                      value={roomTypeId}
                      onChange={(event) => {
                        setRoomTypeId(event.target.value);
                        setRoomId('');
                      }}
                      className="w-full rounded border border-[#E8E2DA] bg-white px-2 py-2 text-sm text-[#191816]"
                    >
                      <option value="">Choose category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              {accommodationType === 'room' ? (
                <div>
                  <Label id="edit-room-label">Physical Room</Label>
                  <PhysicalRoomSelect
                    rooms={rooms}
                    value={roomId}
                    onChange={setRoomId}
                    loading={loadingRooms}
                    labelledBy="edit-room-label"
                  />
                  <p className="text-[11px] text-[#7A7267] pt-1">Only rooms available for these dates are selectable.</p>
                </div>
              ) : (
                <div>
                  <Label id="edit-apartment-label">Apartment</Label>
                  <select
                    aria-labelledby="edit-apartment-label"
                    value={apartmentId}
                    onChange={(event) => setApartmentId(event.target.value)}
                    className="w-full rounded border border-[#E8E2DA] bg-white px-2 py-2 text-sm text-[#191816]"
                  >
                    <option value="">Choose apartment</option>
                    {apartments.map((unit) => (
                      <option key={unit.id} value={unit.id} disabled={!unit.eligible}>
                        {unit.name}{unit.eligible ? '' : ` — ${unit.reason}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#7A7267] pt-1">Only apartments available for these dates are listed.</p>
                </div>
              )}
            </fieldset>

            {/* Agreed / Negotiated Pricing Override */}
            <div className="rounded border border-[#E8E2DA] p-3 space-y-2 bg-[#FAFAFA]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#191816]">Negotiated / Agreed Price</span>
                <label className="flex items-center gap-1.5 text-xs text-[#7A7267] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overridePrice}
                    onChange={(e) => {
                      setOverridePrice(e.target.checked);
                      if (e.target.checked && quote) {
                        setCustomTotalInput(minorToNaira(quote.nextTotalMinorUnits));
                      }
                    }}
                    className="rounded border-[#E8E2DA] text-[#B85C3E]"
                  />
                  Custom stay total
                </label>
              </div>

              {overridePrice ? (
                <div>
                  <Label htmlFor="custom-total-input">Total agreed accommodation amount (₦)</Label>
                  <Input
                    id="custom-total-input"
                    type="number"
                    min={0}
                    step="100"
                    inputMode="numeric"
                    placeholder="e.g. 150000"
                    value={customTotalInput}
                    onChange={(e) => setCustomTotalInput(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-[#7A7267] pt-1">
                    Cannot be set lower than the amount already paid (₦{formatNaira(reservation.paidAmountMinorUnits)}).
                  </p>
                </div>
              ) : null}

              <div>
                <Label htmlFor="edit-extension-reason">Reason for change</Label>
                <select
                  id="edit-extension-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded border border-[#E8E2DA] bg-white px-2 py-2 text-sm text-[#191816]"
                >
                  {REASONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            {quote ? (
              <div className="rounded border border-[#E8E2DA] bg-[#FAFAFA] p-3 text-xs text-[#7A7267] space-y-1">
                <div className="flex justify-between"><span>Current accommodation</span><span>{formatNaira(quote.previousTotalMinorUnits)}</span></div>
                {quote.mode === 'extension' && !overridePrice ? (
                  <>
                    <div className="flex justify-between"><span>Additional nights</span><span>{quote.additionalNights}</span></div>
                    <div className="flex justify-between">
                      <span>Suggested at {formatNaira(quote.configuredNightlyRateMinorUnits || 0)}/night</span>
                      <span>{quote.suggestedAmountMinorUnits == null ? '—' : formatNaira(quote.suggestedAmountMinorUnits)}</span>
                    </div>
                    <div className="pt-1">
                      <Label htmlFor="edit-extension-amount">Extension stay addition (₦)</Label>
                      <Input
                        id="edit-extension-amount"
                        type="number"
                        min={0}
                        step="100"
                        inputMode="numeric"
                        value={extensionAmount}
                        onChange={(event) => setExtensionAmount(event.target.value)}
                      />
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between text-[#191816] pt-1 border-t border-[#E8E2DA]">
                  <strong>New total accommodation</strong>
                  <strong>{formatNaira(quote.nextTotalMinorUnits)}</strong>
                </div>
                <div className="flex justify-between"><span>Payments already recorded</span><span>{formatNaira(quote.paidAmountMinorUnits)}</span></div>
                <div className="flex justify-between">
                  <span>Balance due after save</span>
                  <strong className="text-[#B85C3E]">{formatNaira(Math.max(0, quote.nextTotalMinorUnits - quote.paidAmountMinorUnits))}</strong>
                </div>
                {quote.invoiceCount > 0 ? (
                  <p className="text-[#2E6B4F] pt-1">
                    ✓ Open draft/issued invoices for this stay will be automatically synchronized with this new rate.
                  </p>
                ) : null}
                {quote.requiresOperatorAction ? <p className="text-[#71382D] pt-1">{quote.requiresOperatorAction}</p> : null}
                {quote.note ? <p className="text-[#71382D] pt-1">{quote.note}</p> : null}
              </div>
            ) : null}

            {error ? <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || Boolean(error)} className="bg-[#71382D] hover:bg-[#5D2E25] text-white">
              {saving ? 'Saving…' : 'Save reservation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
