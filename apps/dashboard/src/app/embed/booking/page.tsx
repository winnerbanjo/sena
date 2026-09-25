'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  Users,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Building,
  Loader2,
  X,
  ArrowLeft,
  Sparkles,
  BedDouble,
  Wifi,
  Coffee,
} from 'lucide-react';

interface RoomType {
  id: string;
  name: string;
  description?: string;
  basePriceMinorUnits: number;
  capacityAdults: number;
  capacityChildren: number;
  images?: string[];
  amenities?: string[];
}

interface PropertyDetails {
  id: string;
  name: string;
  currency: string;
  address?: string;
  city?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export default function EmbedBookingPage() {
  return (
    <React.Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B2A4A]" />
      </div>
    }>
      <EmbedBookingContent />
    </React.Suspense>
  );
}

function EmbedBookingContent() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('property') || '';
  const initialCheckIn = searchParams.get('check_in') || new Date().toISOString().split('T')[0];
  const initialCheckOut = searchParams.get('check_out') || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
  const initialGuests = Number(searchParams.get('guests') || 2);
  const preselectedRoomTypeId = searchParams.get('room_type') || '';

  const [loading, setLoading] = React.useState(true);
  const [property, setProperty] = React.useState<PropertyDetails | null>(null);
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([]);
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1); // 1: Select room, 2: Guest info, 3: Review & Pay, 4: Confirmed

  // Filter states
  const [checkIn, setCheckIn] = React.useState(initialCheckIn);
  const [checkOut, setCheckOut] = React.useState(initialCheckOut);
  const [guests, setGuests] = React.useState(initialGuests);
  const [selectedRoom, setSelectedRoom] = React.useState<RoomType | null>(null);

  // Guest inputs
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [specialRequests, setSpecialRequests] = React.useState('');
  const [paymentChoice, setPaymentChoice] = React.useState<'pay_at_property' | 'paystack'>('paystack');

  // Submission state
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [confirmedReservation, setConfirmedReservation] = React.useState<any>(null);

  // Calculate nights
  const nights = React.useMemo(() => {
    try {
      const inDate = new Date(checkIn);
      const outDate = new Date(checkOut);
      const diff = Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 3600 * 24));
      return diff > 0 ? diff : 1;
    } catch {
      return 1;
    }
  }, [checkIn, checkOut]);

  React.useEffect(() => {
    async function loadData() {
      if (!propertyId) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/v1/properties/${propertyId}`);
        const data = await res.json();
        if (data.data) {
          setProperty(data.data);
          const rtRes = await fetch(`/api/v1/properties/${propertyId}/room-types`);
          const rtData = await rtRes.json();
          if (rtData.data) {
            setRoomTypes(rtData.data);
            if (preselectedRoomTypeId) {
              const matched = rtData.data.find((r: RoomType) => r.id === preselectedRoomTypeId);
              if (matched) setSelectedRoom(matched);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load property details:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [propertyId, preselectedRoomTypeId]);

  const handleClose = () => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ action: 'sena:close' }, '*');
    }
  };

  const handleSelectRoom = (room: RoomType) => {
    setSelectedRoom(room);
    setStep(2);
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) {
      setErrorMsg('Please enter your full name and a valid email address.');
      return;
    }
    setErrorMsg(null);
    setStep(3);
  };

  const handleConfirmReservation = async () => {
    if (!selectedRoom || !property) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: property.id,
          room_type_id: selectedRoom.id,
          check_in: checkIn,
          check_out: checkOut,
          num_guests: guests,
          special_requests: specialRequests,
          payment_method: paymentChoice,
          source: 'widget_embed',
          guest: {
            full_name: fullName,
            email: email,
            phone: phone,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to complete reservation');
      }

      setConfirmedReservation(data.data);
      setStep(4);

      // Notify parent embed window
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            action: 'sena:confirmed',
            payload: {
              reference: data.data.reference,
              id: data.data.id,
              totalAmount: data.data.financials?.total_amount,
              guestEmail: email,
            },
          },
          '*'
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B2A4A]" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-6 text-center">
        <Building className="h-12 w-12 text-[#94A3B8] mb-3" />
        <h2 className="text-xl font-semibold text-[#0F172A]">Property Not Found</h2>
        <p className="text-sm text-[#64748B] mt-1 max-w-sm">
          Please provide a valid property ID parameter in the embed configuration.
        </p>
      </div>
    );
  }

  const totalPrice = selectedRoom ? (selectedRoom.basePriceMinorUnits / 100) * nights : 0;

  return (
    <div className="flex h-screen flex-col bg-[#F8FAFC] text-[#0F172A] font-sans antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E2E8F0] bg-white px-5 py-3.5">
        <div className="flex items-center gap-3">
          {step > 1 && step < 4 && (
            <button
              onClick={() => setStep((s) => (s - 1) as any)}
              className="rounded-full p-1 text-[#64748B] hover:bg-[#F1F5F9] transition"
              title="Go Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-[#0F172A]">{property.name}</h1>
            <p className="text-xs text-[#64748B]">{property.city || 'Direct Guest Reservation'}</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-[#64748B]">
          <span className={step >= 1 ? 'text-[#1B2A4A] font-bold' : ''}>1. Room</span>
          <ChevronRight className="h-3 w-3 text-[#CBD5E1]" />
          <span className={step >= 2 ? 'text-[#1B2A4A] font-bold' : ''}>2. Details</span>
          <ChevronRight className="h-3 w-3 text-[#CBD5E1]" />
          <span className={step >= 3 ? 'text-[#1B2A4A] font-bold' : ''}>3. Payment</span>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full">
        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-50 p-3.5 text-xs font-medium text-red-700 border border-red-200">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: SELECT ROOM & DATES */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Date / Guest Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] outline-none focus:border-[#1B2A4A]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] outline-none focus:border-[#1B2A4A]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Guests</label>
                <select
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] outline-none focus:border-[#1B2A4A]"
                >
                  <option value={1}>1 Guest</option>
                  <option value={2}>2 Guests</option>
                  <option value={3}>3 Guests</option>
                  <option value={4}>4 Guests</option>
                </select>
              </div>
            </div>

            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] pt-1">
              Available Room Types ({roomTypes.length})
            </h2>

            {/* Room List */}
            <div className="space-y-3">
              {roomTypes.map((rt) => {
                const nightlyRate = rt.basePriceMinorUnits / 100;
                return (
                  <div
                    key={rt.id}
                    className="flex flex-col sm:flex-row justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs transition hover:border-[#1B2A4A] gap-4"
                  >
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[#0F172A]">{rt.name}</h3>
                        <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium text-[#475569]">
                          Up to {rt.capacityAdults} Guests
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] line-clamp-2">
                        {rt.description || 'Tastefully appointed suite equipped with luxury amenities, plush bedding, and fast Wi-Fi.'}
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-[#64748B]">
                        <span className="flex items-center gap-1"><Wifi className="h-3 w-3" /> Wi-Fi</span>
                        <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> King Bed</span>
                        <span className="flex items-center gap-1"><Coffee className="h-3 w-3" /> Breakfast</span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-[#F1F5F9]">
                      <div className="text-left sm:text-right">
                        <span className="text-base font-bold text-[#0F172A]">₦{nightlyRate.toLocaleString()}</span>
                        <span className="text-[11px] text-[#64748B]"> / night</span>
                      </div>
                      <button
                        onClick={() => handleSelectRoom(rt)}
                        className="mt-2 rounded-lg bg-[#1B2A4A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#131E35]"
                      >
                        Reserve Room
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: GUEST DETAILS */}
        {step === 2 && selectedRoom && (
          <form onSubmit={handleProceedToReview} className="space-y-4">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">Guest Contact Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#0F172A]">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Ngozi Okonjo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#1B2A4A]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#0F172A]">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="ngozi@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#1B2A4A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0F172A]">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+234 803 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#1B2A4A]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F172A]">Special Requests / Arrival Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Late arrival around 8pm, quiet room preferred."
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#1B2A4A]"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[#1B2A4A] py-2.5 text-xs font-semibold text-white transition hover:bg-[#131E35]"
            >
              Continue to Payment & Review
            </button>
          </form>
        )}

        {/* STEP 3: REVIEW & PAYMENT SELECTION */}
        {step === 3 && selectedRoom && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Stay Summary</h3>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Room Type</span>
                <span className="font-semibold text-[#0F172A]">{selectedRoom.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Dates</span>
                <span className="font-medium text-[#0F172A]">{checkIn} to {checkOut} ({nights} {nights === 1 ? 'night' : 'nights'})</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Guests</span>
                <span className="font-medium text-[#0F172A]">{guests} Guests</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#64748B]">Guest Name</span>
                <span className="font-medium text-[#0F172A]">{fullName} ({email})</span>
              </div>
              <div className="border-t border-[#F1F5F9] pt-3 flex justify-between items-center text-sm font-bold text-[#0F172A]">
                <span>Total Due</span>
                <span>₦{totalPrice.toLocaleString()}</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Choose Payment Method</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  onClick={() => setPaymentChoice('paystack')}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    paymentChoice === 'paystack'
                      ? 'border-[#1B2A4A] bg-[#F8FAFC]'
                      : 'border-[#E2E8F0] bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentChoice"
                    checked={paymentChoice === 'paystack'}
                    onChange={() => setPaymentChoice('paystack')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-[#1B2A4A]" /> Pay Online Now
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">Instant guarantee via Card or Bank Transfer.</p>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentChoice('pay_at_property')}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    paymentChoice === 'pay_at_property'
                      ? 'border-[#1B2A4A] bg-[#F8FAFC]'
                      : 'border-[#E2E8F0] bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentChoice"
                    checked={paymentChoice === 'pay_at_property'}
                    onChange={() => setPaymentChoice('pay_at_property')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-[#1B2A4A]" /> Pay at Hotel
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">Settle with reception upon arrival.</p>
                  </div>
                </label>
              </div>
            </div>

            <button
              onClick={handleConfirmReservation}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#1B2A4A] py-2.5 text-xs font-semibold text-white transition hover:bg-[#131E35] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Confirming Reservation...
                </>
              ) : (
                <>Complete Direct Reservation</>
              )}
            </button>
          </div>
        )}

        {/* STEP 4: CONFIRMATION */}
        {step === 4 && confirmedReservation && (
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-center space-y-4 shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Booking Confirmed</span>
              <h2 className="text-lg font-bold text-[#0F172A] mt-1">Thank You, {fullName}!</h2>
              <p className="text-xs text-[#64748B] mt-1">
                Your reservation at <span className="font-semibold text-[#0F172A]">{property.name}</span> has been confirmed.
              </p>
            </div>

            <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] p-4 text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#64748B]">Booking Reference</span>
                <span className="font-mono font-bold text-[#1B2A4A]">{confirmedReservation.reference}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#64748B]">Check-in Date</span>
                <span className="font-medium text-[#0F172A]">{confirmedReservation.check_in}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#64748B]">Check-out Date</span>
                <span className="font-medium text-[#0F172A]">{confirmedReservation.check_out}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#64748B]">Room Type</span>
                <span className="font-medium text-[#0F172A]">{confirmedReservation.room_type?.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#64748B]">Payment Status</span>
                <span className="font-medium text-emerald-700 uppercase text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">
                  {confirmedReservation.financials?.payment_status}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#64748B]">
              A confirmation email has been dispatched to <span className="font-medium text-[#0F172A]">{email}</span>.
            </p>

            <button
              onClick={handleClose}
              className="w-full rounded-lg bg-[#0F172A] py-2.5 text-xs font-semibold text-white transition hover:bg-[#1E293B]"
            >
              Done & Return
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
