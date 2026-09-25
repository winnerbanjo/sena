'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WebsiteData } from '../../lib/website-data';
import { Users, BedDouble, ArrowRight, Check } from 'lucide-react';

export function FeaturedRooms({ data }: { data: WebsiteData }) {
  const pathname = usePathname();
  const { property, rooms, config } = data;
  const slug = property.slug;
  const isSitePath = pathname?.startsWith('/site/');
  const base = isSitePath ? `/site/${slug}` : '';

  if (rooms.length === 0) return null;

  return (
    <section className="py-14 sm:py-20 bg-white border-b border-[#E8E2DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E8E2DA] pb-5">
          <div className="space-y-1">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#B85C3E] block">
              Accommodations
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif text-[#191816] font-normal">
              Featured Residences &amp; Suites
            </h2>
            <p className="text-xs sm:text-sm text-[#7A7267] max-w-xl">
              Thoughtfully curated for quiet comfort, high-speed productivity, and deep rest.
            </p>
          </div>

          <Link
            href={`${base}/rooms`}
            className="text-xs font-medium text-[#71382D] hover:text-[#B85C3E] inline-flex items-center gap-1 group"
          >
            <span>View all {rooms.length} suites</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Room Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {rooms.slice(0, 3).map((room) => {
            const formattedPrice = `₦${(room.basePriceMinorUnits / 100).toLocaleString('en-NG')}`;
            const photoUrl = room.images[0] || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80';

            return (
              <div
                key={room.id}
                className="bg-white rounded-xl border border-[#E8E2DA] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
                style={{ borderRadius: 'var(--theme-radius, 12px)' }}
              >
                {/* Image */}
                <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
                  <img
                    src={photoUrl}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 rounded text-xs font-mono font-medium">
                    {formattedPrice} <span className="text-[10px] text-stone-300">/ night</span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-serif text-lg font-medium text-[#191816] group-hover:text-[#71382D] transition-colors">
                      {room.name}
                    </h3>

                    <div className="flex items-center gap-4 mt-2 text-xs text-[#7A7267]">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#5C564D]" />
                        <span>Up to {room.capacity} Guests</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BedDouble className="w-3.5 h-3.5 text-[#5C564D]" />
                        <span>{room.bedType}</span>
                      </div>
                    </div>

                    <p className="text-xs text-[#7A7267] line-clamp-2 mt-2 leading-relaxed">
                      {room.description}
                    </p>

                    {/* Amenities chips */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {room.amenities.slice(0, 3).map((amenity, idx) => (
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

                  {/* Actions */}
                  <div className="pt-2 border-t border-[#F0ECE4] flex items-center gap-3">
                    <Link
                      href={`${base}/rooms/${room.id}`}
                      className="flex-1 text-center py-2.5 px-3 rounded text-xs font-semibold text-white bg-[#71382D] hover:bg-[#5A2C23] shadow-xs transition-colors"
                      style={{ borderRadius: 'var(--theme-radius, 6px)' }}
                    >
                      Reserve Suite
                    </Link>
                    <Link
                      href={`${base}/rooms/${room.id}`}
                      className="py-2.5 px-3 rounded text-xs font-medium text-[#191816] border border-[#E8E2DA] hover:bg-[#FAF7F2] transition-colors"
                      style={{ borderRadius: 'var(--theme-radius, 6px)' }}
                    >
                      Details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
