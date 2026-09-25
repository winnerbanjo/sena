import * as React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWebsiteData, getTenantBasePath } from '../../../../../lib/website-data';
import { RoomBookingClient } from './RoomBookingClient';
import { ArrowLeft, Users, BedDouble, Check, ShieldCheck, Clock, MapPin } from 'lucide-react';

export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const { slug, id } = await params;
  const { checkIn, checkOut, guests } = await searchParams;

  const data = await getWebsiteData(slug);
  if (!data) return notFound();

  const base = await getTenantBasePath(slug);

  const room = data.rooms.find((r) => r.id === id);
  if (!room) return notFound();

  const { property, config } = data;
  const formattedPrice = `₦${(room.basePriceMinorUnits / 100).toLocaleString('en-NG')}`;

  return (
    <div className="py-8 sm:py-12 bg-[#FAF7F2] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Back Link */}
        <div>
          <Link
            href={`${base}/rooms`}
            className="inline-flex items-center gap-1.5 text-xs text-[#7A7267] hover:text-[#191816] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to all rooms</span>
          </Link>
        </div>

        {/* Room Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E8E2DA] pb-6">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#B85C3E]">
              {property.name} &middot; Residence
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#191816] mt-1">
              {room.name}
            </h1>
            <div className="flex items-center gap-4 text-xs text-[#7A7267] mt-2">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#5C564D]" />
                Up to {room.capacity} Guests
              </span>
              <span>&middot;</span>
              <span className="flex items-center gap-1">
                <BedDouble className="w-3.5 h-3.5 text-[#5C564D]" />
                {room.bedType}
              </span>
            </div>
          </div>

          <div className="text-left md:text-right">
            <span className="text-2xl sm:text-3xl font-serif font-semibold text-[#71382D]">
              {formattedPrice}
            </span>
            <span className="text-xs text-[#7A7267] block">per night &middot; taxes included</span>
          </div>
        </div>

        {/* Main Grid: Gallery & Info (Left 7 Cols) + Interactive Booking (Right 5 Cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-8">
            {/* Image Gallery */}
            <div className="space-y-3">
              <div className="relative aspect-[16/10] rounded-xl overflow-hidden shadow-md bg-stone-100">
                <img
                  src={room.images[0] || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80'}
                  alt={room.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {room.images.length > 1 && (
                <div className="grid grid-cols-3 gap-3">
                  {room.images.slice(1, 4).map((img, idx) => (
                    <div key={idx} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-stone-100 shadow-2xs">
                      <img src={img} alt={`${room.name} ${idx + 2}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl border border-[#E8E2DA] p-6 space-y-3 shadow-2xs">
              <h2 className="font-serif text-lg text-[#191816]">About This Suite</h2>
              <p className="text-xs sm:text-sm text-[#5C564D] leading-relaxed">
                {room.description}
              </p>
            </div>

            {/* Amenities */}
            <div className="bg-white rounded-xl border border-[#E8E2DA] p-6 space-y-4 shadow-2xs">
              <h2 className="font-serif text-lg text-[#191816]">Room Amenities &amp; Inclusions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {room.amenities.map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-[#5C564D]">
                    <Check className="w-3.5 h-3.5 text-[#2E6B4F] flex-shrink-0" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Policies */}
            <div className="bg-white rounded-xl border border-[#E8E2DA] p-6 space-y-3 shadow-2xs text-xs text-[#5C564D]">
              <h2 className="font-serif text-lg text-[#191816]">House Policies</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <strong className="block text-[#191816]">Check-in / Check-out</strong>
                  <span>Check-in from {config.policies.checkInTime || '14:00'}; Checkout by {config.policies.checkOutTime || '11:00'}.</span>
                </div>
                <div>
                  <strong className="block text-[#191816]">Cancellation</strong>
                  <span>{config.policies.cancellation || 'Free cancellation up to 48 hours prior to arrival.'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Booking Form */}
          <div className="lg:col-span-5 sticky top-24">
            <RoomBookingClient
              property={property}
              room={room}
              initialCheckIn={checkIn}
              initialCheckOut={checkOut}
              initialGuests={guests ? Number(guests) : 2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
