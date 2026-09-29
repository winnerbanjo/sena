'use client';

import * as React from 'react';
import { providerLogoSrc } from '@/lib/integrations/platform/provider-branding';

const SIZE = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-14 w-14',
} as const;

export function ConnectedAppLogo({
  provider,
  name,
  size = 'md',
  className = '',
}: {
  provider: string;
  name: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const src = providerLogoSrc(provider);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8E2DA] bg-white ${SIZE[size]} ${className}`}
      dir="ltr"
    >
      {src ? (
        // Local SVG brand marks — plain img keeps proportions without Next image config.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-[70%] w-[70%] object-contain" />
      ) : (
        <span className="text-xs font-semibold tracking-wide text-[#71382D]" aria-hidden>
          {initials || 'App'}
        </span>
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}
