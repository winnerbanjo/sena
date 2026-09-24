'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function OnboardingPlansPage() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = React.useState<'essential' | 'growth' | 'pro'>('growth');
  const [isLoading, setIsLoading] = React.useState(false);
  const [propertyName, setPropertyName] = React.useState('Your Property');

  React.useEffect(() => {
    try {
      const name = localStorage.getItem('sena_property_name');
      if (name) setPropertyName(name);
    } catch (e) {}
  }, []);

  async function handleSelectTrial(plan: 'essential' | 'growth' | 'pro') {
    setSelectedPlan(plan);
    setIsLoading(true);

    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle }),
      });

      if (!res.ok) {
        throw new Error('Failed to activate trial');
      }

      localStorage.setItem('sena_trial_plan', plan);
      localStorage.setItem('sena_trial_started_at', new Date().toISOString());

      // Seamless entry into property overview
      router.push('/');
    } catch (err) {
      console.error('Error activating trial:', err);
      // Fallback transition
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#191816] flex flex-col justify-between p-6 sm:p-12">
      {/* Top Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between pb-8 border-b border-[#E8E1D5]">
        <Link href="https://sena.ng" className="opacity-90 hover:opacity-100 transition-opacity">
          <Image
            src="/assets/sena-logo.png"
            alt="Sena"
            width={96}
            height={32}
            priority
            className="h-6 sm:h-7 w-auto object-contain"
          />
        </Link>

        <span className="text-xs font-mono text-[#8C8275] tracking-wider uppercase">
          Step 5 of 5 &middot; Operating Tier
        </span>
      </header>

      {/* Main Paywall Stage: Editorial & Restrained */}
      <main className="max-w-5xl mx-auto w-full py-12 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-[11px] font-mono tracking-widest uppercase text-[#B85C3E]">
            Property Onboarding Complete
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#71382D]">
            {propertyName} is ready. Start with 3 days on us.
          </h1>
          <p className="text-sm text-[#7A7267] leading-relaxed">
            Every Sena tier includes full access to your master calendar, zero-commission booking engine, and front desk operations for 3 days. No immediate card charge.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-4 flex items-center justify-center gap-2">
            <div className="inline-flex items-center bg-[#EAE3D9]/60 p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-md transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-[#191816] font-medium shadow-xs'
                    : 'text-[#7A7267] hover:text-[#191816]'
                }`}
              >
                Monthly billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  billingCycle === 'yearly'
                    ? 'bg-white text-[#191816] font-medium shadow-xs'
                    : 'text-[#7A7267] hover:text-[#191816]'
                }`}
              >
                <span>Annual billing</span>
                <span className="text-[10px] bg-[#FAF4EF] text-[#B85C3E] px-1.5 py-0.2 rounded font-medium border border-[#E5D4BC]">
                  2 months free
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Tier Cards - Human, Asymmetrical Emphasis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* 1. Essential */}
          <div className="bg-white rounded-xl border border-[#E8E1D5] p-7 flex flex-col justify-between space-y-6 shadow-xs hover:border-[#D5CABA] transition-colors">
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8275]">
                  The Foundations
                </span>
                <h3 className="text-xl font-serif text-[#191816] mt-1">
                  Essential
                </h3>
                <p className="text-xs text-[#7A7267] mt-1 leading-relaxed">
                  For boutique guest houses and serviced apartments with up to 10 rooms.
                </p>
              </div>

              <div className="pt-2 border-t border-[#F0ECE4]">
                <div className="text-2xl font-serif text-[#191816]">
                  {billingCycle === 'monthly' ? '₦25,000' : '₦250,000'}
                  <span className="text-xs font-sans text-[#7A7267] font-normal">
                    {billingCycle === 'monthly' ? ' / month' : ' / year'}
                  </span>
                </div>
                <span className="text-[11px] text-[#2E6B4F] font-medium block mt-1">
                  Free for first 3 days
                </span>
              </div>

              <ul className="space-y-2.5 text-xs text-[#5C564D] pt-2">
                <li className="flex items-center gap-2">
                  <span className="text-[#2E6B4F]">&bull;</span>
                  <span>Up to 10 configured rooms</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#2E6B4F]">&bull;</span>
                  <span>Zero-commission booking engine</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#2E6B4F]">&bull;</span>
                  <span>Master calendar & front desk</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#2E6B4F]">&bull;</span>
                  <span>2 staff accounts</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSelectTrial('essential')}
              className="w-full h-11 rounded-md border border-[#E8E1D5] hover:bg-[#FAF7F2] text-xs font-medium text-[#191816] transition-colors disabled:opacity-50"
            >
              Start 3-Day Free Trial
            </button>
          </div>

          {/* 2. Growth (Featured / Recommended) */}
          <div className="bg-[#FAF7F2] rounded-xl border-2 border-[#71382D] p-7 flex flex-col justify-between space-y-6 shadow-sm relative">
            <span className="absolute -top-3 right-6 px-2.5 py-0.5 bg-[#71382D] text-white text-[10px] font-mono tracking-wider uppercase rounded-full">
              Most Selected
            </span>

            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#B85C3E]">
                  Complete Operating System
                </span>
                <h3 className="text-2xl font-serif text-[#71382D] mt-1">
                  Growth
                </h3>
                <p className="text-xs text-[#7A7267] mt-1 leading-relaxed">
                  For mid-size boutique hotels up to 30 rooms requiring rate plans and housekeeping logs.
                </p>
              </div>

              <div className="pt-2 border-t border-[#E8E1D5]">
                <div className="text-3xl font-serif text-[#191816]">
                  {billingCycle === 'monthly' ? '₦50,000' : '₦500,000'}
                  <span className="text-xs font-sans text-[#7A7267] font-normal">
                    {billingCycle === 'monthly' ? ' / month' : ' / year'}
                  </span>
                </div>
                <span className="text-[11px] text-[#2E6B4F] font-semibold block mt-1">
                  Free for first 3 days &middot; Cancel anytime
                </span>
              </div>

              <ul className="space-y-2.5 text-xs text-[#191816] pt-2">
                <li className="flex items-center gap-2">
                  <span className="text-[#B85C3E]">&check;</span>
                  <span><strong>Up to 30 rooms</strong> included</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#B85C3E]">&check;</span>
                  <span>Interactive tape chart & housekeeping app</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#B85C3E]">&check;</span>
                  <span>Daily morning brief & night audit reports</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#B85C3E]">&check;</span>
                  <span>5 staff logins with role permissions</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#B85C3E]">&check;</span>
                  <span>Dynamic weekend pricing & promotional yields</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSelectTrial('growth')}
              className="w-full h-11 rounded-md bg-[#B85C3E] hover:bg-[#A34E32] text-white text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading && selectedPlan === 'growth' ? 'Activating Trial...' : 'Start 3-Day Free Trial &rarr;'}
            </button>
          </div>

          {/* 3. Pro */}
          <div className="bg-white rounded-xl border border-[#E8E1D5] p-7 flex flex-col justify-between space-y-6 shadow-xs hover:border-[#D5CABA] transition-colors">
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8275]">
                  Multi-Property & Scale
                </span>
                <h3 className="text-xl font-serif text-[#191816] mt-1">
                  Pro
                </h3>
                <p className="text-xs text-[#7A7267] mt-1 leading-relaxed">
                  For large properties up to 100 rooms or multi-unit hospitality groups.
                </p>
              </div>

              <div className="pt-2 border-t border-[#F0ECE4]">
                <div className="text-2xl font-serif text-[#191816]">
                  {billingCycle === 'monthly' ? '₦100,000' : '₦1,000,000'}
                  <span className="text-xs font-sans text-[#7A7267] font-normal">
                    {billingCycle === 'monthly' ? ' / month' : ' / year'}
                  </span>
                </div>
                <span className="text-[11px] text-[#2E6B4F] font-medium block mt-1">
                  Free for first 3 days
                </span>
              </div>

              <ul className="space-y-2.5 text-xs text-[#5C564D] pt-2">
                <li className="flex items-center gap-2">
                  <span className="text-[#2E6B4F]">&bull;</span>
                  <span>Up to 100 configured rooms</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#2E6B4F]">&bull;</span>
                  <span>15 staff accounts & audit trail logs</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#2E6B4F]">&bull;</span>
                  <span>Direct API & webhook access</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#2E6B4F]">&bull;</span>
                  <span>Dedicated concierge onboarding</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSelectTrial('pro')}
              className="w-full h-11 rounded-md border border-[#E8E1D5] hover:bg-[#FAF7F2] text-xs font-medium text-[#191816] transition-colors disabled:opacity-50"
            >
              Start 3-Day Free Trial
            </button>
          </div>
        </div>

        {/* Quiet Footnote */}
        <div className="text-center pt-4">
          <p className="text-xs text-[#8C8275]">
            Need a custom enterprise setup for multiple hotels?{' '}
            <a href="mailto:support@sena.ng" className="text-[#71382D] underline">
              Speak with our hospitality advisory team
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full pt-8 border-t border-[#E8E1D5] flex items-center justify-between text-xs text-[#8C8275]">
        <span>&copy; 2026 Sena Operating System</span>
        <span>All plans include free updates, daily database backups, and security monitoring.</span>
      </footer>
    </div>
  );
}
