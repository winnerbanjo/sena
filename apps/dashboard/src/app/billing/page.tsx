'use client';

import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../components/topbar';
import { NewReservationDialog } from '../../components/new-reservation-dialog';

export default function BillingPage() {
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'yearly'>('monthly');
  const [subData, setSubData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [switching, setSwitching] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState('');

  const fetchSubscription = React.useCallback(async () => {
    try {
      const res = await fetch('/api/subscription');
      if (res.ok) {
        const data = await res.json();
        setSubData(data);
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  async function handleSwitchPlan(plan: string) {
    setSwitching(true);
    setActionMessage('');
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle }),
      });
      if (res.ok) {
        setActionMessage(`Successfully switched to ${plan.toUpperCase()} tier.`);
        fetchSubscription();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSwitching(false);
      setTimeout(() => setActionMessage(''), 4000);
    }
  }

  const currentPlan = subData?.subscription?.plan || 'growth';
  const isTrialing = subData?.isTrialing ?? true;
  const trialDaysLeft = subData?.trialDaysLeft ?? 3;
  const roomCount = subData?.roomCount ?? 8;
  const roomLimit = subData?.subscription?.roomLimit ?? 30;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white text-[#191816]">
      <Topbar
        title="Billing & Subscription"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-10 max-w-5xl w-full mx-auto">
        {/* Editorial Page Header */}
        <div className="border-b border-[#E8E1D5] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#B85C3E] block mb-1">
              Account Infrastructure
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#71382D]">
              Billing &amp; Subscription
            </h1>
            <p className="text-xs text-[#7A7267] mt-1">
              Review your property subscription, trial status, room inventory limits, and tax invoices.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="text-xs text-[#71382D] hover:text-[#B85C3E] underline underline-offset-4 decoration-[#E5D4BC]"
            >
              Property settings &rarr;
            </Link>
          </div>
        </div>

        {actionMessage && (
          <div className="p-3.5 rounded-md bg-[#EFF7F2] border border-[#C6E4CC] text-[#2E6B4F] text-xs font-medium">
            {actionMessage}
          </div>
        )}

        {/* Primary Status Card: Trial vs Active */}
        <div className="bg-[#FAF7F2] rounded-xl border border-[#E8E1D5] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E1D5] pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-serif text-[#191816] capitalize">
                  {currentPlan} Tier
                </h2>
                {isTrialing ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono tracking-wide uppercase bg-[#FEF8EE] text-[#A3681F] border border-[#F2DAC0]">
                    3-Day Free Trial
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono tracking-wide uppercase bg-[#EFF7F2] text-[#2E6B4F] border border-[#C6E4CC]">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-[#7A7267] mt-1">
                {isTrialing
                  ? `Your 3-day trial is currently active with full access to all features. ${trialDaysLeft} days remaining.`
                  : `Next billing date: 24 October 2026 via Paystack.`}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-2xl font-serif text-[#71382D] block">
                {currentPlan === 'essential'
                  ? '₦25,000'
                  : currentPlan === 'pro'
                  ? '₦100,000'
                  : '₦50,000'}
                <span className="text-xs font-sans text-[#7A7267] font-normal"> / month</span>
              </span>
              <span className="text-[11px] text-[#8C8275]">
                {isTrialing ? 'No charge during trial period' : 'Auto-renews monthly'}
              </span>
            </div>
          </div>

          {/* Quotas & Capacity Ledger */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8275] block">
                Room Inventory Usage
              </span>
              <div className="text-lg font-serif text-[#191816] mt-1">
                {roomCount} of {roomLimit} Rooms
              </div>
              <div className="w-full bg-[#EAE3D9] h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#71382D] h-full"
                  style={{ width: `${Math.min(100, Math.round((roomCount / roomLimit) * 100))}%` }}
                />
              </div>
              <span className="text-[11px] text-[#7A7267] mt-1 block">
                {roomLimit - roomCount} rooms available on this tier
              </span>
            </div>

            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8275] block">
                Direct Booking Commission
              </span>
              <div className="text-lg font-serif text-[#2E6B4F] mt-1">
                ₦0 (0% Commission)
              </div>
              <span className="text-[11px] text-[#7A7267] mt-2 block">
                100% direct guest revenue kept by your property
              </span>
            </div>

            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8275] block">
                Payment Channel
              </span>
              <div className="text-lg font-serif text-[#191816] mt-1">
                Paystack Direct
              </div>
              <span className="text-[11px] text-[#7A7267] mt-2 block">
                Linked to official property bank account
              </span>
            </div>
          </div>
        </div>

        {/* Change / Upgrade Tier Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-serif text-[#191816]">
                Available Operating Tiers
              </h2>
              <p className="text-xs text-[#7A7267] mt-0.5">
                Switch plan anytime to match your room capacity and operational needs.
              </p>
            </div>

            {/* Cadence switch */}
            <div className="inline-flex items-center bg-[#FAF7F2] border border-[#E8E1D5] p-1 rounded-md text-xs">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1 rounded transition-colors ${
                  billingCycle === 'monthly' ? 'bg-white text-[#191816] font-medium shadow-xs' : 'text-[#7A7267]'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-3 py-1 rounded transition-colors ${
                  billingCycle === 'yearly' ? 'bg-white text-[#191816] font-medium shadow-xs' : 'text-[#7A7267]'
                }`}
              >
                Yearly (2 mo free)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Essential */}
            <div className={`p-6 rounded-lg border bg-white flex flex-col justify-between space-y-4 ${
              currentPlan === 'essential' ? 'border-[#71382D] ring-1 ring-[#71382D]' : 'border-[#E8E1D5]'
            }`}>
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C8275]">Boutique Foundations</span>
                <h3 className="text-lg font-serif text-[#191816]">Essential</h3>
                <p className="text-xs text-[#7A7267]">Up to 10 rooms. Single property operations.</p>
                <div className="pt-2 text-xl font-serif text-[#191816]">
                  {billingCycle === 'monthly' ? '₦25,000' : '₦250,000'}
                  <span className="text-xs font-sans text-[#7A7267] font-normal"> / {billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
              </div>

              {currentPlan === 'essential' ? (
                <div className="w-full py-2 text-center text-xs font-medium text-[#71382D] bg-[#FAF7F2] rounded border border-[#E8E1D5]">
                  Current Tier
                </div>
              ) : (
                <button
                  type="button"
                  disabled={switching}
                  onClick={() => handleSwitchPlan('essential')}
                  className="w-full h-9 rounded border border-[#E8E1D5] hover:bg-[#FAF7F2] text-xs font-medium text-[#191816] transition-colors"
                >
                  Switch to Essential
                </button>
              )}
            </div>

            {/* Growth */}
            <div className={`p-6 rounded-lg border bg-white flex flex-col justify-between space-y-4 relative ${
              currentPlan === 'growth' ? 'border-[#71382D] ring-2 ring-[#71382D]' : 'border-[#E8E1D5]'
            }`}>
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#B85C3E]">Most Selected</span>
                <h3 className="text-lg font-serif text-[#71382D]">Growth</h3>
                <p className="text-xs text-[#7A7267]">Up to 30 rooms. Multi-rate yield rules &amp; housekeeping.</p>
                <div className="pt-2 text-xl font-serif text-[#191816]">
                  {billingCycle === 'monthly' ? '₦50,000' : '₦500,000'}
                  <span className="text-xs font-sans text-[#7A7267] font-normal"> / {billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
              </div>

              {currentPlan === 'growth' ? (
                <div className="w-full py-2 text-center text-xs font-medium text-[#71382D] bg-[#FAF7F2] rounded border border-[#71382D]/30">
                  Current Tier
                </div>
              ) : (
                <button
                  type="button"
                  disabled={switching}
                  onClick={() => handleSwitchPlan('growth')}
                  className="w-full h-9 rounded bg-[#B85C3E] hover:bg-[#A34E32] text-white text-xs font-semibold tracking-wide transition-colors"
                >
                  Select Growth Tier
                </button>
              )}
            </div>

            {/* Pro */}
            <div className={`p-6 rounded-lg border bg-white flex flex-col justify-between space-y-4 ${
              currentPlan === 'pro' ? 'border-[#71382D] ring-1 ring-[#71382D]' : 'border-[#E8E1D5]'
            }`}>
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C8275]">Hospitality Scale</span>
                <h3 className="text-lg font-serif text-[#191816]">Pro</h3>
                <p className="text-xs text-[#7A7267]">Up to 100 rooms. Multi-property ready, API &amp; audits.</p>
                <div className="pt-2 text-xl font-serif text-[#191816]">
                  {billingCycle === 'monthly' ? '₦100,000' : '₦1,000,000'}
                  <span className="text-xs font-sans text-[#7A7267] font-normal"> / {billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
              </div>

              {currentPlan === 'pro' ? (
                <div className="w-full py-2 text-center text-xs font-medium text-[#71382D] bg-[#FAF7F2] rounded border border-[#E8E1D5]">
                  Current Tier
                </div>
              ) : (
                <button
                  type="button"
                  disabled={switching}
                  onClick={() => handleSwitchPlan('pro')}
                  className="w-full h-9 rounded border border-[#E8E1D5] hover:bg-[#FAF7F2] text-xs font-medium text-[#191816] transition-colors"
                >
                  Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Invoices & Statements */}
        <div className="space-y-4 pt-4 border-t border-[#E8E1D5]">
          <h2 className="text-base font-serif text-[#191816]">
            Invoice History
          </h2>

          <div className="border border-[#E8E1D5] rounded-lg divide-y divide-[#E8E1D5] overflow-hidden">
            <div className="p-4 bg-[#FAF7F2] flex items-center justify-between text-xs text-[#7A7267] font-mono uppercase tracking-wider">
              <span>Invoice</span>
              <span>Billing Period</span>
              <span>Amount</span>
              <span>Status</span>
            </div>

            <div className="p-4 flex items-center justify-between text-xs hover:bg-[#FAF7F2]/50 transition-colors">
              <div>
                <span className="font-mono text-[#191816] font-medium">INV-2026-09-24</span>
                <span className="text-[#8C8275] block text-[11px]">3-Day Free Trial Activation</span>
              </div>
              <span className="text-[#7A7267]">24 Sep &ndash; 27 Sep 2026</span>
              <span className="font-mono text-[#191816]">₦0.00</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide bg-[#EFF7F2] text-[#2E6B4F]">
                Active Trial
              </span>
            </div>
          </div>
        </div>
      </main>

      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={() => {}}
      />
    </div>
  );
}
