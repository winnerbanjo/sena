'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
import { Badge, Button } from '@sena/ui';
import {
  X,
  Printer,
  Mail,
  CreditCard,
  Copy,
  Check,
  Building2,
  Calendar,
  AlertCircle,
  Loader2,
  FileCheck2,
} from 'lucide-react';

export interface PropertyInvoice {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  status: string;
  recipientName: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;
  companyTin?: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalMinorUnits: number;
  taxVatMinorUnits: number;
  taxConsumptionMinorUnits: number;
  serviceChargeMinorUnits: number;
  discountMinorUnits: number;
  totalAmountMinorUnits: number;
  paidAmountMinorUnits: number;
  items: Array<{
    id: string;
    description: string;
    category: string;
    quantity: number;
    unitPriceMinorUnits: number;
    totalMinorUnits: number;
  }>;
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    sortCode?: string;
  } | null;
  paymentTerms?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface InvoiceViewModalProps {
  invoice: PropertyInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  propertyName?: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  onPaymentSuccess?: () => void;
}

export function InvoiceViewModal({
  invoice,
  isOpen,
  onClose,
  propertyName = 'Sena Grand Hotel',
  propertyAddress = 'Victoria Island, Lagos, Nigeria',
  propertyPhone = '+234 1 234 5678',
  propertyEmail = 'reservations@sena.ng',
  onPaymentSuccess,
}: InvoiceViewModalProps) {
  const [recordPaymentOpen, setRecordPaymentOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState('');
  const [payMethod, setPayMethod] = React.useState<'pos' | 'cash' | 'bank_transfer' | 'card'>('pos');
  const [payRef, setPayRef] = React.useState('');
  const [payNotes, setPayNotes] = React.useState('');
  const [submittingPay, setSubmittingPay] = React.useState(false);

  const [sendingEmail, setSendingEmail] = React.useState(false);
  const [emailStatus, setEmailStatus] = React.useState<{ success: boolean; message: string } | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);

  if (!isOpen || !invoice) return null;

  const balanceMinorUnits = Math.max(0, invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits);
  const isPaid = invoice.status === 'paid' || balanceMinorUnits === 0;

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    setSubmittingPay(true);
    try {
      const amountKobo = Math.round(Number(payAmount) * 100);
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountMinorUnits: amountKobo,
          method: payMethod,
          providerReference: payRef.trim() || undefined,
          notes: payNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');
      
      setRecordPaymentOpen(false);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      onPaymentSuccess?.();
    } catch (err: any) {
      alert(err.message || 'Payment recording failed');
    } finally {
      setSubmittingPay(false);
    }
  }

  async function handleSendEmail() {
    if (!invoice) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invoice email');
      setEmailStatus({
        success: true,
        message: `Official invoice dispatched to ${invoice.recipientEmail || 'recipient'}!`,
      });
    } catch (err: any) {
      setEmailStatus({
        success: false,
        message: err.message || 'Error delivering email',
      });
    } finally {
      setSendingEmail(false);
    }
  }

  function handleCopyPayLink() {
    if (!invoice) return;
    const url = `${window.location.origin}/invoice/${invoice.invoiceNumber}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-[#E8E2DA] my-auto overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Top Action Bar (hidden in print) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-[#FAF7F2] border-b border-[#E8E2DA] print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-[#71382D] tracking-wider">
              {invoice.invoiceNumber}
            </span>
            <span className="text-xs text-[#7A7267]">·</span>
            <span className="text-xs text-[#7A7267] capitalize">
              {invoice.invoiceType.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyPayLink}
              className="text-xs bg-white hover:bg-stone-50 border-[#E8E2DA] text-[#191816]"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copiedLink ? 'Link Copied' : 'Share Link'}
            </Button>

            {invoice.recipientEmail && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="text-xs bg-white hover:bg-stone-50 border-[#E8E2DA] text-[#191816]"
              >
                {sendingEmail ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                Send to Email
              </Button>
            )}

            {!isPaid && (
              <Button
                size="sm"
                onClick={() => {
                  setPayAmount((balanceMinorUnits / 100).toString());
                  setRecordPaymentOpen(true);
                }}
                className="text-xs bg-[#2E6B4F] hover:bg-[#255740] text-white"
              >
                <CreditCard className="w-3.5 h-3.5 mr-1" />
                Record Payment
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="text-xs bg-white hover:bg-stone-50 border-[#E8E2DA] text-[#191816]"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print / PDF
            </Button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#7A7267] hover:text-[#191816] hover:bg-stone-200/50 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Email Toast Banner */}
        {emailStatus && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              emailStatus.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <span>{emailStatus.message}</span>
            <button onClick={() => setEmailStatus(null)} className="text-current hover:opacity-75">
              ×
            </button>
          </div>
        )}

        {/* Printable Folio Document Area */}
        <div id="printable-folio" className="p-6 sm:p-10 overflow-y-auto bg-white flex-1 space-y-8 text-[#191816]">
          {/* Header & Watermark Stamp */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-[#E8E2DA] relative">
            <div>
              <span className="text-[11px] font-mono tracking-widest text-[#B85C3E] uppercase font-bold block mb-1">
                Official Hotel Folio & Tax Invoice
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#191816] tracking-tight">
                {propertyName}
              </h1>
              <p className="text-xs text-[#7A7267] mt-1 max-w-sm leading-relaxed">
                {propertyAddress}
                <br />
                Tel: {propertyPhone} · Email: {propertyEmail}
              </p>
            </div>

            <div className="flex flex-col sm:items-end">
              {/* Visual Stamp */}
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

              <div className="text-xs font-mono space-y-0.5 text-right">
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
                Billed To / Guest Details
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
                Tax & Corporate Information
              </span>
              <div className="text-xs space-y-1 text-[#191816]">
                {invoice.companyTin ? (
                  <div>
                    <span className="text-[#7A7267]">Corporate TIN: </span>
                    <strong className="font-mono text-emerald-800">{invoice.companyTin}</strong>
                  </div>
                ) : (
                  <div className="text-[#7A7267]">Individual / Non-Corporate Billing</div>
                )}
                <div>
                  <span className="text-[#7A7267]">Payment Terms: </span>
                  <span>{invoice.paymentTerms || 'Due on Receipt'}</span>
                </div>
                <div>
                  <span className="text-[#7A7267]">Invoice Type: </span>
                  <span className="capitalize">{invoice.invoiceType.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Charges Table */}
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

          {/* Totals & Tax Computation */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-8 pt-2">
            {/* Bank Transfer Instructions */}
            <div className="w-full sm:max-w-xs p-4 rounded-lg bg-[#FAF7F2] border border-[#E8E2DA] text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-[#71382D] font-serif font-bold text-sm">
                <Building2 className="w-4 h-4" />
                <span>Hotel Bank Settlement</span>
              </div>
              <p className="text-[11px] text-[#7A7267]">
                Please reference <strong className="font-mono text-[#191816]">{invoice.invoiceNumber}</strong> on bank transfers.
              </p>
              <div className="pt-2 border-t border-[#E8E2DA] space-y-1 font-mono text-[11px]">
                <div>
                  <span className="text-[#7A7267]">Bank: </span>
                  <strong className="text-[#191816]">{invoice.bankDetails?.bankName || 'Access Bank PLC'}</strong>
                </div>
                <div>
                  <span className="text-[#7A7267]">Account Name: </span>
                  <span className="text-[#191816]">{invoice.bankDetails?.accountName || `${propertyName} Operations`}</span>
                </div>
                <div>
                  <span className="text-[#7A7267]">Account No: </span>
                  <strong className="text-emerald-800 text-xs font-bold tracking-wider">
                    {invoice.bankDetails?.accountNumber || '0123456789'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Subtotal, VAT, Consumption, Service Charge, Total */}
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

          {/* Notes & Terms */}
          {invoice.notes && (
            <div className="pt-4 border-t border-[#E8E2DA] text-xs text-[#7A7267]">
              <span className="font-medium text-[#191816] block mb-0.5">Special Notes & Remarks:</span>
              <p className="whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
            </div>
          )}

          {/* Signoff & Regulatory Footer */}
          <div className="pt-6 border-t border-[#E8E2DA] flex flex-col sm:flex-row items-center justify-between text-[10px] text-[#7A7267] font-mono gap-2">
            <span>Generated electronically by Sena Hospitality PMS · sena.ng</span>
            <span>All guest folios are subject to hotel audit and local hospitality regulations.</span>
          </div>
        </div>

        {/* Record Payment Submodal */}
        {recordPaymentOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl border border-[#E8E2DA] w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E2DA]">
                <h3 className="font-serif text-lg font-medium text-[#191816]">
                  Record Settlement Payment
                </h3>
                <button onClick={() => setRecordPaymentOpen(false)} className="text-[#7A7267] hover:text-[#191816]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#7A7267] font-medium mb-1">Amount (NGN)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-sm text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                  <span className="text-[10px] text-[#7A7267] mt-1 block">
                    Outstanding balance: {formatNaira(balanceMinorUnits)}
                  </span>
                </div>

                <div>
                  <label className="block text-[#7A7267] font-medium mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  >
                    <option value="pos">POS Terminal (Card)</option>
                    <option value="bank_transfer">Direct Bank Transfer</option>
                    <option value="cash">Cash Settlement</option>
                    <option value="card">Online Card (Paystack)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#7A7267] font-medium mb-1">Transaction / POS Reference</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="e.g. POS-9842 or Transfer Ref"
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div>
                  <label className="block text-[#7A7267] font-medium mb-1">Settlement Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="e.g. Paid at checkout counter"
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8E2DA]">
                  <button
                    type="button"
                    onClick={() => setRecordPaymentOpen(false)}
                    className="px-4 py-2 rounded border border-[#E8E2DA] bg-white text-xs font-medium text-[#191816] hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    disabled={submittingPay}
                    className="bg-[#2E6B4F] hover:bg-[#255740] text-white text-xs"
                  >
                    {submittingPay ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      'Confirm Payment'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
