'use client';

import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../../components/topbar';
import { pageMain, pageStack } from '../../../components/design';
import { useToast } from '../../../components/toast-notification';
import { PageLoadState } from '../../../components/page-load-state';
import {
  UserPlus,
  Search,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Filter,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface GymLead {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  source: string;
  status: string;
  trialDate: string | null;
  notes: string | null;
  lossReason: string | null;
  convertedMemberId: string | null;
  createdAt: string;
}

const STAGES = [
  { key: 'all', label: 'All Leads' },
  { key: 'new', label: 'New', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'contacted', label: 'Contacted', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'trial_scheduled', label: 'Trial Booked', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'trial_completed', label: 'Trial Done', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'offered', label: 'Offer Sent', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { key: 'converted', label: 'Converted', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'lost', label: 'Lost', color: 'bg-stone-100 text-stone-600 border-stone-200' },
];

export default function GymLeadsPage() {
  const toast = useToast();
  const [leads, setLeads] = React.useState<GymLead[]>([]);
  const [stagesSummary, setStagesSummary] = React.useState<Record<string, number>>({});
  const [activeStage, setActiveStage] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);

  // Dialog state
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    fullName: '',
    phone: '',
    email: '',
    source: 'walk_in',
    trialDate: '',
    notes: '',
  });

  const fetchLeads = React.useCallback(async () => {
    setLoadError(false);
    try {
      const params = new URLSearchParams();
      if (activeStage !== 'all') params.set('status', activeStage);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/gym/leads?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load gym leads');
      const data = await res.json();
      setLeads(data.leads || []);
      setStagesSummary(data.stagesSummary || {});
    } catch (err: any) {
      setLoadError(true);
      toast.error('Leads CRM', err.message || 'Could not load leads');
    } finally {
      setLoading(false);
    }
  }, [activeStage, search, toast]);

  React.useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phone.trim()) {
      toast.error('Validation', 'Full name and phone number are required.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/gym/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create lead');
      }

      toast.success('Lead Captured', `${formData.fullName} added to pipeline.`);
      setShowAddModal(false);
      setFormData({
        fullName: '',
        phone: '',
        email: '',
        source: 'walk_in',
        trialDate: '',
        notes: '',
      });
      fetchLeads();
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (leadId: string, nextStatus: string) => {
    try {
      const res = await fetch('/api/gym/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast.success('Pipeline Updated', `Lead moved to ${nextStatus.replace('_', ' ')}`);
      fetchLeads();
    } catch (err: any) {
      toast.error('Error', err.message);
    }
  };

  const totalOpenLeads =
    (stagesSummary.new || 0) +
    (stagesSummary.contacted || 0) +
    (stagesSummary.trial_scheduled || 0) +
    (stagesSummary.trial_completed || 0) +
    (stagesSummary.offered || 0);

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Gym Leads CRM" />

      <main className={pageMain + ' space-y-6 max-w-7xl mx-auto w-full p-4 sm:p-6'}>
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-[#E8E1D5] bg-white shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-serif text-[#71382D]">Membership Sales & Lead Pipeline</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#71382D]/10 text-[#71382D]">
                {totalOpenLeads} active leads
              </span>
            </div>
            <p className="text-xs text-[#7A7267] mt-0.5">
              Track gym inquiries, schedule free trials, follow up, and convert prospects to paid members.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-medium shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Lead</span>
          </button>
        </div>

        {/* Funnel Stage Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {STAGES.filter((s) => s.key !== 'all').map((stage) => {
            const count = stagesSummary[stage.key] || 0;
            const isSelected = activeStage === stage.key;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => setActiveStage(isSelected ? 'all' : stage.key)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#71382D] bg-[#71382D]/5 shadow-xs ring-1 ring-[#71382D]'
                    : 'border-[#E8E1D5] bg-white hover:border-[#71382D]/40'
                }`}
              >
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#8C8275] truncate">
                  {stage.label}
                </div>
                <div className="text-lg font-serif font-bold text-[#191816] mt-0.5">{count}</div>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8275]" />
            <input
              type="text"
              placeholder="Search leads by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-[#E8E1D5] bg-white text-[#191816] placeholder-[#8C8275] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
            />
          </div>
          {activeStage !== 'all' && (
            <button
              type="button"
              onClick={() => setActiveStage('all')}
              className="px-3 py-2 text-xs rounded-lg border border-[#E8E1D5] bg-white text-[#71382D] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
            >
              Clear filter ({activeStage})
            </button>
          )}
        </div>

        {/* Leads Table / List */}
        <div className="rounded-xl border border-[#E8E1D5] bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#7A7267]">Loading leads pipeline...</div>
          ) : leads.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-[#8C8275] mx-auto opacity-50" />
              <div className="text-sm font-medium text-[#191816]">No leads found</div>
              <p className="text-xs text-[#7A7267] max-w-sm mx-auto">
                No prospect records match this stage or search query. Click "Add New Lead" to capture a new prospect.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E8E1D5]">
              {leads.map((lead) => {
                const stageObj = STAGES.find((s) => s.key === lead.status);
                return (
                  <div
                    key={lead.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FAF7F2]/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-medium text-[#191816]">{lead.fullName}</strong>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border font-medium ${
                            stageObj?.color || 'bg-stone-50 text-stone-700'
                          }`}
                        >
                          {stageObj?.label || lead.status}
                        </span>
                        <span className="text-[10px] font-mono text-[#8C8275] uppercase px-1.5 py-0.5 bg-stone-100 rounded">
                          {lead.source.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#7A7267]">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#8C8275]" />
                          {lead.phone}
                        </span>
                        {lead.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3 text-[#8C8275]" />
                            {lead.email}
                          </span>
                        )}
                        {lead.trialDate && (
                          <span className="inline-flex items-center gap-1 text-purple-700 font-medium">
                            <Calendar className="w-3 h-3" />
                            Trial: {lead.trialDate}
                          </span>
                        )}
                        <span className="text-[10px] text-[#8C8275]">
                          Added {new Date(lead.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {lead.notes && (
                        <p className="text-xs text-[#524B43] bg-[#FAF7F2] p-2 rounded border border-[#E8E1D5]/60 max-w-xl">
                          "{lead.notes}"
                        </p>
                      )}
                    </div>

                    {/* Pipeline Progression Buttons */}
                    <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                      {lead.status === 'new' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(lead.id, 'contacted')}
                          className="px-2.5 py-1.5 rounded text-xs border border-[#E8E1D5] bg-white hover:bg-[#FAF7F2] text-[#191816] font-medium transition-colors cursor-pointer"
                        >
                          Mark Contacted
                        </button>
                      )}
                      {(lead.status === 'new' || lead.status === 'contacted') && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(lead.id, 'trial_scheduled')}
                          className="px-2.5 py-1.5 rounded text-xs border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 font-medium transition-colors cursor-pointer"
                        >
                          Book Trial
                        </button>
                      )}
                      {lead.status === 'trial_scheduled' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(lead.id, 'trial_completed')}
                          className="px-2.5 py-1.5 rounded text-xs border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-medium transition-colors cursor-pointer"
                        >
                          Trial Completed
                        </button>
                      )}
                      {lead.status === 'trial_completed' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(lead.id, 'offered')}
                          className="px-2.5 py-1.5 rounded text-xs border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800 font-medium transition-colors cursor-pointer"
                        >
                          Send Plan Offer
                        </button>
                      )}
                      {lead.status !== 'converted' && lead.status !== 'lost' && (
                        <Link
                          href={`/gym/members?convertName=${encodeURIComponent(lead.fullName)}&convertPhone=${encodeURIComponent(lead.phone)}&convertEmail=${encodeURIComponent(lead.email || '')}&leadId=${lead.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-xs transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Convert to Member</span>
                        </Link>
                      )}
                      {lead.status !== 'converted' && lead.status !== 'lost' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(lead.id, 'lost')}
                          className="p-1.5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                          title="Mark Lost"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      {lead.status === 'converted' && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Active Member
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: Add New Lead */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-[#E8E1D5] space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8E1D5] pb-3">
                <h2 className="text-base font-serif font-bold text-[#71382D]">Add New Prospect Lead</h2>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-[#8C8275] hover:text-[#191816] text-xs font-mono cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateLead} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Babatunde Johnson"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E1D5] bg-white text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#191816] mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="0803 123 4567"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E1D5] bg-white text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#191816] mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="prospect@gmail.com"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E1D5] bg-white text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#191816] mb-1">Source</label>
                    <select
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E1D5] bg-white text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                    >
                      <option value="walk_in">Walk-in</option>
                      <option value="instagram">Instagram / Social</option>
                      <option value="referral">Member Referral</option>
                      <option value="website">Website / Online</option>
                      <option value="phone">Phone Inquiry</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#191816] mb-1">Trial Date (Optional)</label>
                    <input
                      type="date"
                      value={formData.trialDate}
                      onChange={(e) => setFormData({ ...formData, trialDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E1D5] bg-white text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">Notes / Fitness Goals</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Interested in strength training, works on Adeola Odeku..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E1D5] bg-white text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E1D5]">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-2 text-xs rounded-lg border border-[#E8E1D5] text-[#191816] hover:bg-[#FAF7F2] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Add Lead'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
