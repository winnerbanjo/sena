'use client';

import * as React from 'react';
import { formatNaira, calculateNights } from '@sena/config';
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
import { Plus, Hotel, Home } from 'lucide-react';

type EligibleApartment = {
  id: string;
  name: string;
  apartmentType: string;
  maxGuests: number;
  eligible: boolean;
  reason?: string;
};

type RoomCategory = {
  id: string;
  name: string;
  basePriceMinorUnits: number;
};

const nairaToMinor = (value: string): number | null => {
  if (value.trim() === '') return null;
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
};

const minorToNaira = (minor: number | null | undefined) =>
  minor == null ? '' : String(minor / 100);

export function AddAccommodationDialog({
  reservation,
  open,
  onOpenChange,
  onAdded,
}: {
  reservation: ReservationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (result: any) => void;
}) {
  const [accommodationType, setAccommodationType] = React.useState<'room' | 'apartment'>('room');
  const [checkIn, setCheckIn] = React.useState('');
  const [checkOut, setCheckOut] = React.useState('');
  const [guests, setGuests] = React.useState(1);

  // Room category & physical room
  const [categories, setCategories] = React.useState<RoomCategory[]>([]);
  const [roomTypeId, setRoomTypeId] = React.useState('');
  const [roomId, setRoomId] = React.useState('');
  const [rooms, setRooms] = React.useState<EligiblePhysicalRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = React.useState(false);

  // Apartment
  const [apartments, setApartments] = React.useState<EligibleApartment[]>([]);
  const [apartmentId, setApartmentId] = React.useState('');
  const [loadingApartments, setLoadingApartments] = React.useState(false);

  // Pricing
  const [agreedAmountInput, setAgreedAmountInput] = React.useState('');
  const [customPrice, setCustomPrice] = React.useState(false);
  const [specialRequests, setSpecialRequests] = React.useState('');

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !reservation) return;
    setAccommodationType('room');
    setCheckIn(reservation.checkInDate);
    setCheckOut(reservation.checkOutDate);
    setGuests(1);
    setRoomTypeId('');
    setRoomId('');
    setApartmentId('');
    setAgreedAmountInput('');
    setCustomPrice(false);
    setSpecialRequests('');
    setError(null);
  }, [open, reservation]);

  // Fetch room categories
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch('/api/rooms', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list: RoomCategory[] = Array.isArray(data?.roomTypes)
          ? data.roomTypes.map((rt: any) => ({
              id: rt.id,
              name: rt.name,
              basePriceMinorUnits: rt.basePriceMinorUnits,
            }))
          : [];
        setCategories(list);
        if (list.length > 0 && !roomTypeId) {
          setRoomTypeId(list[0].id);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, roomTypeId]);

  // Fetch eligible rooms
  React.useEffect(() => {
    if (!open || accommodationType !== 'room' || !roomTypeId || checkOut <= checkIn) {
      setRooms([]);
      return;
    }
    const controller = new AbortController();
    setLoadingRooms(true);
    const params = new URLSearchParams({
      roomTypeId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
    });
    fetch(`/api/rooms/eligible?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRooms([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingRooms(false);
      });
    return () => controller.abort();
  }, [open, accommodationType, roomTypeId, checkIn, checkOut]);

  // Fetch eligible apartments
  React.useEffect(() => {
    if (!open || accommodationType !== 'apartment' || checkOut <= checkIn) {
      setApartments([]);
      return;
    }
    const controller = new AbortController();
    setLoadingApartments(true);
    const params = new URLSearchParams({
      checkInDate: checkIn,
      checkOutDate: checkOut,
    });
    fetch(`/api/apartments/eligible?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setApartments(Array.isArray(data?.apartments) ? data.apartments : []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setApartments([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingApartments(false);
      });
    return () => controller.abort();
  }, [open, accommodationType, checkIn, checkOut]);

  const nights = React.useMemo(() => {
    try {
      if (checkIn && checkOut && checkOut > checkIn) {
        return calculateNights(checkIn, checkOut);
      }
    } catch {
      return 0;
    }
    return 0;
  }, [checkIn, checkOut]);

  // Standard amount calculation
  const standardAmountMinor = React.useMemo(() => {
    if (nights <= 0) return 0;
    if (accommodationType === 'room') {
      const cat = categories.find((c) => c.id === roomTypeId);
      return (cat?.basePriceMinorUnits || 0) * nights;
    }
    return 0;
  }, [nights, accommodationType, categories, roomTypeId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!reservation || saving) return;
    setSaving(true);
    setError(null);

    try {
      const customMinor = customPrice ? nairaToMinor(agreedAmountInput) : null;
      const res = await fetch(`/api/reservations/${reservation.id}/add-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accommodationType,
          roomTypeId: accommodationType === 'room' ? roomTypeId : undefined,
          roomId: accommodationType === 'room' && roomId ? roomId : undefined,
          apartmentId: accommodationType === 'apartment' ? apartmentId : undefined,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numGuests: guests,
          customTotalAmountMinorUnits: customMinor,
          specialRequests: specialRequests.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add accommodation');

      if (onAdded) onAdded(data);
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to add accommodation to booking');
    } finally {
      setSaving(false);
    }
  }

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white border border-[#E8E2DA]">
        <form onSubmit={handleAdd}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-[#191816]">
              <Plus className="w-5 h-5 text-[#B85C3E]" />
              Add room to booking
            </DialogTitle>
            <DialogDescription className="text-xs text-[#7A7267]">
              Adding accommodation to {reservation.guestName}&apos;s reservation ({reservation.reference}).
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Stay Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="add-check-in">Check-in</Label>
                <Input
                  id="add-check-in"
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="add-check-out">Check-out</Label>
                <Input
                  id="add-check-out"
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="add-guests">Guests</Label>
                <Input
                  id="add-guests"
                  type="number"
                  min={1}
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="add-acc-type">Accommodation Type</Label>
                <select
                  id="add-acc-type"
                  value={accommodationType}
                  onChange={(e) => setAccommodationType(e.target.value as 'room' | 'apartment')}
                  className="w-full rounded border border-[#E8E2DA] bg-white px-2 py-2 text-sm text-[#191816]"
                >
                  <option value="room">Hotel Room</option>
                  <option value="apartment">Serviced Apartment</option>
                </select>
              </div>
            </div>

            {/* Accommodation Selection */}
            {accommodationType === 'room' ? (
              <div className="rounded border border-[#E8E2DA] p-3 space-y-3 bg-[#FAFAFA]">
                <div>
                  <Label htmlFor="add-room-category">Room Category</Label>
                  <select
                    id="add-room-category"
                    value={roomTypeId}
                    onChange={(e) => {
                      setRoomTypeId(e.target.value);
                      setRoomId('');
                    }}
                    className="w-full rounded border border-[#E8E2DA] bg-white px-2 py-2 text-sm text-[#191816]"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {formatNaira(c.basePriceMinorUnits)}/night
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label id="add-physical-room-label">Room Number (Optional)</Label>
                  <PhysicalRoomSelect
                    rooms={rooms}
                    value={roomId}
                    onChange={setRoomId}
                    loading={loadingRooms}
                    labelledBy="add-physical-room-label"
                  />
                  <p className="text-[11px] text-[#7A7267] pt-1">
                    Leave unassigned to allocate room upon check-in.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded border border-[#E8E2DA] p-3 space-y-3 bg-[#FAFAFA]">
                <div>
                  <Label htmlFor="add-apartment-select">Select Apartment</Label>
                  <select
                    id="add-apartment-select"
                    value={apartmentId}
                    onChange={(e) => setApartmentId(e.target.value)}
                    className="w-full rounded border border-[#E8E2DA] bg-white px-2 py-2 text-sm text-[#191816]"
                    required
                  >
                    <option value="">Choose apartment</option>
                    {apartments.map((a) => (
                      <option key={a.id} value={a.id} disabled={!a.eligible}>
                        {a.name} ({a.apartmentType}){a.eligible ? '' : ` — ${a.reason}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Pricing Section */}
            <div className="rounded border border-[#E8E2DA] p-3 space-y-2 bg-[#FAFAFA]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#191816]">Room Pricing</span>
                <label className="flex items-center gap-1.5 text-xs text-[#7A7267] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customPrice}
                    onChange={(e) => {
                      setCustomPrice(e.target.checked);
                      if (e.target.checked && standardAmountMinor > 0) {
                        setAgreedAmountInput(minorToNaira(standardAmountMinor));
                      }
                    }}
                    className="rounded border-[#E8E2DA] text-[#B85C3E]"
                  />
                  Custom / agreed rate
                </label>
              </div>

              {standardAmountMinor > 0 && !customPrice ? (
                <div className="text-xs text-[#7A7267] flex justify-between">
                  <span>Standard rate ({nights} nights):</span>
                  <strong className="text-[#191816]">{formatNaira(standardAmountMinor)}</strong>
                </div>
              ) : null}

              {customPrice ? (
                <div>
                  <Label htmlFor="add-custom-price">Agreed total for this room (₦)</Label>
                  <Input
                    id="add-custom-price"
                    type="number"
                    min={0}
                    step="100"
                    placeholder="e.g. 75000"
                    value={agreedAmountInput}
                    onChange={(e) => setAgreedAmountInput(e.target.value)}
                    required
                  />
                </div>
              ) : null}
            </div>

            <div>
              <Label htmlFor="add-notes">Special Requests / Notes</Label>
              <Input
                id="add-notes"
                placeholder="e.g. Next to previous room, extra towels"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
              />
            </div>

            {error ? (
              <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#2E6B4F] hover:bg-[#255740] text-white"
            >
              {saving ? 'Adding room…' : 'Add room to booking'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
