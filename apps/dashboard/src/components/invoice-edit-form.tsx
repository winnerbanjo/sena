'use client';

import * as React from 'react';
import { fromMinorUnits, toMinorUnits } from '@sena/config';
import { BELOW_PAID, CLOSED_INVOICE, PAID_FINANCIAL_LOCK } from '@/lib/invoice-edit';
import { Button } from '@sena/ui';
import type { PropertyInvoice } from './invoice-types';

const CATEGORIES = ['room', 'fb', 'laundry', 'transport', 'service', 'other'] as const;

export interface InvoiceEditLabels {
  editTitle: string;
  saveChanges: string;
  cancel: string;
  financialLock: string;
  belowPaid: string;
  closedInvoice: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  tin: string;
  issueDate: string;
  dueDate: string;
  lineItems: string;
  description: string;
  quantity: string;
  rate: string;
  addLine: string;
  removeLine: string;
  discount: string;
  applyVat: string;
  applyConsumption: string;
  applyService: string;
  invoiceNotes: string;
  paymentTerms: string;
  bank: string;
  accountName: string;
  accountNumber: string;
}

function fieldClass() {
  return 'mt-1 w-full min-h-11 rounded border border-[#E8E2DA] px-3 text-sm text-[#191816]';
}

export function InvoiceEditForm({
  invoice,
  labels,
  onCancel,
  onSaved,
}: {
  invoice: PropertyInvoice;
  labels: InvoiceEditLabels;
  onCancel: () => void;
  onSaved: (invoice: PropertyInvoice) => void;
}) {
  const balance = Math.max(0, invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits);
  const financiallyPaid = invoice.status === 'paid' || (invoice.paidAmountMinorUnits > 0 && balance === 0);
  const closed = invoice.status === 'void' || invoice.status === 'cancelled';
  const [recipientName, setRecipientName] = React.useState(invoice.recipientName);
  const [recipientEmail, setRecipientEmail] = React.useState(invoice.recipientEmail || '');
  const [recipientPhone, setRecipientPhone] = React.useState(invoice.recipientPhone || '');
  const [recipientAddress, setRecipientAddress] = React.useState(invoice.recipientAddress || '');
  const [companyTin, setCompanyTin] = React.useState(invoice.companyTin || '');
  const [issueDate, setIssueDate] = React.useState(invoice.issueDate);
  const [dueDate, setDueDate] = React.useState(invoice.dueDate);
  const [paymentTerms, setPaymentTerms] = React.useState(invoice.paymentTerms || '');
  const [notes, setNotes] = React.useState(invoice.notes || '');
  const [discount, setDiscount] = React.useState(String(fromMinorUnits(invoice.discountMinorUnits)));
  const [applyVat, setApplyVat] = React.useState(invoice.taxVatMinorUnits > 0);
  const [applyConsumptionTax, setApplyConsumptionTax] = React.useState(invoice.taxConsumptionMinorUnits > 0);
  const [applyServiceCharge, setApplyServiceCharge] = React.useState(invoice.serviceChargeMinorUnits > 0);
  const [bankName, setBankName] = React.useState(invoice.bankDetails?.bankName || '');
  const [accountName, setAccountName] = React.useState(invoice.bankDetails?.accountName || '');
  const [accountNumber, setAccountNumber] = React.useState(invoice.bankDetails?.accountNumber || '');
  const [items, setItems] = React.useState(invoice.items.map((item) => ({
    id: item.id,
    description: item.description,
    category: item.category,
    quantity: String(item.quantity),
    unitPrice: String(fromMinorUnits(item.unitPriceMinorUnits)),
  })));
  const [error, setError] = React.useState(closed ? labels.closedInvoice : '');
  const [saving, setSaving] = React.useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (closed || saving) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        recipientName,
        recipientEmail,
        recipientPhone,
        recipientAddress,
        companyTin,
        issueDate,
        dueDate,
        paymentTerms,
        notes,
        bankDetails: bankName || accountName || accountNumber
          ? { bankName, accountName, accountNumber, currency: invoice.currency }
          : null,
      };
      if (!financiallyPaid) {
        payload.items = items.map((item) => ({
          id: item.id,
          description: item.description,
          category: item.category,
          quantity: Number(item.quantity),
          unitPriceMinorUnits: toMinorUnits(Number(item.unitPrice)),
        }));
        payload.discountMinorUnits = toMinorUnits(Number(discount) || 0);
        payload.applyVat = applyVat;
        payload.applyConsumptionTax = applyConsumptionTax;
        payload.applyServiceCharge = applyServiceCharge;
      }
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.error === PAID_FINANCIAL_LOCK
          ? labels.financialLock
          : data.error === BELOW_PAID
            ? labels.belowPaid
            : data.error === CLOSED_INVOICE
              ? labels.closedInvoice
              : data.error;
        throw new Error(message || 'The invoice could not be saved.');
      }
      onSaved(data.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The invoice could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5 bg-white px-4 py-6 text-sm text-[#191816] sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{labels.editTitle}</h2>
      </div>
      {financiallyPaid ? <p className="rounded border border-[#E8E2DA] bg-[#FAF7F2] px-3 py-2 text-sm">{labels.financialLock}</p> : null}
      {error ? <p role="alert" className="text-sm text-[#9E382A]">{error}</p> : null}
      {closed ? null : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">{labels.customerName}
              <input required value={recipientName} onChange={(event) => setRecipientName(event.target.value)} className={fieldClass()} />
            </label>
            <label className="block">{labels.email}
              <input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} className={fieldClass()} />
            </label>
            <label className="block">{labels.phone}
              <input value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} className={fieldClass()} />
            </label>
            <label className="block sm:col-span-2">{labels.address}
              <textarea rows={2} value={recipientAddress} onChange={(event) => setRecipientAddress(event.target.value)} className={fieldClass()} />
            </label>
            <label className="block">{labels.tin}
              <input value={companyTin} onChange={(event) => setCompanyTin(event.target.value)} className={fieldClass()} />
            </label>
            <label className="block">{labels.issueDate}
              <input required type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className={fieldClass()} />
            </label>
            <label className="block">{labels.dueDate}
              <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={fieldClass()} />
            </label>
          </div>

          <fieldset disabled={financiallyPaid} className="space-y-3 disabled:opacity-60">
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5c564e]">{labels.lineItems}</legend>
            {items.map((item, index) => (
              <div key={item.id || index} className="grid gap-2 rounded border border-[#E8E2DA] p-3 sm:grid-cols-[1fr_5rem_7rem_auto]">
                <label className="block">{labels.description}
                  <input required value={item.description} onChange={(event) => setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} className={fieldClass()} />
                </label>
                <label className="block">{labels.quantity}
                  <input required inputMode="numeric" value={item.quantity} onChange={(event) => setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} className={fieldClass()} />
                </label>
                <label className="block">{labels.rate}
                  <input required inputMode="decimal" value={item.unitPrice} onChange={(event) => setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, unitPrice: event.target.value } : row))} className={fieldClass()} />
                </label>
                <button
                  type="button"
                  className="min-h-11 self-end px-2 text-sm underline"
                  onClick={() => setItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                >
                  {labels.removeLine}
                </button>
                <label className="block sm:col-span-4 text-xs text-[#5c564e]">
                  <select value={item.category} onChange={(event) => setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, category: event.target.value } : row))} className={fieldClass()}>
                    {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
              </div>
            ))}
            <button
              type="button"
              className="min-h-11 text-sm underline"
              onClick={() => setItems((rows) => [...rows, { id: `item_${rows.length + 1}`, description: '', category: 'other', quantity: '1', unitPrice: '0' }])}
            >
              {labels.addLine}
            </button>
            <label className="block max-w-xs">{labels.discount}
              <input inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} className={fieldClass()} />
            </label>
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={applyVat} onChange={(event) => setApplyVat(event.target.checked)} />{labels.applyVat}</label>
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={applyConsumptionTax} onChange={(event) => setApplyConsumptionTax(event.target.checked)} />{labels.applyConsumption}</label>
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={applyServiceCharge} onChange={(event) => setApplyServiceCharge(event.target.checked)} />{labels.applyService}</label>
          </fieldset>

          <label className="block">{labels.invoiceNotes}
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={fieldClass()} />
          </label>
          <label className="block">{labels.paymentTerms}
            <textarea rows={2} value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} className={fieldClass()} />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">{labels.bank}
              <input value={bankName} onChange={(event) => setBankName(event.target.value)} className={fieldClass()} />
            </label>
            <label className="block">{labels.accountName}
              <input value={accountName} onChange={(event) => setAccountName(event.target.value)} className={fieldClass()} />
            </label>
            <label className="block">{labels.accountNumber}
              <input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} className={fieldClass()} />
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onCancel} className="min-h-11">{labels.cancel}</Button>
            <Button type="submit" disabled={saving} className="min-h-11 bg-[#191816] text-white">{saving ? '…' : labels.saveChanges}</Button>
          </div>
        </>
      )}
    </form>
  );
}
