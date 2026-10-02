'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sena/ui';

export const RESERVATION_REMOVE_REASONS = [
  'Duplicate reservation',
  'Created by mistake',
  'Guest cancelled',
  'Test / erroneous entry',
  'Management decision',
  'Other',
] as const;

export type ReservationRemovePreview = {
  reference: string;
  alreadyRemoved: boolean;
  action: 'delete' | 'void' | 'blocked';
  confirmationRequired: boolean;
  message: string | null;
  reasons: string[];
};

/** The two messages, written the way the operator should read them. */
export function removalDialogCopy(preview: ReservationRemovePreview) {
  if (preview.alreadyRemoved) {
    return {
      title: 'Delete reservation?',
      body: 'This reservation has already been removed.',
      confirmLabel: 'Close',
      destructive: false,
    };
  }
  if (preview.action === 'blocked') {
    return {
      title: 'Delete reservation?',
      body: preview.message || 'This reservation cannot be removed right now.',
      confirmLabel: 'Close',
      destructive: false,
    };
  }
  if (preview.action === 'void') {
    return {
      title: 'Delete reservation?',
      body: `This reservation has ${preview.reasons.length > 1 ? `${preview.reasons.slice(0, -1).join(', ')} and ` : ''}${preview.reasons[preview.reasons.length - 1] || 'stay'} history. Sena will remove it from active operations while preserving its financial history.`,
      confirmLabel: 'Remove reservation',
      destructive: true,
    };
  }
  return {
    title: 'Delete reservation?',
    body: 'This reservation will be permanently deleted.',
    confirmLabel: 'Delete reservation',
    destructive: true,
  };
}

export function ReservationRemoveDialog({
  open,
  onOpenChange,
  reservationId,
  reference,
  onRemoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string | null;
  reference: string;
  onRemoved: () => void;
}) {
  const [preview, setPreview] = React.useState<ReservationRemovePreview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState('');
  const [typed, setTyped] = React.useState('');

  React.useEffect(() => {
    if (!open || !reservationId) return;
    setPreview(null);
    setError(null);
    setReason('');
    setTyped('');
    let active = true;
    fetch(`/api/reservations/${reservationId}/remove`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setError(data.error || 'We could not read this reservation.');
          return;
        }
        setPreview(data);
      })
      .catch(() => active && setError('We could not read this reservation.'));
    return () => {
      active = false;
    };
  }, [open, reservationId]);

  const copy = preview ? removalDialogCopy(preview) : null;
  const referenceMatches = typed.trim().toUpperCase() === reference.toUpperCase();
  const canSubmit = Boolean(
    preview &&
      !preview.alreadyRemoved &&
      preview.action !== 'blocked' &&
      !loading &&
      !working &&
      (!preview.confirmationRequired || referenceMatches)
  );

  async function submit() {
    if (!reservationId || !preview) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason || undefined,
          confirmReference: preview.confirmationRequired ? typed : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onRemoved();
        onOpenChange(false);
      } else {
        setError(data.error || 'We could not remove this reservation.');
        if (res.status === 428) setPreview({ ...preview, confirmationRequired: true });
      }
    } catch {
      setError('We could not remove this reservation. Please try again.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#191816]">{copy?.title || 'Delete reservation?'}</DialogTitle>
          <DialogDescription className="text-[#5C564D]">
            {loading ? 'Checking this reservation…' : copy?.body}
          </DialogDescription>
        </DialogHeader>

        {preview && !preview.alreadyRemoved && preview.action !== 'blocked' && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="reservation-remove-reason" className="text-xs font-medium text-[#5C564D]">
                Reason (optional)
              </label>
              <select
                id="reservation-remove-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-[#E8E2DA] bg-white px-3 py-2 text-sm text-[#191816] focus:outline-none focus:ring-2 focus:ring-[#71382D]/30"
              >
                <option value="">Select a reason</option>
                {RESERVATION_REMOVE_REASONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {preview.confirmationRequired && (
              <div className="space-y-1.5">
                <label htmlFor="reservation-remove-confirm" className="text-xs font-medium text-[#5C564D]">
                  Type <span className="font-mono text-[#191816]">{reference}</span> to confirm
                </label>
                <input
                  id="reservation-remove-confirm"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  className="w-full rounded-md border border-[#E8E2DA] bg-white px-3 py-2 text-sm text-[#191816] focus:outline-none focus:ring-2 focus:ring-[#71382D]/30"
                />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[#8C2F24]">{error}</p>}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-[#E8E2DA] bg-white px-4 py-2 text-sm font-medium text-[#191816] hover:bg-[#FAF8F6]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              copy?.destructive ? 'bg-[#8C2F24] hover:bg-[#71382D]' : 'bg-[#191816] hover:bg-[#000000]'
            }`}
          >
            {working ? 'Working…' : copy?.confirmLabel || 'Delete reservation'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
