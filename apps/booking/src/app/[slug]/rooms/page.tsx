import * as React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWebsiteData } from '../../../lib/website-data';
import { Users, BedDouble, Check, ArrowRight, ShieldCheck } from 'lucide-react';

export default async function RoomsDirectoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const { slug } = await params;
  const { checkIn, checkOut, guests } = await searchParams;

  const data = await getWebsiteData(slug);
  if (!data) return notFound();

  const { property, rooms } = data;

  return (
    <div className="py-10 sm:py-16 bg-[#FAF7F2] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="space-y-2 border-b border-[#E8E2DA] pb-6">
          <span className="text-[11px] font-mono tracking-widest uppercase text-[#B85C3E]">
            {property.name} Accommodations
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#191816]">
            All Residences &amp; Suites
          </h1>
          <p className="text-xs sm:text-sm text-[#7A7267] max-w-2xl">
            Choose from thoughtfully appointed suites with premium finishes, guaranteed 24/7 power, and dedicated Wi-Fi.
          </p>

          {checkIn && checkOut && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E8E2DA] text-xs font-mono text-[#71382D] mt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2E6B4F]" />
              <span>Dates: {checkIn} to {checkOut} ({guests || 2} Guests)</span>
            </div>
          )}
        </div>

        {/* Room Listings */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {rooms.map((room) => {
            const formattedPrice = `₦${(room.basePriceMinorUnits / 100).toLocaleString('en-NG')}`;
            const photoUrl =
              room.images[0] ||
              'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80';

            return (
              <div
                key={room.id}
                className="bg-white rounded-xl border border-[#E8E2DA] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                style={{ borderRadius: 'var(--theme-radius, 12px)' }}
              >
                <div>
                  <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
                    <img
                      src={photoUrl}
                      alt={room.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-sm text-white px-2.5 py-1 rounded text-xs font-mono font-medium">
                      {formattedPrice} <span className="text-[10px] text-stone-300">/ night</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <h2 className="font-serif text-xl font-medium text-[#191816]">
                      {room.name}
                    </h2>

                    <div className="flex items-center gap-4 text-xs text-[#7A7267]">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#5C564D]" />
                        <span>Up to {room.capacity} Guests</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BedDouble className="w-3.5 h-3.5 text-[#5C564D]" />
                        <span>{room.bedType}</span>
                      </div>
                    </div>

                    <p className="text-xs text-[#5C564D] leading-relaxed">
                      {room.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {room.amenities.map((amenity, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#FAF7F2] text-[#5C564D] border border-[#F0ECE4]"
                        >
                          <Check className="w-3 h-3 text-[#2E6B4F]" />
                          <span>{amenity}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0 border-t border-[#F0ECE4] mt-4 flex items-center gap-3">
                  <Link
                    href={`/${slug}/rooms/${room.id}${
                      checkIn && checkOut ? `?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests || 2}` : ''
                    }`}
                    className="flex-1 text-center py-2.5 px-3 rounded text-xs font-semibold text-white bg-[#71382D] hover:bg-[#5A2C23] shadow-xs transition-colors"
                    style={{ borderRadius: 'var(--theme-radius, 6px)' }}
                  >
                    Reserve This Room
                  </Link>
                  <Link
                    href={`/${slug}/rooms/${room.id}`}
                    className="py-2.5 px-3 rounded text-xs font-medium text-[#191816] border border-[#E8E2DA] hover:bg-[#FAF7F2] transition-colors"
                    style={{ borderRadius: 'var(--theme-radius, 6px)' }}
                  >
                    Details
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
