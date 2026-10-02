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

type Quote = {
  mode: 'unchanged' | 'extension' | 'shortening';
  previousTotalMinorUnits: number;
  additionalNights: number;
  configuredNightlyRateMinorUnits: number | null;
  suggestedAmountMinorUnits: number | null;
  appliedAmountMinorUnits: number;
  nextTotalMinorUnits: number;
  paidAmountMinorUnits: number;
  requiresOperatorAction: string | null;
  note: string | null;
};

const REASONS = [
  'Standard extension',
  'Negotiated extension',
  'Management approved',
  'Corporate rate',
  'Long stay',
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
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [extensionAmount, setExtensionAmount] = React.useState('');
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
    setQuote(null);
    setError(null);
    setExtensionAmount('');
    setReason(REASONS[0]);
    seededFor.current = '';
  }, [open, reservation]);

  React.useEffect(() => {
    if (!open || !reservation?.roomTypeId || reservation.apartmentId) {
      setRooms([]);
      return;
    }
    const controller = new AbortController();
    setLoadingRooms(true);
    const params = new URLSearchParams({
      roomTypeId: reservation.roomTypeId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      excludeReservationId: reservation.id,
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
  }, [open, reservation, checkIn, checkOut]);

  React.useEffect(() => {
    if (!open || !reservation || checkOut <= checkIn) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          preview: true,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numGuests: guests,
          roomId: reservation.apartmentId ? null : roomId || null,
        }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Could not preview this change.');
          const next: Quote | null = data.financial || null;
          setQuote(next);
          // Seed the operator's box with the configured-rate suggestion once per
          // stay change, then leave it entirely in their hands.
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
  }, [open, reservation, checkIn, checkOut, guests, roomId]);

  if (!reservation) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!reservation || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numGuests: guests,
          roomId: reservation.apartmentId ? null : roomId || null,
          extensionAmountMinorUnits: quote?.mode === 'extension' ? nairaToMinor(extensionAmount) : null,
          extensionReason: quote?.mode === 'extension' ? reason : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save this reservation.');
      const room = rooms.find((item) => item.id === roomId);
      onSaved({
        ...reservation,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights: data.reservation?.nights || reservation.nights,
        numGuests: guests,
        roomId: reservation.apartmentId ? reservation.roomId : roomId || null,
        roomNumber: room?.roomNumber || reservation.roomNumber,
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
            <DialogTitle>Edit reservation</DialogTitle>
            <DialogDescription>
              {reservation.reference}. Payments and invoices stay as they are.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3">
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
            {reservation.apartmentId ? null : (
              <div>
                <Label id="edit-room-label">Room</Label>
                <PhysicalRoomSelect
                  rooms={rooms}
                  value={roomId}
                  onChange={setRoomId}
                  loading={loadingRooms}
                  labelledBy="edit-room-label"
                />
              </div>
            )}
            {quote ? (
              <div className="rounded border border-[#E8E2DA] bg-[#FAFAFA] p-3 text-xs text-[#7A7267] space-y-1">
                <div className="flex justify-between"><span>Current accommodation</span><span>{formatNaira(quote.previousTotalMinorUnits)}</span></div>
                {quote.mode === 'extension' ? (
                  <>
                    <div className="flex justify-between"><span>Additional nights</span><span>{quote.additionalNights}</span></div>
                    <div className="flex justify-between">
                      <span>Suggested at {formatNaira(quote.configuredNightlyRateMinorUnits || 0)}/night</span>
                      <span>{quote.suggestedAmountMinorUnits == null ? '—' : formatNaira(quote.suggestedAmountMinorUnits)}</span>
                    </div>
                    <div className="pt-1">
                      <Label htmlFor="edit-extension-amount">Additional stay amount (₦)</Label>
                      <Input
                        id="edit-extension-amount"
                        type="number"
                        min={0}
                        step="100"
                        inputMode="numeric"
                        value={extensionAmount}
                        onChange={(event) => setExtensionAmount(event.target.value)}
                      />
                      <p className="text-[11px] text-[#7A7267] pt-1">
                        Adjust this if you negotiated a different amount for the extra nights.
                      </p>
                    </div>
                    <div className="pt-1">
                      <Label htmlFor="edit-extension-reason">Reason</Label>
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
                  </>
                ) : null}
                <div className="flex justify-between text-[#191816] pt-1"><strong>New accommodation</strong><strong>{formatNaira(quote.nextTotalMinorUnits)}</strong></div>
                <div className="flex justify-between"><span>Payments already recorded</span><span>{formatNaira(quote.paidAmountMinorUnits)}</span></div>
                <div className="flex justify-between"><span>Outstanding after this change</span><span>{formatNaira(Math.max(0, quote.nextTotalMinorUnits - quote.paidAmountMinorUnits))}</span></div>
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
