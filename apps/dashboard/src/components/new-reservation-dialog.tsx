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

const ROOM_OPTIONS = [
  { id: 'rt-exec', name: 'Executive Room', price: 12000000, available: 4 },
  { id: 'rt-dlx', name: 'Deluxe Room', price: 8000000, available: 2 },
  { id: 'rt-suite', name: 'Saffron Suite', price: 18000000, available: 1 },
];

export function NewReservationDialog({
  open,
  onOpenChange,
  onCreateReservation,
}: NewReservationDialogProps) {
  const [checkIn, setCheckIn] = React.useState('2026-09-24');
  const [checkOut, setCheckOut] = React.useState('2026-09-27');
  const [selectedRoom, setSelectedRoom] = React.useState(ROOM_OPTIONS[0].name);
  const [guestName, setGuestName] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [paymentStatus, setPaymentStatus] = React.useState<'paid' | 'part_payment' | 'pay_later'>('pay_later');
  const [source, setSource] = React.useState<'walk_in' | 'phone' | 'direct' | 'whatsapp'>('walk_in');

  const nights = calculateNights(checkIn, checkOut);
  const selectedRoomObj = ROOM_OPTIONS.find((r) => r.name === selectedRoom) || ROOM_OPTIONS[0];
  const totalAmountMinorUnits = selectedRoomObj.price * nights;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName) return;

    const reference = `SEN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const newRes: ReservationItem = {
      id: `res-${Date.now()}`,
      reference,
      guestName,
      guestEmail: guestEmail || `${guestName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      guestPhone: guestPhone || '+234 800 000 0000',
      roomType: selectedRoomObj.name,
      roomNumber: selectedRoomObj.name.includes('Executive') ? '203' : '104',
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
          text: `Reservation ${reference} created by Front Desk (${source})`,
          actor: 'Front Desk',
        },
      ],
    };

    onCreateReservation(newRes);
    onOpenChange(false);
    // Reset form
    setGuestName('');
    setGuestPhone('');
    setGuestEmail('');
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
                {ROOM_OPTIONS.map((rm) => (
                  <button
                    key={rm.id}
                    type="button"
                    onClick={() => setSelectedRoom(rm.name)}
                    className={`p-2.5 rounded border text-left text-xs transition-all ${
                      selectedRoom === rm.name
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
                      {rm.available} available
                    </span>
                  </button>
                ))}
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create reservation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
