'use client';

import * as React from 'react';
import { Topbar } from '../../components/topbar';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { Badge, Button } from '@sena/ui';
import {
  Tag,
  Plus,
  Search,
  Copy,
  Check,
  Calendar,
  Percent,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreVertical,
  Trash2,
  TrendingUp,
  X
} from 'lucide-react';

interface OfferItem {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minNights: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'scheduled' | 'expired';
  usageCount: number;
  revenueGenerated: number;
}

const INITIAL_OFFERS: OfferItem[] = [
  {
    id: 'off-1',
    code: 'WEEKEND15',
    title: 'Weekend Staycation Special',
    description: '15% discount for weekend getaways checking in Friday through Sunday.',
    discountType: 'percentage',
    discountValue: 15,
    minNights: 2,
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    status: 'active',
    usageCount: 24,
    revenueGenerated: 1680000,
  },
  {
    id: 'off-2',
    code: 'LONGSTAY20',
    title: 'Extended Residence Offer',
    description: '20% off for guests booking 7 nights or longer with complimentary weekly laundry.',
    discountType: 'percentage',
    discountValue: 20,
    minNights: 7,
    startDate: '2026-08-01',
    endDate: '2026-11-30',
    status: 'active',
    usageCount: 11,
    revenueGenerated: 1120000,
  },
  {
    id: 'off-3',
    code: 'EARLYBIRD',
    title: 'Advance Planner Discount',
    description: '10% off when reserved at least 14 days before arrival date.',
    discountType: 'percentage',
    discountValue: 10,
    minNights: 1,
    startDate: '2026-09-15',
    endDate: '2026-10-31',
    status: 'active',
    usageCount: 16,
    revenueGenerated: 540000,
  },
  {
    id: 'off-4',
    code: 'INDEPENDENCE26',
    title: 'October Independence Holiday',
    description: '₦20,000 flat voucher discount for stays over the Nigerian Independence holiday week.',
    discountType: 'fixed',
    discountValue: 20000,
    minNights: 2,
    startDate: '2026-10-01',
    endDate: '2026-10-05',
    status: 'scheduled',
    usageCount: 0,
    revenueGenerated: 0,
  },
  {
    id: 'off-5',
    code: 'SUMMERVIBE',
    title: 'Summer Getaway',
    description: '12% discount on all Deluxe rooms during August summer holiday.',
    discountType: 'percentage',
    discountValue: 12,
    minNights: 3,
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    status: 'expired',
    usageCount: 38,
    revenueGenerated: 2840000,
  },
];

export default function OffersPage() {
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [offers, setOffers] = React.useState<OfferItem[]>(INITIAL_OFFERS);
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'scheduled' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // New offer modal state
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [formCode, setFormCode] = React.useState('');
  const [formTitle, setFormTitle] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [formType, setFormType] = React.useState<'percentage' | 'fixed'>('percentage');
  const [formValue, setFormValue] = React.useState(15);
  const [formMinNights, setFormMinNights] = React.useState(1);
  const [formStartDate, setFormStartDate] = React.useState('2026-09-24');
  const [formEndDate, setFormEndDate] = React.useState('2026-12-31');

  const filteredOffers = offers.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        o.code.toLowerCase().includes(q) ||
        o.title.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalRevenue = offers.reduce((acc, o) => acc + o.revenueGenerated, 0);
  const totalClaims = offers.reduce((acc, o) => acc + o.usageCount, 0);
  const activeCount = offers.filter((o) => o.status === 'active').length;

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleStatus = (id: string) => {
    setOffers((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        return {
          ...o,
          status: o.status === 'active' ? 'expired' : 'active',
        };
      })
    );
  };

  const handleCreateOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode || !formTitle) return;

    const newOffer: OfferItem = {
      id: `off-${Date.now()}`,
      code: formCode.toUpperCase().replace(/\s+/g, ''),
      title: formTitle,
      description: formDescription || `${formValue}${formType === 'percentage' ? '%' : '₦'} off promo`,
      discountType: formType,
      discountValue: Number(formValue),
      minNights: Number(formMinNights),
      startDate: formStartDate,
      endDate: formEndDate,
      status: 'active',
      usageCount: 0,
      revenueGenerated: 0,
    };

    setOffers([newOffer, ...offers]);
    setCreateModalOpen(false);
    // Reset form
    setFormCode('');
    setFormTitle('');
    setFormDescription('');
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title="Offers & Promotions"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              Offers & Promotions
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Create and manage promo codes, seasonal specials, and direct booking incentives.
            </p>
          </div>

          <Button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 self-start sm:self-auto text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Offer</span>
          </Button>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[10px] sm:text-[11px] text-[#7A7267] uppercase font-semibold">Active Promotions</span>
            <div className="text-xl sm:text-2xl font-serif text-[#191816] mt-1">{activeCount}</div>
            <p className="text-[10px] sm:text-[11px] text-emerald-700 mt-1 font-medium">Currently live</p>
          </div>
          <div className="p-3 sm:p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[10px] sm:text-[11px] text-[#7A7267] uppercase font-semibold">Revenue Generated</span>
            <div className="text-xl sm:text-2xl font-serif text-[#191816] mt-1">₦{totalRevenue.toLocaleString()}</div>
            <p className="text-[10px] sm:text-[11px] text-[#7A7267] mt-1">All campaigns</p>
          </div>
          <div className="p-3 sm:p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[10px] sm:text-[11px] text-[#7A7267] uppercase font-semibold">Bookings Claimed</span>
            <div className="text-xl sm:text-2xl font-serif text-[#191816] mt-1">{totalClaims}</div>
            <p className="text-[10px] sm:text-[11px] text-[#7A7267] mt-1">Direct guests</p>
          </div>
          <div className="p-3 sm:p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[10px] sm:text-[11px] text-[#7A7267] uppercase font-semibold">Avg. Conversion</span>
            <div className="text-xl sm:text-2xl font-serif text-[#191816] mt-1">+18.4%</div>
            <p className="text-[10px] sm:text-[11px] text-emerald-700 mt-1 font-medium">Checkout boost</p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
            {[
              { id: 'all', label: 'All Offers' },
              { id: 'active', label: 'Active' },
              { id: 'scheduled', label: 'Scheduled' },
              { id: 'expired', label: 'Expired / Paused' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-[#191816] text-white'
                    : 'bg-[#FAFAFA] border border-[#E8E2DA] text-[#7A7267] hover:text-[#191816]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#7A7267]" />
            <input
              type="text"
              placeholder="Search code or offer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816] w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
            />
          </div>
        </div>

        {/* Offers Table / Cards */}
        <div className="border border-[#E8E2DA] rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-[#FAFAFA] border-b border-[#E8E2DA] text-[#7A7267] uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Promo Code & Title</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Min. Nights</th>
                  <th className="py-3 px-4">Validity Window</th>
                  <th className="py-3 px-4">Claims</th>
                  <th className="py-3 px-4">Revenue</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2DA]">
                {filteredOffers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-[#7A7267]">
                      No promotions found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredOffers.map((offer) => (
                    <tr key={offer.id} className="hover:bg-[#FAFAFA]/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold px-2 py-0.5 rounded bg-[#FAFAFA] border border-[#E8E2DA] text-[#191816]">
                              {offer.code}
                            </span>
                            <button
                              onClick={() => handleCopyCode(offer.id, offer.code)}
                              className="text-[#7A7267] hover:text-[#191816]"
                              title="Copy promo code"
                            >
                              {copiedId === offer.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="font-medium text-[#191816]">{offer.title}</div>
                          <p className="text-[11px] text-[#7A7267] line-clamp-1">
                            {offer.description}
                          </p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-[#191816]">
                        {offer.discountType === 'percentage'
                          ? `${offer.discountValue}% OFF`
                          : `₦${offer.discountValue.toLocaleString()} OFF`}
                      </td>

                      <td className="py-3.5 px-4 text-[#7A7267]">
                        {offer.minNights} {offer.minNights === 1 ? 'night' : 'nights'}
                      </td>

                      <td className="py-3.5 px-4 text-[#7A7267]">
                        <div className="font-mono text-[11px]">
                          {offer.startDate} to {offer.endDate}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-[#191816]">{offer.usageCount}</span>
                        <span className="text-[10px] text-[#7A7267] block">reservations</span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-[#191816]">
                        ₦{offer.revenueGenerated.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        {offer.status === 'active' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                        {offer.status === 'scheduled' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-2.5 h-2.5" />
                            Scheduled
                          </span>
                        )}
                        {offer.status === 'expired' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                            Paused / Expired
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(offer.id)}
                          className="text-xs font-medium text-[#B85C3E] hover:underline"
                        >
                          {offer.status === 'active' ? 'Pause' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create Offer Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E8E2DA] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#E8E2DA] flex items-center justify-between">
              <h3 className="text-base font-serif font-normal text-[#191816]">
                Create New Promotion
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-[#7A7267] hover:text-[#191816]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOffer} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Promo Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FESTIVE20"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs font-mono uppercase text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Discount Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  >
                    <option value="percentage">Percentage (% off)</option>
                    <option value="fixed">Fixed Amount (₦ off)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1">
                  Offer Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End of Year Festive Special"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Discount Value {formType === 'percentage' ? '(%)' : '(₦)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formValue}
                    onChange={(e) => setFormValue(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Min. Nights Required
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMinNights}
                    onChange={(e) => setFormMinNights(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1">
                  Public Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Shown to guests during direct checkout..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8E2DA]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded border border-[#E8E2DA] bg-white text-xs font-medium text-[#191816] hover:bg-[#FAFAFA]"
                >
                  Cancel
                </button>
                <Button type="submit" className="text-xs">
                  Create Promotion
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={() => {}}
      />
    </div>
  );
}
