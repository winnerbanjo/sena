'use client';

import * as React from 'react';
import { WebsiteData } from '../../lib/website-data';
import { useTheme } from '../../lib/theme-provider';
import { Zap, Wifi, HeartHandshake, ShieldCheck, Sparkles, Clock, Coffee, Shield } from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Zap,
  Wifi,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  Clock,
  Coffee,
  Shield,
};

export function Highlights({ data }: { data: WebsiteData }) {
  const themeContext = useTheme();
  const config = themeContext?.config || data.config;
  const tokens = themeContext?.tokens;
  const headingStyle = themeContext?.headingStyle || {
    fontFamily: 'var(--theme-heading-font)',
  };

  const items = config.highlights || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 bg-white border-b border-[#E8E2DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <span
            style={{ color: tokens?.primaryColor || 'var(--theme-primary, #71382D)' }}
            className="text-[11px] font-mono tracking-widest uppercase font-semibold block"
          >
            Why Guests Choose Us
          </span>
          <h2
            style={headingStyle}
            className="text-xl sm:text-2xl text-[#191816] font-normal"
          >
            Every Detail Considered
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, index) => {
            const IconComponent = (item.icon && ICON_MAP[item.icon]) || Sparkles;

            return (
              <div
                key={index}
                className="p-5 rounded-xl border border-[#E8E2DA] bg-[#FAF7F2] hover:bg-white hover:shadow-xs transition-all space-y-2 text-center sm:text-left"
                style={{ borderRadius: tokens?.borderRadius || 'var(--theme-radius, 10px)' }}
              >
                <div
                  style={{ color: tokens?.primaryColor || 'var(--theme-primary, #71382D)' }}
                  className="w-9 h-9 rounded-lg bg-white border border-[#E8E2DA] flex items-center justify-center shadow-2xs mx-auto sm:mx-0"
                >
                  <IconComponent className="w-4 h-4" />
                </div>
                <h3
                  style={headingStyle}
                  className="text-sm font-semibold text-[#191816] pt-1"
                >
                  {item.title}
                </h3>
                <p className="text-xs text-[#7A7267] leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
