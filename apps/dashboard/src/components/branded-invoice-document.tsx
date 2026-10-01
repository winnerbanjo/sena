'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
import type { PropertyInvoice } from './invoice-types';
import type { InvoiceDocumentPayment, InvoiceDocumentProperty, InvoiceDocumentReservation } from '@/lib/invoice-document';

export interface InvoiceDocumentLabels {
  documentTitle: string;
  billTo: string;
  issueDate: string;
  dueDate: string;
  status: string;
  description: string;
  quantity: string;
  rate: string;
  amount: string;
  subtotal: string;
  discount: string;
  vat: string;
  consumptionTax: string;
  serviceCharge: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  invoiceNotes: string;
  paymentTerms: string;
  poweredBy: string;
  reservation: string;
  guest: string;
  accommodation: string;
  checkIn: string;
  checkOut: string;
  reference: string;
  paymentHistory: string;
  paymentDate: string;
  paymentMethod: string;
  paymentReference: string;
  viewReceipt: string;
  downloadReceipt: string;
  bankTransfer: string;
  bank: string;
  accountName: string;
  accountNumber: string;
  statusDraft: string;
  statusIssued: string;
  statusPartiallyPaid: string;
  statusPaid: string;
  statusOverdue: string;
  statusVoid: string;
}

export const englishInvoiceDocumentLabels: InvoiceDocumentLabels = {
  documentTitle: 'Invoice',
  billTo: 'Bill to',
  issueDate: 'Issue date',
  dueDate: 'Due date',
  status: 'Status',
  description: 'Description',
  quantity: 'Qty',
  rate: 'Rate',
  amount: 'Amount',
  subtotal: 'Subtotal',
  discount: 'Discount',
  vat: 'VAT (7.5%)',
  consumptionTax: 'Consumption tax (5%)',
  serviceCharge: 'Service charge (10%)',
  total: 'Total',
  amountPaid: 'Amount paid',
  balanceDue: 'Balance due',
  invoiceNotes: 'Notes',
  paymentTerms: 'Payment terms',
  poweredBy: 'Powered by Sena',
  reservation: 'Reservation',
  guest: 'Guest',
  accommodation: 'Accommodation',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  reference: 'Reference',
  paymentHistory: 'Payments',
  paymentDate: 'Date',
  paymentMethod: 'Method',
  paymentReference: 'Reference',
  viewReceipt: 'View receipt',
  downloadReceipt: 'Download receipt',
  bankTransfer: 'Bank transfer',
  bank: 'Bank',
  accountName: 'Account name',
  accountNumber: 'Account number',
  statusDraft: 'Draft',
  statusIssued: 'Issued',
  statusPartiallyPaid: 'Partially paid',
  statusPaid: 'Paid',
  statusOverdue: 'Overdue',
  statusVoid: 'Void',
};

function statusWords(status: string, balanceMinorUnits: number, labels: InvoiceDocumentLabels) {
  if (status === 'void' || status === 'cancelled') return labels.statusVoid;
  if (status === 'draft') return labels.statusDraft;
  if (status === 'paid' || balanceMinorUnits <= 0) return labels.statusPaid;
  if (status === 'partially_paid') return labels.statusPartiallyPaid;
  if (status === 'overdue') return labels.statusOverdue;
  return labels.statusIssued;
}

function methodWords(method: string) {
  if (method === 'bank_transfer') return 'Bank transfer';
  if (method === 'pos') return 'POS';
  if (method === 'card') return 'Card';
  if (method === 'cash') return 'Cash';
  return method.replaceAll('_', ' ');
}

function formatPaymentDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PropertyMark({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); }, [logoUrl]);
  if (!logoUrl || failed) return null;
  return (
    <img
      src={logoUrl}
      alt=""
      className="mb-3 max-h-16 max-w-[200px] object-contain object-start"
      onError={() => setFailed(true)}
    />
  );
}

export function BrandedInvoiceDocument({
  invoice,
  property,
  reservation,
  payments = [],
  showReceiptLinks = false,
  labels = englishInvoiceDocumentLabels,
}: {
  invoice: PropertyInvoice;
  property: InvoiceDocumentProperty;
  reservation?: InvoiceDocumentReservation | null;
  payments?: InvoiceDocumentPayment[];
  showReceiptLinks?: boolean;
  labels?: InvoiceDocumentLabels;
}) {
  const balanceMinorUnits = Math.max(0, invoice.totalAmountMinorUnits - invoice.paidAmountMinorUnits);
  const status = statusWords(invoice.status, balanceMinorUnits, labels);
  const contact = [property.phone, property.email].filter(Boolean).join(' · ');

  return (
    <article id="printable-folio" className="sena-invoice-sheet bg-white px-4 py-6 text-start text-[#191816] sm:px-10 sm:py-10">
      <header className="invoice-keep flex flex-col gap-6 border-b border-[#191816] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <PropertyMark name={property.name} logoUrl={property.logoUrl} />
          <p className="text-xl font-semibold tracking-tight break-words">{property.name}</p>
          {property.address ? <p className="mt-1 max-w-md text-sm leading-relaxed text-[#3f3a34] break-words">{property.address}</p> : null}
          {contact ? <p className="mt-1 text-sm text-[#3f3a34] break-words">{contact}</p> : null}
        </div>
        <div className="shrink-0 sm:text-end">
          <h1 className="text-2xl font-semibold tracking-[0.14em]">{labels.documentTitle}</h1>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-6 sm:justify-end">
              <dt className="text-[#5c564e]">{labels.reference}</dt>
              <dd className="font-medium">{invoice.invoiceNumber}</dd>
            </div>
            <div className="flex justify-between gap-6 sm:justify-end">
              <dt className="text-[#5c564e]">{labels.issueDate}</dt>
              <dd>{invoice.issueDate}</dd>
            </div>
            <div className="flex justify-between gap-6 sm:justify-end">
              <dt className="text-[#5c564e]">{labels.dueDate}</dt>
              <dd>{invoice.dueDate}</dd>
            </div>
            <div className="flex justify-between gap-6 sm:justify-end">
              <dt className="text-[#5c564e]">{labels.status}</dt>
              <dd className="font-semibold">{status}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="invoice-keep mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5c564e]">{labels.billTo}</h2>
          <p className="mt-2 text-base font-medium break-words">{invoice.recipientName}</p>
          {invoice.recipientAddress ? <p className="mt-1 text-sm text-[#3f3a34] break-words whitespace-pre-wrap">{invoice.recipientAddress}</p> : null}
          {invoice.recipientEmail ? <p className="mt-1 text-sm break-words">{invoice.recipientEmail}</p> : null}
          {invoice.recipientPhone ? <p className="text-sm">{invoice.recipientPhone}</p> : null}
          {invoice.companyTin ? <p className="mt-1 text-sm">TIN {invoice.companyTin}</p> : null}
        </div>
        {reservation ? (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5c564e]">{labels.reservation}</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex gap-3"><dt className="w-28 shrink-0 text-[#5c564e]">{labels.guest}</dt><dd className="break-words">{reservation.guestName}</dd></div>
              {reservation.accommodation ? <div className="flex gap-3"><dt className="w-28 shrink-0 text-[#5c564e]">{labels.accommodation}</dt><dd className="break-words">{reservation.accommodation}</dd></div> : null}
              <div className="flex gap-3"><dt className="w-28 shrink-0 text-[#5c564e]">{labels.checkIn}</dt><dd>{reservation.checkInDate}</dd></div>
              <div className="flex gap-3"><dt className="w-28 shrink-0 text-[#5c564e]">{labels.checkOut}</dt><dd>{reservation.checkOutDate}</dd></div>
              <div className="flex gap-3"><dt className="w-28 shrink-0 text-[#5c564e]">{labels.reference}</dt><dd className="break-all">{reservation.reference}</dd></div>
            </dl>
          </div>
        ) : null}
      </section>

      <div className="mt-8 overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#191816] text-xs uppercase tracking-[0.08em] text-[#5c564e]">
              <th className="py-2 pe-3 text-start font-semibold">{labels.description}</th>
              <th className="py-2 px-3 text-end font-semibold">{labels.quantity}</th>
              <th className="py-2 px-3 text-end font-semibold">{labels.rate}</th>
              <th className="py-2 ps-3 text-end font-semibold">{labels.amount}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={`${item.id}-${index}`} className="invoice-keep border-b border-[#E8E2DA] align-top">
                <td className="py-3 pe-3 break-words">{item.description}</td>
                <td className="py-3 px-3 text-end tabular-nums">{item.quantity}</td>
                <td className="py-3 px-3 text-end tabular-nums whitespace-nowrap">{formatNaira(item.unitPriceMinorUnits)}</td>
                <td className="py-3 ps-3 text-end tabular-nums whitespace-nowrap">{formatNaira(item.totalMinorUnits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="invoice-keep invoice-totals mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm text-sm">
          {invoice.bankDetails?.accountNumber ? (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5c564e]">{labels.bankTransfer}</h2>
              <p className="mt-2">{labels.bank}: {invoice.bankDetails.bankName}</p>
              <p>{labels.accountName}: {invoice.bankDetails.accountName}</p>
              <p>{labels.accountNumber}: {invoice.bankDetails.accountNumber}</p>
              <p className="mt-2 text-[#3f3a34]">{labels.reference}: {invoice.invoiceNumber}</p>
            </div>
          ) : null}
          {invoice.paymentTerms ? (
            <p className="mt-4"><span className="font-medium">{labels.paymentTerms}. </span>{invoice.paymentTerms}</p>
          ) : null}
        </div>
        <dl className="w-full space-y-1 text-sm sm:w-64">
          <div className="flex justify-between gap-4 border-b border-[#E8E2DA] py-1">
            <dt>{labels.subtotal}</dt>
            <dd className="tabular-nums">{formatNaira(invoice.subtotalMinorUnits)}</dd>
          </div>
          {invoice.discountMinorUnits > 0 ? (
            <div className="flex justify-between gap-4 border-b border-[#E8E2DA] py-1">
              <dt>{labels.discount}</dt>
              <dd className="tabular-nums">-{formatNaira(invoice.discountMinorUnits)}</dd>
            </div>
          ) : null}
          {invoice.taxVatMinorUnits > 0 ? (
            <div className="flex justify-between gap-4 border-b border-[#E8E2DA] py-1">
              <dt>{labels.vat}</dt>
              <dd className="tabular-nums">{formatNaira(invoice.taxVatMinorUnits)}</dd>
            </div>
          ) : null}
          {invoice.taxConsumptionMinorUnits > 0 ? (
            <div className="flex justify-between gap-4 border-b border-[#E8E2DA] py-1">
              <dt>{labels.consumptionTax}</dt>
              <dd className="tabular-nums">{formatNaira(invoice.taxConsumptionMinorUnits)}</dd>
            </div>
          ) : null}
          {invoice.serviceChargeMinorUnits > 0 ? (
            <div className="flex justify-between gap-4 border-b border-[#E8E2DA] py-1">
              <dt>{labels.serviceCharge}</dt>
              <dd className="tabular-nums">{formatNaira(invoice.serviceChargeMinorUnits)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-b border-[#191816] py-2 text-base font-semibold">
            <dt>{labels.total}</dt>
            <dd className="tabular-nums">{formatNaira(invoice.totalAmountMinorUnits)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1">
            <dt>{labels.amountPaid}</dt>
            <dd className="tabular-nums">{formatNaira(invoice.paidAmountMinorUnits)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1 text-base font-semibold">
            <dt>{labels.balanceDue}</dt>
            <dd className="tabular-nums">{formatNaira(balanceMinorUnits)}</dd>
          </div>
        </dl>
      </div>

      {payments.length > 0 ? (
        <section className="invoice-keep mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5c564e]">{labels.paymentHistory}</h2>
          <div className="mt-2 overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#191816] text-xs uppercase tracking-[0.08em] text-[#5c564e]">
                  <th className="py-2 pe-3 text-start font-semibold">{labels.paymentDate}</th>
                  <th className="py-2 px-3 text-start font-semibold">{labels.paymentMethod}</th>
                  <th className="py-2 px-3 text-start font-semibold">{labels.paymentReference}</th>
                  <th className="py-2 ps-3 text-end font-semibold">{labels.amount}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, index) => (
                  <tr key={payment.id || `${payment.paidAt}-${index}`} className="invoice-keep border-b border-[#E8E2DA]">
                    <td className="py-2 pe-3 whitespace-nowrap">{formatPaymentDate(payment.paidAt)}</td>
                    <td className="py-2 px-3">{methodWords(payment.method)}</td>
                    <td className="py-2 px-3 break-all">
                      {payment.reference || '—'}
                      {showReceiptLinks && payment.id && payment.hasReceipt ? (
                        <span className="mt-1 block print:hidden">
                          <a className="underline" href={`/api/payments/${payment.id}/receipt`} target="_blank" rel="noopener noreferrer">{labels.viewReceipt}</a>
                          <span aria-hidden="true"> · </span>
                          <a className="underline" href={`/api/payments/${payment.id}/receipt?download=1`} target="_blank" rel="noopener noreferrer">{labels.downloadReceipt}</a>
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 ps-3 text-end tabular-nums whitespace-nowrap">{formatNaira(payment.amountMinorUnits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {invoice.notes ? (
        <section className="invoice-keep mt-8 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5c564e]">{labels.invoiceNotes}</h2>
          <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{invoice.notes}</p>
        </section>
      ) : null}

      <footer className="invoice-keep mt-10 flex items-end justify-between gap-4 border-t border-[#E8E2DA] pt-4 text-xs text-[#5c564e]">
        <p className="break-words">{[property.name, property.phone, property.email].filter(Boolean).join(' · ')}</p>
        <p className="shrink-0">{labels.poweredBy}</p>
      </footer>
    </article>
  );
}
