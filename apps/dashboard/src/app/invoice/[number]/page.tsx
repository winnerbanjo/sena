'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { formatNaira } from '@sena/config';
import { flutterwaveReturnContext } from '@/lib/flutterwave-callback';
import { Button } from '@sena/ui';
import {
  Printer,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { BrandedInvoiceDocument, englishInvoiceDocumentLabels } from '../../../components/branded-invoice-document';
import type { PropertyInvoice } from '../../../components/invoice-types';

export default function PublicInvoicePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceNumber = params.number as string;
  const returned = flutterwaveReturnContext(searchParams);
  const isPaymentConfirming = returned.confirming;
  const txRef = returned.txRef;
  const transactionId = returned.transactionId;

  const [invoice, setInvoice] = React.useState<PropertyInvoice | null>(null);
  const [property, setProperty] = React.useState<any>(null);
  const [reservation, setReservation] = React.useState<any>(null);
  const [payments, setPayments] = React.useState<Array<{ paidAt: string; method: string; reference: string; amountMinorUnits: number }>>([]);
  const [onlinePaymentAvailable, setOnlinePaymentAvailable] = React.useState(true);
  const [bankTransferAvailable, setBankTransferAvailable] = React.useState(false);
  const [bankAccounts, setBankAccounts] = React.useState<any[]>([]);
  const [transferProofStatus, setTransferProofStatus] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [paying, setPaying] = React.useState(false);
  const [proofError, setProofError] = React.useState('');
  const [proofSubmitting, setProofSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isPaymentConfirming && txRef) {
      void fetch('/api/payments/public/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_ref: txRef, transaction_id: transactionId || undefined }),
        cache: 'no-store',
      }).catch(() => undefined);
    }
  }, [isPaymentConfirming, txRef, transactionId]);

  React.useEffect(() => {
    if (!invoiceNumber) return;
    let stopped = false;
    function load() {
      return fetch(`/api/invoices/public/${invoiceNumber}`)
        .then((res) => {
          if (!res.ok) throw new Error('Invoice not found');
          return res.json();
        })
        .then((data) => {
          if (stopped) return;
          setInvoice(data.invoice);
          setProperty(data.property);
          setReservation(data.reservation);
          setPayments(Array.isArray(data.payments) ? data.payments : []);
          setOnlinePaymentAvailable(Boolean(data.onlinePaymentAvailable));
          setBankTransferAvailable(Boolean(data.bankTransferAvailable));
          setBankAccounts(Array.isArray(data.bankAccounts) ? data.bankAccounts : []);
          setTransferProofStatus(data.transferProofStatus || null);
        })
        .catch((err) => {
          if (!stopped) setError(err.message);
        })
        .finally(() => {
          if (!stopped) setLoading(false);
        });
    }
    void load();
    if (!isPaymentConfirming) return () => { stopped = true; };
    const timer = window.setInterval(() => { void load(); }, 4000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [invoiceNumber, isPaymentConfirming]);

  async function handlePayOnline() {
    if (!invoice) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/invoices/public/${invoiceNumber}/checkout`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start payment');
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (err: any) {
      alert(err.message || 'Payment initiation failed');
      setPaying(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#71382D] mx-auto" />
          <p className="text-sm font-serif text-[#191816]">Loading official statement...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl border border-[#E8E2DA] text-center space-y-4 shadow-sm">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
          <h1 className="text-xl font-serif text-[#191816]">Statement Not Found</h1>
          <p className="text-xs text-[#7A7267]">
            This invoice link is unavailable. Ask the property for a new link.
          </p>
        </div>
      </div>
    );
  }

  const balanceMinorUnits = Math.max(0, invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits);
  const unavailable = ['void', 'draft', 'cancelled'].includes(invoice.status);
  const isPaid = !unavailable && (invoice.status === 'paid' || balanceMinorUnits === 0);
  const canPayOnline = !isPaid && !unavailable && onlinePaymentAvailable;
  const canPayByTransfer = !isPaid && !unavailable && bankTransferAvailable;
  const onlinePaymentUnavailable = !isPaid && !unavailable && !onlinePaymentAvailable && !bankTransferAvailable;

  return (
    <div className="min-h-screen bg-[#FAF7F2] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Floating Actions (hidden in print) */}
        <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-[#E8E2DA] print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#71382D]" />
            <span className="text-xs font-mono font-semibold text-[#191816]">
              {invoice.invoiceNumber}
            </span>
            <span className="text-xs text-[#7A7267]">·</span>
            <span className="text-xs text-[#7A7267] capitalize">
              {invoice.invoiceType.replace('_', ' ')}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            {canPayOnline && (
              <Button
                onClick={handlePayOnline}
                disabled={paying}
                className="min-h-11 w-full sm:w-auto bg-[#2E6B4F] hover:bg-[#255740] text-white text-sm flex items-center justify-center gap-1.5"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting Paystack...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay {formatNaira(balanceMinorUnits)} Online</span>
                  </>
                )}
              </Button>
            )}

            {canPayByTransfer && (
              <div className="w-full sm:w-auto text-xs text-[#71382D] px-3.5 py-2.5 rounded-lg bg-[#FAF7F2] border border-[#E5D4BC]">
                Bank transfer is available below. Selecting it does not mark this invoice paid.
              </div>
            )}

            {onlinePaymentUnavailable && (
              <div className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#FAF7F2] border border-[#E5D4BC] text-xs text-[#71382D]">
                <AlertCircle className="w-4 h-4 text-[#B85C3E] shrink-0" />
                <span>Online payment is currently unavailable. Contact the property to arrange settlement.</span>
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="min-h-11 w-full sm:w-auto text-sm border-[#E8E2DA] hover:bg-stone-50 text-[#191816]"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Payment Success Banner */}
        {isPaid && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-900 print:hidden">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs">
              <strong className="block font-medium">Payment Verified Successfully!</strong>
              <span>Your payment has been received and credited to this folio statement.</span>
            </div>
          </div>
        )}
        {isPaymentConfirming && !isPaid && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-900 print:hidden">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
            <div className="text-xs">
              <strong className="block font-medium">Payment confirmation in progress</strong>
              <span>We will mark this invoice paid only after Paystack verifies the transaction.</span>
            </div>
          </div>
        )}

        <div className="bg-white">
          <BrandedInvoiceDocument
            invoice={invoice}
            property={{
              name: property?.name || '',
              address: property?.address || '',
              phone: property?.phone || '',
              email: property?.email || '',
              logoUrl: property?.logoUrl || null,
            }}
            reservation={reservation}
            payments={payments}
            labels={englishInvoiceDocumentLabels}
          />
        </div>

          {canPayByTransfer && (
            <div className="pt-4 border-t border-[#E8E2DA] space-y-3 print:hidden">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#7A7267] font-bold">Pay by bank transfer</h3>
              {(bankAccounts.length > 0 ? bankAccounts : invoice.bankDetails ? [invoice.bankDetails] : []).map((account: any, index: number) => (
                <div key={`${account.accountNumber}-${index}`} className="rounded-lg border border-[#E8E2DA] p-4 text-xs space-y-1">
                  <p><span className="text-[#7A7267]">Bank:</span> {account.bankName}</p>
                  <p><span className="text-[#7A7267]">Account name:</span> {account.accountName}</p>
                  <p><span className="text-[#7A7267]">Account number:</span> {account.accountNumber}</p>
                  <p><span className="text-[#7A7267]">Currency:</span> {account.currency || invoice.currency}</p>
                  <p><span className="text-[#7A7267]">Reference:</span> {reservation?.reference || invoice.invoiceNumber}</p>
                  <p><span className="text-[#7A7267]">Amount due:</span> {formatNaira(balanceMinorUnits)}</p>
                </div>
              ))}
              {transferProofStatus === 'pending' && <p className="text-xs text-amber-800">Transfer proof is pending hotel verification. This invoice is not paid yet.</p>}
              {transferProofStatus === 'rejected' && <p className="text-xs text-red-700">The previous proof was not accepted. Upload a corrected proof.</p>}
              {transferProofStatus !== 'pending' && (
                <form
                  className="space-y-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const file = (form.elements.namedItem('proof') as HTMLInputElement)?.files?.[0];
                    if (!file) {
                      setProofError('Upload a transfer screenshot or PDF.');
                      return;
                    }
                    setProofSubmitting(true);
                    setProofError('');
                    try {
                      const body = new FormData();
                      body.append('amountMinorUnits', String(balanceMinorUnits));
                      body.append('payerName', invoice.recipientName);
                      body.append('transferReference', (form.elements.namedItem('transferReference') as HTMLInputElement)?.value || '');
                      body.append('file', file);
                      const res = await fetch(`/api/invoices/public/${invoiceNumber}/transfer-proof`, { method: 'POST', body });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Could not submit proof.');
                      setTransferProofStatus('pending');
                    } catch (err: any) {
                      setProofError(err.message || 'Could not submit proof.');
                    } finally {
                      setProofSubmitting(false);
                    }
                  }}
                >
                  <label className="block text-xs">Transfer reference
                    <input name="transferReference" className="mt-1 w-full min-h-11 border border-[#E8E2DA] rounded px-3" />
                  </label>
                  <label className="block text-xs">Upload proof of transfer
                    <input name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block w-full text-xs" />
                  </label>
                  {proofError && <p className="text-xs text-red-700" role="alert">{proofError}</p>}
                  <Button type="submit" disabled={proofSubmitting} className="min-h-11 w-full sm:w-auto">{proofSubmitting ? 'Submitting…' : 'Submit proof for verification'}</Button>
                </form>
              )}
            </div>
          )}

      </div>
    </div>
  );
}
