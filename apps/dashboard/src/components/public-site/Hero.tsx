'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WebsiteData } from '../../lib/website-data';
import { ArrowRight, Star, ShieldCheck } from 'lucide-react';

export function Hero({ data }: { data: WebsiteData }) {
  const pathname = usePathname();
  const { property, config, reviews } = data;
  const isSitePath = pathname?.startsWith('/site/');
  const base = isSitePath ? `/site/${property.slug}` : '';
  const theme = config.theme || 'sena_one';

  // THEME 1: SENA ONE - Modern Luxury (Full-width cinematic background)
  if (theme === 'sena_one') {
    return (
      <section className="relative min-h-[580px] sm:min-h-[680px] flex items-center justify-center text-white overflow-hidden bg-stone-900">
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30 z-10" />
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{ backgroundImage: `url(${config.heroImageUrl})` }}
        />

        <div className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6 pt-12 pb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono tracking-widest uppercase bg-white/15 backdrop-blur-md border border-white/20 text-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{property.name} &middot; {property.propertyType}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif font-normal leading-[1.15] tracking-tight max-w-3xl mx-auto">
            {config.heroHeadline}
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-stone-200 font-light leading-relaxed max-w-2xl mx-auto">
            {config.heroSubheading}
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={`${base}/rooms`}
              className="px-7 py-3.5 rounded text-xs font-semibold text-white bg-[#B85C3E] hover:bg-[#A34F33] shadow-lg transition-all inline-flex items-center gap-2 group"
              style={{ borderRadius: 'var(--theme-radius, 6px)' }}
            >
              <span>{config.heroCtaLabel || 'Reserve Your Stay'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href={`${base}/rooms`}
              className="px-6 py-3.5 rounded text-xs font-medium text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 transition-colors"
              style={{ borderRadius: 'var(--theme-radius, 6px)' }}
            >
              Explore Suites
            </Link>
          </div>

          {reviews.totalCount > 0 && (
            <div className="pt-3 flex items-center justify-center gap-2 text-xs text-stone-300 font-light">
              <div className="flex items-center text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-current" />
                ))}
              </div>
              <span className="font-medium text-white">{reviews.averageRating}</span>
              <span>&middot;</span>
              <span>Based on {reviews.totalCount} verified guest reviews</span>
            </div>
          )}
        </div>
      </section>
    );
  }

  // THEME 2: SENA TWO - Editorial Boutique (Warm, magazine-like typography & framed asymmetry)
  if (theme === 'sena_two') {
    return (
      <section className="bg-[#F8F5F0] border-b border-[#E8E2DA] py-12 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Editorial Text */}
            <div className="lg:col-span-6 space-y-6">
              <span className="text-[11px] font-mono tracking-widest uppercase text-[#71382D] block">
                {property.address} &middot; Residence
              </span>

              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-serif text-[#191816] font-normal leading-[1.18] tracking-tight">
                {config.heroHeadline}
              </h1>

              <p className="text-sm sm:text-base text-[#5C564D] leading-relaxed">
                {config.heroSubheading}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  href={`${base}/rooms`}
                  className="px-6 py-3.5 rounded text-xs font-semibold text-white bg-[#71382D] hover:bg-[#5A2C23] shadow-xs transition-all inline-flex items-center gap-2"
                  style={{ borderRadius: 'var(--theme-radius, 4px)' }}
                >
                  <span>{config.heroCtaLabel || 'Reserve Your Stay'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href={`${base}/about`}
                  className="text-xs text-[#71382D] font-medium hover:underline underline-offset-4 decoration-[#E5D4BC]"
                >
                  Read Our Story &rarr;
                </Link>
              </div>

              <div className="pt-4 border-t border-[#E8E2DA] flex items-center gap-6 text-xs text-[#7A7267]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#2E6B4F]" />
                  <span>Direct Booking Best Rate</span>
                </div>
                <div>
                  <span>Check-in: </span>
                  <strong className="text-[#191816]">{property.checkInTime}</strong>
                </div>
              </div>
            </div>

            {/* Right Framed Imagery */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-lg overflow-hidden shadow-2xl border-4 border-white aspect-[4/3] sm:aspect-[16/11]">
                <img
                  src={config.heroImageUrl}
                  alt={property.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white p-4 rounded border border-[#E8E2DA] shadow-md hidden sm:block max-w-[220px]">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#7A7267] block">
                  Guest Rating
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xl font-serif font-bold text-[#71382D]">
                    {reviews.averageRating}
                  </span>
                  <div className="flex text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <span className="text-xs text-[#7A7267]">({reviews.totalCount} stays)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // THEME 3: SENA THREE - Warm Resort (Earthy tones, soft rounded elements & immersive leisure vibe)
  return (
    <section className="bg-[#FAF7F2] py-8 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden shadow-xl bg-stone-900 min-h-[500px] sm:min-h-[580px] flex items-end">
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10" />
          <img
            src={config.heroImageUrl}
            alt={property.name}
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="relative z-20 p-6 sm:p-12 lg:p-16 max-w-3xl space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-[#B85C3E] text-white">
              {property.name} Resort &amp; Suites
            </span>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-serif text-white font-normal leading-tight">
              {config.heroHeadline}
            </h1>

            <p className="text-xs sm:text-sm text-stone-200 leading-relaxed max-w-xl">
              {config.heroSubheading}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href={`${base}/rooms`}
                className="px-6 py-3 rounded-full text-xs font-semibold text-white bg-[#B85C3E] hover:bg-[#A34F33] shadow-md transition-all inline-flex items-center gap-2"
              >
                <span>{config.heroCtaLabel || 'Reserve Your Stay'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
