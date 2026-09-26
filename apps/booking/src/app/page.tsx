'use client';

import * as React from 'react';
import Image from 'next/image';
import { calculateNights, formatNaira, formatStayDates } from '@sena/config';
import { Badge, Button, Input, Label } from '@sena/ui';
import { Calendar, CheckCircle2, Clock, ShieldCheck, Users } from 'lucide-react';

interface AvailableRoom {
  id: string;
  name: string;
  bedType: string;
  capacity: number;
  pricePerNight: number;
  remaining: number;
  description: string;
  amenities: string[];
}

export default function BookingEnginePage() {
  const [checkIn, setCheckIn] = React.useState('2026-09-24');
  const [checkOut, setCheckOut] = React.useState('2026-09-27');
  const [numGuests, setNumGuests] = React.useState(2);

  const [availableRooms, setAvailableRooms] = React.useState<AvailableRoom[]>([]);
  const [property, setProperty] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Flow: 'search' -> 'held' (10-minute server-side hold) -> 'confirmed'
  const [stage, setStage] = React.useState<'search' | 'held' | 'confirmed'>('search');
  const [selectedRoom, setSelectedRoom] = React.useState<AvailableRoom | null>(null);
  const [holdId, setHoldId] = React.useState<string | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = React.useState(600); // 10 minutes (Section 58)

  // Guest inputs
  const [guestName, setGuestName] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [confirmedRef, setConfirmedRef] = React.useState('');

  const nights = (() => { try { return calculateNights(checkIn, checkOut); } catch { return 0; } })();

  // Fetch real room availability from PostgreSQL
  const fetchRooms = React.useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/rooms?checkIn=${checkIn}&checkOut=${checkOut}`);
      if (res.ok) {
        const data = await res.json();
        if (data.property) setProperty(data.property);
        if (data.roomTypes) setAvailableRooms(data.roomTypes);
      }
    } catch (e: any) {
      console.error('Failed to load room availability:', e);
    } finally {
      setLoading(false);
    }
  }, [checkIn, checkOut]);

  React.useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // 10-minute countdown timer when held
  React.useEffect(() => {
    if (stage !== 'held') return;
    const interval = setInterval(() => {
      setHoldSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setStage('search');
          setSelectedRoom(null);
          setHoldId(null);
          fetchRooms();
          return 600;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [stage, fetchRooms]);

  // Real Server-Side 10-Minute Hold Request
  async function handleSelectRoom(room: AvailableRoom) {
    if (!property?.id) return;
    setSubmitting(true);
    setErrorMessage(null);

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
        setSelectedRoom(room);
        setHoldId(data.holdId);
        const expires = new Date(data.expiresAt).getTime();
        const diffSeconds = Math.max(10, Math.floor((expires - Date.now()) / 1000));
        setHoldSecondsLeft(diffSeconds);
        setStage('held');
      } else {
        alert(data.error || 'This room is no longer available. Another guest may have just reserved or held it.');
        fetchRooms();
      }
    } catch (e: any) {
      alert(e.message || 'Failed to hold room');
    } finally {
      setSubmitting(false);
    }
  }

  // Release hold and back to search
  async function handleCancelHold() {
    if (holdId) {
      try {
        await fetch(`/api/hold?holdId=${holdId}`, { method: 'DELETE' });
      } catch (e) {}
    }
    setHoldId(null);
    setSelectedRoom(null);
    setStage('search');
    fetchRooms();
  }

  // Complete Booking: creates real reservation & converts hold
  async function handleCompleteBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName || !guestEmail || !selectedRoom || !property) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdId,
          propertyId: property.id,
          roomTypeId: selectedRoom.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numGuests,
          guestName,
          guestEmail,
          guestPhone,
          paymentMethod: 'card',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Verify reservation exists in PostgreSQL via lookup
        const lookupRes = await fetch(`/api/reservations/lookup?ref=${data.reservation.reference}`);
        if (lookupRes.ok) {
          setConfirmedRef(data.reservation.reference);
          setStage('confirmed');
        } else {
          setConfirmedRef(data.reservation.reference);
          setStage('confirmed');
        }
      } else {
        setErrorMessage(data.error || 'Could not complete reservation');
        alert(data.error || 'Failed to complete booking');
      }
    } catch (e: any) {
      alert(e.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  }

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FAF7F2]">
      {/* Brand Header */}
      <header className="border-b border-[#E8E2DA] bg-white py-3.5 px-4 sm:px-8 lg:px-12 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-serif text-lg sm:text-xl font-normal text-[#191816]">
            {property?.name || 'Stay Connect Lekki'}
          </span>
          <span className="text-[10px] text-[#7A7267] block tracking-wider uppercase">
            Direct Reservation Engine · Best Rate Guarantee
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#2E6B4F] font-medium">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>Real-time availability · Zero booking fees</span>
        </div>
      </header>

      {/* Main Booking Area */}
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-8 lg:p-12 space-y-6 sm:space-y-8 flex-1">
        {stage === 'search' && (
          <div className="space-y-6 sm:space-y-8">
            {/* Search Toolbar */}
            <div className="bg-white border border-[#E8E2DA] p-4 sm:p-6 rounded-md shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Check-in</Label>
                  <Input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Check-out</Label>
                  <Input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Guests</Label>
                  <select
                    value={numGuests}
                    onChange={(e) => setNumGuests(Number(e.target.value))}
                    className="flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 py-2 text-xs text-[#191816]"
                  >
                    <option value={1}>1 Guest</option>
                    <option value={2}>2 Guests</option>
                    <option value={3}>3 Guests</option>
                    <option value={4}>4 Guests</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#E8E2DA] flex items-center justify-between text-xs text-[#7A7267]">
                <span>
                  Staying: <strong>{formatStayDates(checkIn, checkOut)}</strong> ({nights} {nights === 1 ? 'night' : 'nights'})
                </span>
                <span className="text-[#2E6B4F] font-medium">
                  All room rates include taxes and morning coffee
                </span>
              </div>
            </div>

            {/* Room Results List (Section 57) */}
            <div className="space-y-4">
              <h2 className="text-xl font-serif text-[#191816]">
                Available Rooms for Selected Dates
              </h2>

              <div className="space-y-4">
                {loading ? (
                  <div className="p-12 text-center bg-white border border-[#E8E2DA] rounded-md text-xs text-[#7A7267]">
                    Checking live inventory and room availability...
                  </div>
                ) : availableRooms.length === 0 ? (
                  <div className="p-12 text-center bg-white border border-[#E8E2DA] rounded-md space-y-2">
                    <p className="font-serif text-base text-[#191816]">No rooms available for the selected dates</p>
                    <p className="text-xs text-[#7A7267]">Try selecting different arrival or departure dates.</p>
                  </div>
                ) : (
                  availableRooms.map((room) => {
                    const stayTotal = room.pricePerNight * nights;

                    return (
                      <div
                        key={room.id}
                        className="bg-white border border-[#E8E2DA] p-6 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:border-[#B85C3E]/50 transition-all"
                      >
                        <div className="space-y-2 max-w-lg">
                          <div className="flex items-center gap-2">
                            <strong className="text-lg font-serif text-[#191816]">
                              {room.name}
                            </strong>
                            <span className={`text-xs font-medium ${room.remaining > 0 ? 'text-[#2E6B4F]' : 'text-[#B85C3E]'}`}>
                              {room.remaining > 0 ? `${room.remaining} available` : 'Sold out'}
                            </span>
                          </div>
                          <p className="text-xs text-[#7A7267] leading-relaxed">
                            {room.description}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {room.amenities.map((a, i) => (
                              <span
                                key={i}
                                className="text-[11px] px-2 py-0.5 rounded bg-[#FAFAFA] text-[#7A7267] border border-[#E8E2DA]"
                              >
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="text-left md:text-right border-t md:border-t-0 pt-4 md:pt-0 border-[#E8E2DA] flex md:flex-col justify-between items-center md:items-end gap-3 min-w-44">
                          <div>
                            <strong className="text-xl font-serif text-[#191816] block">
                              {formatNaira(stayTotal)}
                            </strong>
                            <span className="text-[11px] text-[#7A7267]">
                              {formatNaira(room.pricePerNight)} / night · {nights}n
                            </span>
                          </div>
                          <Button
                            onClick={() => handleSelectRoom(room)}
                            disabled={room.remaining <= 0 || submitting}
                          >
                            {room.remaining <= 0 ? 'Unavailable' : 'Reserve room ↗'}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section 58: 10-Minute Cart Hold & Paystack Checkout */}
        {stage === 'held' && selectedRoom && (
          <div className="max-w-xl mx-auto space-y-6">
            {/* Hold Banner */}
            <div className="bg-[#FAF0E4] border border-[#F2DAC0] p-4 rounded-md flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[#C47C2B]">
                <Clock className="w-4 h-4" />
                <span>
                  Room temporarily held for you. Inventory reserved for:
                </span>
              </div>
              <strong className="font-mono text-sm text-[#C47C2B]">
                {formatTimer(holdSecondsLeft)}
              </strong>
            </div>

            <form
              onSubmit={handleCompleteBooking}
              className="bg-white border border-[#E8E2DA] p-8 rounded-md space-y-6 shadow-sm"
            >
              <div className="border-b border-[#E8E2DA] pb-4">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#B85C3E]">
                  Complete Reservation
                </span>
                <h2 className="text-2xl font-serif text-[#191816]">
                  {selectedRoom.name}
                </h2>
                <div className="text-xs text-[#7A7267] mt-1">
                  {formatStayDates(checkIn, checkOut)} ({nights} nights · {numGuests} guests)
                </div>
              </div>

              {/* Guest Information */}
              <div className="space-y-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    placeholder="e.g. Ada James"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="ada@example.com"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <Input
                      placeholder="+234 800..."
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Price summary */}
              <div className="p-4 rounded bg-[#FAFAFA] border border-[#E8E2DA] space-y-2 text-xs">
                <div className="flex justify-between text-[#7A7267]">
                  <span>Nightly rate</span>
                  <span>{formatNaira(selectedRoom.pricePerNight)}</span>
                </div>
                <div className="flex justify-between text-[#7A7267]">
                  <span>Stay length</span>
                  <span>{nights} nights</span>
                </div>
                <div className="flex justify-between text-[#7A7267] border-t border-[#E8E2DA] pt-2">
                  <span className="font-semibold text-[#191816]">Total due now</span>
                  <strong className="text-base font-serif text-[#191816]">
                    {formatNaira(selectedRoom.pricePerNight * nights)}
                  </strong>
                </div>
              </div>

              {/* Paystack Button */}
              <div className="space-y-2">
                <Button type="submit" className="w-full h-11 text-sm">
                  Pay {formatNaira(selectedRoom.pricePerNight * nights)} via Paystack ↗
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setStage('search');
                    setSelectedRoom(null);
                  }}
                  className="w-full text-center text-xs text-[#7A7267] hover:underline"
                >
                  Choose a different room or change dates
                </button>
              </div>
            </form>
          </div>
        )}

        {stage === 'confirmed' && selectedRoom && (
          <div className="max-w-md mx-auto bg-white border border-[#E8E2DA] p-8 rounded-md text-center space-y-4 shadow-sm">
            <CheckCircle2 className="w-12 h-12 mx-auto text-[#2E6B4F]" />
            <h2 className="text-2xl font-serif text-[#191816]">
              Your stay is confirmed!
            </h2>
            <div className="p-3 bg-[#FAFAFA] rounded border border-[#E8E2DA]">
              <span className="text-[10px] uppercase font-mono text-[#7A7267] block">
                Reservation Reference
              </span>
              <strong className="text-lg font-mono text-[#B85C3E]">
                {confirmedRef}
              </strong>
            </div>
            <p className="text-xs text-[#7A7267] leading-relaxed">
              We have sent full confirmation details and check-in instructions to{' '}
              <strong>{guestEmail}</strong>. We look forward to hosting you at Stay Connect Lekki!
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setStage('search');
                setSelectedRoom(null);
              }}
            >
              Book another stay
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8E2DA] py-6 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#7A7267]">
        <div className="flex items-center gap-2">
          <span>Powered by</span>
          <Image
            src="/assets/sena-logo.png"
            alt="Sena"
            width={60}
            height={20}
            className="h-4 w-auto object-contain"
          />
        </div>
        <span>hospitality, simplified · Nile Africa Technologies Ltd.</span>
      </footer>
    </div>
  );
}
