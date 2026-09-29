'use client';
import { useTranslations } from 'next-intl';

import * as React from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@sena/ui';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { ConnectedAppLogo } from '@/components/connected-apps/connected-app-logo';

type FlutterwaveState = {
  status: string;
  displayStatus?: 'disconnected' | 'connected' | 'needs_attention' | 'disabled';
  mode?: 'test' | 'live';
  account?: string | null;
  connectedAt?: string | null;
  verifiedAt?: string | null;
  webhookStatus?: string;
  webhookReadiness?: 'not_configured' | 'configured_unverified' | 'verified' | 'needs_attention';
  webhookVerifiedAt?: string | null;
  lastWebhookAt?: string | null;
  webhookUrl?: string;
  secret?: string | null;
  webhookSecret?: string | null;
  webhookSecretRevealed?: boolean;
  enabled?: boolean;
  acceptOnlinePayments?: boolean;
  directBooking?: boolean;
  invoices?: boolean;
};

const empty: FlutterwaveState = { status: 'disconnected', displayStatus: 'disconnected' };

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
      <div className="min-w-0">
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

export function FlutterwaveConnectionPanel({ onBack }: { onBack?: () => void }) {
  const t = useTranslations('apps');
  const tCommon = useTranslations('common');
  const [flutterwave, setFlutterwave] = React.useState<FlutterwaveState>(empty);
  const [preferred, setPreferred] = React.useState<'paystack' | 'flutterwave' | null>(null);
  const [enabledProviders, setEnabledProviders] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(false);
  const [replace, setReplace] = React.useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [secretKey, setSecretKey] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [copiedHash, setCopiedHash] = React.useState(false);
  const [canManage, setCanManage] = React.useState(false);

  const load = React.useCallback(async () => {
    const [connection, catalog] = await Promise.all([
      fetch('/api/apps/flutterwave', { cache: 'no-store' }),
      fetch('/api/apps/payments', { cache: 'no-store' }),
    ]);
    if (connection.ok) {
      const data = await connection.json();
      setCanManage(Boolean(data.canManage));
      setFlutterwave(data.flutterwave);
    }
    if (catalog.ok) {
      const data = await catalog.json();
      setPreferred(data.preferredOnlineProvider || null);
      setEnabledProviders(Array.isArray(data.enabledProviders) ? data.enabledProviders : []);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true);
    setFeedback('');
    const response = await fetch('/api/apps/flutterwave', {
      method: replace ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replace ? { action: 'replace', secretKey } : { secretKey }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setFeedback(data.error || t('connectionFailed'));
    setFlutterwave(data.flutterwave);
    setSecretKey('');
    setOpen(false);
    setReplace(false);
    setFeedback(replace ? t('secretReplaced') : t('flutterwaveConnected'));
  }

  async function action(method: 'PATCH' | 'DELETE', body?: object, success = t('saved')) {
    setBusy(true);
    setFeedback('');
    const response = await fetch('/api/apps/flutterwave', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setFeedback(data.error || t('updateFailed'));
    setFlutterwave(data.flutterwave);
    setFeedback(success);
  }

  async function savePreferred(next: 'paystack' | 'flutterwave') {
    setBusy(true);
    setFeedback('');
    const response = await fetch('/api/apps/payments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preferred_provider', preferredOnlineProvider: next }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setFeedback(data.error || t('updateFailed'));
    setPreferred(data.preferredOnlineProvider || next);
    setEnabledProviders(Array.isArray(data.enabledProviders) ? data.enabledProviders : enabledProviders);
    setFeedback(t('preferredSaved'));
  }

  const isEnabled = flutterwave.enabled !== false && flutterwave.acceptOnlinePayments !== false;
  const display = flutterwave.displayStatus || (flutterwave.status === 'disconnected' ? 'disconnected' : 'connected');
  const managed = display !== 'disconnected';
  const modeLabel = flutterwave.mode === 'test' ? t('testMode') : flutterwave.mode === 'live' ? t('liveMode') : '';
  const readiness = flutterwave.webhookReadiness
    || (flutterwave.webhookStatus === 'active'
      ? 'verified'
      : flutterwave.webhookStatus === 'needs_attention'
        ? 'needs_attention'
        : flutterwave.webhookUrl
          ? 'configured_unverified'
          : 'not_configured');
  const webhookLabel = readiness === 'verified'
    ? t('webhookVerified')
    : readiness === 'needs_attention'
      ? t('webhookNeedsAttention')
      : readiness === 'configured_unverified'
        ? t('webhookConfiguredUnverified')
        : t('webhookNotConfigured');
  const showPreferred = canManage && enabledProviders.includes('paystack') && enabledProviders.includes('flutterwave');
  const effectivePreferred = preferred || 'paystack';

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title={t('title')} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#71382D] hover:text-[#B85C3E]"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              {t('title')}
            </button>
          )}
          <div className="flex items-start gap-3.5">
            <ConnectedAppLogo provider="flutterwave" name={t('flutterwave')} size="lg" />
            <div className="min-w-0">
              <h1 className="text-2xl font-serif text-[#191816]">{t('flutterwave')}</h1>
              <p className="mt-1 text-sm text-[#7A7267]">{t('flutterwaveManageSubtitle')}</p>
            </div>
          </div>
        </div>
        {feedback && <div role="status" className="max-w-3xl rounded border border-[#E8E2DA] bg-white px-4 py-3 text-sm text-[#191816]">{feedback}</div>}

        {!managed ? (
          <section className="max-w-xl rounded-xl border border-[#E8E2DA] bg-white p-5 sm:p-6 shadow-2xs">
            <div className="flex items-start gap-3">
              <ConnectedAppLogo provider="flutterwave" name={t('flutterwave')} size="md" />
              <div className="min-w-0">
                <h2 className="font-semibold text-[#191816]">{t('flutterwave')}</h2>
                <p className="mt-1 text-sm text-[#7A7267]">{t('statusNotConnected')}</p>
              </div>
            </div>
            {canManage ? (
              <Button className="mt-5" onClick={() => { setReplace(false); setFeedback(''); setOpen(true); }}>{t('connect')}</Button>
            ) : (
              <p className="mt-5 text-sm text-[#7A7267]">{t('ownerConnectsFlutterwave')}</p>
            )}
          </section>
        ) : (
          <div className="max-w-3xl space-y-5">
            <section className="rounded-xl border border-[#E8E2DA] bg-white p-5 sm:p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-serif text-xl sm:text-2xl text-[#191816]">{t('flutterwave')}</h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EBF5EF] text-[#2E6B4F] border border-[#C5E3D0]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2E6B4F]" />
                      {t('connected')}
                    </span>
                    {flutterwave.mode && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider text-[#71382D] bg-[#F7F1E8] border border-[#E5D4BC]">
                        {modeLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#7A7267]">
                    {flutterwave.account || t('verifiedFlutterwaveAccount')} · {t('connected')} {when(flutterwave.connectedAt, '—')}
                  </p>
                </div>

                {canManage && (
                  <div className="flex items-center gap-3 self-start sm:self-auto rounded-lg border border-[#E5D4BC] bg-[#FAF7F2] px-3.5 py-2">
                    <div className="text-right min-w-0">
                      <div className="text-xs font-medium text-[#191816]">{t('acceptFlutterwave')}</div>
                      <div className="text-[10px] text-[#7A7267]">{isEnabled ? t('activeForNewPayments') : t('pausedForNewPayments')}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label={t('acceptFlutterwave')}
                      disabled={busy}
                      onClick={() =>
                        action(
                          'PATCH',
                          { action: 'payments', enabled: !isEnabled },
                          !isEnabled ? t('flutterwaveEnabled') : t('flutterwavePaused')
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
                  {t('flutterwavePaused')}
                </div>
              )}

              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 pt-4 border-t border-[#E8E2DA]">
                <div>
                  <dt className="text-xs text-[#7A7267]">{t('account')}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-[#191816]">{flutterwave.account || t('verifiedFlutterwaveAccount')}</dd>
                </div>
                {canManage && (
                  <div>
                    <dt className="text-xs text-[#7A7267]">{t('secretKey')}</dt>
                    <dd className="mt-0.5 font-mono text-sm text-[#191816]">{flutterwave.secret}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-[#7A7267]">{t('connected')}</dt>
                  <dd className="mt-0.5 text-sm text-[#191816]">{when(flutterwave.connectedAt, '—')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#7A7267]">{t('lastVerified')}</dt>
                  <dd className="mt-0.5 text-sm text-[#191816]">{when(flutterwave.verifiedAt)}</dd>
                </div>
              </dl>
              {!canManage && <p className="mt-4 text-xs text-[#7A7267]">{t('ownerManagesFlutterwave')}</p>}
            </section>
            {canManage && (
            <>
            <section className="rounded-xl border border-[#E8E2DA] bg-white p-5 sm:p-6 shadow-2xs">
              <div>
                <h2 className="font-semibold text-[#191816]">{t('paymentSurfaces')}</h2>
                <p className="mt-1 text-xs text-[#7A7267]">{t('paymentSurfacesHelp')}</p>
              </div>
              <div className="mt-3 divide-y divide-[#E8E2DA]">
                <Toggle
                  label={t('directBookingEngine')}
                  description={t('directBookingEngineHelp')}
                  disabled={busy}
                  on={flutterwave.directBooking !== false}
                  onChange={(next) =>
                    action('PATCH', { action: 'payments', directBooking: next }, next ? t('directBookingOn') : t('directBookingOff'))
                  }
                />
                <Toggle
                  label={t('invoicePaymentLinks')}
                  description={t('invoicePaymentLinksHelp')}
                  disabled={busy}
                  on={flutterwave.invoices !== false}
                  onChange={(next) =>
                    action('PATCH', { action: 'payments', invoices: next }, next ? t('invoicePaymentsOn') : t('invoicePaymentsOff'))
                  }
                />
              </div>
            </section>

            {showPreferred && (
              <section className="rounded-xl border border-[#E8E2DA] bg-white p-5 sm:p-6 shadow-2xs">
                <h2 className="font-semibold text-[#191816]">{t('preferredProvider')}</h2>
                <p className="mt-1 text-xs text-[#7A7267]">{t('preferredProviderHelp')}</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void savePreferred('paystack')}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${effectivePreferred === 'paystack' ? 'border-[#71382D] bg-[#F5EEE9] text-[#71382D]' : 'border-[#E8E2DA] bg-white text-[#191816]'}`}
                  >
                    {t('paystack')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void savePreferred('flutterwave')}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${effectivePreferred === 'flutterwave' ? 'border-[#71382D] bg-[#F5EEE9] text-[#71382D]' : 'border-[#E8E2DA] bg-white text-[#191816]'}`}
                  >
                    {t('flutterwave')}
                  </button>
                </div>
              </section>
            )}

            <section className="rounded border border-[#E8E2DA] bg-white p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-[#191816]">{t('webhook')}</h2>
                <p className="mt-1 text-sm text-[#7A7267]">{t('webhookFlutterwaveHelp')}</p>
              </div>
              <div>
                <p className="text-xs text-[#7A7267]">{t('webhookUrl')}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-[#F9F7F5] px-2 py-2 text-xs">{flutterwave.webhookUrl}</code>
                  <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(flutterwave.webhookUrl || ''); setCopied(true); }}>{tCommon('copy')}</Button>
                </div>
                {copied && <p className="mt-1 text-xs text-[#2E6B4F]">{tCommon('copied')}</p>}
              </div>
              <div>
                <p className="text-xs text-[#7A7267]">{t('secretHash')}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <code className="min-w-0 flex-1 break-all rounded bg-[#F9F7F5] px-2 py-2 text-xs">{flutterwave.webhookSecret}</code>
                  {flutterwave.webhookSecretRevealed && (
                    <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(flutterwave.webhookSecret || ''); setCopiedHash(true); }}>{tCommon('copy')}</Button>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#7A7267]">{flutterwave.webhookSecretRevealed ? t('secretHashOnce') : t('secretHashHelp')}</p>
                {copiedHash && <p className="mt-1 text-xs text-[#2E6B4F]">{tCommon('copied')}</p>}
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-[#7A7267]">{t('webhookStatus')}</dt><dd className="mt-1">{webhookLabel}</dd></div>
                <div><dt className="text-[#7A7267]">{t('lastWebhookReceived')}</dt><dd className="mt-1">{when(flutterwave.lastWebhookAt, t('noWebhookYet'))}</dd></div>
                <div><dt className="text-[#7A7267]">{t('lastVerifiedWebhook')}</dt><dd className="mt-1">{when(flutterwave.webhookVerifiedAt)}</dd></div>
              </dl>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-[#7A7267]">
                <li>{t('flutterwaveWebhookStep1')}</li>
                <li>{t('flutterwaveWebhookStep2')}</li>
                <li>{t('flutterwaveWebhookStep3')}</li>
                <li>{t('flutterwaveWebhookStep4')}</li>
                <li>{t('flutterwaveWebhookStep5')}</li>
              </ol>
            </section>

            <section className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy} onClick={() => action('PATCH', { action: 'test' }, t('flutterwaveVerified'))}>{t('testConnection')}</Button>
              <Button variant="outline" disabled={busy} onClick={() => action('PATCH', { action: 'rotate_webhook_secret' }, t('secretHashRotated'))}>{t('rotateSecretHash')}</Button>
              <Button variant="outline" onClick={() => { setReplace(true); setSecretKey(''); setFeedback(''); setOpen(true); }}>{t('replaceSecretKey')}</Button>
              <Button variant="outline" disabled={busy} onClick={() => setConfirmDisconnect(true)}>{t('disconnectFlutterwave')}</Button>
            </section>
            </>
            )}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{replace ? t('replaceSecretKey') : t('connectFlutterwave')}</DialogTitle>
              <DialogDescription>{t('flutterwaveByopNote')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor="flutterwave-secret" className="text-sm font-medium">{t('flutterwaveSecretKey')}</label>
              <Input id="flutterwave-secret" type="password" autoComplete="off" placeholder="FLWSECK_TEST- or FLWSECK-" value={secretKey} onChange={(event) => setSecretKey(event.target.value)} />
              <p className="text-xs text-[#7A7267]">{t('flutterwaveSecretHelp')}</p>
              <p className="text-xs text-[#7A7267]">{t('testLiveNeverMix')}</p>
            </div>
            {feedback && <p className="text-sm text-red-700">{feedback}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{tCommon('cancel')}</Button>
              <Button disabled={busy || !secretKey.trim()} onClick={save}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{replace ? t('replaceSecretKey') : t('connectFlutterwave')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('disconnectFlutterwave')}</DialogTitle>
              <DialogDescription>{t('disconnectFlutterwaveHelp')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDisconnect(false)}>{tCommon('cancel')}</Button>
              <Button disabled={busy} onClick={() => { setConfirmDisconnect(false); void action('DELETE', undefined, t('flutterwaveDisconnected')); }}>{t('disconnectFlutterwave')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
