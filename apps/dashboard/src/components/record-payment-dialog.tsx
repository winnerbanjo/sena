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
  embedded,
}: {
  open: boolean;
  onClose: () => void;
  reservationId: string;
  guestName: string;
  reference: string;
  outstandingMinorUnits: number;
  checkedOut?: boolean;
  onRecorded?: () => void;
  embedded?: boolean;
}) {
  const [amount, setAmount] = React.useState((outstandingMinorUnits / 100).toString());
  const [method, setMethod] = React.useState('cash');
  const [transferReference, setTransferReference] = React.useState('');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const key = React.useRef(crypto.randomUUID());
  const overlayRef = useDialogA11y<HTMLFormElement>(open && !embedded, onClose);
  const formRef = React.useRef<HTMLFormElement>(null);
  const ref = embedded ? formRef : overlayRef;

  React.useEffect(() => {
    if (open) {
      setAmount((outstandingMinorUnits / 100).toString());
      setMethod('cash');
      setTransferReference('');
      setNote('');
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
        throw new Error(embedded ? 'Enter an amount up to the amount due.' : 'Enter an amount up to the outstanding balance.');
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

  const title = checkedOut ? 'Settle outstanding balance' : 'Record payment';
  const amountPhrase = embedded ? `Amount due ${formatNaira(outstandingMinorUnits)}.` : `Outstanding ${formatNaira(outstandingMinorUnits)}.`;

  const form = (
    <form
      ref={ref}
      onSubmit={submit}
      role={embedded ? undefined : 'dialog'}
      aria-modal={embedded ? undefined : true}
      aria-labelledby="settle-payment-title"
      className={embedded ? 'space-y-4' : 'w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-lg p-5 space-y-4'}
    >
      <h2 id="settle-payment-title" className="font-serif text-xl">
        {title}
      </h2>
      <p className="text-sm text-[#7A7267]">
        {guestName} · {reference}. {amountPhrase}
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
  );

  if (embedded) return form;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-3">
      {form}
    </div>
  );
}
