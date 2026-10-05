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
import { Check, Loader2, Search, User, AlertCircle } from 'lucide-react';

interface GuestOption {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  totalStays?: number;
}

interface ChangeGuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  currentGuestName: string;
  currentGuestId?: string;
  hasBookingGroup?: boolean;
  onReassigned?: (data: { guestId: string; guestName: string; guestEmail: string; guestPhone: string }) => void;
}

export function ChangeGuestDialog({
  open,
  onOpenChange,
  reservationId,
  currentGuestName,
  currentGuestId,
  hasBookingGroup,
  onReassigned,
}: ChangeGuestDialogProps) {
  const [guests, setGuests] = React.useState<GuestOption[]>([]);
  const [loadingGuests, setLoadingGuests] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selectedGuest, setSelectedGuest] = React.useState<GuestOption | null>(null);
  const [reason, setReason] = React.useState('');
  const [updateBookingGroup, setUpdateBookingGroup] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSelectedGuest(null);
      setQuery('');
      setReason('');
      setUpdateBookingGroup(false);
      setError(null);
      return;
    }

    setLoadingGuests(true);
    fetch('/api/guests')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.guests)) {
          setGuests(data.guests);
        }
      })
      .catch(() => setGuests([]))
      .finally(() => setLoadingGuests(false));
  }, [open]);

  const filteredGuests = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests.slice(0, 8);
    return guests
      .filter((g) => {
        const name = (g.fullName || '').toLowerCase();
        const email = (g.email || '').toLowerCase();
        const phone = (g.phone || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      })
      .slice(0, 15);
  }, [guests, query]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !selectedGuest) return;

    if (!reason.trim()) {
      setError('Please provide a reason for reassigning this reservation.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/reservations/${reservationId}/reassign-guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: selectedGuest.id,
          reason: reason.trim(),
          updateBookingGroup,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reassign guest.');
      }

      onReassigned?.({
        guestId: selectedGuest.id,
        guestName: selectedGuest.fullName,
        guestEmail: selectedGuest.email || '',
        guestPhone: selectedGuest.phone || '',
      });

      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error reassigning guest.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white border border-[#E8E2DA]">
        <form onSubmit={handleConfirm}>
          <DialogHeader>
            <DialogTitle>Change Reservation Guest</DialogTitle>
            <DialogDescription>
              Reassign this reservation from <strong>{currentGuestName}</strong> to another guest profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Step 1: Guest Search */}
            <div>
              <Label htmlFor="search-guest">Search Guest Directory</Label>
              <div className="relative mt-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-[#7A7267]" />
                <Input
                  id="search-guest"
                  type="text"
                  placeholder="Search by full name, phone number, or email..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            {/* List of matched guests */}
            <div className="rounded border border-[#E8E2DA] bg-[#FAFAFA] max-h-48 overflow-y-auto divide-y divide-[#E8E2DA]">
              {loadingGuests ? (
                <div className="py-6 text-center text-xs text-[#7A7267] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading guest directory...
                </div>
              ) : filteredGuests.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#7A7267]">
                  No guests found matching &ldquo;{query}&rdquo;.
                </div>
              ) : (
                filteredGuests.map((g) => {
                  const isCurrent = g.id === currentGuestId;
                  const isSelected = selectedGuest?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => setSelectedGuest(g)}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors ${
                        isSelected
                          ? 'bg-[#FAF0E4] border-l-2 border-[#B85C3E]'
                          : isCurrent
                          ? 'opacity-50 cursor-not-allowed bg-stone-100'
                          : 'hover:bg-white'
                      }`}
                    >
                      <div>
                        <strong className="text-[#191816] font-medium block">
                          {g.fullName} {isCurrent ? '(Current)' : ''}
                        </strong>
                        <span className="text-[#7A7267] text-[11px]">
                          {g.phone || 'No phone'} · {g.email || 'No email'}
                        </span>
                      </div>
                      {isSelected ? (
                        <Check className="w-4 h-4 text-[#B85C3E]" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>

            {/* Selected Guest Confirmation Preview */}
            {selectedGuest && (
              <div className="p-3 rounded border border-[#E8E2DA] bg-white space-y-1">
                <span className="text-[10px] uppercase font-mono text-[#7A7267] block">
                  New Assigned Guest
                </span>
                <div className="text-sm font-semibold text-[#191816] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#B85C3E]" />
                  {selectedGuest.fullName}
                </div>
                <div className="text-xs text-[#7A7267]">
                  {selectedGuest.phone || 'No phone'} · {selectedGuest.email || 'No email'}
                </div>
              </div>
            )}

            {/* Reason input */}
            <div>
              <Label htmlFor="reassign-reason">
                Reason for change <span className="text-red-500">*</span>
              </Label>
              <textarea
                id="reassign-reason"
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Front desk selected wrong previous guest at check-in / Guest transferred booking"
                className="mt-1 w-full rounded border border-[#E8E2DA] bg-white p-2.5 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
              />
            </div>

            {/* Booking group option */}
            {hasBookingGroup && (
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="update-booking-group"
                  checked={updateBookingGroup}
                  onChange={(e) => setUpdateBookingGroup(e.target.checked)}
                  className="mt-0.5 rounded border-[#E8E2DA] text-[#B85C3E] focus:ring-[#B85C3E]"
                />
                <Label htmlFor="update-booking-group" className="text-xs font-normal text-[#5C564D] cursor-pointer">
                  Also update the primary guest on all rooms in this booking group
                </Label>
              </div>
            )}

            {/* Explanatory security callout */}
            <div className="flex items-start gap-2 p-2.5 rounded bg-[#FAF7F2] border border-[#E8E2DA] text-[11px] text-[#7A7267]">
              <AlertCircle className="w-4 h-4 text-[#B85C3E] shrink-0 mt-0.5" />
              <span>
                Historical payments and settled accounting are never rewritten. Open draft invoices will update their recipient details automatically.
              </span>
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
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !selectedGuest || !reason.trim()}
              className="bg-[#71382D] hover:bg-[#5D2E25] text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {submitting ? 'Updating...' : 'Reassign Guest'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
