'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, RefreshCw, Unplug } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { useWorkspace } from '@/components/workspace-access';
import {
  organizationsFromManagePayload,
  resolveZohoOrgsView,
  type ZohoOrgsFetchStatus,
} from '@/lib/integrations/zoho/orgs-ui-state';

type DetailResponse = {
  canManage: boolean;
  property?: { id: string; name: string; slug: string };
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
  const workspace = useWorkspace();
  const workspacePropertyId = workspace?.property.id || null;
  const [data, setData] = React.useState<DetailResponse | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [zohoOrgs, setZohoOrgs] = React.useState<Array<{ organizationId: string; name: string }>>([]);
  const [zohoSelectedOrgId, setZohoSelectedOrgId] = React.useState<string | null>(null);
  const [zohoSelectedOrgName, setZohoSelectedOrgName] = React.useState<string | null>(null);
  const [zohoSyncEnabled, setZohoSyncEnabled] = React.useState(false);
  const [zohoOrgsError, setZohoOrgsError] = React.useState<string | null>(null);
  const [zohoOrgsFetchStatus, setZohoOrgsFetchStatus] = React.useState<ZohoOrgsFetchStatus>('idle');
  const [googleCalendars, setGoogleCalendars] = React.useState<Array<{ id: string; summary: string; primary?: boolean }>>([]);
  const [selectedGoogleCalendarId, setSelectedGoogleCalendarId] = React.useState<string | null>(null);
  const [selectedGoogleCalendarName, setSelectedGoogleCalendarName] = React.useState<string | null>(null);
  const [googleSyncEnabled, setGoogleSyncEnabled] = React.useState(false);
  const [googleAccountEmail, setGoogleAccountEmail] = React.useState<string | null>(null);
  const [googleCalendarsError, setGoogleCalendarsError] = React.useState<string | null>(null);
  const [googleCalendarsFetchStatus, setGoogleCalendarsFetchStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const zohoManageRequestId = React.useRef(0);
  const googleManageRequestId = React.useRef(0);

  const load = React.useCallback(async () => {
    const response = await fetch(`/api/apps/${provider}?_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      setError(t('detailLoadFailed'));
      return;
    }
    const payload = (await response.json()) as DetailResponse;
    if (workspacePropertyId && payload.property?.id && payload.property.id !== workspacePropertyId) {
      // Session/UI property diverged — force a full reload of the workspace shell.
      window.location.assign(`/apps?manage=${encodeURIComponent(provider)}`);
      return;
    }
    setData(payload);
  }, [provider, t, workspacePropertyId]);

  const loadZohoManage = React.useCallback(async () => {
    if (provider !== 'zoho_invoice') return;
    const requestId = ++zohoManageRequestId.current;
    setZohoOrgsFetchStatus('loading');
    setZohoOrgsError(null);
    try {
      const response = await fetch(`/api/apps/zoho_invoice/manage?_=${Date.now()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (requestId !== zohoManageRequestId.current) return;
      if (
        workspacePropertyId &&
        payload?.property?.id &&
        typeof payload.property.id === 'string' &&
        payload.property.id !== workspacePropertyId
      ) {
        window.location.assign('/apps?manage=zoho_invoice');
        return;
      }
      if (!response.ok) {
        setZohoOrgsError(typeof payload.error === 'string' ? payload.error : t('zohoOrgsLoadFailed'));
        setZohoOrgs([]);
        setZohoOrgsFetchStatus('error');
        return;
      }
      const nextOrgs = organizationsFromManagePayload(payload);
      setZohoOrgs(nextOrgs);
      if (typeof payload.selectedOrganizationId === 'string') setZohoSelectedOrgId(payload.selectedOrganizationId);
      else setZohoSelectedOrgId(null);
      if (typeof payload.selectedOrganizationName === 'string') setZohoSelectedOrgName(payload.selectedOrganizationName);
      else setZohoSelectedOrgName(null);
      if (typeof payload.syncEnabled === 'boolean') setZohoSyncEnabled(payload.syncEnabled);
      if (typeof payload.organizationsError === 'string' && payload.organizationsError) {
        setZohoOrgsError(t('zohoOrgsLoadFailed'));
        setZohoOrgsFetchStatus('error');
        return;
      }
      // Manage says disconnected while detail said connected — trust manage, hide org picker.
      if (payload.connectionStatus && payload.connectionStatus !== 'connected') {
        setZohoOrgs([]);
        setZohoOrgsFetchStatus('ready');
        setData((prev) =>
          prev
            ? {
                ...prev,
                app: { ...prev.app, connectionStatus: String(payload.connectionStatus) },
              }
            : prev
        );
        return;
      }
      setZohoOrgsFetchStatus('ready');
    } catch {
      if (requestId !== zohoManageRequestId.current) return;
      setZohoOrgsError(t('zohoOrgsLoadFailed'));
      setZohoOrgs([]);
      setZohoOrgsFetchStatus('error');
    }
  }, [provider, t, workspacePropertyId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    // Property switch remounts via WorkspaceAccess key; still reset local Zoho state defensively.
    zohoManageRequestId.current += 1;
    setZohoOrgs([]);
    setZohoSelectedOrgId(null);
    setZohoSelectedOrgName(null);
    setZohoSyncEnabled(false);
    setZohoOrgsError(null);
    setZohoOrgsFetchStatus('idle');
    googleManageRequestId.current += 1;
    setGoogleCalendars([]);
    setSelectedGoogleCalendarId(null);
    setSelectedGoogleCalendarName(null);
    setGoogleSyncEnabled(false);
    setGoogleAccountEmail(null);
    setGoogleCalendarsError(null);
    setGoogleCalendarsFetchStatus('idle');
  }, [workspacePropertyId]);

  React.useEffect(() => {
    if (provider !== 'zoho_invoice') return;
    if (data?.app?.connectionStatus !== 'connected') return;
    void loadZohoManage();
  }, [provider, data?.app?.connectionStatus, loadZohoManage]);

  const loadGoogleManage = React.useCallback(async () => {
    if (provider !== 'google_calendar') return;
    const requestId = ++googleManageRequestId.current;
    setGoogleCalendarsFetchStatus('loading');
    setGoogleCalendarsError(null);
    try {
      const response = await fetch(`/api/apps/google_calendar?_=${Date.now()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (requestId !== googleManageRequestId.current) return;
      if (workspacePropertyId && payload.property?.id && payload.property.id !== workspacePropertyId) {
        window.location.assign(`/apps?manage=${encodeURIComponent(provider)}`);
        return;
      }
      if (!response.ok) {
        setGoogleCalendarsFetchStatus('error');
        setGoogleCalendarsError(payload.error || t('googleCalendarsLoadFailed'));
        return;
      }
      setGoogleCalendars(Array.isArray(payload.calendars) ? payload.calendars : []);
      setSelectedGoogleCalendarId(typeof payload.selectedCalendarId === 'string' ? payload.selectedCalendarId : null);
      setSelectedGoogleCalendarName(typeof payload.selectedCalendarName === 'string' ? payload.selectedCalendarName : null);
      setGoogleSyncEnabled(Boolean(payload.syncEnabled));
      setGoogleAccountEmail(typeof payload.accountEmail === 'string' ? payload.accountEmail : null);
      setGoogleCalendarsFetchStatus('ready');
    } catch {
      if (requestId !== googleManageRequestId.current) return;
      setGoogleCalendarsFetchStatus('error');
      setGoogleCalendarsError(t('googleCalendarsLoadFailed'));
    }
  }, [provider, t, workspacePropertyId]);

  React.useEffect(() => {
    if (provider !== 'google_calendar') return;
    if (data?.app?.connectionStatus !== 'connected') return;
    void loadGoogleManage();
  }, [provider, data?.app?.connectionStatus, loadGoogleManage]);

  async function retryZohoOrgs() {
    setBusy(true);
    setError(null);
    try {
      await load();
      await loadZohoManage();
    } finally {
      setBusy(false);
    }
  }

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

  async function selectGoogleCalendar(calendarId: string, calendarName?: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/apps/google_calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'select_calendar', calendarId, calendarName }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || t('googleCalendarSelectFailed'));
        return;
      }
      setSelectedGoogleCalendarId(calendarId);
      setSelectedGoogleCalendarName(calendarName || null);
      if (payload.calendarChanged) setGoogleSyncEnabled(false);
      else if (typeof payload.syncEnabled === 'boolean') setGoogleSyncEnabled(payload.syncEnabled);
      setMessage(t('googleCalendarSelected'));
      await load();
      await loadGoogleManage();
    } finally {
      setBusy(false);
    }
  }

  async function toggleGoogleSync() {
    setBusy(true);
    setError(null);
    try {
      const next = !googleSyncEnabled;
      const response = await fetch('/api/apps/google_calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'set_sync_enabled', enabled: next }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || t('googleSyncToggleFailed'));
        return;
      }
      setGoogleSyncEnabled(Boolean(payload.syncEnabled));
      setMessage(next ? t('googleSyncEnabled') : t('googleSyncDisabled'));
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
      const endpoint = provider === 'google_calendar' ? '/api/apps/google_calendar' : `/api/apps/${provider}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          provider === 'google_calendar'
            ? { action: 'sync_now' }
            : { action: 'sync_now', jobType: 'full_sync' }
        ),
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

                {(() => {
                  const zohoView = resolveZohoOrgsView({
                    connected: true,
                    fetchStatus: zohoOrgsFetchStatus,
                    organizations: zohoOrgs,
                    errorMessage: zohoOrgsError,
                  });
                  if (zohoView.kind === 'loading') {
                    return <p className="text-sm text-[#7A7267]">{t('zohoOrgsLoading')}</p>;
                  }
                  if (zohoView.kind === 'error') {
                    return (
                      <div className="space-y-3 rounded-xl border border-[#E5D4BC] bg-[#FBF7F1] p-4">
                        <p className="text-sm text-[#71382D]">{zohoView.message}</p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void retryZohoOrgs()}
                          className="min-h-11 rounded-lg border border-[#E8E2DA] bg-white px-3 text-sm font-medium text-[#71382D] disabled:opacity-60"
                        >
                          {t('zohoOrgsRetry')}
                        </button>
                      </div>
                    );
                  }
                  if (zohoView.kind === 'list') {
                    return (
                      <div className="space-y-3">
                        <h2 className="text-sm font-medium text-[#191816]">{t('zohoOrganization')}</h2>
                        <p className="text-sm text-[#7A7267]">{t('zohoOrganizationHelp')}</p>
                        <ul className="divide-y divide-[#E8E2DA] rounded-xl border border-[#E8E2DA] bg-white">
                          {zohoView.organizations.map((org) => (
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
                    );
                  }
                  return (
                    <div className="space-y-3 rounded-xl border border-[#E8E2DA] bg-white p-4">
                      <p className="text-sm text-[#7A7267]">{t('zohoOrgsEmpty')}</p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void retryZohoOrgs()}
                        className="min-h-11 rounded-lg border border-[#E8E2DA] px-3 text-sm font-medium text-[#71382D] disabled:opacity-60"
                      >
                        {t('zohoOrgsRetry')}
                      </button>
                    </div>
                  );
                })()}
              </section>
            ) : null}

            {provider === 'google_calendar' && data?.canManage && app.connectionStatus === 'connected' ? (
              <section className="max-w-3xl space-y-4">
                <div className="rounded-xl border border-[#E8E2DA] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-medium text-[#191816]">{t('googleSyncReservations')}</h2>
                      <p className="mt-1 text-sm text-[#7A7267]">{t('googleSyncReservationsHelp')}</p>
                      {googleAccountEmail || app.accountLabel ? (
                        <p className="mt-2 text-xs text-[#7A7267]">
                          {t('googleAccount')}:{' '}
                          <span className="text-[#191816] ltr-isolate" dir="ltr">
                            {googleAccountEmail || app.accountLabel}
                          </span>
                        </p>
                      ) : null}
                      {selectedGoogleCalendarId ? (
                        <p className="mt-1 text-xs text-[#7A7267]">
                          {t('googleTargetCalendar')}:{' '}
                          <span className="text-[#191816]">{selectedGoogleCalendarName || selectedGoogleCalendarId}</span>
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-[#71382D]">{t('googleCalendarRequired')}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={googleSyncEnabled}
                      aria-label={t('googleSyncReservations')}
                      disabled={busy || !selectedGoogleCalendarId}
                      onClick={() => void toggleGoogleSync()}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                        googleSyncEnabled ? 'bg-[#2E6B4F]' : 'bg-[#D5CDC3]'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                          googleSyncEnabled ? 'translate-x-6' : 'translate-x-1'
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

                {googleCalendarsFetchStatus === 'loading' || googleCalendarsFetchStatus === 'idle' ? (
                  <p className="text-sm text-[#7A7267]">{t('googleCalendarsLoading')}</p>
                ) : null}
                {googleCalendarsFetchStatus === 'error' ? (
                  <div className="space-y-3 rounded-xl border border-[#E5D4BC] bg-[#FBF7F1] p-4">
                    <p className="text-sm text-[#71382D]">{googleCalendarsError || t('googleCalendarsLoadFailed')}</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void loadGoogleManage()}
                      className="min-h-11 rounded-lg border border-[#E8E2DA] bg-white px-3 text-sm font-medium text-[#71382D] disabled:opacity-60"
                    >
                      {t('googleCalendarsRetry')}
                    </button>
                  </div>
                ) : null}
                {googleCalendarsFetchStatus === 'ready' && googleCalendars.length === 0 ? (
                  <p className="text-sm text-[#7A7267]">{t('googleCalendarsEmpty')}</p>
                ) : null}
                {googleCalendarsFetchStatus === 'ready' && googleCalendars.length > 0 ? (
                  <div className="space-y-3">
                    <h2 className="text-sm font-medium text-[#191816]">{t('googleTargetCalendar')}</h2>
                    <p className="text-sm text-[#7A7267]">{t('googleTargetCalendarHelp')}</p>
                    <ul className="divide-y divide-[#E8E2DA] rounded-xl border border-[#E8E2DA] bg-white">
                      {googleCalendars.map((calendar) => (
                        <li key={calendar.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                          <span className="text-[#191816]">
                            {calendar.summary}
                            {calendar.primary ? (
                              <span className="ml-2 text-xs text-[#7A7267]">({t('googlePrimaryBadge')})</span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            disabled={busy || selectedGoogleCalendarId === calendar.id}
                            onClick={() => void selectGoogleCalendar(calendar.id, calendar.summary)}
                            className="min-h-11 rounded-lg border border-[#E8E2DA] px-3 text-sm font-medium text-[#71382D] disabled:opacity-60"
                          >
                            {selectedGoogleCalendarId === calendar.id ? t('googleCalendarSelectedLabel') : t('googleUseCalendar')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
