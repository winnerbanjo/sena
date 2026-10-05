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
import { Loader2 } from 'lucide-react';

interface EditGuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest: {
    id: string;
    fullName?: string;
    name?: string;
    email?: string | null;
    phone?: string | null;
    identificationType?: string | null;
    identificationNumber?: string | null;
    notes?: string | null;
  } | null;
  onSaved?: (updated: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    identificationType?: string | null;
    identificationNumber?: string | null;
    notes?: string | null;
  }) => void;
}

export function EditGuestDialog({
  open,
  onOpenChange,
  guest,
  onSaved,
}: EditGuestDialogProps) {
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [idType, setIdType] = React.useState('');
  const [idNumber, setIdNumber] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && guest) {
      setFullName(guest.fullName || guest.name || '');
      setEmail(guest.email || '');
      setPhone(guest.phone || '');
      setIdType(guest.identificationType || '');
      setIdNumber(guest.identificationNumber || '');
      setNotes(guest.notes || '');
      setError(null);
    }
  }, [open, guest]);

  if (!guest) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!guest || saving) return;
    if (!fullName.trim()) {
      setError('Guest name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase() || null,
          phone: phone.trim() || null,
          identificationType: idType.trim() || null,
          identificationNumber: idNumber.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update guest profile.');
      }

      onSaved?.({
        id: guest.id,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase() || null,
        phone: phone.trim() || null,
        identificationType: idType.trim() || null,
        identificationNumber: idNumber.trim() || null,
        notes: notes.trim() || null,
      });

      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating guest.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-[#E8E2DA]">
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Edit Guest Profile</DialogTitle>
            <DialogDescription>
              Update contact info and guest directory record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-3">
            <div>
              <Label htmlFor="guest-fullname">Full Name</Label>
              <Input
                id="guest-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="guest-phone">Phone</Label>
                <Input
                  id="guest-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="guest-email">Email</Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="guest-id-type">ID Type</Label>
                <select
                  id="guest-id-type"
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 py-2 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                >
                  <option value="">None / Unspecified</option>
                  <option value="passport">International Passport</option>
                  <option value="national_id">National ID / NIN</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="voters_card">Voter's Card</option>
                </select>
              </div>
              <div>
                <Label htmlFor="guest-id-number">ID Number</Label>
                <Input
                  id="guest-id-number"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="ID Number"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="guest-notes">Staff Notes</Label>
              <textarea
                id="guest-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VIP preferences, corporate billing instructions, etc."
                rows={3}
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
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#71382D] hover:bg-[#5D2E25] text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
