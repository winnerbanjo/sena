'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@sena/ui';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ReservationItem } from './mock-data';

interface CancelReservationDialogProps {
  reservation: ReservationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled?: (updatedReservation: ReservationItem) => void;
}

const CANCELLATION_REASONS = [
  'Guest requested cancellation',
  'Booking entered by mistake',
  'Duplicate booking',
  'No-show / unable to travel',
  'Emergency / property operational issue',
  'Payment not received / expired hold',
  'Other',
] as const;

export function CancelReservationDialog({
  reservation,
  open,
  onOpenChange,
  onCancelled,
}: CancelReservationDialogProps) {
  const [selectedReason, setSelectedReason] = React.useState<string>(CANCELLATION_REASONS[0]);
  const [customNotes, setCustomNotes] = React.useState<string>('');
  const [cancelling, setCancelling] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSelectedReason(CANCELLATION_REASONS[0]);
      setCustomNotes('');
      setError(null);
    }
  }, [open]);

  if (!reservation) return null;

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!reservation || cancelling) return;

    setCancelling(true);
    setError(null);

    const fullReason =
      selectedReason === 'Other'
        ? customNotes.trim() || 'Other'
        : customNotes.trim()
        ? `${selectedReason}: ${customNotes.trim()}`
        : selectedReason;

    try {
      const res = await fetch(`/api/reservations/${reservation.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: fullReason }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel reservation.');
      }

      const updated: ReservationItem = {
        ...reservation,
        status: 'cancelled',
      };

      onCancelled?.(updated);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error cancelling reservation.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-[#E8E2DA]">
        <form onSubmit={handleConfirm}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-[#991B1B]">
              <AlertTriangle className="w-5 h-5" />
              <DialogTitle className="text-[#191816]">Cancel Reservation</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#7A7267] pt-1">
              Are you sure you want to cancel the reservation for{' '}
              <strong className="text-[#191816] font-semibold">{reservation.guestName}</strong> (
              {reservation.reference})?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-3">
            <div className="rounded-md border border-[#FEE2E2] bg-[#FEF2F2] p-3 text-xs text-[#991B1B] space-y-1">
              <p className="font-semibold">Important:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#B91C1C]">
                <li>Room inventory will be released immediately back to availability.</li>
                <li>Invoices, payment logs, and financial records will be preserved.</li>
                <li>This action cannot be undone once confirmed.</li>
              </ul>
            </div>

            <div>
              <Label htmlFor="cancel-reason" className="text-xs font-medium text-[#191816]">
                Reason for Cancellation
              </Label>
              <select
                id="cancel-reason"
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="mt-1 flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 py-2 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
              >
                {CANCELLATION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="cancel-notes" className="text-xs font-medium text-[#191816]">
                Additional Notes {selectedReason === 'Other' && <span className="text-[#991B1B]">*</span>}
              </Label>
              <textarea
                id="cancel-notes"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder={
                  selectedReason === 'Other'
                    ? 'Please specify the cancellation reason...'
                    : 'Optional details for staff audit history...'
                }
                rows={3}
                required={selectedReason === 'Other'}
                className="mt-1 w-full rounded border border-[#E8E2DA] bg-white p-2.5 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
              />
            </div>

            {error && (
              <div className="rounded bg-red-50 p-2.5 text-xs text-red-700">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={cancelling}
            >
              Keep Reservation
            </Button>
            <Button
              type="submit"
              disabled={cancelling || (selectedReason === 'Other' && !customNotes.trim())}
              className="bg-[#991B1B] hover:bg-[#7F1D1D] text-white"
            >
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
