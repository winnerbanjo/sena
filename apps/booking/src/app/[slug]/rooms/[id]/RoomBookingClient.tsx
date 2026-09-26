'use client';

import * as React from 'react';
import { Calendar, Users, ShieldCheck, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

export function RoomBookingClient({
  property,
  room,
  initialCheckIn,
  initialCheckOut,
  initialGuests,
}: {
  property: any;
  room: any;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultOut = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

  const [checkIn, setCheckIn] = React.useState(initialCheckIn || todayStr);
  const [checkOut, setCheckOut] = React.useState(initialCheckOut || defaultOut);
  const [guests, setGuests] = React.useState(initialGuests || 2);

  // States: 'select' -> 'held' (10-min countdown) -> 'confirmed'
  const [stage, setStage] = React.useState<'select' | 'held' | 'confirmed'>('select');
  const [submitting, setSubmitting] = React.useState(false);
  const [holdId, setHoldId] = React.useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(600);

  // Guest inputs
  const [guestName, setGuestName] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [confirmedRef, setConfirmedRef] = React.useState('');

  // Calculate nights
  const nights = React.useMemo(() => {
    try {
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
      return Math.max(1, diff);
    } catch {
      return 1;
    }
  }, [checkIn, checkOut]);

  const totalMinorUnits = nights * room.basePriceMinorUnits;
  const formattedTotal = `₦${(totalMinorUnits / 100).toLocaleString('en-NG')}`;

  // Countdown timer for 10-minute hold
  React.useEffect(() => {
    if (stage !== 'held') return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          setStage('select');
          setHoldId(null);
          alert('Your 10-minute room hold has expired. Please select dates again.');
          return 600;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  // Request 10-minute hold
  async function handleCreateHold(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property.id,
          roomTypeId: room.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          quantity: 1,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setHoldId(data.holdId);
        setSecondsLeft(600);
        setStage('held');
      } else {
        alert(data.error || 'This room is not available for the selected dates.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to hold room');
    } finally {
      setSubmitting(false);
    }
  }

  // Complete booking
  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName || !guestEmail) {
      alert('Please provide your name and email address.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdId,
          propertyId: property.id,
          roomTypeId: room.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numGuests: guests,
          guestName,
          guestEmail,
          guestPhone,
          paymentMethod: 'pay_at_property',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setConfirmedRef(data.reservation.reference);
        setStage('confirmed');
      } else {
        alert(data.error || 'Failed to complete reservation.');
      }
    } catch (err: any) {
      alert(err.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // STAGE 3: CONFIRMED
  if (stage === 'confirmed') {
    return (
      <div className="bg-white rounded-xl border border-emerald-200 p-6 space-y-4 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="font-serif text-xl text-[#191816]">Reservation confirmed</h3><p className="text-sm">Payment is due at the property. No online payment has been taken.</p>
        <p className="text-xs text-[#7A7267]">
          Thank you, <strong className="text-[#191816]">{guestName}</strong>. Your reservation is saved. Your contact email is{' '}
          <strong className="text-[#191816]">{guestEmail}</strong>.
        </p>

        <div className="p-4 rounded-lg bg-[#FAF7F2] border border-[#E8E2DA] text-left text-xs space-y-2 font-mono">
          <div className="flex justify-between">
            <span className="text-[#7A7267]">Booking Reference:</span>
            <strong className="text-[#71382D] text-sm">{confirmedRef}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A7267]">Room:</span>
            <span className="text-[#191816]">{room.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A7267]">Dates:</span>
            <span className="text-[#191816]">{checkIn} &rarr; {checkOut} ({nights} nights)</span>
          </div>
          <div className="flex justify-between border-t border-[#E8E2DA] pt-2">
            <span className="text-[#7A7267]">Total Charged:</span>
            <strong className="text-[#191816]">{formattedTotal}</strong>
          </div>
        </div>

        <button
          onClick={() => {
            setStage('select');
            setHoldId(null);
            setConfirmedRef('');
          }}
          className="w-full py-2.5 rounded bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold"
        >
          Make Another Booking
        </button>
      </div>
    );
  }

  // STAGE 2: HELD (Guest completes checkout)
  if (stage === 'held') {
    return (
      <div className="bg-white rounded-xl border border-[#E8E2DA] p-6 space-y-5 shadow-md">
        <div className="flex items-center justify-between border-b border-[#E8E2DA] pb-3">
          <div>
            <h3 className="font-serif text-lg text-[#191816]">Room Held For You</h3>
            <p className="text-[11px] text-[#7A7267]">Complete your details to confirm your stay.</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTimer(secondsLeft)}</span>
          </div>
        </div>

        {/* Summary */}
        <div className="p-3 rounded bg-[#FAF7F2] border border-[#E8E2DA] text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-[#7A7267]">Suite:</span>
            <strong className="text-[#191816]">{room.name}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A7267]">Stay:</span>
            <span>{checkIn} to {checkOut} ({nights} nights)</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-[#E8E2DA] pt-1 mt-1 text-[#71382D]">
            <span>Total:</span>
            <span>{formattedTotal}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleCheckout} className="space-y-3 text-xs">
          <div>
            <label className="block text-[#191816] font-medium mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={guestName}
              placeholder="e.g. Samuel Adekunle"
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
            />
          </div>

          <div>
            <label className="block text-[#191816] font-medium mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={guestEmail}
              placeholder="samuel@example.com"
              onChange={(e) => setGuestEmail(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
            />
          </div>

          <div>
            <label className="block text-[#191816] font-medium mb-1">Phone Number</label>
            <input
              type="tel"
              value={guestPhone}
              placeholder="+234 800 000 0000"
              onChange={(e) => setGuestPhone(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded text-white text-xs font-semibold bg-[#71382D] hover:bg-[#5A2C23] shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{submitting ? 'Confirming Stay...' : `Confirm reservation (${formattedTotal})`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    );
  }

  // STAGE 1: SELECT DATES & RESERVE
  return (
    <div className="bg-white rounded-xl border border-[#E8E2DA] p-6 space-y-5 shadow-sm">
      <div className="border-b border-[#E8E2DA] pb-3">
        <h3 className="font-serif text-lg text-[#191816]">Reserve This Suite</h3>
        <p className="text-[11px] text-[#7A7267]">Book directly with {property.name}.</p>
      </div>

      <form onSubmit={handleCreateHold} className="space-y-4">
        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2.5 rounded bg-[#FAF7F2] border border-[#E8E2DA]">
            <label className="block text-[10px] uppercase font-mono tracking-wider text-[#7A7267] mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#71382D]" />
              <span>Check-in</span>
            </label>
            <input
              type="date"
              value={checkIn}
              min={todayStr}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full bg-transparent text-xs font-medium text-[#191816] focus:outline-none"
            />
          </div>

          <div className="p-2.5 rounded bg-[#FAF7F2] border border-[#E8E2DA]">
            <label className="block text-[10px] uppercase font-mono tracking-wider text-[#7A7267] mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#71382D]" />
              <span>Check-out</span>
            </label>
            <input
              type="date"
              value={checkOut}
              min={checkIn}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full bg-transparent text-xs font-medium text-[#191816] focus:outline-none"
            />
          </div>
        </div>

        {/* Guests */}
        <div className="p-2.5 rounded bg-[#FAF7F2] border border-[#E8E2DA]">
          <label className="block text-[10px] uppercase font-mono tracking-wider text-[#7A7267] mb-1 flex items-center gap-1">
            <Users className="w-3 h-3 text-[#71382D]" />
            <span>Guests</span>
          </label>
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="w-full bg-transparent text-xs font-medium text-[#191816] focus:outline-none"
          >
            {[...Array(room.capacity)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} {i === 0 ? 'Guest' : 'Guests'}
              </option>
            ))}
          </select>
        </div>

        {/* Price Breakdown */}
        <div className="pt-2 border-t border-[#E8E2DA] space-y-1 text-xs">
          <div className="flex justify-between text-[#7A7267]">
            <span>
              ₦{(room.basePriceMinorUnits / 100).toLocaleString('en-NG')} &times; {nights} {nights === 1 ? 'night' : 'nights'}
            </span>
            <span className="font-mono text-[#191816]">{formattedTotal}</span>
          </div>
          <div className="flex justify-between font-serif text-sm font-semibold text-[#191816] pt-1">
            <span>Total Payable</span>
            <span className="text-[#71382D]">{formattedTotal}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 rounded text-white text-xs font-semibold bg-[#71382D] hover:bg-[#5A2C23] shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{submitting ? 'Holding Suite...' : 'Hold & Continue'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#7A7267] text-center pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2E6B4F]" />
          <span>Instant confirmation &middot; Zero booking commission</span>
        </div>
      </form>
    </div>
  );
}
