'use client';
import { pageMain } from '../../components/design';
import { useTranslations } from 'next-intl';

import { PageLoadState, readJsonResponse } from '../../components/page-load-state';
import * as React from 'react';
import { formatNaira } from '@sena/config';
import {
  Badge,
  Button,
  MetricCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sena/ui';
import { CreditCard, Download, Plus } from 'lucide-react';
import { Topbar } from '../../components/topbar';
import { useDialogA11y } from '../../components/use-dialog-a11y';
import { PaymentReceiptField, usePaymentReceipt } from '../../components/payment-receipt-field';
import { manualPaymentBody } from '../../lib/payment-receipt-file';

interface PaymentItem {
  id: string;
  reference: string;
  guestName: string;
  amountMinorUnits: number;
  provider: 'paystack' | 'manual';
  method: 'card' | 'bank_transfer' | 'pos' | 'cash';
  status: 'successful' | 'pending' | 'refunded';
  date: string;
  hasReceipt: boolean;
}

export default function PaymentsPage() {
  const t = useTranslations('payments');
  const [payments, setPayments] = React.useState<PaymentItem[]>([]);
  const [reservations, setReservations] = React.useState<any[]>([]);
  const [receivables, setReceivables] = React.useState<any[]>([]);
  const [proofs, setProofs] = React.useState<any[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [recordError, setRecordError] = React.useState('');
  const [recording, setRecording] = React.useState(false);
  const [recordForm, setRecordForm] = React.useState({ reservationId: '', amount: '', method: 'cash', reference: '', note: '' });
  const idempotencyKey = React.useRef('');
  const recordDialogRef = useDialogA11y<HTMLFormElement>(recordOpen, () => setRecordOpen(false));
  const receipt = usePaymentReceipt({ invalid: t('receiptInvalid'), tooLarge: t('receiptTooLarge') });

  React.useEffect(() => {
    Promise.all([
      fetch('/api/payments').then(readJsonResponse),
      fetch('/api/reservations').then(readJsonResponse),
    ])
      .then(([payData, resData]) => {
        if (payData.payments) {
          const mapped: PaymentItem[] = payData.payments.map((p: any) => ({
            id: p.id,
            reference: p.providerReference || `PAY-${p.id.slice(0, 6)}`,
            guestName: p.guestName || 'Walk-in Guest',
            amountMinorUnits: p.amountMinorUnits,
            provider: p.provider || 'manual',
            method: p.method || 'cash',
            status: p.status || 'successful',
            hasReceipt: Boolean(p.hasReceipt),
            date: new Date(p.createdAt).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
          }));
          setPayments(mapped);
        }
        if (resData.reservations) {
          setReservations(resData.reservations);
        }
        if (payData.receivables) setReceivables(payData.receivables);
        if (payData.transferProofs) setProofs(payData.transferProofs);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const totalCollectedMinorUnits = payments
    .filter((p) => p.status === 'successful')
    .reduce((sum, p) => sum + p.amountMinorUnits, 0);

  const pendingFoliosMinorUnits = reservations
    .filter((r) => r.paymentStatus !== 'paid' && r.status !== 'cancelled')
    .reduce((sum, r) => {
      const balance = Number(r.totalAmountMinorUnits || 0) - Number(r.paidAmountMinorUnits || 0);
      return sum + (balance > 0 ? balance : 0);
    }, 0);

  const directReservationsCount = reservations.filter((r) => r.source === 'direct').length;
  const directBookingShare = reservations.length > 0
    ? Math.round((directReservationsCount / reservations.length) * 100)
    : 0;
  const outstandingReservations = reservations.filter((reservation) => reservation.status !== 'cancelled' && Number(reservation.totalAmountMinorUnits || 0) > Number(reservation.paidAmountMinorUnits || 0));

  async function submitRecordPayment(event: React.FormEvent) {
    event.preventDefault();
    setRecording(true);
    setRecordError('');
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    try {
      const reservation = outstandingReservations.find((item) => item.id === recordForm.reservationId);
      const outstanding = reservation ? Number(reservation.totalAmountMinorUnits) - Number(reservation.paidAmountMinorUnits || 0) : 0;
      const amountMinorUnits = Math.round(Number(recordForm.amount) * 100);
      if (!reservation || !Number.isInteger(amountMinorUnits) || amountMinorUnits <= 0 || amountMinorUnits > outstanding) {
        throw new Error('Enter an amount up to the outstanding balance.');
      }
      const request = manualPaymentBody({
        reservationId: reservation.id,
        amountMinorUnits,
        method: recordForm.method,
        providerReference: recordForm.reference || undefined,
        notes: recordForm.note || undefined,
      }, receipt.file);
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { ...request.headers, 'Idempotency-Key': idempotencyKey.current },
        body: request.body,
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'receipt_type') throw new Error(t('receiptInvalid'));
        if (data.code === 'receipt_size') throw new Error(t('receiptTooLarge'));
        throw new Error(data.error || 'Payment could not be recorded.');
      }
      if (data.receiptError) window.alert(t('receiptUploadFailed'));
      setRecordOpen(false);
      receipt.clear();
      idempotencyKey.current = '';
      window.location.reload();
    } catch (error: any) {
      setRecordError(error.message || 'Payment could not be recorded.');
    } finally {
      setRecording(false);
    }
  }

  if (loading || loadError) return <PageLoadState title={t('title')} failed={loadError} />;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title={t('title')} />

      <main className={pageMain}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-base font-medium text-[#191816]">
              Financials & Transactions
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Successful recorded payments and outstanding guest balances.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button variant="secondary" size="sm" className="text-xs">
              <Download className="w-3.5 h-3.5 mr-1" />
              Export CSV
            </Button>
            <Button size="sm" className="text-xs" onClick={() => { receipt.clear(); setRecordError(''); setRecordOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Record payment
            </Button>
          </div>
        </div>

        {/* Financial Statement Overview */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6 flex flex-col justify-between space-y-3 rounded-md border border-[#E8E2DA] bg-white p-4">
            <div>
              <span className="mb-1 block text-xs text-[#7A7267]">
                Settled revenue
              </span>
              <strong className="text-2xl font-medium tabular-nums tracking-tight text-[#191816]">
                {formatNaira(totalCollectedMinorUnits)}
              </strong>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#7A7267] pt-2 border-t border-[#E8E2DA]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Successful recorded payments</span>
            </div>
          </div>

          <div className="md:col-span-3 p-5 rounded-lg bg-white border border-[#E8E2DA] flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7267] block mb-1">
                Pending Folios
              </span>
              <strong className="text-2xl font-medium tabular-nums text-[#191816]">
                {formatNaira(pendingFoliosMinorUnits)}
              </strong>
            </div>
            <p className="text-[11px] text-[#7A7267]">
              Outstanding guest balances.
            </p>
          </div>

          <div className="md:col-span-3 p-5 rounded-lg bg-white border border-[#E8E2DA] flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7267] block mb-1">
                Direct Booking Share
              </span>
              <strong className="text-2xl font-medium tabular-nums text-[#191816]">
                {directBookingShare}%
              </strong>
            </div>
            <p className="text-[11px] text-[#7A7267]">
              Share of bookings from the direct channel.
            </p>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-x-auto">
          <div className="p-4 border-b border-[#E8E2DA] bg-[#FAF9F6] flex items-center justify-between">
            <strong className="text-sm font-serif font-normal text-[#191816]">
              Settlement Ledger
            </strong>
            <span className="text-xs text-[#7A7267]">
              Showing confirmed payments
            </span>
          </div>

          <div className="sm:hidden divide-y divide-[#E8E2DA]">
            {payments.map((pay) => (
              <div key={pay.id} className="p-4 space-y-1">
                <p className="font-medium">{pay.guestName}</p>
                <p className="font-serif text-lg">{formatNaira(pay.amountMinorUnits)}</p>
                <p className="text-sm text-[#5C564D]">{pay.provider === 'paystack' ? 'Paystack' : 'Manual'} · {pay.provider === 'paystack' ? 'Online' : pay.method === 'bank_transfer' ? 'Bank transfer' : pay.method === 'pos' ? 'POS' : 'Cash'} · {pay.status}</p>
                <p className="text-sm text-[#7A7267]">{pay.reference} · {pay.date}</p>
                {pay.hasReceipt && (
                  <p className="flex flex-wrap gap-x-3 text-sm">
                    <a className="text-[#71382D] underline" href={`/api/payments/${pay.id}/receipt`} target="_blank" rel="noopener noreferrer">{t('viewReceipt')}</a>
                    <a className="text-[#71382D] underline" href={`/api/payments/${pay.id}/receipt?download=1`} target="_blank" rel="noopener noreferrer">{t('downloadReceipt')}</a>
                  </p>
                )}
              </div>
            ))}
          </div>
          <Table className="hidden sm:table min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-[#FAF9F6] border-b border-[#E8E2DA]">
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Reference</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Guest</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Amount</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Provider</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Method</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Status</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs text-right">Date & Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#E8E2DA]">
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-14 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="font-serif text-sm text-[#191816]">
                        {loading ? 'Reconciling transaction ledger...' : 'No transactions recorded yet'}
                      </p>
                      <p className="text-xs text-[#7A7267] leading-relaxed">
                        Incoming payments verified by Paystack and manual desk collections will appear in this settlement ledger.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((pay) => (
                  <TableRow key={pay.id}>
                    <TableCell className="font-mono text-xs font-semibold text-[#B85C3E]">
                      <div>{pay.reference}</div>
                      {pay.hasReceipt && (
                        <div className="mt-1 flex flex-wrap gap-x-3 font-sans font-normal">
                          <a className="text-[#71382D] underline" href={`/api/payments/${pay.id}/receipt`} target="_blank" rel="noopener noreferrer">{t('viewReceipt')}</a>
                          <a className="text-[#71382D] underline" href={`/api/payments/${pay.id}/receipt?download=1`} target="_blank" rel="noopener noreferrer">{t('downloadReceipt')}</a>
                        </div>
                      )}
                  </TableCell>
                  <TableCell className="font-medium text-sm text-[#191816]">
                    {pay.guestName}
                  </TableCell>
                  <TableCell className="font-serif font-medium text-sm text-[#191816]">
                    {formatNaira(pay.amountMinorUnits)}
                  </TableCell>
                  <TableCell className="text-xs text-[#7A7267]">
                    {pay.provider === 'paystack' ? 'Paystack' : 'Manual'}
                  </TableCell>
                  <TableCell className="text-xs text-[#7A7267]">
                    {pay.provider === 'paystack' ? 'Online' : pay.method === 'bank_transfer' ? 'Bank transfer' : pay.method === 'pos' ? 'POS' : 'Cash'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pay.status === 'successful' ? 'paid' : 'pending'}>
                      {pay.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-[#7A7267] text-right font-mono">{pay.date}</TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </div>

        <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-x-auto">
          <div className="p-4 border-b border-[#E8E2DA] bg-[#FAF9F6]">
            <strong className="text-sm font-serif font-normal text-[#191816]">Outstanding guest balances</strong>
            <p className="text-xs text-[#7A7267]">Who still owes the hotel, including checked-out receivables.</p>
          </div>
          {receivables.length === 0 ? (
            <p className="p-4 text-sm text-[#7A7267]">No outstanding guest balances.</p>
          ) : (
            <div className="divide-y divide-[#E8E2DA]">
              {receivables.map((row) => (
                <div key={row.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                  <div>
                    <strong>{row.guestName || 'Guest'}</strong>
                    <p className="text-xs text-[#7A7267]">{row.reference} · {row.status.replace('_', ' ')} · Checkout {row.checkOutDate}</p>
                  </div>
                  <div className="text-right">
                    <p>Total {formatNaira(row.totalAmountMinorUnits)}</p>
                    <p>Paid {formatNaira(row.paidAmountMinorUnits)}</p>
                    <p className="text-[#B85C3E] font-medium">{row.settlement}: {formatNaira(row.outstandingMinorUnits)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-x-auto">
          <div className="p-4 border-b border-[#E8E2DA] bg-[#FAF9F6]">
            <strong className="text-sm font-serif font-normal text-[#191816]">Transfer proofs</strong>
            <p className="text-xs text-[#7A7267]">Guest-submitted proofs are not payments until verified.</p>
          </div>
          {proofs.length === 0 ? (
            <p className="p-4 text-sm text-[#7A7267]">No transfer proofs submitted.</p>
          ) : (
            <div className="divide-y divide-[#E8E2DA]">
              {proofs.map((proof) => (
                <div key={proof.id} className="p-4 space-y-2 text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <strong>{proof.guestName || proof.payerName || 'Guest'}</strong>
                      <p className="text-xs text-[#7A7267]">{proof.reservationReference || 'Invoice'} · {formatNaira(proof.amountMinorUnits)} · {proof.status.replace('_', ' ')}</p>
                      <p className="text-xs text-[#7A7267]">{proof.transferReference || 'No transfer reference'} · {new Date(proof.submittedAt).toLocaleString()}</p>
                    </div>
                    {proof.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={async () => {
                          await fetch(`/api/payments/transfer-proofs/${proof.id}/verify`, { method: 'POST' });
                          window.location.reload();
                        }}>Verify payment</Button>
                        <Button size="sm" variant="secondary" onClick={async () => {
                          await fetch(`/api/payments/transfer-proofs/${proof.id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                          window.location.reload();
                        }}>Reject</Button>
                      </div>
                    )}
                  </div>
                  {proof.proofUrl && <a href={proof.proofUrl} target="_blank" rel="noreferrer" className="text-[#71382D] underline text-xs">View submitted proof</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      {recordOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3">
          <form ref={recordDialogRef} onSubmit={submitRecordPayment} role="dialog" aria-modal="true" aria-labelledby="record-payment-title" className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-lg p-5 space-y-4">
            <h2 id="record-payment-title" className="font-serif text-xl">Record payment</h2>
            <label htmlFor="record-reservation" className="block text-sm">Reservation
              <select id="record-reservation" required value={recordForm.reservationId} onChange={(event) => setRecordForm({ ...recordForm, reservationId: event.target.value })} className="mt-1 w-full min-h-11 border border-[#E8E2DA] rounded px-3 py-2">
                <option value="">Select a stay</option>
                {outstandingReservations.map((reservation) => (
                  <option key={reservation.id} value={reservation.id}>{reservation.reference} · {reservation.guestName || 'Guest'} · {formatNaira(Number(reservation.totalAmountMinorUnits) - Number(reservation.paidAmountMinorUnits || 0))} due</option>
                ))}
              </select>
            </label>
            <label htmlFor="record-amount" className="block text-sm">Amount in naira
              <input id="record-amount" required inputMode="decimal" value={recordForm.amount} onChange={(event) => setRecordForm({ ...recordForm, amount: event.target.value })} className="mt-1 w-full min-h-11 border border-[#E8E2DA] rounded px-3 py-2" />
            </label>
            <label htmlFor="record-method" className="block text-sm">Method
              <select id="record-method" value={recordForm.method} onChange={(event) => setRecordForm({ ...recordForm, method: event.target.value })} className="mt-1 w-full min-h-11 border border-[#E8E2DA] rounded px-3 py-2">
                <option value="cash">Cash</option>
                <option value="pos">POS</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </label>
            <label htmlFor="record-reference" className="block text-sm">Reference
              <input id="record-reference" value={recordForm.reference} onChange={(event) => setRecordForm({ ...recordForm, reference: event.target.value })} className="mt-1 w-full min-h-11 border border-[#E8E2DA] rounded px-3 py-2" />
            </label>
            <PaymentReceiptField
              id="record-receipt"
              copy={{
                label: t('receiptLabel'),
                upload: t('receiptUpload'),
                help: t('receiptHelp'),
                remove: t('receiptRemove'),
                selected: t('receiptSelected'),
                invalid: t('receiptInvalid'),
                tooLarge: t('receiptTooLarge'),
              }}
              file={receipt.file}
              previewUrl={receipt.previewUrl}
              message={receipt.message}
              onChoose={receipt.choose}
              onClear={receipt.clear}
            />
            <label htmlFor="record-note" className="block text-sm">Note
              <input id="record-note" value={recordForm.note} onChange={(event) => setRecordForm({ ...recordForm, note: event.target.value })} className="mt-1 w-full min-h-11 border border-[#E8E2DA] rounded px-3 py-2" />
            </label>
            {recordError && <p className="text-sm text-red-700" role="alert">{recordError}</p>}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="secondary" className="min-h-11" onClick={() => setRecordOpen(false)}>Cancel</Button>
              <Button type="submit" className="min-h-11" disabled={recording}>{recording ? 'Recording...' : 'Confirm payment'}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
