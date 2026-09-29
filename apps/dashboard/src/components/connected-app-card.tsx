'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ConnectedAppLogo } from '@/components/connected-apps/connected-app-logo';

export type ConnectedAppStatusTone = 'connected' | 'disconnected' | 'disabled' | 'coming_soon' | 'attention';

const TONE: Record<ConnectedAppStatusTone, string> = {
  connected: 'bg-[#EBF5EF] text-[#2E6B4F] border-[#C5E3D0]',
  disconnected: 'bg-[#F9F7F5] text-[#7A7267] border-[#E8E2DA]',
  disabled: 'bg-[#F7F1E8] text-[#71382D] border-[#E5D4BC]',
  coming_soon: 'bg-[#F9F7F5] text-[#7A7267] border-[#E8E2DA]',
  attention: 'bg-[#F7F1E8] text-[#71382D] border-[#E5D4BC]',
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
          <p className="mt-1.5 text-sm leading-relaxed text-[#7A7267]">{description}</p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[statusTone]}`}>
            {statusTone === 'connected' ? (
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#2E6B4F]" aria-hidden />
            ) : null}
            {statusLabel}
          </span>
          {modeLabel ? (
            <span className="inline-flex items-center rounded-full border border-[#E5D4BC] bg-[#F7F1E8] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[#71382D]">
              {modeLabel}
            </span>
          ) : null}
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
    'group flex min-w-0 flex-col gap-4 rounded-2xl border border-[#E8E2DA] bg-white p-4 transition-colors sm:p-5';

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
    <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#E8E2DA] bg-white p-4 sm:p-5" aria-hidden>
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
