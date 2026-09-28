'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export type ConnectedAppStatusTone = 'connected' | 'disconnected' | 'disabled' | 'coming_soon' | 'attention';

const TONE: Record<ConnectedAppStatusTone, string> = {
  connected: 'bg-[#EBF5EF] text-[#2E6B4F] border-[#C5E3D0]',
  disconnected: 'bg-[#F9F7F5] text-[#7A7267] border-[#E8E2DA]',
  disabled: 'bg-[#F7F1E8] text-[#71382D] border-[#E5D4BC]',
  coming_soon: 'bg-[#F9F7F5] text-[#7A7267] border-[#E8E2DA]',
  attention: 'bg-[#F7F1E8] text-[#71382D] border-[#E5D4BC]',
};

export function ConnectedAppCard({
  name,
  description,
  icon,
  statusLabel,
  statusTone,
  modeLabel,
  actionLabel,
  actionHref,
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
  statusLabel: string;
  statusTone: ConnectedAppStatusTone;
  modeLabel?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-[#E8E2DA] bg-white p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="shrink-0 rounded bg-[#F5EEE9] p-2">{icon}</div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[#191816]">{name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#7A7267]">{description}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[statusTone]}`}>
            {statusLabel}
          </span>
          {modeLabel ? (
            <span className="inline-flex items-center rounded-full border border-[#E5D4BC] bg-[#F7F1E8] px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-[#71382D]">
              {modeLabel}
            </span>
          ) : null}
        </div>
        {actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[#71382D] hover:text-[#B85C3E]"
          >
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
