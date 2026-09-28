'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
import { Button } from '@sena/ui';
import { useDialogA11y } from './use-dialog-a11y';

export function RecordPaymentDialog({
  open,
  onClose,
  reservationId,
  guestName,
  reference,
  outstandingMinorUnits,
  checkedOut,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  reservationId: string;
  guestName: string;
  reference: string;
  outstandingMinorUnits: number;
  checkedOut?: boolean;
  onRecorded?: () => void;
}) {
  const [amount, setAmount] = React.useState((outstandingMinorUnits / 100).toString());
  const [method, setMethod] = React.useState('cash');
  const [transferReference, setTransferReference] = React.useState('');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const key = React.useRef(crypto.randomUUID());
  const formRef = useDialogA11y<HTMLFormElement>(open, onClose);

  React.useEffect(() => {
    if (open) {
      setAmount((outstandingMinorUnits / 100).toString());
      setError('');
      key.current = crypto.randomUUID();
    }
  }, [open, outstandingMinorUnits]);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const amountMinorUnits = Math.round(Number(amount) * 100);
      if (!Number.isInteger(amountMinorUnits) || amountMinorUnits <= 0 || amountMinorUnits > outstandingMinorUnits) {
        throw new Error('Enter an amount up to the outstanding balance.');
      }
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key.current },
        body: JSON.stringify({
          reservationId,
          amountMinorUnits,
          method,
          providerReference: transferReference || undefined,
          notes: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment could not be recorded.');
      onRecorded?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment could not be recorded.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3">
      <form ref={formRef} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="settle-payment-title" className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-lg p-5 space-y-4">
        <h2 id="settle-payment-title" className="font-serif text-xl">
          {checkedOut ? 'Settle outstanding balance' : 'Record payment'}
        </h2>
        <p className="text-sm text-[#7A7267]">
          {guestName} · {reference}. Outstanding {formatNaira(outstandingMinorUnits)}.
        </p>
        <label htmlFor="settle-amount" className="block text-sm">Amount
          <input id="settle-amount" required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full min-h-11 border border-[#E8E2DA] rounded px-3 py-2" />
        </label>
        <label htmlFor="settle-method" className="block text-sm">Method
          <select id="settle-method" value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 w-full min-h-11 border border-[#E8E2DA] rounded px-3 py-2">
            <option value="cash">Cash</option>
            <option value="pos">POS</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </label>
        <label htmlFor="settle-ref" className="block text-sm">Transfer or POS reference
          <input id="settle-ref" value={transferReference} onChange={(event) => setTransferReference(event.target.value)} className="mt-1 w-full min-h-11 border border-[#E8E2DA] rounded px-3 py-2" />
        </label>
        <label htmlFor="settle-note" className="block text-sm">Note
          <input id="settle-note" value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full min-h-11 border border-[#E8E2DA] rounded px-3 py-2" />
        </label>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="secondary" className="min-h-11" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="min-h-11" disabled={saving}>{saving ? 'Recording…' : 'Confirm payment'}</Button>
        </div>
      </form>
    </div>
  );
}
