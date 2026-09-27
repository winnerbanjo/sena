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
  enabled?: boolean;
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

function Toggle({
  on,
  disabled,
  label,
  description,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  description?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <span className="text-sm font-medium text-[#191816]">{label}</span>
        {description && <p className="text-xs text-[#7A7267] mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71382D] ${
          on ? 'bg-[#2E6B4F]' : 'bg-[#D5CDC3]'
        } disabled:opacity-50`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            on ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
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

  const isEnabled = paystack.enabled !== false && paystack.acceptOnlinePayments !== false;
  const display = paystack.displayStatus || (paystack.status === 'disconnected' ? 'disconnected' : 'connected');
  const managed = display !== 'disconnected';
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
          <section className="max-w-xl rounded-xl border border-[#E8E2DA] bg-white p-5 sm:p-6 shadow-2xs">
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
            <section className="rounded-xl border border-[#E8E2DA] bg-white p-5 sm:p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-serif text-xl sm:text-2xl text-[#191816]">Paystack</h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EBF5EF] text-[#2E6B4F] border border-[#C5E3D0]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2E6B4F]" />
                      Connected
                    </span>
                    {paystack.mode && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider text-[#71382D] bg-[#F7F1E8] border border-[#E5D4BC]">
                        {modeLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#7A7267]">
                    {paystack.account || 'Verified Paystack account'} · Connected {when(paystack.connectedAt, '—')}
                  </p>
                </div>

                {canManage && (
                  <div className="flex items-center gap-3 self-start sm:self-auto rounded-lg border border-[#E5D4BC] bg-[#FAF7F2] px-3.5 py-2">
                    <div className="text-right">
                      <div className="text-xs font-medium text-[#191816]">Paystack enabled</div>
                      <div className="text-[10px] text-[#7A7267]">{isEnabled ? 'Active for new payments' : 'Paused for new payments'}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label="Paystack enabled"
                      disabled={busy}
                      onClick={() =>
                        action(
                          'PATCH',
                          { action: 'payments', enabled: !isEnabled },
                          !isEnabled
                            ? 'Paystack enabled. New online payments are now active.'
                            : 'Paystack paused. Existing payment history remains available, but new online payments will not be started.'
                        )
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71382D] ${
                        isEnabled ? 'bg-[#2E6B4F]' : 'bg-[#D5CDC3]'
                      } disabled:opacity-50`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>

              {!isEnabled && (
                <div className="mt-4 rounded-lg bg-[#FAF7F2] border border-[#E5D4BC] p-3 text-xs text-[#71382D] leading-relaxed">
                  Paystack is paused. Existing payment history remains available, but new online payments will not be started.
                </div>
              )}

              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 pt-4 border-t border-[#E8E2DA]">
                <div>
                  <dt className="text-xs text-[#7A7267]">Account</dt>
                  <dd className="mt-0.5 text-sm font-medium text-[#191816]">{paystack.account || 'Verified Paystack account'}</dd>
                </div>
                {canManage && (
                  <div>
                    <dt className="text-xs text-[#7A7267]">Secret Key</dt>
                    <dd className="mt-0.5 font-mono text-sm text-[#191816]">{paystack.secret}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-[#7A7267]">Connected</dt>
                  <dd className="mt-0.5 text-sm text-[#191816]">{when(paystack.connectedAt, '—')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#7A7267]">Last verified</dt>
                  <dd className="mt-0.5 text-sm text-[#191816]">{when(paystack.verifiedAt)}</dd>
                </div>
              </dl>
              {!canManage && <p className="mt-4 text-xs text-[#7A7267]">A property owner manages this Paystack connection.</p>}
            </section>
            {canManage && (
            <>
            <section className="rounded-xl border border-[#E8E2DA] bg-white p-5 sm:p-6 shadow-2xs">
              <div>
                <h2 className="font-semibold text-[#191816]">Payment surfaces</h2>
                <p className="mt-1 text-xs text-[#7A7267]">
                  Configure where Paystack online payments are accepted. When Paystack is paused above, these preferences remain stored but inactive.
                </p>
              </div>
              <div className="mt-3 divide-y divide-[#E8E2DA]">
                <Toggle
                  label="Direct booking engine"
                  description="Allow guests to pay online when reserving rooms through your direct booking website."
                  disabled={busy}
                  on={paystack.directBooking !== false}
                  onChange={(next) =>
                    action('PATCH', { action: 'payments', directBooking: next }, next ? 'Direct booking payments are on.' : 'Direct booking payments are off.')
                  }
                />
                <Toggle
                  label="Invoice payment links"
                  description="Include an online Paystack checkout link on guest folios and invoices."
                  disabled={busy}
                  on={paystack.invoices !== false}
                  onChange={(next) =>
                    action('PATCH', { action: 'payments', invoices: next }, next ? 'Invoice payments are on.' : 'Invoice payments are off.')
                  }
                />
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
