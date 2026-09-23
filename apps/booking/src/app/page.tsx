'use client';

import * as React from 'react';
import { calculateNights, formatNaira, formatStayDates } from '@sena/config';
import { Badge, Button, Input, Label } from '@sena/ui';
import { Calendar, CheckCircle2, Clock, ShieldCheck, Sparkles, Users } from 'lucide-react';

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

const AVAILABLE_ROOMS: AvailableRoom[] = [
  {
    id: 'rt-exec',
    name: 'Executive Room',
    bedType: 'King bed',
    capacity: 2,
    pricePerNight: 12000000,
    remaining: 4,
    description: 'Generous suite with garden views, dedicated workspace, and marble en-suite bathroom.',
    amenities: ['King bed', 'Courtyard view', 'Fast Wi-Fi', 'Breakfast included', 'Espresso machine'],
  },
  {
    id: 'rt-dlx',
    name: 'Deluxe Room',
    bedType: 'Queen bed',
    capacity: 2,
    pricePerNight: 8000000,
    remaining: 2,
    description: 'Warm and tranquil guest room with natural materials and luxurious linens.',
    amenities: ['Queen bed', 'Work desk', 'Fast Wi-Fi', 'Rain shower'],
  },
  {
    id: 'rt-suite',
    name: 'Saffron Suite',
    bedType: 'King bed + Lounge',
    capacity: 3,
    pricePerNight: 18000000,
    remaining: 1,
    description: 'Our signature penthouse suite with private wrap-around terrace and freestanding tub.',
    amenities: ['Private terrace', 'Living room', 'Soaking tub', 'Butler service'],
  },
];

export default function BookingEnginePage() {
  const [checkIn, setCheckIn] = React.useState('2026-09-24');
  const [checkOut, setCheckOut] = React.useState('2026-09-27');
  const [numGuests, setNumGuests] = React.useState(2);

  // Flow: 'search' -> 'held' (10-minute hold) -> 'confirmed'
  const [stage, setStage] = React.useState<'search' | 'held' | 'confirmed'>('search');
  const [selectedRoom, setSelectedRoom] = React.useState<AvailableRoom | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = React.useState(600); // 10 minutes (Section 58)

  // Guest inputs
  const [guestName, setGuestName] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [confirmedRef, setConfirmedRef] = React.useState('');

  const nights = calculateNights(checkIn, checkOut);

  // 10-minute countdown timer when held
  React.useEffect(() => {
    if (stage !== 'held') return;
    const interval = setInterval(() => {
      setHoldSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setStage('search');
          setSelectedRoom(null);
          return 600;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

  function handleSelectRoom(room: AvailableRoom) {
    setSelectedRoom(room);
    setHoldSecondsLeft(600);
    setStage('held');
  }

  function handleCompleteBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName || !guestEmail) return;
    const ref = `SEN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setConfirmedRef(ref);
    setStage('confirmed');
  }

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Brand Header */}
      <header className="border-b border-[#E2D8CC] bg-white py-4 px-6 sm:px-12 flex items-center justify-between">
        <div>
          <span className="font-serif text-xl font-normal text-[#191816]">
            Stay Connect Lekki
          </span>
          <span className="text-[10px] text-[#7A7267] block tracking-wider uppercase">
            Direct Reservation Engine
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#2E6B4F] font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Best rate guarantee · 0% commission</span>
        </div>
      </header>

      {/* Main Booking Area */}
      <main className="max-w-4xl mx-auto w-full p-6 sm:p-12 space-y-8 flex-1">
        {stage === 'search' && (
          <div className="space-y-8">
            {/* Search Toolbar */}
            <div className="bg-white border border-[#E2D8CC] p-6 rounded-md shadow-sm">
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
                    className="flex h-10 w-full rounded border border-[#E2D8CC] bg-white px-3 py-2 text-xs text-[#191816]"
                  >
                    <option value={1}>1 Guest</option>
                    <option value={2}>2 Guests</option>
                    <option value={3}>3 Guests</option>
                    <option value={4}>4 Guests</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#E2D8CC] flex items-center justify-between text-xs text-[#7A7267]">
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
                {AVAILABLE_ROOMS.map((room) => {
                  const stayTotal = room.pricePerNight * nights;

                  return (
                    <div
                      key={room.id}
                      className="bg-white border border-[#E2D8CC] p-6 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:border-[#B85C3E]/50 transition-all"
                    >
                      <div className="space-y-2 max-w-lg">
                        <div className="flex items-center gap-2">
                          <strong className="text-lg font-serif text-[#191816]">
                            {room.name}
                          </strong>
                          <span className="text-xs text-[#2E6B4F] font-medium">
                            {room.remaining} remaining
                          </span>
                        </div>
                        <p className="text-xs text-[#7A7267] leading-relaxed">
                          {room.description}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {room.amenities.map((a, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2 py-0.5 rounded bg-[#F7F1E8] text-[#7A7267] border border-[#E2D8CC]"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-left md:text-right border-t md:border-t-0 pt-4 md:pt-0 border-[#E2D8CC] flex md:flex-col justify-between items-center md:items-end gap-3 min-w-44">
                        <div>
                          <strong className="text-xl font-serif text-[#191816] block">
                            {formatNaira(stayTotal)}
                          </strong>
                          <span className="text-[11px] text-[#7A7267]">
                            {formatNaira(room.pricePerNight)} / night · {nights}n
                          </span>
                        </div>
                        <Button onClick={() => handleSelectRoom(room)}>
                          Reserve room ↗
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
              className="bg-white border border-[#E2D8CC] p-8 rounded-md space-y-6 shadow-sm"
            >
              <div className="border-b border-[#E2D8CC] pb-4">
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
              <div className="p-4 rounded bg-[#F7F1E8]/60 border border-[#E2D8CC] space-y-2 text-xs">
                <div className="flex justify-between text-[#7A7267]">
                  <span>Nightly rate</span>
                  <span>{formatNaira(selectedRoom.pricePerNight)}</span>
                </div>
                <div className="flex justify-between text-[#7A7267]">
                  <span>Stay length</span>
                  <span>{nights} nights</span>
                </div>
                <div className="flex justify-between text-[#7A7267] border-t border-[#E2D8CC] pt-2">
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

        {/* Confirmed Stage */}
        {stage === 'confirmed' && selectedRoom && (
          <div className="max-w-md mx-auto bg-white border border-[#E2D8CC] p-8 rounded-md text-center space-y-4 shadow-sm">
            <CheckCircle2 className="w-12 h-12 mx-auto text-[#2E6B4F]" />
            <h2 className="text-2xl font-serif text-[#191816]">
              Your stay is confirmed!
            </h2>
            <div className="p-3 bg-[#F7F1E8] rounded border border-[#E2D8CC]">
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
      <footer className="border-t border-[#E2D8CC] py-6 px-6 sm:px-12 text-center text-xs text-[#7A7267]">
        Powered by Sena · Hospitality, Simplified · Nile Africa Technologies Ltd.
      </footer>
    </div>
  );
}
