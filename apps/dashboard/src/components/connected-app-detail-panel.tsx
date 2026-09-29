'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, RefreshCw, Unplug } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { ConnectedAppLogo } from '@/components/connected-apps/connected-app-logo';
import { ProviderEducationSections } from '@/components/connected-apps/provider-education';
import { useWorkspace } from '@/components/workspace-access';
import { categoryLabelKey, providerCopyKeys } from '@/lib/integrations/platform/provider-branding';
import { getProviderContent } from '@/lib/integrations/platform/provider-content';
import {
  organizationsFromManagePayload,
  resolveZohoOrgsView,
  type ZohoOrgsFetchStatus,
} from '@/lib/integrations/zoho/orgs-ui-state';

function isZohoAccountingProvider(provider: string) {
  return provider === 'zoho_invoice' || provider === 'zoho_books';
}

function zohoManagePath(provider: string) {
  return provider === 'zoho_books' ? '/api/apps/zoho_books/manage' : '/api/apps/zoho_invoice/manage';
}

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
  const searchParams = useSearchParams();
  const oauthResult = searchParams.get('oauth');
  const [data, setData] = React.useState<DetailResponse | null>(null);
  const [showOauthSuccess, setShowOauthSuccess] = React.useState(oauthResult === 'connected');

  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [zohoOrgs, setZohoOrgs] = React.useState<Array<{ organizationId: string; name: string }>>([]);
  const [zohoSelectedOrgId, setZohoSelectedOrgId] = React.useState<string | null>(null);
  const [zohoSelectedOrgName, setZohoSelectedOrgName] = React.useState<string | null>(null);
  const [zohoSyncEnabled, setZohoSyncEnabled] = React.useState(false);
  const [zohoOrgsError, setZohoOrgsError] = React.useState<string | null>(null);
  const [zohoOrgsFetchStatus, setZohoOrgsFetchStatus] = React.useState<ZohoOrgsFetchStatus>('idle');
  const [zohoBankAccounts, setZohoBankAccounts] = React.useState<Array<{ accountId: string; name: string }>>([]);
  const [zohoPaymentAccountId, setZohoPaymentAccountId] = React.useState<string | null>(null);
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
    setError(null);
    try {
      const response = await fetch(`/api/apps/${provider}?_=${Date.now()}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as DetailResponse & { error?: string };
      if (!response.ok) {
        setError(typeof payload.error === 'string' ? payload.error : t('detailLoadFailed'));
        setData(null);
        return;
      }
      if (!payload?.app?.provider) {
        // Defensive: manage-only payloads must never leave the detail screen spinning.
        setError(t('detailLoadFailed'));
        setData(null);
        return;
      }
      if (workspacePropertyId && payload.property?.id && payload.property.id !== workspacePropertyId) {
        // Session/UI property diverged — force a full reload of the workspace shell.
        window.location.assign(`/apps?manage=${encodeURIComponent(provider)}`);
        return;
      }
      setData(payload);
    } catch {
      setError(t('detailLoadFailed'));
      setData(null);
    }
  }, [provider, t, workspacePropertyId]);

  const loadZohoManage = React.useCallback(async () => {
    if (!isZohoAccountingProvider(provider)) return;
    const requestId = ++zohoManageRequestId.current;
    setZohoOrgsFetchStatus('loading');
    setZohoOrgsError(null);
    try {
      const response = await fetch(`${zohoManagePath(provider)}?_=${Date.now()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (requestId !== zohoManageRequestId.current) return;
      if (
        workspacePropertyId &&
        payload?.property?.id &&
        typeof payload.property.id === 'string' &&
        payload.property.id !== workspacePropertyId
      ) {
        window.location.assign(`/apps?manage=${encodeURIComponent(provider)}`);
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
      if (Array.isArray(payload.bankAccounts)) {
        setZohoBankAccounts(
          payload.bankAccounts
            .filter((row: any) => row && typeof row.accountId === 'string')
            .map((row: any) => ({ accountId: String(row.accountId), name: String(row.name || row.accountId) }))
        );
      } else {
        setZohoBankAccounts([]);
      }
      if (typeof payload.paymentAccountId === 'string') setZohoPaymentAccountId(payload.paymentAccountId);
      else setZohoPaymentAccountId(null);
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
    if (oauthResult !== 'connected' && oauthResult !== 'error') return;
    setShowOauthSuccess(oauthResult === 'connected');
    if (oauthResult === 'error') {
      setError(t('oauthReturnFailed'));
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('oauth');
    url.searchParams.delete('reason');
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, [oauthResult, t]);

  React.useEffect(() => {
    // Property switch remounts via WorkspaceAccess key; still reset local Zoho state defensively.
    zohoManageRequestId.current += 1;
    setZohoOrgs([]);
    setZohoSelectedOrgId(null);
    setZohoSelectedOrgName(null);
    setZohoSyncEnabled(false);
    setZohoOrgsError(null);
    setZohoOrgsFetchStatus('idle');
    setZohoBankAccounts([]);
    setZohoPaymentAccountId(null);
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
    if (!isZohoAccountingProvider(provider)) return;
    if (data?.app?.connectionStatus !== 'connected') return;
    void loadZohoManage();
  }, [provider, data?.app?.connectionStatus, loadZohoManage]);

  const loadGoogleManage = React.useCallback(async () => {
    if (provider !== 'google_calendar') return;
    const requestId = ++googleManageRequestId.current;
    setGoogleCalendarsFetchStatus('loading');
    setGoogleCalendarsError(null);
    try {
      const response = await fetch(`/api/apps/google_calendar/manage?_=${Date.now()}`, { cache: 'no-store' });
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
      const response = await fetch(zohoManagePath(provider), {
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
      // Invoice auto-enables on org select; Books requires an explicit enable step.
      setZohoSyncEnabled(provider === 'zoho_invoice');
      setMessage(t('zohoOrgSelected'));
      await load();
      if (provider === 'zoho_books') await loadZohoManage();
    } finally {
      setBusy(false);
    }
  }

  async function selectZohoPaymentAccount(paymentAccountId: string | null, paymentAccountName?: string | null) {
    if (provider !== 'zoho_books') return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(zohoManagePath(provider), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'select_payment_account', paymentAccountId, paymentAccountName }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof payload.error === 'string' ? payload.error : t('updateFailed'));
        return;
      }
      setZohoPaymentAccountId(typeof payload.paymentAccountId === 'string' ? payload.paymentAccountId : null);
      setMessage(t('zohoBooksPaymentAccountSaved'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleZohoSync() {
    setBusy(true);
    setError(null);
    try {
      const next = !zohoSyncEnabled;
      const response = await fetch(zohoManagePath(provider), {
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
      const response = await fetch('/api/apps/google_calendar/manage', {
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
      const response = await fetch('/api/apps/google_calendar/manage', {
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
      const endpoint = provider === 'google_calendar' ? '/api/apps/google_calendar/manage' : `/api/apps/${provider}`;
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
  const copy = providerCopyKeys(provider);
  const content = getProviderContent(provider);
  const displayName = content?.brandName || (copy ? t(copy.nameKey) : app?.name || t('title'));
  const displayDescription = copy ? t(copy.descriptionKey) : app?.description || '';
  const displayCategory = app ? t(categoryLabelKey(app.category) as 'calendarCategory') : '';
  const oauthConnectedTitle = t('oauthConnectedTitle', { name: displayName });
  const detailFailedNamed = t('detailLoadFailedNamed', { name: displayName });
  const connectLabel = content ? t(content.connectCtaKey as 'connectGoogleCalendar') : t('connect');

  const connected = app?.connectionStatus === 'connected';
  const comingSoon = app?.availability !== 'available' || app?.connectionStatus === 'coming_soon';
  const needsConfig =
    connected &&
    ((provider === 'google_calendar' && !selectedGoogleCalendarId) ||
      (isZohoAccountingProvider(provider) && !zohoSelectedOrgId));
  const syncEnabledLabel =
    provider === 'google_calendar'
      ? googleSyncEnabled
        ? t('syncOn')
        : t('syncOff')
      : isZohoAccountingProvider(provider)
        ? zohoSyncEnabled
          ? t('syncOn')
          : t('syncOff')
        : null;

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden bg-[#F7F1E8]">
      <Topbar title={displayName} />
      <main className="flex-1 space-y-8 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#71382D] hover:text-[#B85C3E]"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('backToMarketplace')}
        </button>

        {!app && !error ? <DetailSkeleton /> : null}

        {!app && error ? (
          <div className="max-w-lg rounded-2xl border border-[#E5D4BC] bg-[#FBF7F1] p-5">
            <p className="text-sm text-[#71382D]">{detailFailedNamed}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 min-h-11 rounded-lg border border-[#E8E2DA] bg-white px-4 text-sm font-medium text-[#71382D]"
            >
              {t('catalogRetry')}
            </button>
          </div>
        ) : null}

        {app ? (
          <>
            <header className="flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-start">
              <ConnectedAppLogo provider={provider} name={displayName} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7A7267]">{displayCategory}</p>
                <h1 className="mt-1 font-serif text-3xl tracking-tight text-[#191816] sm:text-[2.15rem]">{displayName}</h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5C564C]">{displayDescription}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill
                    label={statusLabel(t, comingSoon ? 'coming_soon' : needsConfig ? 'needs_attention' : app.connectionStatus)}
                    tone={comingSoon ? 'coming_soon' : statusToneFor(needsConfig, app.connectionStatus)}
                  />
                  {connected && (app.healthStatus === 'healthy' || app.healthStatus === 'ok') ? (
                    <StatusPill label={t('healthOk')} tone="connected" />
                  ) : null}
                  {connected && (app.healthStatus === 'error' || app.healthStatus === 'degraded') ? (
                    <StatusPill label={t('statusActionRequired')} tone="attention" />
                  ) : null}
                </div>
              </div>
            </header>

            {showOauthSuccess && connected ? (
              <div className="max-w-3xl rounded-2xl border border-[#C5E3D0] bg-[#EBF5EF] px-4 py-3.5">
                <p className="text-sm font-medium text-[#2E6B4F]">{oauthConnectedTitle}</p>
                <p className="mt-1 text-sm text-[#2E6B4F]">
                  {provider === 'google_calendar'
                    ? t('oauthConnectedNextGoogle')
                    : isZohoAccountingProvider(provider)
                      ? t('oauthConnectedNextZoho')
                      : t('oauthConnectedNextGeneric')}
                </p>
              </div>
            ) : null}

            {message ? <p className="max-w-3xl text-sm text-[#2E6B4F]">{message}</p> : null}
            {error ? (
              <div className="max-w-3xl rounded-2xl border border-[#E5D4BC] bg-[#FBF7F1] px-4 py-3">
                <p className="text-sm text-[#71382D]">{operatorError(t, error)}</p>
              </div>
            ) : null}

            {!connected ? (
              <ProviderEducationSections
                provider={provider}
                brandName={displayName}
                availability={app.availability}
                connected={false}
              />
            ) : null}

            {connected ? (
              <section className="max-w-3xl space-y-3">
                <SectionTitle>{t('connectionHeading')}</SectionTitle>
                <div className="divide-y divide-[#E8E2DA] rounded-2xl border border-[#E8E2DA] bg-white">
                  <ConnectionRow
                    label={provider === 'google_calendar' ? t('googleAccount') : t('account')}
                    value={app.accountLabel || googleAccountEmail || '—'}
                  />
                  <ConnectionRow label={t('connected')} value={t('connected')} />
                  {provider === 'google_calendar' ? (
                    <ConnectionRow
                      label={t('googleTargetCalendar')}
                      value={selectedGoogleCalendarName || selectedGoogleCalendarId || '—'}
                    />
                  ) : null}
                  {isZohoAccountingProvider(provider) ? (
                    <ConnectionRow label={t('zohoOrganization')} value={zohoSelectedOrgName || zohoSelectedOrgId || '—'} />
                  ) : null}
                  {syncEnabledLabel ? (
                    <ConnectionRow
                      label={isZohoAccountingProvider(provider) ? t('zohoSyncInvoices') : t('reservationSyncLabel')}
                      value={syncEnabledLabel}
                    />
                  ) : null}
                  <ConnectionRow
                    label={t('lastSuccessfulSync')}
                    value={app.lastSyncAt ? new Date(app.lastSyncAt).toLocaleString() : '—'}
                  />
                </div>
              </section>
            ) : null}

            {data?.canManage ? (
              <div className="flex flex-wrap gap-3">
                {!connected && !comingSoon && app.availability === 'available' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void startOAuth()}
                    className="min-h-11 rounded-xl bg-[#71382D] px-5 text-sm font-medium text-white hover:bg-[#B85C3E] disabled:opacity-60"
                  >
                    {connectLabel}
                  </button>
                ) : null}
                {connected ? (
                  <>
                    {provider !== 'google_calendar' && !isZohoAccountingProvider(provider) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void syncNow()}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E8E2DA] bg-white px-4 text-sm font-medium text-[#191816] disabled:opacity-60"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {t('syncNow')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void disconnect()}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E5D4BC] bg-white px-4 text-sm font-medium text-[#71382D] disabled:opacity-60"
                    >
                      <Unplug className="h-4 w-4" />
                      {t('disconnect')}
                    </button>
                  </>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[#7A7267]">{t('ownerManagesApps')}</p>
            )}

            {isZohoAccountingProvider(provider) && data?.canManage && connected ? (
              <section className="max-w-3xl space-y-4">
                <SectionTitle>{t('configurationHeading')}</SectionTitle>
                <div className="rounded-2xl border border-[#E8E2DA] bg-white p-4 sm:p-5">
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
                      {(t('zohoLastSynced', { time: new Date(app.lastSyncAt).toLocaleString() }))}
                    </p>
                  ) : null}
                </div>

                {provider === 'zoho_books' && zohoSelectedOrgId ? (
                  <div className="rounded-2xl border border-[#E8E2DA] bg-white p-4 sm:p-5">
                    <h2 className="text-sm font-medium text-[#191816]">{t('zohoBooksPaymentAccount')}</h2>
                    <p className="mt-1 text-sm text-[#7A7267]">{t('zohoBooksPaymentAccountHelp')}</p>
                    <label className="mt-3 block">
                      <span className="sr-only">{t('zohoBooksPaymentAccount')}</span>
                      <select
                        className="min-h-11 w-full rounded-xl border border-[#E8E2DA] bg-white px-3 text-sm text-[#191816]"
                        disabled={busy}
                        value={zohoPaymentAccountId || ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!value) {
                            void selectZohoPaymentAccount(null, null);
                            return;
                          }
                          const match = zohoBankAccounts.find((row) => row.accountId === value);
                          void selectZohoPaymentAccount(value, match?.name || null);
                        }}
                      >
                        <option value="">{t('zohoBooksPaymentAccountDefault')}</option>
                        {zohoBankAccounts.map((account) => (
                          <option key={account.accountId} value={account.accountId}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                {(() => {
                  const zohoView = resolveZohoOrgsView({
                    connected: true,
                    fetchStatus: zohoOrgsFetchStatus,
                    organizations: zohoOrgs,
                    errorMessage: zohoOrgsError,
                  });
                  if (zohoView.kind === 'loading') {
                    return <ListSkeleton label={t('zohoOrgsLoading')} />;
                  }
                  if (zohoView.kind === 'error') {
                    return (
                      <div className="space-y-3 rounded-2xl border border-[#E5D4BC] bg-[#FBF7F1] p-4">
                        <p className="text-sm text-[#71382D]">{t('zohoOrgsLoadFailed')}</p>
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
                        <ul className="divide-y divide-[#E8E2DA] rounded-2xl border border-[#E8E2DA] bg-white">
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
                    <div className="space-y-3 rounded-2xl border border-[#E8E2DA] bg-white p-4">
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

            {provider === 'google_calendar' && data?.canManage && connected ? (
              <section className="max-w-3xl space-y-4">
                <SectionTitle>{t('configurationHeading')}</SectionTitle>
                <div className="rounded-2xl border border-[#E8E2DA] bg-white p-4 sm:p-5">
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
                      {new Date(app.lastSyncAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>

                {googleCalendarsFetchStatus === 'loading' || googleCalendarsFetchStatus === 'idle' ? (
                  <ListSkeleton label={t('googleCalendarsLoading')} />
                ) : null}
                {googleCalendarsFetchStatus === 'error' ? (
                  <div className="space-y-3 rounded-2xl border border-[#E5D4BC] bg-[#FBF7F1] p-4">
                    <p className="text-sm text-[#71382D]">{t('googleCalendarsLoadFailed')}</p>
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
                    <ul className="divide-y divide-[#E8E2DA] rounded-2xl border border-[#E8E2DA] bg-white">
                      {googleCalendars.map((calendar) => (
                        <li key={calendar.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                          <span className="text-[#191816]">
                            {calendar.summary}
                            {calendar.primary ? (
                              <span className="ms-2 text-xs text-[#7A7267]">({t('googlePrimaryBadge')})</span>
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

            {connected ? (
              <ProviderEducationSections
                provider={provider}
                brandName={displayName}
                availability={app.availability}
                connected={true}
              />
            ) : null}

            {app.lastErrorMessage ? (
              <section className="max-w-3xl rounded-2xl border border-[#E5D4BC] bg-[#F7F1E8] p-4">
                <h2 className="text-sm font-medium text-[#71382D]">{t('lastError')}</h2>
                <p className="mt-1 text-sm text-[#71382D]">{operatorError(t, app.lastErrorMessage)}</p>
              </section>
            ) : null}

            {(data?.syncJobs || []).length > 0 ? (
              <section className="max-w-3xl space-y-3">
                <SectionTitle>{t('syncHistory')}</SectionTitle>
                <ul className="divide-y divide-[#E8E2DA] rounded-2xl border border-[#E8E2DA] bg-white">
                  {(data?.syncJobs || []).slice(0, 5).map((job) => (
                    <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-[#191816]">{friendlyJobType(t, job.jobType)}</p>
                        <p className="text-xs text-[#7A7267]">{new Date(job.createdAt).toLocaleString()}</p>
                      </div>
                      <span className="text-[#7A7267]">{friendlyJobStatus(t, job.status)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {(data?.activity || []).length > 0 ? (
              <section className="max-w-3xl space-y-3">
                <SectionTitle>{t('recentActivity')}</SectionTitle>
                <ul className="divide-y divide-[#E8E2DA] rounded-2xl border border-[#E8E2DA] bg-white">
                  {(data?.activity || []).slice(0, 5).map((row) => (
                    <li key={row.id} className="px-4 py-3 text-sm">
                      <p className="text-[#191816]">{friendlyActivity(t, row.action, row.details)}</p>
                      <p className="text-xs text-[#7A7267]">{new Date(row.createdAt).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="max-w-3xl space-y-6" aria-hidden>
      <div className="flex gap-4">
        <div className="h-14 w-14 animate-pulse rounded-xl bg-[#F5EEE9]" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 w-20 animate-pulse rounded bg-[#F5EEE9]" />
          <div className="h-7 w-48 animate-pulse rounded bg-[#F5EEE9]" />
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-[#F5EEE9]" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-20 animate-pulse rounded-2xl bg-[#F5EEE9]" />
        <div className="h-20 animate-pulse rounded-2xl bg-[#F5EEE9]" />
      </div>
    </div>
  );
}

function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label={label}>
      <div className="h-12 animate-pulse rounded-2xl bg-[#F5EEE9]" />
      <div className="h-12 animate-pulse rounded-2xl bg-[#F5EEE9]" />
      <div className="h-12 animate-pulse rounded-2xl bg-[#F5EEE9]" />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7A7267]">{children}</h2>;
}

function ConnectionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#7A7267]">{label}</p>
      <p className="break-words text-sm text-[#191816] sm:text-end" dir="auto">
        {value}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E8E2DA] bg-white p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#7A7267]">{label}</p>
      <p className="mt-1 break-words text-sm text-[#191816]" dir="auto">
        {value}
      </p>
    </div>
  );
}

function StatusPill({
  label,
  tone = 'disconnected',
}: {
  label: string;
  tone?: 'connected' | 'disconnected' | 'coming_soon' | 'attention';
}) {
  const styles =
    tone === 'connected'
      ? 'border-[#C5E3D0] bg-[#EBF5EF] text-[#2E6B4F]'
      : tone === 'attention'
        ? 'border-[#E5D4BC] bg-[#F7F1E8] text-[#71382D]'
        : 'border-[#E8E2DA] bg-[#F9F7F5] text-[#7A7267]';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {tone === 'connected' ? <span className="me-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#2E6B4F]" aria-hidden /> : null}
      {label}
    </span>
  );
}


function statusToneFor(needsConfig: boolean, status: string): 'connected' | 'disconnected' | 'coming_soon' | 'attention' {
  if (needsConfig) return 'attention';
  if (status === 'connected') return 'connected';
  if (status === 'coming_soon') return 'coming_soon';
  if (status === 'needs_attention' || status === 'error') return 'attention';
  return 'disconnected';
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

function operatorError(t: ReturnType<typeof useTranslations<'apps'>>, raw: string) {
  const value = raw.toLowerCase();
  if (value.includes('oauth') || value.includes('authorization')) return t('oauthReturnFailed');
  if (value.includes('network') || value.includes('fetch')) return t('detailLoadFailed');
  if (raw.length > 140 || /[_A-Z]{6,}/.test(raw)) return t('detailLoadFailed');
  return raw;
}

function friendlyJobType(t: ReturnType<typeof useTranslations<'apps'>>, jobType: string) {
  if (jobType.includes('reconcile')) return t('syncJobReconcile');
  if (jobType.includes('full')) return t('syncJobFull');
  if (jobType.includes('reservation')) return t('syncJobReservation');
  if (jobType.includes('invoice') || jobType.includes('payment')) return t('syncJobInvoice');
  return t('syncJobGeneric');
}

function friendlyJobStatus(t: ReturnType<typeof useTranslations<'apps'>>, status: string) {
  if (status === 'succeeded' || status === 'success' || status === 'completed') return t('syncStatusSucceeded');
  if (status === 'failed' || status === 'error' || status === 'dead_letter') return t('syncStatusFailed');
  if (status === 'queued' || status === 'pending' || status === 'retrying') return t('syncStatusQueued');
  if (status === 'running' || status === 'processing') return t('syncStatusRunning');
  return status;
}

function friendlyActivity(
  t: ReturnType<typeof useTranslations<'apps'>>,
  action: string,
  details?: Record<string, unknown> | null
) {
  const value = action.toLowerCase();
  const calendar =
    typeof details?.calendarName === 'string'
      ? details.calendarName
      : typeof details?.calendarId === 'string'
        ? details.calendarId
        : null;
  const org =
    typeof details?.organizationName === 'string'
      ? details.organizationName
      : typeof details?.orgName === 'string'
        ? details.orgName
        : null;

  if (value.includes('oauth') && (value.includes('start') || value.includes('begun'))) return t('activityOAuthStarted');
  if (value.includes('oauth') && (value.includes('complet') || value.includes('authorized') || value.includes('connected'))) {
    return t('activityOAuthCompleted');
  }
  if (value.includes('calendar_selected') || value.includes('calendar.selected')) {
    return calendar ? t('activityCalendarSelected', { calendar }) : t('activityCalendarSelectedGeneric');
  }
  if (value.includes('sync_enabled') || value.includes('sync.enabled')) return t('activitySyncEnabled');
  if (value.includes('sync_disabled') || value.includes('sync.disabled')) return t('activitySyncDisabled');
  if (value.includes('org') && value.includes('select')) {
    return org ? t('activityOrgSelected', { org }) : t('activitySynced');
  }
  if (value.includes('disconnected')) return t('activityDisconnected');
  if (value.includes('connected')) return t('activityConnected');
  if (value.includes('sync')) return t('activitySynced');
  return t('activityGeneric', { action: action.replaceAll('_', ' ').replaceAll('.', ' · ') });
}
