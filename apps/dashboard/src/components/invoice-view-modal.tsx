'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
import { useTranslations } from 'next-intl';
import { manualPaymentBody } from '@/lib/payment-receipt-file';
import { PaymentReceiptField, usePaymentReceipt } from './payment-receipt-field';
import { useDialogA11y } from './use-dialog-a11y';
import { Button } from '@sena/ui';
import {
  X,
  Printer,
  Mail,
  CreditCard,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import { BrandedInvoiceDocument, type InvoiceDocumentLabels } from './branded-invoice-document';
import { InvoiceEditForm, type InvoiceEditLabels } from './invoice-edit-form';
import type { InvoiceDocumentPayment, InvoiceDocumentProperty, InvoiceDocumentReservation } from '@/lib/invoice-document';
import type { PropertyInvoice } from './invoice-types';

export type { PropertyInvoice } from './invoice-types';

interface InvoiceViewModalProps {
  invoice: PropertyInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  propertyName?: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  onPaymentSuccess?: () => void;
  onUpdated?: (invoice: PropertyInvoice) => void;
}

export function InvoiceViewModal({
  invoice,
  isOpen,
  onClose,
  propertyName = '',
  propertyAddress = '',
  propertyPhone = '',
  propertyEmail = '',
  onPaymentSuccess,
  onUpdated,
}: InvoiceViewModalProps) {
  const [recordPaymentOpen, setRecordPaymentOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState('');
  const [payMethod, setPayMethod] = React.useState<'pos' | 'cash' | 'bank_transfer' | 'card'>('pos');
  const [payRef, setPayRef] = React.useState('');
  const [payNotes, setPayNotes] = React.useState('');
  const paymentRequestKey = React.useRef<string | null>(null);
  const t = useTranslations('invoices');
  const receipt = usePaymentReceipt({ invalid: t('receiptInvalid'), tooLarge: t('receiptTooLarge') });
  const [submittingPay, setSubmittingPay] = React.useState(false);

  const [sendingEmail, setSendingEmail] = React.useState(false);
  const [emailStatus, setEmailStatus] = React.useState<{ success: boolean; message: string } | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [shareMessage, setShareMessage] = React.useState('');
  const dialogRef = useDialogA11y(isOpen && Boolean(invoice), onClose);
  const [zohoSync, setZohoSync] = React.useState<{
    status: string;
    invoiceUrl: string | null;
  } | null>(null);
  const [zohoBusy, setZohoBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [documentProperty, setDocumentProperty] = React.useState<InvoiceDocumentProperty | null>(null);
  const [documentReservation, setDocumentReservation] = React.useState<InvoiceDocumentReservation | null>(null);
  const [documentPayments, setDocumentPayments] = React.useState<InvoiceDocumentPayment[]>([]);

  React.useEffect(() => {
    setEditing(false);
    if (!isOpen || !invoice?.id) {
      setDocumentProperty(null);
      setDocumentReservation(null);
      setDocumentPayments([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/invoices/${invoice.id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.document) return;
        setDocumentProperty(data.document.property || null);
        setDocumentReservation(data.document.reservation || null);
        setDocumentPayments(Array.isArray(data.document.payments) ? data.document.payments : []);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [isOpen, invoice?.id, invoice?.totalAmountMinorUnits, invoice?.paidAmountMinorUnits, invoice?.recipientName]);

  React.useEffect(() => {
    if (!isOpen || !invoice?.id) {
      setZohoSync(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/apps/zoho_invoice/manage?invoiceId=${encodeURIComponent(invoice.id)}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({}));
        if (cancelled || !payload.sync) return;
        if (payload.sync.status === 'not_connected') {
          setZohoSync(null);
          return;
        }
        setZohoSync({ status: payload.sync.status, invoiceUrl: payload.sync.invoiceUrl || null });
      } catch {
        /* Zoho status is optional UI chrome */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, invoice?.id]);

  async function retryZohoSync() {
    if (!invoice?.id) return;
    setZohoBusy(true);
    try {
      const response = await fetch('/api/apps/zoho_invoice/manage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'retry_invoice', invoiceId: invoice.id }),
        cache: 'no-store',
      });
      if (response.ok) setZohoSync({ status: 'syncing', invoiceUrl: null });
    } finally {
      setZohoBusy(false);
    }
  }

  if (!isOpen || !invoice) return null;

  const balanceMinorUnits = Math.max(0, invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits);
  const isPaid = invoice.status === 'paid' || balanceMinorUnits === 0;

  const documentLabels: InvoiceDocumentLabels = {
    documentTitle: t('documentTitle'),
    billTo: t('billTo'),
    issueDate: t('issueDate'),
    dueDate: t('dueDate'),
    status: t('status'),
    description: t('description'),
    quantity: t('quantity'),
    rate: t('rate'),
    amount: t('amount'),
    subtotal: t('subtotal'),
    discount: t('discount'),
    vat: t('vat'),
    consumptionTax: t('consumptionTax'),
    serviceCharge: t('serviceCharge'),
    total: t('total'),
    amountPaid: t('amountPaid'),
    balanceDue: t('balanceDue'),
    invoiceNotes: t('invoiceNotes'),
    paymentTerms: t('paymentTerms'),
    poweredBy: t('poweredBy'),
    reservation: t('reservation'),
    guest: t('guest'),
    accommodation: t('accommodation'),
    checkIn: t('checkIn'),
    checkOut: t('checkOut'),
    reference: t('reference'),
    paymentHistory: t('paymentHistory'),
    paymentDate: t('paymentDate'),
    paymentMethod: t('paymentMethod'),
    paymentReference: t('paymentReference'),
    viewReceipt: t('viewReceipt'),
    downloadReceipt: t('downloadReceipt'),
    bankTransfer: t('bankTransfer'),
    bank: t('bank'),
    accountName: t('accountName'),
    accountNumber: t('accountNumber'),
    statusDraft: t('statusDraft'),
    statusIssued: t('statusIssued'),
    statusPartiallyPaid: t('statusPartiallyPaid'),
    statusPaid: t('statusPaid'),
    statusOverdue: t('statusOverdue'),
    statusVoid: t('statusVoid'),
  };
  const editLabels: InvoiceEditLabels = {
    editTitle: t('editTitle'),
    saveChanges: t('saveChanges'),
    cancel: t('cancelEdit'),
    financialLock: t('financialLock'),
    belowPaid: t('belowPaid'),
    closedInvoice: t('closedInvoice'),
    customerName: t('customerName'),
    email: t('email'),
    phone: t('phone'),
    address: t('address'),
    tin: t('tin'),
    issueDate: t('issueDate'),
    dueDate: t('dueDate'),
    lineItems: t('lineItems'),
    description: t('description'),
    quantity: t('quantity'),
    rate: t('rate'),
    addLine: t('addLine'),
    removeLine: t('removeLine'),
    discount: t('discount'),
    applyVat: t('applyVat'),
    applyConsumption: t('applyConsumption'),
    applyService: t('applyService'),
    invoiceNotes: t('invoiceNotes'),
    paymentTerms: t('paymentTerms'),
    bank: t('bank'),
    accountName: t('accountName'),
    accountNumber: t('accountNumber'),
  };


  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice || submittingPay) return;
    if (!paymentRequestKey.current) paymentRequestKey.current = crypto.randomUUID();
    setSubmittingPay(true);
    try {
      const amountKobo = Math.round(Number(payAmount) * 100);
      const request = manualPaymentBody({
        amountMinorUnits: amountKobo,
        method: payMethod,
        providerReference: payRef.trim() || undefined,
        notes: payNotes.trim() || undefined,
      }, receipt.file);
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { ...request.headers, 'Idempotency-Key': paymentRequestKey.current! },
        body: request.body,
      });
      let data: { error?: string; code?: string; paymentRecorded?: boolean; receiptError?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) {
        if (data?.code === 'receipt_type') throw new Error(t('receiptInvalid'));
        if (data?.code === 'receipt_size') throw new Error(t('receiptTooLarge'));
        if (data?.paymentRecorded === false) {
          throw new Error(data.error || 'This payment could not be recorded. No payment was added. Please try again.');
        }
        if (data?.error) throw new Error(data.error);
        throw new Error('We could not confirm this payment. Refresh this invoice before trying again.');
      }
      if (data?.receiptError) window.alert(t('receiptUploadFailed'));
      
      paymentRequestKey.current = null;
      receipt.clear();
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
        success: Boolean(data.emailSent),
        message: data.message || `Invoice sent to ${invoice.recipientEmail || 'recipient'}.`,
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

  async function invoiceUrl() {
    if (!invoice) throw new Error('Invoice unavailable');
    if (invoice.publicToken) {
      return `${window.location.origin}/invoice/${invoice.publicToken}`;
    }
    const response = await fetch(`/api/invoices/${invoice.id}`);
    const data = await response.json();
    if (!response.ok || !data.invoice?.publicToken) throw new Error('Could not create invoice link. Try again.');
    return `${window.location.origin}/invoice/${data.invoice.publicToken}`;
  }

  async function handleCopyPayLink() {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(await invoiceUrl());
      setCopiedLink(true);
      setShareMessage('Invoice link copied.');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err: any) {
      setShareMessage(err.message || 'Could not copy link.');
      setTimeout(() => setShareMessage(''), 2500);
    }
  }

  async function handleShareInvoice() {
    if (!invoice) return;
    try {
      const url = await invoiceUrl();
      const payload = { title: `Invoice ${invoice.invoiceNumber}`, text: `${invoice.invoiceNumber} from ${propertyName}. Amount due ${formatNaira(balanceMinorUnits)}.`, url };
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share(payload);
          setShareMessage('Invoice share sheet opened.');
          return;
        } catch (error: any) {
          if (error?.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setShareMessage('Sharing is not available on this device. The invoice link was copied instead.');
    } catch (err: any) {
      setShareMessage(err.message || 'Could not share invoice.');
      setTimeout(() => setShareMessage(''), 2500);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-6 bg-black/60 overflow-y-auto">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="invoice-dialog-title" className="relative w-full max-w-4xl bg-white rounded-xl border border-[#E8E2DA] my-auto overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Top Action Bar (hidden in print) */}
        <div className="flex flex-col gap-3 px-4 sm:px-6 py-3.5 bg-[#FAF7F2] border-b border-[#E8E2DA] print:hidden">
          <div className="flex items-center gap-2">
            <h2 id="invoice-dialog-title" className="text-sm font-semibold text-[#191816]">
              Invoice {invoice.invoiceNumber}
            </h2>
            <span className="text-xs text-[#7A7267]">·</span>
            <span className="text-xs text-[#7A7267] capitalize">
              {invoice.invoiceType.replace('_', ' ')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyPayLink}
              className="min-h-11 text-sm bg-white hover:bg-stone-50 border-[#E8E2DA] text-[#191816]"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copiedLink ? 'Link copied' : 'Copy invoice link'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleShareInvoice}
              className="min-h-11 text-sm bg-white hover:bg-stone-50 border-[#E8E2DA] text-[#191816]"
            >
              Share invoice
            </Button>

            {invoice.recipientEmail && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="min-h-11 text-sm bg-white hover:bg-stone-50 border-[#E8E2DA] text-[#191816]"
              >
                {sendingEmail ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                Send invoice
              </Button>
            )}

            {!isPaid && (
              <Button
                size="sm"
                onClick={() => {
                  setPayAmount((balanceMinorUnits / 100).toString());
                  setRecordPaymentOpen(true);
                }}
                className="min-h-11 text-sm bg-[#2E6B4F] hover:bg-[#255740] text-white"
              >
                <CreditCard className="w-3.5 h-3.5 mr-1" />
                Record Payment
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
              className="min-h-11 text-sm bg-white hover:bg-stone-50 border-[#E8E2DA] text-[#191816]"
            >
              <Pencil className="w-3.5 h-3.5 mr-1" />
              {t('edit')}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="min-h-11 text-sm bg-white hover:bg-stone-50 border-[#E8E2DA] text-[#191816]"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print
            </Button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice"
              className="min-h-11 min-w-11 rounded-lg text-[#7A7267] hover:text-[#191816] hover:bg-stone-200/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {zohoSync ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E2DA] bg-[#FAF7F2] px-4 py-2 text-xs text-[#7A7267] sm:px-6">
              <span>
                {zohoSync.status === 'synced'
                  ? 'Synced to Zoho Invoice'
                  : zohoSync.status === 'syncing'
                    ? 'Syncing to Zoho Invoice…'
                    : zohoSync.status === 'failed'
                      ? 'Zoho sync failed'
                      : 'Not synced to Zoho'}
              </span>
              <span className="flex items-center gap-2">
                {zohoSync.status === 'synced' && zohoSync.invoiceUrl ? (
                  <a
                    href={zohoSync.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center gap-1 font-medium text-[#71382D]"
                  >
                    Open in Zoho
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
                {zohoSync.status === 'failed' ? (
                  <button
                    type="button"
                    disabled={zohoBusy}
                    onClick={() => void retryZohoSync()}
                    className="min-h-9 rounded-md border border-[#E8E2DA] bg-white px-2.5 font-medium text-[#71382D] disabled:opacity-60"
                  >
                    Retry
                  </button>
                ) : null}
              </span>
            </div>
          ) : null}
        </div>

        {/* Email Toast Banner */}
        {(emailStatus || shareMessage) && (
          <div
            role="status"
            className={`px-4 sm:px-6 py-2.5 text-sm flex items-center justify-between gap-3 border-b ${
              emailStatus && !emailStatus.success
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            <span>{emailStatus?.message || shareMessage}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => { setEmailStatus(null); setShareMessage(''); }} className="min-h-11 min-w-11 text-current">
              ×
            </button>
          </div>
        )}

        <div className="overflow-y-auto bg-white flex-1">
          {editing ? (
            <InvoiceEditForm
              invoice={invoice}
              labels={editLabels}
              onCancel={() => setEditing(false)}
              onSaved={(next) => {
                setEditing(false);
                onUpdated?.(next);
                onPaymentSuccess?.();
              }}
            />
          ) : (
            <BrandedInvoiceDocument
              invoice={invoice}
              property={documentProperty || {
                name: propertyName,
                address: propertyAddress,
                phone: propertyPhone,
                email: propertyEmail,
                logoUrl: null,
              }}
              reservation={documentReservation}
              payments={documentPayments}
              showReceiptLinks
              labels={documentLabels}
            />
          )}
        </div>

        {/* Record Payment Submodal */}
        {recordPaymentOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl border border-[#E8E2DA] w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E2DA]">
                <h3 className="text-lg font-medium text-[#191816]">
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

                <PaymentReceiptField
                  id="settlement-receipt"
                  appearance="invoice"
                  copy={{
                    label: t('receiptLabel'),
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
