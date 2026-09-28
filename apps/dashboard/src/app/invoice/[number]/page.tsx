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
  Building2,
  Calendar,
  CreditCard,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import type { PropertyInvoice } from '../../../components/invoice-view-modal';

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

        {/* Printable Official Folio Document */}
        <div className="bg-white rounded-xl border border-[#E8E2DA] shadow-sm p-6 sm:p-10 space-y-8 text-[#191816]">
          {/* Header & Watermark */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-[#E8E2DA]">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[#B85C3E] uppercase font-bold block mb-1">
                Official Hotel Folio &amp; Tax Invoice
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#191816]">
                {property?.name || 'Sena Grand Hotel'}
              </h1>
              <p className="text-xs text-[#7A7267] mt-1 max-w-sm leading-relaxed">
                {property?.address || 'Victoria Island, Lagos, Nigeria'}
                <br />
                Tel: {property?.phone || '+234 1 234 5678'} · Email: {property?.email || 'reservations@sena.ng'}
              </p>
            </div>

            <div className="flex flex-col sm:items-end">
              <div
                className={`inline-block px-4 py-1.5 rounded border text-xs font-mono font-bold tracking-widest uppercase mb-3 ${
                  isPaid
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60 ring-2 ring-emerald-600/20'
                    : invoice.status === 'overdue'
                    ? 'border-red-600 text-red-700 bg-red-50/60 ring-2 ring-red-600/20'
                    : 'border-[#B85C3E] text-[#B85C3E] bg-[#B85C3E]/10 ring-2 ring-[#B85C3E]/20'
                }`}
              >
                {unavailable ? invoice.status.toUpperCase() : isPaid ? 'PAID IN FULL' : invoice.status === 'overdue' ? 'OVERDUE' : 'PAYMENT DUE'}
              </div>

              <div className="text-xs font-mono space-y-0.5 sm:text-right">
                <div>
                  <span className="text-[#7A7267]">Invoice Ref: </span>
                  <strong className="text-[#191816]">{invoice.invoiceNumber}</strong>
                </div>
                <div>
                  <span className="text-[#7A7267]">Issue Date: </span>
                  <span className="text-[#191816]">{invoice.issueDate}</span>
                </div>
                <div>
                  <span className="text-[#7A7267]">Due Date: </span>
                  <span className="text-[#191816] font-medium">{invoice.dueDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Billed To / Recipient Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-[#FAF7F2] p-5 rounded-lg border border-[#E8E2DA]">
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-[#7A7267] font-semibold block mb-1">
                Billed To
              </span>
              <strong className="text-base font-serif text-[#191816] block">
                {invoice.recipientName}
              </strong>
              {invoice.recipientAddress && (
                <p className="text-xs text-[#7A7267] mt-0.5">{invoice.recipientAddress}</p>
              )}
              <div className="text-xs text-[#7A7267] mt-2 space-y-0.5">
                {invoice.recipientEmail && <div>Email: {invoice.recipientEmail}</div>}
                {invoice.recipientPhone && <div>Phone: {invoice.recipientPhone}</div>}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-[#7A7267] font-semibold block mb-1">
                Billing Context
              </span>
              <div className="text-xs space-y-1 text-[#191816]">
                {invoice.companyTin ? (
                  <div>
                    <span className="text-[#7A7267]">Corporate TIN: </span>
                    <strong className="font-mono text-emerald-800">{invoice.companyTin}</strong>
                  </div>
                ) : (
                  <div className="text-[#7A7267]">Individual / Non-Corporate Folio</div>
                )}
                <div>
                  <span className="text-[#7A7267]">Payment Terms: </span>
                  <span>{invoice.paymentTerms || 'Due on Receipt'}</span>
                </div>
                {reservation && (
                  <div>
                    <span className="text-[#7A7267]">Stay Period: </span>
                    <span>{reservation.checkInDate} to {reservation.checkOutDate} ({reservation.nights} nights)</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#7A7267] font-bold mb-2">
              Itemized Folio Breakdown
            </h3>
            <div className="border border-[#E8E2DA] rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] text-[#7A7267] border-b border-[#E8E2DA] font-mono uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 font-semibold">Description</th>
                    <th className="py-2.5 px-4 font-semibold">Category</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Qty</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Unit Rate</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Amount (NGN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2DA]">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/50">
                      <td className="py-3 px-4 font-medium text-[#191816]">{item.description}</td>
                      <td className="py-3 px-4 capitalize text-[#7A7267]">
                        <span className="inline-block px-2 py-0.5 rounded bg-stone-100 text-[10px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-[#7A7267]">{item.quantity}</td>
                      <td className="py-3 px-4 text-right font-mono text-[#7A7267]">
                        {formatNaira(item.unitPriceMinorUnits)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-[#191816]">
                        {formatNaira(item.totalMinorUnits)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Bank Details */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-8 pt-2">
            {invoice.bankDetails?.accountNumber ? (
            <div className="w-full sm:max-w-xs p-4 rounded-lg bg-[#FAF7F2] border border-[#E8E2DA] text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-[#71382D] font-serif font-bold text-sm">
                <Building2 className="w-4 h-4" />
                <span>Pay by bank transfer</span>
              </div>
              <p className="text-[11px] text-[#7A7267]">
                Please quote <strong className="font-mono text-[#191816]">{invoice.invoiceNumber}</strong> on bank transfers.
              </p>
              <div className="pt-2 border-t border-[#E8E2DA] space-y-1 font-mono text-[11px]">
                <div>
                  <span className="text-[#7A7267]">Bank: </span>
                  <strong className="text-[#191816]">{invoice.bankDetails.bankName}</strong>
                </div>
                <div>
                  <span className="text-[#7A7267]">Account Name: </span>
                  <span className="text-[#191816]">{invoice.bankDetails.accountName}</span>
                </div>
                <div>
                  <span className="text-[#7A7267]">Account No: </span>
                  <strong className="text-emerald-800 text-xs font-bold tracking-wider">
                    {invoice.bankDetails.accountNumber}
                  </strong>
                </div>
                {invoice.bankDetails.currency && (
                  <div>
                    <span className="text-[#7A7267]">Currency: </span>
                    <span className="text-[#191816]">{invoice.bankDetails.currency}</span>
                  </div>
                )}
              </div>
            </div>
            ) : (
              <div className="w-full sm:max-w-xs" />
            )}

            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#E8E2DA] text-[#7A7267]">
                <span>Subtotal:</span>
                <span className="font-mono text-[#191816]">{formatNaira(invoice.subtotalMinorUnits)}</span>
              </div>

              {invoice.taxVatMinorUnits > 0 && (
                <div className="flex justify-between py-1 border-b border-[#E8E2DA] text-[#7A7267]">
                  <span>VAT (7.5%):</span>
                  <span className="font-mono text-[#191816]">{formatNaira(invoice.taxVatMinorUnits)}</span>
                </div>
              )}

              {invoice.taxConsumptionMinorUnits > 0 && (
                <div className="flex justify-between py-1 border-b border-[#E8E2DA] text-[#7A7267]">
                  <span>Consumption Tax (5%):</span>
                  <span className="font-mono text-[#191816]">{formatNaira(invoice.taxConsumptionMinorUnits)}</span>
                </div>
              )}

              {invoice.serviceChargeMinorUnits > 0 && (
                <div className="flex justify-between py-1 border-b border-[#E8E2DA] text-[#7A7267]">
                  <span>Service Charge (10%):</span>
                  <span className="font-mono text-[#191816]">{formatNaira(invoice.serviceChargeMinorUnits)}</span>
                </div>
              )}

              {invoice.discountMinorUnits > 0 && (
                <div className="flex justify-between py-1 border-b border-[#E8E2DA] text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-mono">-{formatNaira(invoice.discountMinorUnits)}</span>
                </div>
              )}

              <div className="flex justify-between py-2 border-b-2 border-[#191816] text-sm font-serif font-bold text-[#191816]">
                <span>Total Amount:</span>
                <span className="font-mono">{formatNaira(invoice.totalAmountMinorUnits)}</span>
              </div>

              <div className="flex justify-between py-1 text-xs text-emerald-700 font-medium">
                <span>Paid to Date:</span>
                <span className="font-mono">-{formatNaira(invoice.paidAmountMinorUnits)}</span>
              </div>

              <div className="flex justify-between py-2 bg-[#FAF7F2] px-3 rounded border border-[#E8E2DA] text-xs font-bold">
                <span className={balanceMinorUnits > 0 ? 'text-[#B85C3E]' : 'text-emerald-700'}>
                  Balance Due:
                </span>
                <span className="font-mono text-sm text-[#191816]">
                  {formatNaira(balanceMinorUnits)}
                </span>
              </div>
            </div>
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

          {/* Notes */}
          {invoice.notes && (
            <div className="pt-4 border-t border-[#E8E2DA] text-xs text-[#7A7267]">
              <span className="font-medium text-[#191816] block mb-0.5">Special Remarks:</span>
              <p className="whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
            </div>
          )}

          {/* Security & Verification Footer */}
          <div className="pt-6 border-t border-[#E8E2DA] flex flex-col sm:flex-row items-center justify-between text-[10px] text-[#7A7267] font-mono gap-2">
            <div className="flex items-center gap-1.5 text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Hotel Invoice · Sena Hospitality Platform</span>
            </div>
            <span>Questions? Contact {property?.email || 'reservations@sena.ng'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
