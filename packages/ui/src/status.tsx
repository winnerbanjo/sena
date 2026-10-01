import * as React from 'react';
import { cn } from './utils';

/** One status language. Tones stay semantic; labels stay sentence case. */
const TONE_CLASS = {
  positive: 'border-[#C6E4CC] bg-[#EBF5ED] text-[#1F5C40]',
  warning: 'border-[#E7D3B0] bg-[#FAF6EE] text-[#7A4E10]',
  negative: 'border-[#F0C9C2] bg-[#FDF0ED] text-[#8C2F24]',
  info: 'border-[#D5E0EE] bg-[#F4F7FB] text-[#2C4A6E]',
  emphasis: 'border-[#E5D4BC] bg-[#F7F1E8] text-[#71382D]',
  neutral: 'border-[#E8E2DA] bg-[#FAFAF8] text-[#5C564D]',
} as const;

export type StatusTone = keyof typeof TONE_CLASS;

const STATUS_TONE: Record<string, StatusTone> = {
  available: 'positive',
  clean: 'positive',
  inspected: 'positive',
  ready: 'positive',
  confirmed: 'positive',
  paid: 'positive',
  settled: 'positive',
  connected: 'positive',
  enabled: 'positive',
  active: 'positive',
  success: 'positive',
  reserved: 'warning',
  pending: 'warning',
  pending_verification: 'warning',
  partially_paid: 'warning',
  partial: 'warning',
  needs_cleaning: 'warning',
  dirty: 'warning',
  cleaning: 'info',
  in_progress: 'info',
  occupied: 'emphasis',
  checked_in: 'emphasis',
  in_house: 'emphasis',
  unpaid: 'negative',
  not_paid: 'negative',
  cancelled: 'negative',
  canceled: 'negative',
  failed: 'negative',
  overdue: 'negative',
  disconnected: 'negative',
  disabled: 'neutral',
  archived: 'neutral',
  blocked: 'neutral',
  maintenance: 'neutral',
  draft: 'neutral',
};

export function statusTone(status: string | null | undefined): StatusTone {
  const key = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return STATUS_TONE[key] || 'neutral';
}

export function StatusBadge({
  status,
  tone,
  className,
  children,
}: {
  status?: string;
  tone?: StatusTone;
  className?: string;
  children: React.ReactNode;
}) {
  const resolved = tone || statusTone(status);
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4',
        TONE_CLASS[resolved],
        className
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
