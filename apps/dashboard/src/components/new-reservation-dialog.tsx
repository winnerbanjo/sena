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

export function NewReservationDialog({
  open,
  onOpenChange,
  onCreateReservation,
}: NewReservationDialogProps) {
  const workspace = useWorkspace();
  const getTodayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: workspace?.property.timezone || 'Africa/Lagos' }).format(new Date());
  const getTomorrowStr = () => {
    const d = new Date(`${getTodayStr()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [checkIn, setCheckIn] = React.useState(getTodayStr());
  const [checkOut, setCheckOut] = React.useState(getTomorrowStr());
  const [roomOptions, setRoomOptions] = React.useState<RoomTypeOption[]>([]);
  const [loadingRooms, setLoadingRooms] = React.useState(false);
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>('');
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
      setLoadingRooms(true);

      fetch('/api/rooms')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.roomTypes && data.roomTypes.length > 0) {
            const mapped = data.roomTypes.map((rt: any) => ({
              id: rt.id,
              name: rt.name,
              price: rt.basePriceMinorUnits,
              available: rt.totalInventory || 0,
            }));
            setRoomOptions(mapped);
            setSelectedRoomId((prev) => (mapped.some((m: any) => m.id === prev) ? prev : mapped[0].id));
          } else {
            setRoomOptions([]);
            setSelectedRoomId('');
          }
        })
        .catch(() => {
          setRoomOptions([]);
          setSelectedRoomId('');
        })
        .finally(() => setLoadingRooms(false));
    }
  }, [open]);

  const nights = (() => { try { return calculateNights(checkIn, checkOut); } catch { return 0; } })();
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
          roomTypeId: selectedRoomId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numGuests: 2,
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
            <DialogTitle>New reservation</DialogTitle>
            <DialogDescription>
              Check availability and record a stay directly into the master calendar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="reservation-check-in">Check-in</Label>
                <Input
                  id="reservation-check-in"
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="reservation-check-out">Check-out</Label>
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

            {/* Room selection */}
            <div>
              <Label>Room Category</Label>
              <div className="grid grid-cols-3 gap-2">
                {loadingRooms ? (
                  <div className="col-span-3 text-xs text-[#7A7267] p-3 bg-[#FAFAFA] rounded border border-[#E8E2DA] flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading room categories…
                  </div>
                ) : roomOptions.length === 0 ? (
                  <div className="col-span-3 p-3 bg-[#FFF8F5] rounded border border-[#F0D5C3] text-xs text-[#71382D]">
                    <strong className="block mb-0.5">No room categories set up yet.</strong>
                    Go to <strong>Rooms → Add category</strong> to create your first room type before making reservations.
                  </div>
                ) : (
                  roomOptions.map((rm) => (
                    <button
                      key={rm.id}
                      type="button"
                      aria-pressed={selectedRoomId === rm.id}
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
                  aria-label="Guest full name" autoComplete="name"
                  placeholder="Full name (e.g. Ada James)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="tel" aria-label="Guest phone" autoComplete="tel"
                  placeholder="Phone (+234...)"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
                <Input
                  type="email"
                  aria-label="Guest email" autoComplete="email"
                  placeholder="Email address"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Source & Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="reservation-source">Source</Label>
                <select id="reservation-source"
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
                <Label>Payment</Label>
                <p className="text-xs text-[#7A7267] mt-2">Record payments from the reservation after saving it. New reservations start unpaid.</p>
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
            <Button type="submit" disabled={submitting || roomOptions.length === 0 || !selectedRoomId} className="bg-[#71382D] hover:bg-[#5D2E25] text-white">
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
