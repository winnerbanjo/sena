'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@sena/ui';
import { ConnectedAppLogo } from '@/components/connected-apps/connected-app-logo';

export type ConnectedAppStatusTone = 'connected' | 'disconnected' | 'disabled' | 'coming_soon' | 'attention';

const TONE: Record<ConnectedAppStatusTone, StatusTone> = {
  connected: 'positive',
  disconnected: 'neutral',
  disabled: 'neutral',
  coming_soon: 'neutral',
  attention: 'warning',
};

export function ConnectedAppCard({
  provider,
  name,
  description,
  categoryLabel,
  statusLabel,
  statusTone,
  modeLabel,
  metaLabel,
  actionLabel,
  actionHref,
}: {
  provider: string;
  name: string;
  description: string;
  categoryLabel: string;
  statusLabel: string;
  statusTone: ConnectedAppStatusTone;
  modeLabel?: string;
  metaLabel?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  const interactive = Boolean(actionLabel && actionHref);
  const body = (
    <>
      <div className="flex min-w-0 items-start gap-3.5">
        <ConnectedAppLogo provider={provider} name={name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold leading-tight text-[#191816]">{name}</h3>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#7A7267]">{categoryLabel}</span>
          </div>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-[#7A7267]">{description}</p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <StatusBadge tone={TONE[statusTone]}>{statusLabel}</StatusBadge>
          {modeLabel ? <span className="text-xs text-[#7A7267]">{modeLabel}</span> : null}
          {metaLabel ? <span className="text-xs text-[#7A7267]">{metaLabel}</span> : null}
        </div>
        {interactive ? (
          <span className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[#71382D] group-hover:text-[#B85C3E]">
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </span>
        ) : null}
      </div>
    </>
  );

  const shellClass =
    'group flex h-full min-w-0 flex-col gap-4 rounded-md border border-[#E8E2DA] bg-white p-4';

  if (interactive && actionHref) {
    return (
      <Link href={actionHref} className={`${shellClass} hover:border-[#D9CFC2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71382D]`}>
        {body}
      </Link>
    );
  }

  return <article className={shellClass}>{body}</article>;
}

export function ConnectedAppCardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-md border border-[#E8E2DA] bg-white p-4" aria-hidden>
      <div className="flex items-start gap-3.5">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-[#F5EEE9]" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="h-4 w-28 animate-pulse rounded bg-[#F5EEE9]" />
          <div className="h-3 w-full animate-pulse rounded bg-[#F5EEE9]" />
          <div className="h-3 w-3/4 max-w-[14rem] animate-pulse rounded bg-[#F5EEE9]" />
        </div>
      </div>
      <div className="h-6 w-24 animate-pulse rounded-full bg-[#F5EEE9]" />
    </div>
  );
}
