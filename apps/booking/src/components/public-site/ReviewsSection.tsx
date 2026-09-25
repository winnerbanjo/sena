'use client';

import * as React from 'react';
import Link from 'next/link';
import { WebsiteData } from '../../lib/website-data';
import { Star, ShieldCheck, MessageSquare, ArrowRight } from 'lucide-react';

export function ReviewsSection({ data }: { data: WebsiteData }) {
  const { property, reviews } = data;
  const items = reviews.items || [];

  if (items.length === 0) return null;

  return (
    <section className="py-14 sm:py-20 bg-[#FAF7F2] border-b border-[#E8E2DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header with Average Rating Badge */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E8E2DA] pb-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#71382D] block">
              Guest Impressions
            </span>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl sm:text-3xl font-serif text-[#191816]">
                What Guests Are Saying
              </h2>
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E8E2DA] text-xs shadow-2xs">
                <span className="font-bold text-[#71382D] text-sm">{reviews.averageRating}</span>
                <div className="flex text-amber-500">
                  <Star className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-[#7A7267] text-[11px]">
                  ({reviews.totalCount} reviews)
                </span>
              </div>
            </div>
          </div>

          <Link
            href={`/${property.slug}/reviews`}
            className="text-xs font-medium text-[#71382D] hover:text-[#B85C3E] inline-flex items-center gap-1"
          >
            <span>Read all reviews &rarr;</span>
          </Link>
        </div>

        {/* Review Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.slice(0, 3).map((rev) => (
            <div
              key={rev.id}
              className="p-6 rounded-xl border border-[#E8E2DA] bg-white flex flex-col justify-between space-y-4 shadow-2xs hover:shadow-xs transition-shadow"
              style={{ borderRadius: 'var(--theme-radius, 10px)' }}
            >
              <div className="space-y-3">
                {/* Rating stars & verified badge */}
                <div className="flex items-center justify-between">
                  <div className="flex text-amber-500">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>

                  {rev.isVerifiedStay ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#2E6B4F] bg-[#EBF5ED] px-2 py-0.5 rounded-full border border-[#D1EADB]">
                      <ShieldCheck className="w-3 h-3" /> Verified Stay
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-mono text-[#7A7267] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E8E2DA]">
                      {rev.source}
                    </span>
                  )}
                </div>

                {rev.title && (
                  <h4 className="font-serif text-sm font-semibold text-[#191816]">
                    &ldquo;{rev.title}&rdquo;
                  </h4>
                )}

                <p className="text-xs text-[#5C564D] leading-relaxed italic">
                  &ldquo;{rev.body}&rdquo;
                </p>
              </div>

              {/* Guest name & owner response */}
              <div className="pt-3 border-t border-[#F0ECE4] space-y-2">
                <span className="text-xs font-semibold text-[#191816] block">
                  {rev.guestName}
                </span>

                {rev.response && (
                  <div className="p-2.5 rounded bg-[#FAF7F2] border border-[#E8E2DA] text-[11px] space-y-1">
                    <span className="font-medium text-[#71382D] block">Response from property:</span>
                    <p className="text-[#5C564D] italic">{rev.response}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
