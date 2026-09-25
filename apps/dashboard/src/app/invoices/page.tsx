'use client';

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
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  CreditCard,
  Building2,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Topbar } from '../../components/topbar';
import { InvoiceViewModal, type PropertyInvoice } from '../../components/invoice-view-modal';

interface InvoiceMetrics {
  totalInvoicedMinorUnits: number;
  totalPaidMinorUnits: number;
  totalOutstandingMinorUnits: number;
  overdueCount: number;
  overdueMinorUnits: number;
}

interface LineItemForm {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: string; // Naira input
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = React.useState<PropertyInvoice[]>([]);
  const [metrics, setMetrics] = React.useState<InvoiceMetrics>({
    totalInvoicedMinorUnits: 0,
    totalPaidMinorUnits: 0,
    totalOutstandingMinorUnits: 0,
    overdueCount: 0,
    overdueMinorUnits: 0,
  });
  const [propertyMeta, setPropertyMeta] = React.useState<{
    propertyName?: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
  }>({});

  const [loading, setLoading] = React.useState(true);
  const [statusTab, setStatusTab] = React.useState<'all' | 'unpaid' | 'paid' | 'overdue' | 'draft'>('all');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Selected invoice for detail/print modal
  const [selectedInvoice, setSelectedInvoice] = React.useState<PropertyInvoice | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  // Create Invoice Modal State
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [reservations, setReservations] = React.useState<any[]>([]);
  const [selectedResId, setSelectedResId] = React.useState<string>('');

  // Form Fields
  const [invoiceType, setInvoiceType] = React.useState<string>('guest_folio');
  const [recipientName, setRecipientName] = React.useState('');
  const [recipientEmail, setRecipientEmail] = React.useState('');
  const [recipientPhone, setRecipientPhone] = React.useState('');
  const [recipientAddress, setRecipientAddress] = React.useState('');
  const [companyTin, setCompanyTin] = React.useState('');
  const [issueDate, setIssueDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [paymentTerms, setPaymentTerms] = React.useState('Due on Receipt');
  const [notes, setNotes] = React.useState('');

  // Surcharges & Taxes
  const [applyVat, setApplyVat] = React.useState(true);
  const [applyConsumptionTax, setApplyConsumptionTax] = React.useState(false);
  const [applyServiceCharge, setApplyServiceCharge] = React.useState(true);
  const [discountNaira, setDiscountNaira] = React.useState('0');

  // Dynamic Line Items
  const [lineItems, setLineItems] = React.useState<LineItemForm[]>([
    { id: '1', description: 'Deluxe Suite (Stay)', category: 'room', quantity: 1, unitPrice: '65000' },
  ]);

  const [submittingInvoice, setSubmittingInvoice] = React.useState(false);

  const fetchInvoices = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices?status=${statusTab}&type=${typeFilter}&search=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
        if (data.metrics) setMetrics(data.metrics);
        setPropertyMeta({
          propertyName: data.propertyName,
          propertyAddress: data.propertyAddress,
          propertyPhone: data.propertyPhone,
          propertyEmail: data.propertyEmail,
        });
      }
    } catch (e) {
      console.error('Failed to load invoices:', e);
    } finally {
      setLoading(false);
    }
  }, [statusTab, typeFilter, searchQuery]);

  React.useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Load reservations for linking
  React.useEffect(() => {
    fetch('/api/reservations')
      .then((res) => res.json())
      .then((data) => {
        if (data.reservations) setReservations(data.reservations);
      })
      .catch((e) => console.error('Error loading reservations for invoicing:', e));
  }, []);

  // When a reservation is picked in create modal, auto-fill guest & stay charges
  function handleSelectReservation(resId: string) {
    setSelectedResId(resId);
    if (!resId) return;
    const r = reservations.find((item) => item.id === resId);
    if (r) {
      setRecipientName(r.guestName || '');
      setRecipientEmail(r.guestEmail || '');
      setRecipientPhone(r.guestPhone || '');
      setInvoiceType('guest_folio');
      setIssueDate(r.checkInDate || new Date().toISOString().slice(0, 10));
      setDueDate(r.checkOutDate || new Date().toISOString().slice(0, 10));

      const roomTotalNaira = (r.totalAmountMinorUnits || 0) / 100;
      setLineItems([
        {
          id: '1',
          description: `${r.roomTypeName || 'Room'} (${r.nights || 1} nights, ${r.checkInDate} to ${r.checkOutDate})`,
          category: 'room',
          quantity: 1,
          unitPrice: roomTotalNaira.toString(),
        },
      ]);
    }
  }

  function handleAddLineItem() {
    setLineItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        description: '',
        category: 'fb',
        quantity: 1,
        unitPrice: '0',
      },
    ]);
  }

  function handleRemoveLineItem(id: string) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleUpdateLineItem(id: string, field: keyof LineItemForm, value: any) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  // Live calculations for Create Modal
  const calculatedSubtotalNaira = lineItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const vatNaira = applyVat ? calculatedSubtotalNaira * 0.075 : 0;
  const consumptionTaxNaira = applyConsumptionTax ? calculatedSubtotalNaira * 0.05 : 0;
  const serviceChargeNaira = applyServiceCharge ? calculatedSubtotalNaira * 0.1 : 0;
  const discountValNaira = Math.max(0, Number(discountNaira) || 0);
  const totalCalculatedNaira = Math.max(
    0,
    calculatedSubtotalNaira + vatNaira + consumptionTaxNaira + serviceChargeNaira - discountValNaira
  );

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientName.trim()) {
      alert('Recipient name is required');
      return;
    }
    setSubmittingInvoice(true);
    try {
      const itemsPayload = lineItems.map((item) => ({
        description: item.description.trim() || 'Hotel Service',
        category: item.category,
        quantity: Number(item.quantity) || 1,
        unitPriceMinorUnits: Math.round((Number(item.unitPrice) || 0) * 100),
      }));

      const payload = {
        invoiceType,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
        recipientAddress: recipientAddress.trim() || undefined,
        companyTin: companyTin.trim() || undefined,
        reservationId: selectedResId || undefined,
        issueDate,
        dueDate,
        items: itemsPayload,
        applyVat,
        applyConsumptionTax,
        applyServiceCharge,
        discountMinorUnits: Math.round(discountValNaira * 100),
        paymentTerms,
        notes,
      };

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invoice');

      setCreateModalOpen(false);
      resetCreateForm();
      fetchInvoices();

      // Open view modal for the newly generated invoice
      if (data.invoice) {
        setSelectedInvoice(data.invoice);
        setModalOpen(true);
      }
    } catch (err: any) {
      alert(err.message || 'Error creating invoice');
    } finally {
      setSubmittingInvoice(false);
    }
  }

  function resetCreateForm() {
    setSelectedResId('');
    setRecipientName('');
    setRecipientEmail('');
    setRecipientPhone('');
    setRecipientAddress('');
    setCompanyTin('');
    setInvoiceType('guest_folio');
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate(new Date().toISOString().slice(0, 10));
    setLineItems([{ id: '1', description: 'Deluxe Suite (Stay)', category: 'room', quantity: 1, unitPrice: '65000' }]);
    setApplyVat(true);
    setApplyConsumptionTax(false);
    setApplyServiceCharge(true);
    setDiscountNaira('0');
    setNotes('');
  }

  function handleOpenInvoice(inv: PropertyInvoice) {
    setSelectedInvoice(inv);
    setModalOpen(true);
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white text-[#191816]">
      <Topbar title="Invoices & Folios" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              Invoices & Guest Folios
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Issue itemized guest stay folios, corporate tax invoices, and collect settlements.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button
              onClick={() => {
                resetCreateForm();
                setCreateModalOpen(true);
              }}
              size="sm"
              className="text-xs bg-[#71382D] hover:bg-[#5A2C23] text-white flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Invoice</span>
            </Button>
          </div>
        </div>

        {/* Executive Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Invoiced"
            value={formatNaira(metrics.totalInvoicedMinorUnits)}
            subtext="Billed across active folios"
          />
          <MetricCard
            label="Settled Revenue"
            value={formatNaira(metrics.totalPaidMinorUnits)}
            subtext="Collected in full or part"
          />
          <MetricCard
            label="Outstanding Folios"
            value={formatNaira(metrics.totalOutstandingMinorUnits)}
            subtext="Pending balance due"
          />
          <MetricCard
            label="Overdue Receivables"
            value={formatNaira(metrics.overdueMinorUnits)}
            subtext={`${metrics.overdueCount} accounts past due date`}
          />
        </div>

        {/* Search & Status Tabs Bar */}
        <div className="bg-white rounded-lg border border-[#E8E2DA] p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: 'All Invoices' },
                { id: 'unpaid', label: 'Unpaid & Due' },
                { id: 'paid', label: 'Paid in Full' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'draft', label: 'Drafts' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                    statusTab === tab.id
                      ? 'bg-[#71382D] text-white'
                      : 'bg-[#FAF7F2] text-[#7A7267] hover:text-[#191816]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right side: Type Filter & Search Bar */}
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded border border-[#E8E2DA] text-xs text-[#191816] bg-white focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="guest_folio">Guest Folio</option>
                <option value="corporate">Corporate</option>
                <option value="event_banquet">Event & Banquet</option>
                <option value="walk_in">Walk-in Service</option>
                <option value="proforma">Proforma</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#7A7267] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search invoice #, guest, TIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded border border-[#E8E2DA] text-xs text-[#191816] w-52 sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                />
              </div>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-[#7A7267] text-xs">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading invoices...
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <FileText className="w-8 h-8 text-[#7A7267] mx-auto opacity-50" />
                <p className="text-sm font-serif text-[#191816]">No invoices found</p>
                <p className="text-xs text-[#7A7267] max-w-sm mx-auto">
                  Generate your first guest stay folio or corporate invoice using the &quot;Create New Invoice&quot; button above.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Recipient / Entity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Issue / Due</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const balance = Math.max(0, inv.totalAmountMinorUnits - inv.paidAmountMinorUnits);
                    const isPaid = inv.status === 'paid' || balance === 0;

                    return (
                      <TableRow key={inv.id} className="hover:bg-[#FAFAFA]/70 cursor-pointer" onClick={() => handleOpenInvoice(inv)}>
                        <TableCell className="font-mono font-medium text-[#71382D]">
                          {inv.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-[#191816]">{inv.recipientName}</div>
                          {inv.companyTin ? (
                            <div className="text-[10px] text-emerald-800 font-mono">TIN: {inv.companyTin}</div>
                          ) : (
                            inv.recipientEmail && <div className="text-[11px] text-[#7A7267]">{inv.recipientEmail}</div>
                          )}
                        </TableCell>
                        <TableCell className="capitalize text-[#7A7267] text-xs">
                          {inv.invoiceType.replace('_', ' ')}
                        </TableCell>
                        <TableCell className="text-xs text-[#7A7267]">
                          <div>{inv.issueDate}</div>
                          <div className="text-[10px] text-[#191816]">Due: {inv.dueDate}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium text-[#191816]">
                          {formatNaira(inv.totalAmountMinorUnits)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          <span className={balance > 0 ? 'text-[#B85C3E] font-medium' : 'text-emerald-700'}>
                            {formatNaira(balance)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : inv.status === 'overdue'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : inv.status === 'partially_paid'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-[#B85C3E]/10 text-[#B85C3E] border border-[#B85C3E]/30'
                            }`}
                          >
                            {isPaid ? 'PAID' : inv.status.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenInvoice(inv)}
                            className="text-xs border-[#E8E2DA] hover:bg-[#FAF7F2] text-[#191816]"
                          >
                            View Folio
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </main>

      {/* Invoice Detail & Print Modal */}
      <InvoiceViewModal
        invoice={selectedInvoice}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        propertyName={propertyMeta.propertyName}
        propertyAddress={propertyMeta.propertyAddress}
        propertyPhone={propertyMeta.propertyPhone}
        propertyEmail={propertyMeta.propertyEmail}
        onPaymentSuccess={() => {
          fetchInvoices();
          // Reload the updated invoice
          if (selectedInvoice) {
            fetch(`/api/invoices/${selectedInvoice.id}`)
              .then((r) => r.json())
              .then((data) => {
                if (data.invoice) setSelectedInvoice(data.invoice);
              });
          }
        }}
      />

      {/* Create New Invoice Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-[#E8E2DA] my-auto overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-[#FAF7F2] border-b border-[#E8E2DA]">
              <div>
                <h3 className="text-lg font-serif font-medium text-[#191816]">
                  Create Official Invoice / Guest Folio
                </h3>
                <p className="text-xs text-[#7A7267] mt-0.5">
                  Issue a structured billing statement with automated Nigerian VAT & service charges.
                </p>
              </div>
              <button
                disabled={submittingInvoice}
                onClick={() => setCreateModalOpen(false)}
                className="text-[#7A7267] hover:text-[#191816]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {/* Pre-fill from active reservation */}
              <div className="p-3.5 bg-stone-50 rounded-lg border border-[#E8E2DA] space-y-2">
                <span className="font-semibold text-[#71382D] uppercase tracking-wider text-[10px] block">
                  Link Existing In-House / Arriving Stay (Optional)
                </span>
                <select
                  value={selectedResId}
                  onChange={(e) => handleSelectReservation(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] bg-white focus:outline-none"
                >
                  <option value="">-- Standalone Billing / Corporate (No reservation link) --</option>
                  {reservations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.reference} · {r.guestName} ({r.roomTypeName || 'Room'} · {r.checkInDate} to {r.checkOutDate})
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipient / Client Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#7A7267] font-medium mb-1">
                    Invoice Type
                  </label>
                  <select
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] bg-white focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  >
                    <option value="guest_folio">Guest Stay Folio</option>
                    <option value="corporate">Corporate Tax Invoice</option>
                    <option value="event_banquet">Event & Banquet Billing</option>
                    <option value="walk_in">Walk-in Restaurant & Service</option>
                    <option value="proforma">Proforma Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#7A7267] font-medium mb-1">
                    Billed Entity / Recipient Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chief Adeleke or Shell Petroleum Dev."
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div>
                  <label className="block text-[#7A7267] font-medium mb-1">
                    Email Address (for direct invoice dispatch)
                  </label>
                  <input
                    type="email"
                    placeholder="guest@domain.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div>
                  <label className="block text-[#7A7267] font-medium mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+234 800 000 0000"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                {invoiceType === 'corporate' && (
                  <div>
                    <label className="block text-[#7A7267] font-medium mb-1">
                      Corporate TIN (Tax Identification Number)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 19284719-0001"
                      value={companyTin}
                      onChange={(e) => setCompanyTin(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[#7A7267] font-medium mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] bg-white focus:outline-none"
                  >
                    <option value="Due on Receipt">Due on Receipt (Immediate)</option>
                    <option value="Net 7 Days">Net 7 Days</option>
                    <option value="Net 15 Days">Net 15 Days</option>
                    <option value="Net 30 Days">Net 30 Days (Corporate)</option>
                    <option value="50% Advance">50% Advance / 50% on Arrival</option>
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#7A7267] font-medium mb-1">Issue Date</label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#7A7267] font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Line Items Section */}
              <div className="space-y-3 pt-2 border-t border-[#E8E2DA]">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[#191816] uppercase tracking-wider text-[11px]">
                    Itemized Charges & Services
                  </h4>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddLineItem}
                    className="text-xs py-1 px-2 border-[#E8E2DA]"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Line Item
                  </Button>
                </div>

                <div className="space-y-2">
                  {lineItems.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-[#FAF7F2] p-2.5 rounded-lg border border-[#E8E2DA]">
                      <div className="col-span-5">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Deluxe Room (Night 1) or Seafood Buffet"
                          value={item.description}
                          onChange={(e) => handleUpdateLineItem(item.id, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded border border-[#E8E2DA] text-xs bg-white text-[#191816] focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <select
                          value={item.category}
                          onChange={(e) => handleUpdateLineItem(item.id, 'category', e.target.value)}
                          className="w-full px-2 py-1.5 rounded border border-[#E8E2DA] text-xs bg-white text-[#191816] focus:outline-none"
                        >
                          <option value="room">Room</option>
                          <option value="fb">F &amp; B</option>
                          <option value="laundry">Laundry</option>
                          <option value="transport">Transfer</option>
                          <option value="service">Service</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleUpdateLineItem(item.id, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 rounded border border-[#E8E2DA] text-xs bg-white text-[#191816] text-center focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="Rate ₦"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateLineItem(item.id, 'unitPrice', e.target.value)}
                          className="w-full px-2 py-1.5 rounded border border-[#E8E2DA] text-xs bg-white text-[#191816] text-right focus:outline-none"
                        />
                      </div>

                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          disabled={lineItems.length <= 1}
                          onClick={() => handleRemoveLineItem(item.id)}
                          className="text-[#7A7267] hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nigerian Statutory Taxes & Surcharges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-[#FAF7F2] border border-[#E8E2DA]">
                <div className="space-y-2">
                  <span className="font-semibold text-[#191816] block text-xs mb-1">
                    Statutory Taxes & Hospitality Surcharges
                  </span>

                  <label className="flex items-center gap-2 text-xs text-[#191816] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyVat}
                      onChange={(e) => setApplyVat(e.target.checked)}
                      className="rounded border-[#E8E2DA] text-[#71382D] focus:ring-[#71382D]"
                    />
                    <span>7.5% Nigerian Value Added Tax (VAT)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-[#191816] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyConsumptionTax}
                      onChange={(e) => setApplyConsumptionTax(e.target.checked)}
                      className="rounded border-[#E8E2DA] text-[#71382D] focus:ring-[#71382D]"
                    />
                    <span>5.0% State Hotel Consumption Tax (Lagos/State)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-[#191816] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyServiceCharge}
                      onChange={(e) => setApplyServiceCharge(e.target.checked)}
                      className="rounded border-[#E8E2DA] text-[#71382D] focus:ring-[#71382D]"
                    />
                    <span>10.0% Staff Hospitality Service Charge</span>
                  </label>
                </div>

                <div className="space-y-2 border-t sm:border-t-0 sm:border-l sm:pl-4 border-[#E8E2DA]">
                  <div>
                    <label className="block text-[#7A7267] font-medium mb-1">Custom Discount (₦)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={discountNaira}
                      onChange={(e) => setDiscountNaira(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-1.5 rounded border border-[#E8E2DA] text-xs bg-white text-[#191816] focus:outline-none"
                    />
                  </div>

                  {/* Financial Preview Box */}
                  <div className="pt-2 text-xs space-y-1 font-mono">
                    <div className="flex justify-between text-[#7A7267]">
                      <span>Subtotal:</span>
                      <span>₦{calculatedSubtotalNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {applyVat && (
                      <div className="flex justify-between text-[#7A7267]">
                        <span>VAT (7.5%):</span>
                        <span>₦{vatNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {applyConsumptionTax && (
                      <div className="flex justify-between text-[#7A7267]">
                        <span>Consumption (5%):</span>
                        <span>₦{consumptionTaxNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {applyServiceCharge && (
                      <div className="flex justify-between text-[#7A7267]">
                        <span>Service (10%):</span>
                        <span>₦{serviceChargeNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-[#E8E2DA] font-bold text-sm text-[#191816]">
                      <span>Grand Total:</span>
                      <span>₦{totalCalculatedNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[#7A7267] font-medium mb-1">
                  Invoice Notes & Bank Instructions
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please quote invoice reference on wire transfer. Late checkout complimentary."
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E2DA]">
                <button
                  type="button"
                  disabled={submittingInvoice}
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded border border-[#E8E2DA] bg-white text-xs font-medium text-[#191816] hover:bg-stone-50"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={submittingInvoice}
                  className="bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs flex items-center gap-1.5"
                >
                  {submittingInvoice ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Invoice...</span>
                    </>
                  ) : (
                    <span>Issue &amp; Save Invoice</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
