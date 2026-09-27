'use client';

import * as React from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@sena/ui';
import { CreditCard, Loader2 } from 'lucide-react';
import { Topbar } from '@/components/topbar';

type PaystackState = {
  status: string;
  displayStatus?: 'disconnected' | 'connected' | 'needs_attention' | 'disabled';
  mode?: 'test' | 'live';
  account?: string | null;
  connectedAt?: string | null;
  verifiedAt?: string | null;
  webhookStatus?: string;
  webhookVerifiedAt?: string | null;
  lastWebhookAt?: string | null;
  webhookUrl?: string;
  secret?: string | null;
  acceptOnlinePayments?: boolean;
  directBooking?: boolean;
  invoices?: boolean;
};

const empty: PaystackState = { status: 'disconnected', displayStatus: 'disconnected' };

function when(value?: string | null, emptyLabel = 'Not verified yet') {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

function Toggle({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-[#191816]">{label}</span>
      <button
        type="button"
        aria-pressed={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`min-w-16 rounded px-3 py-1.5 text-xs font-semibold ${on ? 'bg-[#2E6B4F] text-white' : 'bg-[#F3EFEA] text-[#7A7267]'} disabled:opacity-50`}
      >
        {on ? 'On' : 'Off'}
      </button>
    </div>
  );
}

export default function AppsPage() {
  const [paystack, setPaystack] = React.useState<PaystackState>(empty);
  const [open, setOpen] = React.useState(false);
  const [replace, setReplace] = React.useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [secretKey, setSecretKey] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [canManage, setCanManage] = React.useState(false);

  const load = React.useCallback(async () => {
    const response = await fetch('/api/apps/paystack', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      setCanManage(Boolean(data.canManage));
      setPaystack(data.paystack);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true);
    setFeedback('');
    const response = await fetch('/api/apps/paystack', {
      method: replace ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replace ? { action: 'replace', secretKey } : { secretKey }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setFeedback(data.error || "We couldn't connect this Paystack account.");
    setPaystack(data.paystack);
    setSecretKey('');
    setOpen(false);
    setReplace(false);
    setFeedback(replace ? 'Secret key replaced.' : 'Paystack connected.');
  }

  async function action(method: 'PATCH' | 'DELETE', body?: object, success = 'Saved.') {
    setBusy(true);
    setFeedback('');
    const response = await fetch('/api/apps/paystack', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setFeedback(data.error || 'The connection could not be updated.');
    setPaystack(data.paystack);
    setFeedback(success);
  }

  const display = paystack.displayStatus || (paystack.status === 'disconnected' ? 'disconnected' : 'connected');
  const managed = display !== 'disconnected';
  const statusLabel = display === 'connected' ? 'Connected' : display === 'needs_attention' ? 'Needs attention' : display === 'disabled' ? 'Disabled' : 'Not connected';
  const modeLabel = paystack.mode === 'test' ? 'Test Mode' : paystack.mode === 'live' ? 'Live Mode' : '';
  const webhookLabel = paystack.webhookStatus === 'active' ? 'Active' : paystack.webhookStatus === 'needs_attention' ? 'Needs attention' : 'Waiting for event';

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title="Apps" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-serif text-[#191816]">Paystack</h1>
          <p className="mt-1 text-sm text-[#7A7267]">Accept online payments through this property&apos;s own Paystack account.</p>
        </div>
        {feedback && <div role="status" className="max-w-3xl rounded border border-[#E8E2DA] bg-white px-4 py-3 text-sm text-[#191816]">{feedback}</div>}

        {!managed ? (
          <section className="max-w-xl rounded border border-[#E8E2DA] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="rounded bg-[#F5EEE9] p-2"><CreditCard className="h-5 w-5 text-[#71382D]" /></div>
              <div>
                <h2 className="font-semibold text-[#191816]">Paystack</h2>
                <p className="mt-1 text-sm text-[#7A7267]">Available · Not connected</p>
              </div>
            </div>
            {canManage ? (
              <Button className="mt-5" onClick={() => { setReplace(false); setFeedback(''); setOpen(true); }}>Connect</Button>
            ) : (
              <p className="mt-5 text-sm text-[#7A7267]">A property owner can connect this property&apos;s Paystack account.</p>
            )}
          </section>
        ) : (
          <div className="max-w-3xl space-y-5">
            <section className="rounded border border-[#E8E2DA] bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl text-[#191816]">Paystack</h2>
                  <p className={`mt-1 text-sm font-semibold ${display === 'needs_attention' || display === 'disabled' ? 'text-amber-700' : 'text-[#2E6B4F]'}`}>{statusLabel}</p>
                  {modeLabel && <p className={`text-sm ${paystack.mode === 'test' ? 'font-semibold text-amber-700' : 'text-[#191816]'}`}>{modeLabel}</p>}
                </div>
                <CreditCard className="h-5 w-5 text-[#71382D]" />
              </div>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-[#7A7267]">Account</dt><dd className="mt-1 text-[#191816]">{paystack.account || 'Verified Paystack account'}</dd></div>
                {canManage && <div><dt className="text-[#7A7267]">Secret Key</dt><dd className="mt-1 font-mono text-[#191816]">{paystack.secret}</dd></div>}
                <div><dt className="text-[#7A7267]">Connected</dt><dd className="mt-1 text-[#191816]">{when(paystack.connectedAt, '—')}</dd></div>
                <div><dt className="text-[#7A7267]">Last verified</dt><dd className="mt-1 text-[#191816]">{when(paystack.verifiedAt)}</dd></div>
              </dl>
              {!canManage && <p className="mt-4 text-sm text-[#7A7267]">A property owner manages this Paystack connection.</p>}
            </section>
            {canManage && (
            <>
            <section className="rounded border border-[#E8E2DA] bg-white p-5">
              <h2 className="font-semibold text-[#191816]">Accept online payments</h2>
              <p className="mt-1 text-sm text-[#7A7267]">Turning this off stops new Paystack payments. Past payments stay in Sena.</p>
              <div className="mt-2 divide-y divide-[#E8E2DA]">
                <Toggle label="Accept online payments with Paystack" disabled={busy} on={paystack.acceptOnlinePayments !== false} onChange={(next) => action('PATCH', { action: 'payments', acceptOnlinePayments: next }, next ? 'Online payments are on.' : 'Online payments are off. Past payments are unchanged.')} />
                <Toggle label="Direct booking" disabled={busy || paystack.acceptOnlinePayments === false} on={paystack.directBooking !== false} onChange={(next) => action('PATCH', { action: 'payments', directBooking: next }, next ? 'Direct booking payments are on.' : 'Direct booking payments are off.')} />
                <Toggle label="Invoice payment links" disabled={busy || paystack.acceptOnlinePayments === false} on={paystack.invoices !== false} onChange={(next) => action('PATCH', { action: 'payments', invoices: next }, next ? 'Invoice payments are on.' : 'Invoice payments are off.')} />
              </div>
            </section>

            <section className="rounded border border-[#E8E2DA] bg-white p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-[#191816]">Webhook</h2>
                <p className="mt-1 text-sm text-[#7A7267]">Paystack uses this address to tell Sena when a payment succeeds.</p>
              </div>
              <div>
                <p className="text-xs text-[#7A7267]">Webhook URL</p>
                <div className="mt-1 flex gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-[#F9F7F5] px-2 py-2 text-xs">{paystack.webhookUrl}</code>
                  <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(paystack.webhookUrl || ''); setCopied(true); }}>Copy</Button>
                </div>
                {copied && <p className="mt-1 text-xs text-[#2E6B4F]">Copied.</p>}
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-[#7A7267]">Webhook status</dt><dd className="mt-1">{webhookLabel}</dd></div>
                <div><dt className="text-[#7A7267]">Last webhook received</dt><dd className="mt-1">{when(paystack.lastWebhookAt, 'No webhook received yet')}</dd></div>
                <div><dt className="text-[#7A7267]">Last verified webhook</dt><dd className="mt-1">{when(paystack.webhookVerifiedAt)}</dd></div>
              </dl>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-[#7A7267]">
                <li>Open Paystack Dashboard.</li>
                <li>Go to Settings → API Keys &amp; Webhooks.</li>
                <li>Find the Webhook URL field.</li>
                <li>Paste the Sena webhook URL.</li>
                <li>Save.</li>
                <li>Return to Sena.</li>
                <li>Complete a Paystack test payment.</li>
              </ol>
            </section>

            <section className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy} onClick={() => action('PATCH', { action: 'test' }, 'Paystack connection verified.')}>Test Connection</Button>
              <Button variant="outline" onClick={() => { setReplace(true); setSecretKey(''); setFeedback(''); setOpen(true); }}>Replace Secret Key</Button>
              <Button variant="outline" disabled={busy} onClick={() => setConfirmDisconnect(true)}>Disconnect Paystack</Button>
            </section>
            </>
            )}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{replace ? 'Replace Secret Key' : 'Connect Paystack'}</DialogTitle>
              <DialogDescription>Payments are collected by this property&apos;s own Paystack account.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor="paystack-secret" className="text-sm font-medium">Paystack Secret Key</label>
              <Input id="paystack-secret" type="password" autoComplete="off" placeholder="sk_test_ or sk_live_" value={secretKey} onChange={(event) => setSecretKey(event.target.value)} />
              <p className="text-xs text-[#7A7267]">Find your Secret Key in your Paystack Dashboard under Settings → API Keys &amp; Webhooks.</p>
            </div>
            {feedback && <p className="text-sm text-red-700">{feedback}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={busy || !secretKey.trim()} onClick={save}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{replace ? 'Replace Secret Key' : 'Connect Paystack'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disconnect Paystack</DialogTitle>
              <DialogDescription>New online payments will stop. Past payments, invoices, reservations, and receipts stay in Sena.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDisconnect(false)}>Cancel</Button>
              <Button disabled={busy} onClick={() => { setConfirmDisconnect(false); void action('DELETE', undefined, 'Paystack disconnected. Historical payments remain available.'); }}>Disconnect Paystack</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
