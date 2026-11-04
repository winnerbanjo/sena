'use client';

import * as React from 'react';
import { Topbar } from '../../../components/topbar';
import { pageMain, pageStack } from '../../../components/design';
import { useToast } from '../../../components/toast-notification';
import { Plus, CreditCard, Clock, Calendar, Check, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@sena/ui';
import { PageLoadState } from '../../../components/page-load-state';

export default function GymPlansPage() {
  const toast = useToast();
  const [plans, setPlans] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [newPlanOpen, setNewPlanOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form inputs
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [durationMonths, setDurationMonths] = React.useState('1');
  const [priceNaira, setPriceNaira] = React.useState('');
  const [regFeeNaira, setRegFeeNaira] = React.useState('0');
  const [accessHours, setAccessHours] = React.useState('all_hours');
  const [maxClassCredits, setMaxClassCredits] = React.useState('4');

  const fetchPlans = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/gym/plans');
      if (!res.ok) throw new Error('Failed to load plans');
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (err: any) {
      setLoadError(true);
      toast.error('Plans', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = Number(priceNaira);
    if (!name.trim() || isNaN(priceNum) || priceNum <= 0) {
      toast.error('Invalid Details', 'Please provide a valid plan name and price');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/gym/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          durationMonths: Number(durationMonths) || 1,
          priceMinorUnits: priceNum * 100,
          registrationFeeMinorUnits: (Number(regFeeNaira) || 0) * 100,
          accessHours,
          maxClassCreditsPerMonth: Number(maxClassCredits) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create plan');

      toast.success('Plan Created', `${data.plan.name} has been published`);
      setNewPlanOpen(false);
      setName('');
      setDescription('');
      setPriceNaira('');
      setRegFeeNaira('0');
      fetchPlans();
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && plans.length === 0) {
    return <PageLoadState title="Membership Plans" failed={loadError} failureKind="error" retry={fetchPlans} />;
  }

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Membership Plans" />

      <main className={pageMain + ' max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6'}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-serif text-[#71382D]">Membership Passes & Plans</h1>
            <p className="text-xs text-[#7A7267] mt-0.5">
              Configure membership tiers, pricing, duration intervals, and class access allowances.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNewPlanOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Membership Plan</span>
          </button>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-[#E8E1D5] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6 hover:border-[#71382D]/40 transition-colors"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-serif text-[#191816] font-semibold">{p.name}</h2>
                    <span className="text-[11px] font-mono text-[#8C8275]">
                      Duration: {p.durationMonths} {p.durationMonths === 1 ? 'month' : 'months'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {p.status}
                  </span>
                </div>

                <div className="pt-2">
                  <div className="text-3xl font-serif text-[#71382D] font-bold">
                    ₦{(p.priceMinorUnits / 100).toLocaleString()}
                  </div>
                  {p.registrationFeeMinorUnits > 0 && (
                    <span className="text-[11px] text-[#8C8275]">
                      + ₦{(p.registrationFeeMinorUnits / 100).toLocaleString()} registration fee
                    </span>
                  )}
                </div>

                {p.description && <p className="text-xs text-[#7A7267] leading-relaxed">{p.description}</p>}

                <div className="pt-2 border-t border-[#E8E1D5] space-y-2 text-xs text-[#555]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#8C8275]" />
                    <span className="capitalize">{p.accessHours.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#8C8275]" />
                    <span>{p.maxClassCreditsPerMonth} fitness class credits / mo</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E8E1D5] text-[11px] font-mono text-[#8C8275]">
                Plan ID: {p.id.slice(0, 8)}…
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Create Plan Dialog */}
      {newPlanOpen && (
        <Dialog open={true} onOpenChange={() => setNewPlanOpen(false)}>
          <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif text-[#71382D]">Create Membership Plan</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4 pt-2 text-xs">
              <div>
                <label className="block font-semibold text-[#191816] mb-1">
                  Plan Name <span className="text-[#B85C3E]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Platinum Annual Membership"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">
                    Price (₦) <span className="text-[#B85C3E]">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="25000"
                    value={priceNaira}
                    onChange={(e) => setPriceNaira(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Duration (Months)</label>
                  <select
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] bg-white focus:outline-none focus:border-[#71382D]"
                  >
                    <option value="1">1 Month</option>
                    <option value="3">3 Months (Quarterly)</option>
                    <option value="6">6 Months (Bi-annual)</option>
                    <option value="12">12 Months (Annual)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Reg Fee (₦)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={regFeeNaira}
                    onChange={(e) => setRegFeeNaira(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Class Credits / mo</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="4"
                    value={maxClassCredits}
                    onChange={(e) => setMaxClassCredits(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#191816] mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Includes towel service, sauna access, and guest day passes"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <button
                  type="button"
                  onClick={() => setNewPlanOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E1D5] text-xs font-medium text-[#191816]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs"
                >
                  {submitting ? 'Publishing…' : 'Publish Plan'}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
