'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
import { deskPaymentStatus, type DeskPaymentKind } from '../lib/financial-status';

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
  const status = deskPaymentStatus({ totalAmountMinorUnits, paidAmountMinorUnits, pendingTransferProof });
  const tone = deskStatusTone(status.kind);
  return (
    <span className={`inline-flex items-center gap-1.5 ${compact ? 'text-[11px] font-mono' : 'text-xs'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      <span className={tone.text}>{compact ? status.columnLabel : status.label}</span>
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
  const status = deskPaymentStatus({ totalAmountMinorUnits, paidAmountMinorUnits, pendingTransferProof });
  const tone = deskStatusTone(status.kind);
  const due = status.amountDueMinorUnits;

  return (
    <div className={`rounded border p-3 space-y-2 ${tone.panel}`}>
      <div>
        <span className="block text-[11px] uppercase tracking-wider text-[#8C8275]">Payment Status</span>
        <strong className={`block text-sm ${tone.text}`}>{status.label}</strong>
      </div>
      {status.kind === 'paid' && status.receivedLabel ? (
        <p className="text-xs text-[#191816]">{status.receivedLabel} received</p>
      ) : null}
      {status.kind === 'partially_paid' ? (
        <p className="text-xs text-[#191816]">
          {status.receivedLabel} paid · Amount due {status.dueLabel}
        </p>
      ) : null}
      {status.kind === 'not_paid' ? (
        <p className="text-xs text-[#191816]">Amount due {status.dueLabel}</p>
      ) : null}
      {status.kind === 'pending_verification' ? (
        <p className="text-xs text-[#191816]">
          Transfer proof uploaded. Amount due {formatNaira(due)} until the hotel verifies it.
        </p>
      ) : null}
    </div>
  );
}
