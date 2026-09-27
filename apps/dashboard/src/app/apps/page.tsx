'use client';

import * as React from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@sena/ui';
import { CreditCard, Loader2 } from 'lucide-react';
import { Topbar } from '@/components/topbar';

type PaystackState = { id?: string; status: string; mode?: 'test' | 'live'; account?: string; verifiedAt?: string; webhookStatus?: string; webhookUrl?: string; secret?: string | null };

export default function AppsPage() {
  const [paystack, setPaystack] = React.useState<PaystackState>({ status: 'disconnected' });
  const [open, setOpen] = React.useState(false);
  const [replace, setReplace] = React.useState(false);
  const [secretKey, setSecretKey] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');

  const load = React.useCallback(async () => {
    const response = await fetch('/api/apps/paystack', { cache: 'no-store' });
    if (response.ok) setPaystack((await response.json()).paystack);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true); setFeedback('');
    const response = await fetch('/api/apps/paystack', { method: replace ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(replace ? { action: 'replace', secretKey } : { secretKey }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return setFeedback(data.error || "We couldn't connect this Paystack account.");
    setPaystack(data.paystack); setSecretKey(''); setOpen(false); setReplace(false); setFeedback('Paystack connected.');
  }

  async function action(method: 'PATCH' | 'DELETE', body?: object) {
    setBusy(true); setFeedback('');
    const response = await fetch('/api/apps/paystack', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return setFeedback(data.error || 'The connection could not be updated.');
    setPaystack(data.paystack); setFeedback(method === 'DELETE' ? 'Paystack disconnected. Historical payments remain available.' : 'Connection verified.');
  }

  const connected = paystack.status === 'connected' || paystack.status === 'needs_attention';
  return <div className="flex-1 flex flex-col h-screen overflow-hidden"><Topbar title="Apps" /><main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
    <div><h1 className="text-2xl font-serif text-[#191816]">Apps</h1><p className="text-sm text-[#7A7267] mt-1">Connect Sena with the tools you use to run your property.</p></div>
    {feedback && <div role="status" className="rounded border border-[#E8E2DA] bg-white px-4 py-3 text-sm text-[#191816]">{feedback}</div>}
    <section><p className="text-xs font-semibold tracking-widest text-[#7A7267] mb-3">PAYMENTS</p><div className="max-w-2xl rounded border border-[#E8E2DA] bg-white p-5">
      <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="rounded bg-[#F5EEE9] p-2"><CreditCard className="h-5 w-5 text-[#71382D]" /></div><div><h2 className="font-semibold text-[#191816]">Paystack</h2><p className="mt-1 text-sm text-[#7A7267]">Accept online payments through your own Paystack account.</p></div></div>
      {!connected ? <Button onClick={() => setOpen(true)}>Connect</Button> : <span className={`text-xs font-semibold ${paystack.status === 'connected' ? 'text-emerald-700' : 'text-amber-700'}`}>● {paystack.status === 'connected' ? 'Connected' : 'Needs attention'}</span>}</div>
      {connected && <div className="mt-5 grid gap-3 border-t border-[#E8E2DA] pt-4 text-sm sm:grid-cols-2"><div><span className="text-[#7A7267]">Account</span><p>{paystack.account}</p></div><div><span className="text-[#7A7267]">Mode</span><p className={paystack.mode === 'test' ? 'font-semibold text-amber-700' : ''}>{paystack.mode === 'test' ? 'Test Mode' : 'Live'}</p></div><div><span className="text-[#7A7267]">Secret Key</span><p className="font-mono">{paystack.secret}</p></div><div><span className="text-[#7A7267]">Webhook</span><p>{paystack.webhookStatus === 'active' ? 'Active' : paystack.webhookStatus === 'needs_attention' ? 'Needs attention' : 'Waiting for event'}</p></div><div className="sm:col-span-2"><span className="text-[#7A7267]">Webhook URL</span><div className="mt-1 flex gap-2"><code className="min-w-0 flex-1 truncate rounded bg-[#F9F7F5] px-2 py-2 text-xs">{paystack.webhookUrl}</code><Button variant="outline" onClick={() => navigator.clipboard.writeText(paystack.webhookUrl || '')}>Copy</Button></div><p className="mt-1 text-xs text-[#7A7267]">Add this URL in Paystack Dashboard under API Keys &amp; Webhooks.</p></div><div className="sm:col-span-2 flex flex-wrap gap-2 pt-2"><Button variant="outline" disabled={busy} onClick={() => action('PATCH', { action: 'test' })}>Test Connection</Button><Button variant="outline" onClick={() => { setReplace(true); setOpen(true); }}>Replace API Key</Button><Button variant="outline" disabled={busy} onClick={() => action('DELETE')}>Disconnect Paystack</Button></div></div>}
    </div></section>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{replace ? 'Replace Paystack API Key' : 'Connect Paystack'}</DialogTitle><DialogDescription>Accept online payments directly through your own Paystack account. Payments are processed and settled according to your Paystack account settings.</DialogDescription></DialogHeader><div className="space-y-2"><label htmlFor="paystack-secret" className="text-sm font-medium">Secret Key</label><Input id="paystack-secret" type="password" autoComplete="off" placeholder="sk_live________________" value={secretKey} onChange={(event) => setSecretKey(event.target.value)} /><p className="text-xs text-[#7A7267]">Find this in Paystack Dashboard → Settings → API Keys &amp; Webhooks.</p></div>{feedback && <p className="text-sm text-red-700">{feedback}</p>}<DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !secretKey.trim()} onClick={save}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{replace ? 'Replace API Key' : 'Connect Paystack'}</Button></DialogFooter></DialogContent></Dialog>
  </main></div>;
}
