'use client';

import * as React from 'react';
import { WebsiteData } from '../../lib/website-data';
import { MapPin, Navigation, Clock, ExternalLink } from 'lucide-react';

export function LocationSection({ data }: { data: WebsiteData }) {
  const { property, config } = data;
  const places = config.nearbyPlaces || [];

  const mapQueryUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${property.name} ${property.address} ${property.country}`
  )}`;

  return (
    <section className="py-14 sm:py-20 bg-white border-b border-[#E8E2DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Address & Nearby landmarks */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-1">
              <span className="text-[11px] font-mono tracking-widest uppercase text-[#B85C3E] block">
                Neighborhood &amp; Arrival
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif text-[#191816]">
                Conveniently Positioned
              </h2>
            </div>

            <div className="p-4 rounded-xl border border-[#E8E2DA] bg-[#FAF7F2] flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#71382D] mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-sm font-serif text-[#191816] block">
                  {property.name}
                </strong>
                <p className="text-xs text-[#5C564D] mt-0.5">
                  {property.address}, {property.country}
                </p>
                <a
                  href={mapQueryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#71382D] hover:underline inline-flex items-center gap-1 mt-2"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {places.length > 0 && (
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#7A7267] block">
                  Estimated Travel Times
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {places.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-[#E8E2DA] bg-white flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-[#191816] truncate pr-2">
                        {p.place}
                      </span>
                      <span className="text-[11px] font-mono text-[#71382D] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E8E2DA] flex-shrink-0">
                        {p.distance}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Styled Map Showcase Placeholder */}
          <div className="lg:col-span-6">
            <div className="relative rounded-2xl overflow-hidden border border-[#E8E2DA] shadow-md bg-stone-100 aspect-[16/10] flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#71382D] text-white flex items-center justify-center shadow-md animate-bounce">
                <Navigation className="w-6 h-6" />
              </div>
              <div>
                <strong className="text-sm font-serif text-[#191816] block">
                  {property.name}
                </strong>
                <span className="text-xs text-[#7A7267]">
                  {property.address}
                </span>
              </div>
              <a
                href={mapQueryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded text-xs font-semibold text-white bg-[#71382D] hover:bg-[#5A2C23] shadow-xs transition-colors"
                style={{ borderRadius: 'var(--theme-radius, 6px)' }}
              >
                Get Driving Directions
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
