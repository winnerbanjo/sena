'use client';
import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../components/topbar';
import { Button } from '@sena/ui';
import { PwaInstallCard } from '../../components/pwa-install-card';

type Profile = { name: string; propertyType: string; address: string; email: string; phone: string; country: string; timezone: string; checkInTime: string; checkOutTime: string; currency: string };
export default function SettingsPage() {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [tab, setTab] = React.useState('general');
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [failed, setFailed] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string[]>>({});
  const [dirty, setDirty] = React.useState(false);
  const load = React.useCallback(async () => {
    setFailed(false);
    try {
      const response = await fetch('/api/me', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!data.property) throw new Error();
      setProfile(data.property);
    } catch { setFailed(true); setFeedback('We could not load your settings. Please try again.'); }
  }, []);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!profile || saving) return;
    setSaving(true); setFeedback(''); setFields({}); setFailed(false);
    try {
      const response = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
      const data = await response.json();
      if (!response.ok) { setFields(data.fields || {}); throw new Error(data.error || 'Your settings could not be saved. Try again.'); }
      setProfile(data.property); setDirty(false); setFeedback('Settings saved');
    } catch (error) { setFailed(true); setFeedback(error instanceof Error ? error.message : 'Your settings could not be saved. Try again.'); }
    finally { setSaving(false); }
  }
  function field(key: keyof Profile, label: string, type = 'text') {
    return <div key={key} className="space-y-1.5"><label htmlFor={`setting-${key}`} className="block text-sm font-medium">{label}</label><input id={`setting-${key}`} name={key} type={type} value={profile?.[key] || ''} onChange={event => { setProfile(current => current ? { ...current, [key]: event.target.value } : current); setDirty(true); setFeedback(''); }} aria-invalid={!!fields[key]} aria-describedby={fields[key] ? `error-${key}` : undefined} className="min-h-11 w-full rounded border border-[#E5D4BC] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E]" />{fields[key] && <p id={`error-${key}`} className="text-sm text-[#9E382A]">{fields[key][0]}</p>}</div>;
  }
  return <div className="flex-1 flex flex-col h-screen overflow-hidden"><Topbar title="Settings" /><main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
    <div className="flex flex-wrap justify-between items-center gap-4 border-b border-[#E8E2DA] pb-4"><div><h2 className="text-2xl font-serif">Property settings</h2><p className="text-sm text-[#7A7267]">Keep your contact details and arrival times up to date.</p></div>{['general', 'policies'].includes(tab) && <Button form="property-settings" type="submit" disabled={!profile || saving || !dirty}>{saving ? 'Saving…' : 'Save changes'}</Button>}</div>
    <nav aria-label="Settings sections" className="flex gap-4 overflow-x-auto border-b border-[#E8E2DA]">{[['general','General & profile'],['policies','Arrival & departure'],['payments','Payments'],['notifications','Notifications'],['subscription','Billing & plan']].map(([id,label]) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={`min-h-11 shrink-0 border-b-2 px-1 text-sm ${tab === id ? 'border-[#B85C3E] text-[#71382D]' : 'border-transparent text-[#7A7267]'}`}>{label}</button>)}</nav>
    {feedback && <p role={failed ? 'alert' : 'status'} className={failed ? 'text-[#9E382A]' : 'text-[#2E6B4F]'}>{feedback}</p>}
    {!profile ? failed ? <Button onClick={load}>Try again</Button> : <div aria-label="Loading settings" className="max-w-3xl h-80 rounded bg-[#F7F1E8] animate-pulse" /> : <form id="property-settings" onSubmit={save} className="max-w-3xl space-y-6">
      {tab === 'general' && <><div className="grid sm:grid-cols-2 gap-5 rounded-lg border border-[#E8E2DA] p-5">{field('name','Property name')}{field('propertyType','Property type')}{field('email','Contact email','email')}{field('phone','Contact phone','tel')}<div className="sm:col-span-2">{field('address','Address')}</div>{field('country','Country')}{field('timezone','Property timezone')}<p className="text-sm text-[#7A7267] sm:col-span-2">Currency: {profile.currency}. Contact support before changing the currency of an operating property.</p></div><PwaInstallCard /></>}
      {tab === 'policies' && <div className="space-y-5 rounded-lg border border-[#E8E2DA] p-5"><div className="grid sm:grid-cols-2 gap-5">{field('checkInTime','Check-in from','time')}{field('checkOutTime','Check-out by','time')}</div><p className="text-sm text-[#7A7267]">Times use your property timezone. Manage published cancellation and guest policies in your website editor.</p><Link href="/website" className="text-[#71382D] underline">Open website editor</Link></div>}
      {tab === 'payments' && <div className="space-y-3 rounded-lg border border-[#E8E2DA] p-5"><h3 className="font-serif text-lg">Payment records and settlement</h3><p className="text-sm text-[#7A7267]">Review collected payments in Payments. Contact Sena support to verify your settlement account before accepting online payments.</p><Link className="text-[#71382D] underline" href="/payments">View payments</Link></div>}
      {tab === 'notifications' && <div className="space-y-3 rounded-lg border border-[#E8E2DA] p-5"><h3 className="font-serif text-lg">Notification preferences — coming soon</h3><p className="text-sm text-[#7A7267]">Custom notification preferences are not available yet. Existing booking and account emails continue to use the contact details provided.</p></div>}
      {tab === 'subscription' && <div className="space-y-3 rounded-lg border border-[#E8E2DA] p-5"><h3 className="font-serif text-lg">Billing & plan</h3><p className="text-sm text-[#7A7267]">View your current plan, renewal date, and billing history.</p><Link className="text-[#71382D] underline" href="/billing">Open billing & plan</Link></div>}
    </form>}
  </main></div>;
}
