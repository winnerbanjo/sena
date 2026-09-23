'use client';

import * as React from 'react';
import { Topbar } from '../../components/topbar';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { Badge, Button } from '@sena/ui';
import {
  ClipboardList,
  Download,
  Printer,
  Calendar,
  CreditCard,
  TrendingUp,
  Percent,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  DollarSign,
  ArrowUpRight,
  Filter
} from 'lucide-react';

export default function ReportsPage() {
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<'today' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [activeReportTab, setActiveReportTab] = React.useState<'financial' | 'occupancy' | 'housekeeping' | 'tax'>('financial');
  const [exporting, setExporting] = React.useState<string | null>(null);

  const handleExport = (format: 'csv' | 'pdf') => {
    setExporting(format);
    setTimeout(() => {
      setExporting(null);
      alert(`Report exported successfully as ${format.toUpperCase()}!`);
    }, 800);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title="Reports & Exports"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-8 space-y-6 bg-white">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-2xl font-serif font-normal text-[#191816]">
              Reports & Auditing
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Download audited hospitality metrics, accounting exports, tax ledgers, and operational reports.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Date range picker */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
            >
              <option value="today">Today (24h)</option>
              <option value="week">This Week</option>
              <option value="month">Month to Date (September 2026)</option>
              <option value="quarter">Q3 2026</option>
              <option value="year">Year to Date 2026</option>
            </select>

            <button
              onClick={() => handleExport('csv')}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs font-medium text-[#191816] hover:bg-[#FAFAFA] transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{exporting === 'csv' ? 'Exporting...' : 'Export CSV'}</span>
            </button>

            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs font-medium text-[#191816] hover:bg-[#FAFAFA] transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>{exporting === 'pdf' ? 'Generating...' : 'Export PDF'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="p-1.5 rounded border border-[#E8E2DA] bg-white text-[#7A7267] hover:text-[#191816] hover:bg-[#FAFAFA]"
              title="Print Report"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Report Sub-tabs */}
        <div className="flex items-center gap-6 border-b border-[#E8E2DA]">
          {[
            { id: 'financial', label: 'Financial & Revenue Ledger' },
            { id: 'occupancy', label: 'Occupancy & ADR Performance' },
            { id: 'housekeeping', label: 'Housekeeping & Turnaround' },
            { id: 'tax', label: 'VAT & Consumption Tax' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id as any)}
              className={`py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                activeReportTab === tab.id
                  ? 'border-[#B85C3E] text-[#B85C3E] font-semibold'
                  : 'border-transparent text-[#7A7267] hover:text-[#191816]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Financial & Revenue */}
        {activeReportTab === 'financial' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Gross Booking Value</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">₦14,850,000</div>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">+14.2% vs previous period</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Net Accommodation</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">₦13,420,000</div>
                <p className="text-[11px] text-[#7A7267] mt-1">Room rate revenue</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Ancillary & Services</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">₦1,430,000</div>
                <p className="text-[11px] text-[#7A7267] mt-1">Laundry, kitchen, late checkout</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Direct Commission Saved</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">₦1,850,000</div>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">Retained vs OTAs</p>
              </div>
            </div>

            {/* Payment Method Breakdown Table */}
            <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-hidden">
              <div className="p-4 border-b border-[#E8E2DA] flex items-center justify-between bg-[#FAFAFA]">
                <div>
                  <h3 className="text-sm font-semibold text-[#191816]">Settlement Channels & Payment Methods</h3>
                  <p className="text-[11px] text-[#7A7267]">Reconciliation by payment processor for selected period.</p>
                </div>
                <span className="text-xs font-mono font-medium text-[#191816]">Total: ₦14,850,000</span>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E8E2DA] text-[#7A7267] uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Channel / Gateway</th>
                    <th className="py-2.5 px-4">Transactions</th>
                    <th className="py-2.5 px-4">Gross Collected</th>
                    <th className="py-2.5 px-4">Processing Fees</th>
                    <th className="py-2.5 px-4">Net Settled</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2DA]">
                  {[
                    { channel: 'Paystack Direct (Card / Apple Pay)', count: 48, gross: 7850000, fee: 117750, net: 7732250, status: 'Settled to GTBank' },
                    { channel: 'Bank Transfer (Dedicated Virtual Account)', count: 32, gross: 4200000, fee: 21000, net: 4179000, status: 'Settled to GTBank' },
                    { channel: 'Front Desk POS Terminal', count: 18, gross: 2300000, fee: 34500, net: 2265500, status: 'Settled to GTBank' },
                    { channel: 'Corporate Invoice Wire', count: 4, gross: 500000, fee: 0, net: 500000, status: 'Direct Wire' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-[#FAFAFA]/70">
                      <td className="py-3 px-4 font-medium text-[#191816]">{row.channel}</td>
                      <td className="py-3 px-4 text-[#7A7267]">{row.count} txns</td>
                      <td className="py-3 px-4 font-semibold text-[#191816]">₦{row.gross.toLocaleString()}</td>
                      <td className="py-3 px-4 text-[#7A7267]">₦{row.fee.toLocaleString()}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">₦{row.net.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Occupancy & ADR */}
        {activeReportTab === 'occupancy' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Average Occupancy</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">83.8%</div>
                <p className="text-[11px] text-[#7A7267] mt-1">352 room nights sold / 420 total</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">ADR (Average Daily Rate)</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">₦84,200</div>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">+₦6,500 vs last month</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">RevPAR</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">₦70,560</div>
                <p className="text-[11px] text-[#7A7267] mt-1">Revenue per available room</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Average Stay Length</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">3.4 nights</div>
                <p className="text-[11px] text-[#7A7267] mt-1">Extended residence guests</p>
              </div>
            </div>

            <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-hidden">
              <div className="p-4 border-b border-[#E8E2DA] bg-[#FAFAFA]">
                <h3 className="text-sm font-semibold text-[#191816]">Room Type Performance Audit</h3>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E8E2DA] text-[#7A7267] uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Room Category</th>
                    <th className="py-2.5 px-4">Units</th>
                    <th className="py-2.5 px-4">Nights Sold</th>
                    <th className="py-2.5 px-4">Occupancy %</th>
                    <th className="py-2.5 px-4">Category ADR</th>
                    <th className="py-2.5 px-4 text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2DA]">
                  {[
                    { type: 'Executive Penthouse Suite', units: 6, sold: 98, occ: 91, adr: 120000, rev: 5880000 },
                    { type: 'Deluxe Residence Suite', units: 12, sold: 168, occ: 82, adr: 85000, rev: 5712000 },
                    { type: 'Studio Apartment', units: 8, sold: 86, occ: 78, adr: 65000, rev: 1828000 },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-[#FAFAFA]/70">
                      <td className="py-3 px-4 font-medium text-[#191816]">{row.type}</td>
                      <td className="py-3 px-4 text-[#7A7267]">{row.units} rooms</td>
                      <td className="py-3 px-4 text-[#7A7267]">{row.sold} nights</td>
                      <td className="py-3 px-4 font-semibold text-[#191816]">{row.occ}%</td>
                      <td className="py-3 px-4 font-mono">₦{row.adr.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-semibold text-[#191816]">₦{row.rev.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Housekeeping & Operations */}
        {activeReportTab === 'housekeeping' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Total Turnovers</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">142 cleanings</div>
                <p className="text-[11px] text-[#7A7267] mt-1">100% completed on time</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Average Turnaround Time</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">28 mins</div>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">4 mins faster than SLA</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Supervisor Inspection Pass Rate</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">98.4%</div>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">High cleanliness score</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Tax & Levies */}
        {activeReportTab === 'tax' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Federal VAT (7.5%)</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">₦1,006,500</div>
                <p className="text-[11px] text-[#7A7267] mt-1">FIRS compliant remittance</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Lagos Hotel Consumption Tax (5%)</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">₦671,000</div>
                <p className="text-[11px] text-[#7A7267] mt-1">LIRS statutory levy</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Total Tax Provision</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">₦1,677,500</div>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">Prepared for e-filing</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={() => {}}
      />
    </div>
  );
}
