'use client';

import * as React from 'react';
import { WebsiteData } from '../../lib/website-data';
import { useTheme } from '../../lib/theme-provider';

export function PropertyIntro({ data }: { data: WebsiteData }) {
  const themeContext = useTheme();
  const config = themeContext?.config || data.config;
  const tokens = themeContext?.tokens;
  const headingStyle = themeContext?.headingStyle || {
    fontFamily: 'var(--theme-heading-font)',
  };

  return (
    <section className="py-14 sm:py-20 bg-[#FAF7F2] border-b border-[#E8E2DA]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4">
        <span
          style={{ color: tokens?.accentColor || 'var(--theme-accent, #B85C3E)' }}
          className="text-[11px] font-mono tracking-widest uppercase font-semibold block"
        >
          {config.welcomeEyebrow || 'Hospitality, Simplified'}
        </span>

        <h2
          style={headingStyle}
          className="text-2xl sm:text-4xl text-[#191816] font-normal leading-tight"
        >
          {config.welcomeTitle || 'A Tranquil Sanctuary in the City'}
        </h2>

        <p className="text-xs sm:text-base text-[#5C564D] leading-relaxed max-w-2xl mx-auto pt-2">
          {config.welcomeBody}
        </p>

        {config.welcomeImageUrl && (
          <div className="pt-6">
            <img
              src={config.welcomeImageUrl}
              alt="Welcome"
              className="rounded-xl shadow-md mx-auto max-h-[360px] w-full object-cover"
              style={{ borderRadius: tokens?.borderRadius || 'var(--theme-radius, 12px)' }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
