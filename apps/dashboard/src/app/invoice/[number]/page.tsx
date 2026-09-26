'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { formatNaira } from '@sena/config';
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
  const isPaymentSuccess = searchParams.get('payment') === 'success';

  const [invoice, setInvoice] = React.useState<PropertyInvoice | null>(null);
  const [property, setProperty] = React.useState<any>(null);
  const [reservation, setReservation] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [paying, setPaying] = React.useState(false);

  React.useEffect(() => {
    if (!invoiceNumber) return;
    fetch(`/api/invoices/public/${invoiceNumber}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invoice not found');
        return res.json();
      })
      .then((data) => {
        setInvoice(data.invoice);
        setProperty(data.property);
        setReservation(data.reservation);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [invoiceNumber]);

  async function handlePayOnline() {
    if (!invoice) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/invoices/public/${invoice.id}/checkout`, {
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
            The invoice reference &quot;{invoiceNumber}&quot; does not exist or has been archived.
          </p>
        </div>
      </div>
    );
  }

  const balanceMinorUnits = Math.max(0, invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits);
  const isPaid = invoice.status === 'paid' || balanceMinorUnits === 0;

  return (
    <div className="min-h-screen bg-[#FAF7F2] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Floating Actions (hidden in print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#E8E2DA] shadow-sm print:hidden">
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

          <div className="flex items-center gap-2.5 flex-wrap">
            {!isPaid && (
              <Button
                onClick={handlePayOnline}
                disabled={paying}
                className="bg-[#2E6B4F] hover:bg-[#255740] text-white text-xs flex items-center gap-1.5"
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

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="text-xs border-[#E8E2DA] hover:bg-stone-50 text-[#191816]"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Payment Success Banner */}
        {isPaymentSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-900 print:hidden">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs">
              <strong className="block font-medium">Payment Verified Successfully!</strong>
              <span>Your payment has been received and credited to this folio statement.</span>
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
                {isPaid ? 'PAID IN FULL' : invoice.status === 'overdue' ? 'OVERDUE' : 'PAYMENT DUE'}
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
            <div className="w-full sm:max-w-xs p-4 rounded-lg bg-[#FAF7F2] border border-[#E8E2DA] text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-[#71382D] font-serif font-bold text-sm">
                <Building2 className="w-4 h-4" />
                <span>Hotel Bank Settlement</span>
              </div>
              <p className="text-[11px] text-[#7A7267]">
                Please quote <strong className="font-mono text-[#191816]">{invoice.invoiceNumber}</strong> on bank wires.
              </p>
              <div className="pt-2 border-t border-[#E8E2DA] space-y-1 font-mono text-[11px]">
                <div>
                  <span className="text-[#7A7267]">Bank: </span>
                  <strong className="text-[#191816]">{invoice.bankDetails?.bankName || 'Not provided'}</strong>
                </div>
                <div>
                  <span className="text-[#7A7267]">Account Name: </span>
                  <span className="text-[#191816]">{invoice.bankDetails?.accountName || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-[#7A7267]">Account No: </span>
                  <strong className="text-emerald-800 text-xs font-bold tracking-wider">
                    {invoice.bankDetails?.accountNumber || 'Contact the property for payment details'}
                  </strong>
                </div>
              </div>
            </div>

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
