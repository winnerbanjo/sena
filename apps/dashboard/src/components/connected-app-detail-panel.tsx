'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, RefreshCw, Unplug } from 'lucide-react';
import { Topbar } from '@/components/topbar';

type DetailResponse = {
  canManage: boolean;
  app: {
    provider: string;
    name: string;
    category: string;
    description: string;
    availability: string;
    authenticationType: string;
    capabilities: string[];
    connectionStatus: string;
    healthStatus: string | null;
    accountLabel?: string | null;
    connectedAt?: string | null;
    lastSyncAt?: string | null;
    lastErrorMessage?: string | null;
    docsUrl?: string | null;
  };
  activity?: Array<{ id: string; action: string; createdAt: string; details: Record<string, unknown> | null }>;
  syncJobs?: Array<{ id: string; jobType: string; status: string; createdAt: string; lastError: string | null }>;
  mappings?: Array<{ id: string; senaObjectType: string; externalObjectId: string; syncState: string }>;
};

export function ConnectedAppDetailPanel({
  provider,
  onBack,
}: {
  provider: string;
  onBack: () => void;
}) {
  const t = useTranslations('apps');
  const router = useRouter();
  const [data, setData] = React.useState<DetailResponse | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [zohoOrgs, setZohoOrgs] = React.useState<Array<{ organizationId: string; name: string }>>([]);
  const [zohoSelectedOrgId, setZohoSelectedOrgId] = React.useState<string | null>(null);
  const [zohoSelectedOrgName, setZohoSelectedOrgName] = React.useState<string | null>(null);
  const [zohoSyncEnabled, setZohoSyncEnabled] = React.useState(false);
  const [googleCalendars, setGoogleCalendars] = React.useState<Array<{ id: string; summary: string }>>([]);
  const [selectedGoogleCalendarId, setSelectedGoogleCalendarId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const response = await fetch(`/api/apps/${provider}`, { cache: 'no-store' });
    if (!response.ok) {
      setError(t('detailLoadFailed'));
      return;
    }
    setData(await response.json());
  }, [provider, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (provider !== 'zoho_invoice') return;
    void (async () => {
      const response = await fetch('/api/apps/zoho_invoice/manage', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      if (Array.isArray(payload.organizations)) setZohoOrgs(payload.organizations);
      if (typeof payload.selectedOrganizationId === 'string') setZohoSelectedOrgId(payload.selectedOrganizationId);
      if (typeof payload.selectedOrganizationName === 'string') setZohoSelectedOrgName(payload.selectedOrganizationName);
      if (typeof payload.syncEnabled === 'boolean') setZohoSyncEnabled(payload.syncEnabled);
    })();
  }, [provider, data?.app?.connectionStatus]);

  React.useEffect(() => {
    if (provider !== 'google_calendar') return;
    void (async () => {
      const response = await fetch('/api/apps/google_calendar', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      if (Array.isArray(payload.calendars)) setGoogleCalendars(payload.calendars);
      if (typeof payload.selectedCalendarId === 'string') setSelectedGoogleCalendarId(payload.selectedCalendarId);
    })();
  }, [provider, data?.app?.connectionStatus]);

  async function selectZohoOrg(organizationId: string, organizationName?: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/apps/zoho_invoice/manage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'select_organization', organizationId, organizationName }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || t('zohoOrgSelectFailed'));
        return;
      }
      setZohoSelectedOrgId(organizationId);
      setZohoSelectedOrgName(organizationName || null);
      setZohoSyncEnabled(true);
      setMessage(t('zohoOrgSelected'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleZohoSync() {
    setBusy(true);
    setError(null);
    try {
      const next = !zohoSyncEnabled;
      const response = await fetch('/api/apps/zoho_invoice/manage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'set_sync_enabled', enabled: next }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || t('zohoSyncToggleFailed'));
        return;
      }
      setZohoSyncEnabled(Boolean(payload.syncEnabled));
      setMessage(next ? t('zohoSyncEnabled') : t('zohoSyncDisabled'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function selectGoogleCalendar(calendarId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/apps/google_calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'select_calendar', calendarId }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || 'Could not select calendar.');
        return;
      }
      setSelectedGoogleCalendarId(calendarId);
      setMessage('Google Calendar selected.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function startOAuth() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/apps/oauth/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, returnTo: `/apps?manage=${provider}` }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 503 && payload.code === 'OAUTH_CLIENT_MISSING') {
        setError(t('oauthClientMissing'));
        return;
      }
      if (!response.ok || !payload.authorizeUrl) {
        setError(payload.error || t('oauthStartFailed'));
        return;
      }
      window.location.href = payload.authorizeUrl;
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/apps/${provider}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'sync_now', jobType: 'full_sync' }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || t('syncFailed'));
        return;
      }
      setMessage(t('syncQueued'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm(t('disconnectConfirm'))) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/apps/${provider}`, { method: 'DELETE', cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || t('disconnectFailed'));
        return;
      }
      setMessage(t('disconnectedPreserved'));
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const app = data?.app;

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <Topbar title={app?.name || t('title')} />
      <main className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm text-[#71382D]">
          <ArrowLeft className="h-4 w-4" />
          {t('backToMarketplace')}
        </button>

        {!app ? (
          <p className="text-sm text-[#7A7267]">{error || t('loadingDetail')}</p>
        ) : (
          <>
            <header className="max-w-3xl">
              <p className="text-[11px] font-medium uppercase tracking-widest text-[#7A7267]">{app.category.replaceAll('_', ' ')}</p>
              <h1 className="mt-1 font-serif text-2xl text-[#191816]">{app.name}</h1>
              <p className="mt-2 text-sm text-[#7A7267]">{app.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill label={statusLabel(t, app.connectionStatus)} />
                {app.healthStatus ? <StatusPill label={`${t('health')}: ${app.healthStatus.replaceAll('_', ' ')}`} /> : null}
              </div>
            </header>

            {message ? <p className="text-sm text-[#2E6B4F]">{message}</p> : null}
            {error ? <p className="text-sm text-[#71382D]">{error}</p> : null}

            <section className="grid max-w-3xl gap-4 sm:grid-cols-2">
              <Info label={t('account')} value={app.accountLabel || t('statusNotConnected')} />
              <Info label={t('authType')} value={app.authenticationType} />
              <Info label={t('connectedAt')} value={app.connectedAt ? new Date(app.connectedAt).toLocaleString() : '—'} />
              <Info label={t('lastSync')} value={app.lastSyncAt ? new Date(app.lastSyncAt).toLocaleString() : '—'} />
            </section>

            <section className="max-w-3xl">
              <h2 className="text-sm font-medium text-[#191816]">{t('capabilities')}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {app.capabilities.map((capability) => (
                  <li key={capability} className="rounded-full border border-[#E8E2DA] px-2.5 py-1 text-xs text-[#7A7267]">
                    {capability.replaceAll('_', ' ')}
                  </li>
                ))}
              </ul>
            </section>

            {data?.canManage ? (
              <div className="flex flex-wrap gap-3">
                {app.connectionStatus === 'disconnected' || app.connectionStatus === 'coming_soon' ? (
                  app.availability === 'available' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void startOAuth()}
                      className="min-h-11 rounded-lg bg-[#71382D] px-4 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {t('connect')}
                    </button>
                  ) : (
                    <p className="text-sm text-[#7A7267]">{t('statusComingSoon')}</p>
                  )
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void syncNow()}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#E8E2DA] px-4 text-sm font-medium text-[#191816] disabled:opacity-60"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {t('syncNow')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void disconnect()}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#E5D4BC] px-4 text-sm font-medium text-[#71382D] disabled:opacity-60"
                    >
                      <Unplug className="h-4 w-4" />
                      {t('disconnect')}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#7A7267]">{t('ownerManagesApps')}</p>
            )}

            {provider === 'zoho_invoice' && data?.canManage && app.connectionStatus === 'connected' ? (
              <section className="max-w-3xl space-y-4">
                <div className="rounded-xl border border-[#E8E2DA] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-medium text-[#191816]">{t('zohoSyncInvoices')}</h2>
                      <p className="mt-1 text-sm text-[#7A7267]">{t('zohoSyncInvoicesHelp')}</p>
                      {zohoSelectedOrgName ? (
                        <p className="mt-2 text-xs text-[#7A7267]">
                          {t('zohoOrganization')}: <span className="text-[#191816]">{zohoSelectedOrgName}</span>
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-[#71382D]">{t('zohoOrgRequired')}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={zohoSyncEnabled}
                      aria-label={t('zohoSyncInvoices')}
                      disabled={busy || !zohoSelectedOrgId}
                      onClick={() => void toggleZohoSync()}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                        zohoSyncEnabled ? 'bg-[#2E6B4F]' : 'bg-[#D5CDC3]'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                          zohoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {app.lastSyncAt ? (
                    <p className="mt-3 text-xs text-[#7A7267]">
                      {t('zohoLastSynced', { time: new Date(app.lastSyncAt).toLocaleString() })}
                    </p>
                  ) : null}
                </div>

                {zohoOrgs.length > 0 ? (
                  <div className="space-y-3">
                    <h2 className="text-sm font-medium text-[#191816]">{t('zohoOrganization')}</h2>
                    <p className="text-sm text-[#7A7267]">{t('zohoOrganizationHelp')}</p>
                    <ul className="divide-y divide-[#E8E2DA] rounded-xl border border-[#E8E2DA] bg-white">
                      {zohoOrgs.map((org) => (
                        <li key={org.organizationId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                          <span className="text-[#191816]">{org.name}</span>
                          <button
                            type="button"
                            disabled={busy || zohoSelectedOrgId === org.organizationId}
                            onClick={() => void selectZohoOrg(org.organizationId, org.name)}
                            className="min-h-11 rounded-lg border border-[#E8E2DA] px-3 text-sm font-medium text-[#71382D] disabled:opacity-60"
                          >
                            {zohoSelectedOrgId === org.organizationId ? t('zohoOrgSelectedLabel') : t('zohoUseOrg')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {provider === 'google_calendar' && data?.canManage && app.connectionStatus === 'connected' && googleCalendars.length > 0 ? (
              <section className="max-w-3xl space-y-3">
                <h2 className="text-sm font-medium text-[#191816]">Target calendar</h2>
                <p className="text-sm text-[#7A7267]">Reservations sync outbound to the selected calendar. Selected: {selectedGoogleCalendarId || 'primary'}.</p>
                <ul className="divide-y divide-[#E8E2DA] rounded-xl border border-[#E8E2DA] bg-white">
                  {googleCalendars.map((calendar) => (
                    <li key={calendar.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span className="text-[#191816]">{calendar.summary}</span>
                      <button
                        type="button"
                        disabled={busy || selectedGoogleCalendarId === calendar.id}
                        onClick={() => void selectGoogleCalendar(calendar.id)}
                        className="min-h-11 rounded-lg border border-[#E8E2DA] px-3 text-sm font-medium text-[#71382D] disabled:opacity-60"
                      >
                        {selectedGoogleCalendarId === calendar.id ? 'Selected' : 'Use calendar'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {app.lastErrorMessage ? (
              <section className="max-w-3xl rounded-xl border border-[#E5D4BC] bg-[#F7F1E8] p-4">
                <h2 className="text-sm font-medium text-[#71382D]">{t('lastError')}</h2>
                <p className="mt-1 text-sm text-[#71382D]">{app.lastErrorMessage}</p>
              </section>
            ) : null}

            <section className="max-w-3xl space-y-3">
              <h2 className="text-sm font-medium text-[#191816]">{t('syncHistory')}</h2>
              {(data?.syncJobs || []).length === 0 ? (
                <p className="text-sm text-[#7A7267]">{t('noSyncJobs')}</p>
              ) : (
                <ul className="divide-y divide-[#E8E2DA] rounded-xl border border-[#E8E2DA] bg-white">
                  {(data?.syncJobs || []).map((job) => (
                    <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span className="text-[#191816]">{job.jobType}</span>
                      <span className="text-[#7A7267]">{job.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="max-w-3xl space-y-3">
              <h2 className="text-sm font-medium text-[#191816]">{t('recentActivity')}</h2>
              {(data?.activity || []).length === 0 ? (
                <p className="text-sm text-[#7A7267]">{t('noActivity')}</p>
              ) : (
                <ul className="divide-y divide-[#E8E2DA] rounded-xl border border-[#E8E2DA] bg-white">
                  {(data?.activity || []).map((row) => (
                    <li key={row.id} className="px-4 py-3 text-sm">
                      <p className="text-[#191816]">{row.action}</p>
                      <p className="text-xs text-[#7A7267]">{new Date(row.createdAt).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {app.docsUrl ? (
              <a href={app.docsUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-[#71382D]">
                {t('viewDocs')}
              </a>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E8E2DA] bg-white p-4">
      <p className="text-[11px] uppercase tracking-widest text-[#7A7267]">{label}</p>
      <p className="mt-1 text-sm text-[#191816]">{value}</p>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#E8E2DA] bg-[#F9F7F5] px-2.5 py-0.5 text-xs font-medium text-[#7A7267]">
      {label}
    </span>
  );
}

function statusLabel(t: ReturnType<typeof useTranslations<'apps'>>, status: string) {
  switch (status) {
    case 'connected':
      return t('connected');
    case 'needs_attention':
      return t('statusActionRequired');
    case 'coming_soon':
      return t('statusComingSoon');
    case 'connecting':
      return t('statusConnecting');
    case 'paused':
      return t('statusPaused');
    case 'error':
      return t('statusError');
    default:
      return t('statusNotConnected');
  }
}
