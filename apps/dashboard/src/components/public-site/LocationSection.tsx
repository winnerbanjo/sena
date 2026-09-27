'use client';

import * as React from 'react';
import { WebsiteData } from '../../lib/website-data';
import { useTheme } from '../../lib/theme-provider';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';

export function LocationSection({ data }: { data: WebsiteData }) {
  const themeContext = useTheme();
  const config = themeContext?.config || data.config;
  const tokens = themeContext?.tokens;
  const headingStyle = themeContext?.headingStyle || {
    fontFamily: 'var(--theme-heading-font)',
  };

  const { property } = data;
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
              <span
                style={{ color: tokens?.accentColor || 'var(--theme-accent, #B85C3E)' }}
                className="text-[11px] font-mono tracking-widest uppercase font-semibold block"
              >
                Neighborhood &amp; Arrival
              </span>
              <h2
                style={headingStyle}
                className="text-2xl sm:text-3xl text-[#191816] font-normal"
              >
                Conveniently Positioned
              </h2>
            </div>

            <div
              style={{ borderRadius: tokens?.borderRadius || '12px' }}
              className="p-4 border border-[#E8E2DA] bg-[#FAF7F2] flex items-start gap-3"
            >
              <MapPin
                style={{ color: tokens?.primaryColor || '#71382D' }}
                className="w-5 h-5 mt-0.5 flex-shrink-0"
              />
              <div>
                <strong
                  style={headingStyle}
                  className="text-sm text-[#191816] block"
                >
                  {property.name}
                </strong>
                <p className="text-xs text-[#5C564D] mt-0.5">
                  {property.address}, {property.country}
                </p>
                <a
                  href={mapQueryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: tokens?.primaryColor || '#71382D' }}
                  className="text-xs font-semibold hover:underline inline-flex items-center gap-1 mt-2"
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
                      style={{ borderRadius: tokens?.borderRadius || '8px' }}
                      className="p-3 border border-[#E8E2DA] bg-white flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-medium text-[#191816] block">{p.place}</span>
                        {p.category && (
                          <span className="text-[10px] font-mono uppercase text-[#7A7267]">{p.category}</span>
                        )}
                      </div>
                      {p.distance && (
                        <span className="text-[11px] font-mono font-medium text-[#71382D] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E8E2DA]">
                          {p.distance}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Map Preview / Visual Card */}
          <div className="lg:col-span-6">
            <div
              style={{ borderRadius: tokens?.borderRadius || '16px' }}
              className="relative overflow-hidden border border-[#E8E2DA] bg-[#FAF7F2] shadow-xs aspect-[4/3] flex flex-col items-center justify-center text-center p-6"
            >
              <div
                style={{
                  backgroundColor: tokens?.primaryColor || '#71382D',
                  color: tokens?.primaryColorForeground || '#ffffff',
                }}
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3 shadow-sm"
              >
                <Navigation className="w-5 h-5" />
              </div>
              <h3
                style={headingStyle}
                className="text-base font-semibold text-[#191816] mb-1"
              >
                Find Us Easily
              </h3>
              <p className="text-xs text-[#7A7267] max-w-sm mb-4">
                We are situated at {property.address}, welcoming international and domestic guests year-round.
              </p>
              <a
                href={mapQueryUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  backgroundColor: tokens?.primaryColor || '#71382D',
                  color: tokens?.primaryColorForeground || '#ffffff',
                  borderRadius: tokens?.borderRadius || '8px',
                }}
                className="text-xs font-semibold px-4 py-2 hover:opacity-90 transition-all shadow-xs inline-flex items-center gap-1.5"
              >
                <span>Get Driving Directions</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
