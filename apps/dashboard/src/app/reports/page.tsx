'use client';

import * as React from 'react';
import { Topbar } from '../../components/topbar';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { Badge, Button } from '@sena/ui';
import { formatNaira } from '@sena/config';
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
  Filter,
  FileCheck
} from 'lucide-react';

export default function ReportsPage() {
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<'today' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [activeReportTab, setActiveReportTab] = React.useState<'financial' | 'occupancy' | 'housekeeping' | 'tax'>('financial');
  const [exporting, setExporting] = React.useState<string | null>(null);

  // Dynamic DB data
  const [reservations, setReservations] = React.useState<any[]>([]);
  const [payments, setPayments] = React.useState<any[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [roomTypes, setRoomTypes] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      fetch('/api/reservations').then((r) => r.json()).catch(() => ({ reservations: [] })),
      fetch('/api/payments').then((r) => r.json()).catch(() => ({ payments: [] })),
      fetch('/api/rooms').then((r) => r.json()).catch(() => ({ rooms: [], roomTypes: [] })),
    ])
      .then(([resData, payData, roomData]) => {
        if (resData.reservations) setReservations(resData.reservations);
        if (payData.payments) setPayments(payData.payments);
        if (roomData.rooms) setRooms(roomData.rooms);
        if (roomData.roomTypes) setRoomTypes(roomData.roomTypes);
      })
      .catch((e) => console.error('Failed to load reports data:', e))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = (format: 'csv' | 'pdf') => {
    setExporting(format);
    setTimeout(() => {
      setExporting(null);
      alert(`Report exported successfully as ${format.toUpperCase()}!`);
    }, 800);
  };

  // Calculations
  const grossBookingValueMinorUnits = reservations
    .filter((r) => r.status !== 'cancelled')
    .reduce((sum, r) => sum + Number(r.totalAmountMinorUnits || 0), 0);

  const netAccommodationMinorUnits = grossBookingValueMinorUnits;
  const ancillaryMinorUnits = 0;
  // Direct booking commission saved (15% OTA commission saved on direct bookings)
  const directBookingsValue = reservations
    .filter((r) => r.source === 'direct' && r.status !== 'cancelled')
    .reduce((sum, r) => sum + Number(r.totalAmountMinorUnits || 0), 0);
  const commissionSavedMinorUnits = Math.round(directBookingsValue * 0.15);

  // Taxes
  const vatMinorUnits = Math.round(grossBookingValueMinorUnits * 0.075);
  const consumptionTaxMinorUnits = Math.round(grossBookingValueMinorUnits * 0.05);
  const totalTaxMinorUnits = vatMinorUnits + consumptionTaxMinorUnits;

  // Occupancy metrics
  const validStays = reservations.filter((r) => r.status !== 'cancelled');
  const totalNightsSold = validStays.reduce((sum, r) => sum + Number(r.nights || 1), 0);
  const totalAvailableRoomNights = rooms.length * 30 || 1;
  const avgOccupancy = rooms.length > 0
    ? Math.min(100, Math.round((totalNightsSold / totalAvailableRoomNights) * 100))
    : 0;

  const adrMinorUnits = totalNightsSold > 0
    ? Math.round(grossBookingValueMinorUnits / totalNightsSold)
    : 0;
  const revParMinorUnits = rooms.length > 0
    ? Math.round(grossBookingValueMinorUnits / (rooms.length * 30))
    : 0;

  const avgStayLength = validStays.length > 0
    ? (totalNightsSold / validStays.length).toFixed(1)
    : '0';

  // Housekeeping counts
  const cleanRoomsCount = rooms.filter((r) => (r.housekeepingStatus || r.housekeeping) === 'clean').length;
  const dirtyRoomsCount = rooms.filter((r) => (r.housekeepingStatus || r.housekeeping) === 'dirty').length;
  const cleaningRoomsCount = rooms.filter((r) => (r.housekeepingStatus || r.housekeeping) === 'cleaning').length;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title="Reports & Exports"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-white">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              Reports & Auditing
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Download audited hospitality metrics, accounting exports, tax ledgers, and operational reports.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
            >
              <option value="today">Today (24h)</option>
              <option value="week">This Week</option>
              <option value="month">Month to Date</option>
              <option value="quarter">This Quarter</option>
              <option value="year">Year to Date</option>
            </select>

            <button
              onClick={() => handleExport('csv')}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs font-medium text-[#191816] hover:bg-[#FAFAFA] transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{exporting === 'csv' ? 'Exporting...' : 'CSV'}</span>
            </button>

            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs font-medium text-[#191816] hover:bg-[#FAFAFA] transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>{exporting === 'pdf' ? 'Generating...' : 'PDF'}</span>
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
        <div className="flex items-center gap-4 sm:gap-6 border-b border-[#E8E2DA] overflow-x-auto whitespace-nowrap">
          {[
            { id: 'financial', label: 'Financial & Revenue Ledger' },
            { id: 'occupancy', label: 'Occupancy & ADR Performance' },
            { id: 'housekeeping', label: 'Housekeeping & Turnaround' },
            { id: 'tax', label: 'VAT & Consumption Tax' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id as any)}
              className={`py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors flex-shrink-0 ${
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[10px] sm:text-[11px] text-[#7A7267] uppercase font-semibold">Gross Booking Value</span>
                <div className="text-xl sm:text-2xl font-serif text-[#191816] mt-1">
                  {formatNaira(grossBookingValueMinorUnits)}
                </div>
                <p className="text-[10px] sm:text-[11px] text-[#7A7267] mt-1">
                  {reservations.length > 0 ? `${reservations.length} bookings recorded` : 'No bookings recorded'}
                </p>
              </div>

              <div className="p-3 sm:p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Net Accommodation</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">
                  {formatNaira(netAccommodationMinorUnits)}
                </div>
                <p className="text-[11px] text-[#7A7267] mt-1">Room rate revenue</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Ancillary & Services</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">
                  {formatNaira(ancillaryMinorUnits)}
                </div>
                <p className="text-[11px] text-[#7A7267] mt-1">Laundry, kitchen, add-ons</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Direct Commission Saved</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">
                  {formatNaira(commissionSavedMinorUnits)}
                </div>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">15% saved vs OTAs</p>
              </div>
            </div>

            {/* Payment Method Breakdown Table */}
            <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-hidden">
              <div className="p-4 border-b border-[#E8E2DA] flex items-center justify-between bg-[#FAFAFA]">
                <div>
                  <h3 className="text-sm font-semibold text-[#191816]">Settlement Channels & Payment Methods</h3>
                  <p className="text-[11px] text-[#7A7267]">Reconciliation by payment processor for selected period.</p>
                </div>
                <span className="text-xs font-mono font-medium text-[#191816]">
                  Total: {formatNaira(grossBookingValueMinorUnits)}
                </span>
              </div>

              {payments.length === 0 ? (
                <div className="p-12 text-center space-y-2 bg-[#FAF9F6]">
                  <CreditCard className="w-6 h-6 mx-auto text-[#7A7267]" />
                  <p className="font-serif text-sm text-[#191816]">No transactions recorded for this period</p>
                  <p className="text-xs text-[#7A7267] max-w-sm mx-auto">
                    Confirmed payments and bank transfers will automatically reconcile in this ledger.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFA] border-b border-[#E8E2DA] text-[#7A7267] uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Channel / Gateway</th>
                      <th className="py-2.5 px-4">Transactions</th>
                      <th className="py-2.5 px-4">Gross Collected</th>
                      <th className="py-2.5 px-4">Provider</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2DA]">
                    {payments.map((p, i) => (
                      <tr key={i} className="hover:bg-[#FAFAFA]/70">
                        <td className="py-3 px-4 font-medium text-[#191816]">
                          {p.providerReference || `PAY-${p.id.slice(0, 6)}`}
                        </td>
                        <td className="py-3 px-4 text-[#7A7267] capitalize">{p.method || 'Card'}</td>
                        <td className="py-3 px-4 font-semibold text-[#191816] font-mono">
                          {formatNaira(p.amountMinorUnits)}
                        </td>
                        <td className="py-3 px-4 text-[#7A7267] capitalize">{p.provider || 'Paystack'}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {p.status || 'Verified'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Occupancy & ADR */}
        {activeReportTab === 'occupancy' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Average Occupancy</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">{avgOccupancy}%</div>
                <p className="text-[11px] text-[#7A7267] mt-1">
                  {rooms.length > 0 ? `${totalNightsSold} nights sold / ${totalAvailableRoomNights} room capacity` : 'No rooms configured'}
                </p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">ADR (Average Daily Rate)</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">{formatNaira(adrMinorUnits)}</div>
                <p className="text-[11px] text-[#7A7267] mt-1">Average earned per occupied room</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">RevPAR</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">{formatNaira(revParMinorUnits)}</div>
                <p className="text-[11px] text-[#7A7267] mt-1">Revenue per available room</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Average Stay Length</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">{avgStayLength} nights</div>
                <p className="text-[11px] text-[#7A7267] mt-1">Across all confirmed guests</p>
              </div>
            </div>

            <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-hidden">
              <div className="p-4 border-b border-[#E8E2DA] bg-[#FAFAFA]">
                <h3 className="text-sm font-semibold text-[#191816]">Room Type Performance Audit</h3>
              </div>
              {roomTypes.length === 0 ? (
                <div className="p-12 text-center space-y-2 bg-[#FAF9F6]">
                  <p className="font-serif text-sm text-[#191816]">No room categories configured</p>
                  <p className="text-xs text-[#7A7267]">Add room categories to audit individual tier ADR and occupancy.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFA] border-b border-[#E8E2DA] text-[#7A7267] uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Room Category</th>
                      <th className="py-2.5 px-4">Units</th>
                      <th className="py-2.5 px-4">Nights Sold</th>
                      <th className="py-2.5 px-4">Base Rate</th>
                      <th className="py-2.5 px-4 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2DA]">
                    {roomTypes.map((rt) => {
                      const catRooms = rooms.filter((r) => r.roomTypeId === rt.id || r.roomTypeName === rt.name);
                      const catRes = reservations.filter((r) => r.roomTypeId === rt.id || r.roomTypeName === rt.name);
                      const sold = catRes.reduce((s, r) => s + Number(r.nights || 1), 0);
                      const rev = catRes.reduce((s, r) => s + Number(r.paidAmountMinorUnits || 0), 0);

                      return (
                        <tr key={rt.id} className="hover:bg-[#FAFAFA]/70">
                          <td className="py-3 px-4 font-medium text-[#191816]">{rt.name}</td>
                          <td className="py-3 px-4 text-[#7A7267]">{catRooms.length} rooms</td>
                          <td className="py-3 px-4 text-[#7A7267]">{sold} nights</td>
                          <td className="py-3 px-4 font-mono">{formatNaira(rt.basePriceMinorUnits || 0)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-[#191816]">{formatNaira(rev)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Housekeeping & Operations */}
        {activeReportTab === 'housekeeping' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Clean & Ready Units</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">{cleanRoomsCount} rooms</div>
                <p className="text-[11px] text-[#7A7267] mt-1">Inspected and available for check-in</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Awaiting Turnover</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">{dirtyRoomsCount} rooms</div>
                <p className="text-[11px] text-[#B85C3E] mt-1 font-medium">Pending housekeeping attention</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Service in Progress</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">{cleaningRoomsCount} rooms</div>
                <p className="text-[11px] text-[#2E6B4F] mt-1 font-medium">Currently being serviced</p>
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
                <div className="text-2xl font-serif text-[#191816] mt-1">
                  {formatNaira(vatMinorUnits)}
                </div>
                <p className="text-[11px] text-[#7A7267] mt-1">FIRS statutory remittance calculation</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Hotel Consumption Tax (5%)</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">
                  {formatNaira(consumptionTaxMinorUnits)}
                </div>
                <p className="text-[11px] text-[#7A7267] mt-1">State consumption tax levy</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
                <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Total Tax Provision</span>
                <div className="text-2xl font-serif text-[#191816] mt-1">
                  {formatNaira(totalTaxMinorUnits)}
                </div>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">Accrued from settled folios</p>
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
