'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { WebsiteData } from '../../lib/website-data';
import { Calendar, Users, Search, ArrowRight } from 'lucide-react';

export function BookingBar({ data }: { data: WebsiteData }) {
  const router = useRouter();
  const pathname = usePathname();
  const { property } = data;

  const isSitePath = pathname?.startsWith('/site/');
  const base = isSitePath ? `/site/${property.slug}` : '';

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultOut = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

  const [checkIn, setCheckIn] = React.useState(todayStr);
  const [checkOut, setCheckOut] = React.useState(defaultOut);
  const [guests, setGuests] = React.useState(2);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      `${base}/rooms?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guests}`
    );
  };

  return (
    <div className="relative z-30 max-w-5xl mx-auto px-4 sm:px-6 -mt-8 sm:-mt-10 mb-12">
      <form
        onSubmit={handleSearch}
        className="bg-white rounded-xl shadow-xl border border-[#E8E2DA] p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center"
        style={{ borderRadius: 'var(--theme-radius, 12px)' }}
      >
        {/* Check-In */}
        <div className="lg:col-span-3 p-2 rounded-lg bg-[#FAF7F2] border border-[#F0ECE4]">
          <label className="block text-[10px] uppercase font-mono tracking-wider text-[#7A7267] mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#71382D]" />
            <span>Check-in</span>
          </label>
          <input
            type="date"
            value={checkIn}
            min={todayStr}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full bg-transparent text-xs font-medium text-[#191816] focus:outline-none cursor-pointer"
          />
        </div>

        {/* Check-Out */}
        <div className="lg:col-span-3 p-2 rounded-lg bg-[#FAF7F2] border border-[#F0ECE4]">
          <label className="block text-[10px] uppercase font-mono tracking-wider text-[#7A7267] mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#71382D]" />
            <span>Check-out</span>
          </label>
          <input
            type="date"
            value={checkOut}
            min={checkIn}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full bg-transparent text-xs font-medium text-[#191816] focus:outline-none cursor-pointer"
          />
        </div>

        {/* Guests */}
        <div className="lg:col-span-3 p-2 rounded-lg bg-[#FAF7F2] border border-[#F0ECE4]">
          <label className="block text-[10px] uppercase font-mono tracking-wider text-[#7A7267] mb-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#71382D]" />
            <span>Guests</span>
          </label>
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="w-full bg-transparent text-xs font-medium text-[#191816] focus:outline-none cursor-pointer"
          >
            <option value={1}>1 Guest</option>
            <option value={2}>2 Guests</option>
            <option value={3}>3 Guests</option>
            <option value={4}>4 Guests</option>
            <option value={5}>5+ Guests</option>
          </select>
        </div>

        {/* CTA */}
        <div className="lg:col-span-3 flex items-center">
          <button
            type="submit"
            className="w-full py-3 sm:py-3.5 px-4 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
            style={{ borderRadius: 'var(--theme-radius, 8px)' }}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Check Availability</span>
          </button>
        </div>
      </form>
    </div>
  );
}
