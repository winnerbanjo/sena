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
  Input,
  Label,
} from '@sena/ui';
import { RotateCcw } from 'lucide-react';
import { useToast } from './toast-notification';
import type { ReservationItem } from './mock-data';
import { PhysicalRoomSelect } from './physical-room-select';
import type { EligiblePhysicalRoom } from './reservation-room';

interface ReverseCheckOutDialogProps {
  reservation: ReservationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReversed: () => void;
}

export function ReverseCheckOutDialog({
  reservation,
  open,
  onOpenChange,
  onReversed,
}: ReverseCheckOutDialogProps) {
  const toast = useToast();
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [conflictOccurred, setConflictOccurred] = React.useState(false);
  const [conflictMessage, setConflictMessage] = React.useState('');
  const [eligibleRooms, setEligibleRooms] = React.useState<EligiblePhysicalRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = React.useState('');
  const [loadingRooms, setLoadingRooms] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason('');
      setErrorMsg(null);
      setConflictOccurred(false);
      setConflictMessage('');
      setSelectedRoomId('');
      setEligibleRooms([]);
    }
  }, [open]);

  if (!reservation) return null;

  async function loadEligibleRooms() {
    if (!reservation) return;
    setLoadingRooms(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/eligible-rooms?forCheckIn=1`);
      if (res.ok) {
        const data = await res.json();
        setEligibleRooms(Array.isArray(data.rooms) ? data.rooms : []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRooms(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reservation) return;

    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setErrorMsg('Please enter a detailed justification (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/reservations/${reservation.id}/reverse-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: trimmed,
          targetRoomId: selectedRoomId || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setConflictOccurred(true);
        setConflictMessage(data.error || 'The unit is currently occupied by another reservation.');
        void loadEligibleRooms();
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reverse check-out.');
      }

      toast.success(
        'Check-out Reversed',
        `Reservation ${reservation.reference} has been restored to Checked In.`
      );
      onReversed();
      onOpenChange(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not reverse check-out.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-[#E8E2DA]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-[#71382D] font-semibold">
              <RotateCcw className="w-5 h-5 text-[#B85C3E]" />
              Reverse Check-Out
            </DialogTitle>
            <DialogDescription className="text-xs text-[#7A7267]">
              Reinstate reservation {reservation.reference} ({reservation.guestName}) to Checked In.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="rounded bg-[#FDF8F5] border border-[#F0BCB0] p-3 text-[#71382D] space-y-1">
              <p className="font-semibold">Master Administrator Operation</p>
              <p className="text-[11px] text-[#7A7267]">
                Reversing a check-out will restore the stay status to &apos;Checked In&apos;, return the accommodation unit to &apos;Occupied&apos;, and log an immutable audit event.
              </p>
            </div>

            {conflictOccurred ? (
              <div className="rounded bg-amber-50 border border-amber-200 p-3 space-y-2 text-amber-900">
                <p className="font-semibold">{conflictMessage}</p>
                {!reservation.apartmentId && (
                  <div>
                    <Label htmlFor="reassign-room" className="text-xs">
                      Select an alternate room for reinstatement:
                    </Label>
                    <PhysicalRoomSelect
                      rooms={eligibleRooms}
                      value={selectedRoomId}
                      onChange={setSelectedRoomId}
                      loading={loadingRooms}
                      emptyLabel="No available rooms found"
                    />
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-1">
              <Label htmlFor="reverse-reason" className="text-xs text-[#191816] font-medium">
                Mandatory Operational Reason <span className="text-[#B85C3E]">*</span>
              </Label>
              <Input
                id="reverse-reason"
                placeholder="e.g. Guest extended stay; receptionist checked out by mistake"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="text-xs"
              />
              <p className="text-[10px] text-[#7A7267]">
                Minimum 5 characters. This justification is permanently recorded in the property activity log.
              </p>
            </div>

            {errorMsg && (
              <div className="rounded bg-red-50 border border-red-200 p-2.5 text-red-700 text-xs">
                {errorMsg}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#71382D] hover:bg-[#5A2C23] text-white"
              disabled={submitting || reason.trim().length < 5 || (conflictOccurred && !reservation.apartmentId && !selectedRoomId)}
            >
              {submitting ? 'Reversing...' : 'Confirm Reversal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
