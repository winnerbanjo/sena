'use client';

import * as React from 'react';
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
import type { ReservationItem } from './mock-data';
import { Loader2 } from 'lucide-react';

interface NewReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateReservation: (reservation: ReservationItem) => void;
}

interface RoomTypeOption {
  id: string;
  name: string;
  price: number;
  available: number;
}

const DEFAULT_ROOM_OPTIONS: RoomTypeOption[] = [
  { id: 'standard', name: 'Standard Room', price: 5000000, available: 4 },
  { id: 'deluxe', name: 'Deluxe Suite', price: 7500000, available: 2 },
  { id: 'executive', name: 'Executive Suite', price: 12000000, available: 1 },
];

export function NewReservationDialog({
  open,
  onOpenChange,
  onCreateReservation,
}: NewReservationDialogProps) {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [checkIn, setCheckIn] = React.useState(getTodayStr());
  const [checkOut, setCheckOut] = React.useState(getTomorrowStr());
  const [roomOptions, setRoomOptions] = React.useState<RoomTypeOption[]>(DEFAULT_ROOM_OPTIONS);
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>(DEFAULT_ROOM_OPTIONS[0].id);
  const [guestName, setGuestName] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [paymentStatus, setPaymentStatus] = React.useState<'paid' | 'part_payment' | 'pay_later'>('pay_later');
  const [source, setSource] = React.useState<'walk_in' | 'phone' | 'direct' | 'whatsapp'>('walk_in');
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setCheckIn(getTodayStr());
      setCheckOut(getTomorrowStr());

      fetch('/api/rooms')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.roomTypes && data.roomTypes.length > 0) {
            const mapped = data.roomTypes.map((rt: any) => ({
              id: rt.id,
              name: rt.name,
              price: rt.basePriceMinorUnits,
              available: rt.totalInventory || 1,
            }));
            setRoomOptions(mapped);
            setSelectedRoomId((prev) => (mapped.some((m: any) => m.id === prev) ? prev : mapped[0].id));
          }
        })
        .catch(() => {});
    }
  }, [open]);

  const nights = Math.max(1, calculateNights(checkIn, checkOut));
  const selectedRoomObj = roomOptions.find((r) => r.id === selectedRoomId) || roomOptions[0] || {
    id: 'default',
    name: 'Standard Room',
    price: 5000000,
    available: 1,
  };
  const totalAmountMinorUnits = selectedRoomObj.price * nights;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName || !selectedRoomId) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomTypeId: selectedRoomId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numGuests: 2,
          source,
          paymentStatus,
          paidAmountMinorUnits: paymentStatus === 'paid' ? totalAmountMinorUnits : 0,
          guest: {
            fullName: guestName,
            email: guestEmail || `${guestName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            phone: guestPhone || '+234 800 000 0000',
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
        roomType: selectedRoomObj.name,
        roomNumber: 'Unassigned',
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
      <DialogContent className="max-w-lg bg-white border border-[#E8E2DA]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New reservation</DialogTitle>
            <DialogDescription>
              Check availability and record a stay directly into the master calendar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Check-in</Label>
                <Input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Check-out</Label>
                <Input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Room selection */}
            <div>
              <Label>Room Category</Label>
              <div className="grid grid-cols-3 gap-2">
                {roomOptions.length === 0 ? (
                  <div className="col-span-3 text-xs text-[#7A7267] p-2.5 bg-[#FAFAFA] rounded border border-[#E8E2DA] flex items-center justify-center">
                    Loading available room categories...
                  </div>
                ) : (
                  roomOptions.map((rm) => (
                    <button
                      key={rm.id}
                      type="button"
                      onClick={() => setSelectedRoomId(rm.id)}
                      className={`p-2.5 rounded border text-left text-xs transition-all ${
                        selectedRoomId === rm.id
                          ? 'border-[#B85C3E] bg-[#FAFAFA] ring-1 ring-[#B85C3E]'
                          : 'border-[#E8E2DA] bg-white hover:border-[#7A7267]'
                      }`}
                    >
                      <span className="font-semibold text-[#191816] block truncate">
                        {rm.name}
                      </span>
                      <span className="text-[11px] text-[#7A7267] block">
                        {formatNaira(rm.price)}/nt
                      </span>
                      <span className="text-[10px] text-[#2E6B4F] mt-1 block">
                        {rm.available} in inventory
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Guest Details */}
            <div className="pt-2 border-t border-[#E8E2DA] space-y-3">
              <Label>Guest Information</Label>
              <div>
                <Input
                  placeholder="Full name (e.g. Ada James)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Phone (+234...)"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Source & Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source</Label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as any)}
                  className="flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 py-2 text-xs text-[#191816]"
                >
                  <option value="walk_in">Walk-in</option>
                  <option value="phone">Phone call</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="direct">Direct Website</option>
                </select>
              </div>
              <div>
                <Label>Payment State</Label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 py-2 text-xs text-[#191816]"
                >
                  <option value="pay_later">Pay later</option>
                  <option value="paid">Paid in full</option>
                  <option value="part_payment">Part payment</option>
                </select>
              </div>
            </div>

            {/* Cost summary */}
            <div className="p-3 bg-[#FAFAFA] rounded border border-[#E8E2DA] flex items-center justify-between text-xs">
              <span className="text-[#7A7267]">
                Total for {nights} {nights === 1 ? 'night' : 'nights'}:
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
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-[#71382D] hover:bg-[#5D2E25] text-white">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Confirming reservation...
                </span>
              ) : (
                'Create reservation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
