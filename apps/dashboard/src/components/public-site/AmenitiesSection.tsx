'use client';

import * as React from 'react';
import { WebsiteData } from '../../lib/website-data';
import { Check, Sparkles } from 'lucide-react';

export function AmenitiesSection({ data }: { data: WebsiteData }) {
  const { config } = data;
  const list = config.amenities || [];

  if (list.length === 0) return null;

  return (
    <section className="py-14 sm:py-20 bg-white border-b border-[#E8E2DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-[11px] font-mono tracking-widest uppercase text-[#B85C3E] block">
            Comforts &amp; Features
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif text-[#191816]">
            Included in Every Stay
          </h2>
          <p className="text-xs sm:text-sm text-[#7A7267]">
            From reliable utilities to thoughtful touches, we make your stay easy and productive.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {list.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-lg border border-[#E8E2DA] bg-[#FAF7F2] flex items-center gap-3"
              style={{ borderRadius: 'var(--theme-radius, 8px)' }}
            >
              <div className="w-7 h-7 rounded-full bg-white border border-[#E8E2DA] flex items-center justify-center text-[#2E6B4F] flex-shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-medium text-[#191816] block">
                  {item.name}
                </span>
                {item.category && (
                  <span className="text-[10px] text-[#7A7267] block">
                    {item.category}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
