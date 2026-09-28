'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
import { useTranslations } from 'next-intl';
import { deskPaymentStatus, type DeskPaymentKind } from '../lib/financial-status';
import { isolateLtr } from './ltr';

const KIND_STYLES: Record<DeskPaymentKind, { dot: string; text: string; panel: string }> = {
  paid: {
    dot: 'bg-[#2E6B4F]',
    text: 'text-[#2E6B4F]',
    panel: 'border-[#CDE5D8] bg-[#F3FAF6]',
  },
  partially_paid: {
    dot: 'bg-[#A3681F]',
    text: 'text-[#A3681F]',
    panel: 'border-[#E5D4BC] bg-[#FAF7F2]',
  },
  not_paid: {
    dot: 'bg-[#A3681F]',
    text: 'text-[#A3681F]',
    panel: 'border-[#E5D4BC] bg-[#FAF7F2]',
  },
  pending_verification: {
    dot: 'bg-[#A3681F]',
    text: 'text-[#A3681F]',
    panel: 'border-[#E5D4BC] bg-[#FAF7F2]',
  },
};

export function deskStatusTone(kind: DeskPaymentKind) {
  return KIND_STYLES[kind];
}

function useDeskPaymentCopy() {
  const t = useTranslations('frontDesk');
  const tStatus = useTranslations('statuses.payment');
  return { t, tStatus };
}

function columnLabel(
  kind: DeskPaymentKind,
  dueLabel: string | undefined,
  t: ReturnType<typeof useTranslations>,
) {
  if (kind === 'paid') return t('paidColumn');
  if (kind === 'pending_verification') return t('pendingVerificationColumn');
  if (kind === 'partially_paid') return t('partiallyPaidColumn', { amount: dueLabel || '' });
  return t('notPaidColumn', { amount: dueLabel || '' });
}

export function DeskPaymentBadge({
  totalAmountMinorUnits,
  paidAmountMinorUnits,
  pendingTransferProof,
  compact,
}: {
  totalAmountMinorUnits: number;
  paidAmountMinorUnits: number;
  pendingTransferProof?: boolean;
  compact?: boolean;
}) {
  const { t, tStatus } = useDeskPaymentCopy();
  const status = deskPaymentStatus({ totalAmountMinorUnits, paidAmountMinorUnits, pendingTransferProof });
  const tone = deskStatusTone(status.kind);
  const label = compact ? columnLabel(status.kind, status.dueLabel ? isolateLtr(status.dueLabel) : '', t) : tStatus(status.kind);
  return (
    <span className={`inline-flex items-center gap-1.5 ${compact ? 'text-[11px] font-mono' : 'text-xs'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      <span className={tone.text}>{label}</span>
    </span>
  );
}

export function CheckInPaymentStatus({
  totalAmountMinorUnits,
  paidAmountMinorUnits,
  pendingTransferProof,
}: {
  totalAmountMinorUnits: number;
  paidAmountMinorUnits: number;
  pendingTransferProof?: boolean;
}) {
  const { t, tStatus } = useDeskPaymentCopy();
  const status = deskPaymentStatus({ totalAmountMinorUnits, paidAmountMinorUnits, pendingTransferProof });
  const tone = deskStatusTone(status.kind);
  const due = status.amountDueMinorUnits;

  return (
    <div className={`rounded border p-3 space-y-2 ${tone.panel}`}>
      <div>
        <span className="block text-[11px] uppercase tracking-wider text-[#8C8275]">{t('paymentStatus')}</span>
        <strong className={`block text-sm ${tone.text}`}>{tStatus(status.kind)}</strong>
      </div>
      {status.kind === 'paid' && status.receivedLabel ? (
        <p className="text-xs text-[#191816]">{t('received', { amount: isolateLtr(status.receivedLabel) })}</p>
      ) : null}
      {status.kind === 'partially_paid' ? (
        <p className="text-xs text-[#191816]">{t('paidAndDue', { paid: isolateLtr(status.receivedLabel || ''), due: isolateLtr(status.dueLabel || '') })}</p>
      ) : null}
      {status.kind === 'not_paid' ? (
        <p className="text-xs text-[#191816]">{t('amountDue', { amount: isolateLtr(status.dueLabel || '') })}</p>
      ) : null}
      {status.kind === 'pending_verification' ? (
        <p className="text-xs text-[#191816]">{t('pendingProofNote', { amount: isolateLtr(formatNaira(due)) })}</p>
      ) : null}
    </div>
  );
}
