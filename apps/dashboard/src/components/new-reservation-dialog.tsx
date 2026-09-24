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
} from '@sena/ui';
import type { ReservationItem } from './mock-data';

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

export function NewReservationDialog({
  open,
  onOpenChange,
  onCreateReservation,
}: NewReservationDialogProps) {
  const [checkIn, setCheckIn] = React.useState('2026-09-24');
  const [checkOut, setCheckOut] = React.useState('2026-09-27');
  const [roomOptions, setRoomOptions] = React.useState<RoomTypeOption[]>([]);
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>('');
  const [guestName, setGuestName] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [paymentStatus, setPaymentStatus] = React.useState<'paid' | 'part_payment' | 'pay_later'>('pay_later');
  const [source, setSource] = React.useState<'walk_in' | 'phone' | 'direct' | 'whatsapp'>('walk_in');
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      fetch('/api/rooms')
        .then((res) => res.json())
        .then((data) => {
          if (data.roomTypes && data.roomTypes.length > 0) {
            const mapped = data.roomTypes.map((rt: any) => ({
              id: rt.id,
              name: rt.name,
              price: rt.basePriceMinorUnits,
              available: rt.totalInventory || 1,
            }));
            setRoomOptions(mapped);
            setSelectedRoomId(mapped[0].id);
          }
        })
        .catch(console.error);
    }
  }, [open]);

  const nights = calculateNights(checkIn, checkOut);
  const selectedRoomObj = roomOptions.find((r) => r.id === selectedRoomId) || roomOptions[0] || {
    id: 'default',
    name: 'Standard Room',
    price: 8500000,
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
        const err = await res.json();
        throw new Error(err.error || 'Failed to create reservation');
      }

      const data = await res.json();
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
            text: `Reservation ${created.reference} created in PostgreSQL (${source})`,
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
                  <div className="col-span-3 text-xs text-[#7A7267] p-2 bg-[#FAFAFA] rounded border border-[#E8E2DA]">
                    Loading categories from PostgreSQL...
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
              {submitting ? 'Creating in PostgreSQL...' : 'Create reservation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
