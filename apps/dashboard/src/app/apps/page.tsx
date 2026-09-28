'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Building2, CreditCard, Globe, Home, Wallet } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { ConnectedAppCard, type ConnectedAppStatusTone } from '@/components/connected-app-card';
import { PaystackConnectionPanel } from '@/components/paystack-connection-panel';
import { FlutterwaveConnectionPanel } from '@/components/flutterwave-connection-panel';

type ProviderCatalogState = {
  status?: string;
  displayStatus?: 'disconnected' | 'connected' | 'needs_attention' | 'disabled';
  mode?: 'test' | 'live';
  enabled?: boolean;
  acceptOnlinePayments?: boolean;
};

function providerCatalogStatus(provider: ProviderCatalogState | null): {
  tone: ConnectedAppStatusTone;
  statusKey: 'statusNotConnected' | 'statusConnectedEnabled' | 'statusConnectedDisabled' | 'statusActionRequired';
} {
  const display = provider?.displayStatus || (provider?.status === 'disconnected' || !provider ? 'disconnected' : 'connected');
  if (display === 'disconnected') return { tone: 'disconnected', statusKey: 'statusNotConnected' };
  if (display === 'needs_attention') return { tone: 'attention', statusKey: 'statusActionRequired' };
  if (display === 'disabled') return { tone: 'disabled', statusKey: 'statusConnectedDisabled' };
  const enabled = provider?.enabled !== false && provider?.acceptOnlinePayments !== false;
  if (!enabled) return { tone: 'disabled', statusKey: 'statusConnectedDisabled' };
  return { tone: 'connected', statusKey: 'statusConnectedEnabled' };
}

function ConnectedAppsCatalog() {
  const t = useTranslations('apps');
  const tCommon = useTranslations('common');
  const [paystack, setPaystack] = React.useState<ProviderCatalogState | null>(null);
  const [flutterwave, setFlutterwave] = React.useState<ProviderCatalogState | null>(null);
  const [preferred, setPreferred] = React.useState<'paystack' | 'flutterwave' | null>(null);
  const [enabledProviders, setEnabledProviders] = React.useState<string[]>([]);
  const [canManage, setCanManage] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [preferredBusy, setPreferredBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetch('/api/apps/payments', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setCanManage(Boolean(data.canManage));
        setPaystack(data.paystack || null);
        setFlutterwave(data.flutterwave || null);
        setPreferred(data.preferredOnlineProvider || null);
        setEnabledProviders(Array.isArray(data.enabledProviders) ? data.enabledProviders : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const paystackSummary = providerCatalogStatus(paystack);
  const flutterwaveSummary = providerCatalogStatus(flutterwave);
  const paystackMode =
    paystackSummary.statusKey === 'statusNotConnected'
      ? undefined
      : paystack?.mode === 'live'
        ? t('liveMode')
        : paystack?.mode === 'test'
          ? t('testMode')
          : undefined;
  const flutterwaveMode =
    flutterwaveSummary.statusKey === 'statusNotConnected'
      ? undefined
      : flutterwave?.mode === 'live'
        ? t('liveMode')
        : flutterwave?.mode === 'test'
          ? t('testMode')
          : undefined;
  const paystackHref = canManage ? '/apps?manage=paystack' : undefined;
  const flutterwaveHref = canManage ? '/apps?manage=flutterwave' : undefined;
  const paystackAction =
    canManage && loaded
      ? paystackSummary.statusKey === 'statusNotConnected'
        ? t('connect')
        : t('manage')
      : undefined;
  const flutterwaveAction =
    canManage && loaded
      ? flutterwaveSummary.statusKey === 'statusNotConnected'
        ? t('connect')
        : t('manage')
      : undefined;
  const showPreferred = canManage && loaded && enabledProviders.includes('paystack') && enabledProviders.includes('flutterwave');
  const effectivePreferred = preferred || 'paystack';

  async function savePreferred(next: 'paystack' | 'flutterwave') {
    setPreferredBusy(true);
    try {
      const response = await fetch('/api/apps/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preferred_provider', preferredOnlineProvider: next }),
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json();
      setPreferred(data.preferredOnlineProvider || next);
      setEnabledProviders(Array.isArray(data.enabledProviders) ? data.enabledProviders : enabledProviders);
    } finally {
      setPreferredBusy(false);
    }
  }

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <Topbar title={t('title')} />
      <main className="flex-1 space-y-8 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="font-serif text-2xl text-[#191816]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[#7A7267]">{t('subtitle')}</p>
        </div>

        <section aria-labelledby="connected-apps-payments">
          <h2 id="connected-apps-payments" className="text-[11px] font-medium uppercase tracking-widest text-[#7A7267]">
            {t('paymentsCategory')}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ConnectedAppCard
              name={t('paystack')}
              description={t('paystackDescription')}
              icon={<CreditCard className="h-5 w-5 text-[#71382D]" />}
              statusLabel={loaded ? t(paystackSummary.statusKey) : tCommon('loading')}
              statusTone={loaded ? paystackSummary.tone : 'disconnected'}
              modeLabel={loaded ? paystackMode : undefined}
              actionLabel={paystackAction}
              actionHref={paystackHref}
            />
            <ConnectedAppCard
              name={t('flutterwave')}
              description={t('flutterwaveDescription')}
              icon={<Wallet className="h-5 w-5 text-[#71382D]" />}
              statusLabel={loaded ? t(flutterwaveSummary.statusKey) : tCommon('loading')}
              statusTone={loaded ? flutterwaveSummary.tone : 'disconnected'}
              modeLabel={loaded ? flutterwaveMode : undefined}
              actionLabel={flutterwaveAction}
              actionHref={flutterwaveHref}
            />
          </div>
          {showPreferred ? (
            <div className="mt-4 max-w-xl rounded-xl border border-[#E8E2DA] bg-white p-4">
              <h3 className="text-sm font-medium text-[#191816]">{t('preferredProvider')}</h3>
              <p className="mt-1 text-xs text-[#7A7267]">{t('preferredProviderHelp')}</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={preferredBusy}
                  onClick={() => void savePreferred('paystack')}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${effectivePreferred === 'paystack' ? 'border-[#71382D] bg-[#F5EEE9] text-[#71382D]' : 'border-[#E8E2DA] text-[#191816]'}`}
                >
                  {t('paystack')}
                </button>
                <button
                  type="button"
                  disabled={preferredBusy}
                  onClick={() => void savePreferred('flutterwave')}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${effectivePreferred === 'flutterwave' ? 'border-[#71382D] bg-[#F5EEE9] text-[#71382D]' : 'border-[#E8E2DA] text-[#191816]'}`}
                >
                  {t('flutterwave')}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="connected-apps-booking-channels">
          <h2 id="connected-apps-booking-channels" className="text-[11px] font-medium uppercase tracking-widest text-[#7A7267]">
            {t('bookingChannelsCategory')}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ConnectedAppCard
              name={t('bookingCom')}
              description={t('bookingComDescription')}
              icon={<Building2 className="h-5 w-5 text-[#71382D]" />}
              statusLabel={t('statusComingSoon')}
              statusTone="coming_soon"
            />
            <ConnectedAppCard
              name={t('airbnb')}
              description={t('airbnbDescription')}
              icon={<Home className="h-5 w-5 text-[#71382D]" />}
              statusLabel={t('statusComingSoon')}
              statusTone="coming_soon"
            />
            <ConnectedAppCard
              name={t('expedia')}
              description={t('expediaDescription')}
              icon={<Globe className="h-5 w-5 text-[#71382D]" />}
              statusLabel={t('statusComingSoon')}
              statusTone="coming_soon"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function ConnectedAppsSurface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  if (searchParams.get('manage') === 'paystack') {
    return <PaystackConnectionPanel onBack={() => router.push('/apps')} />;
  }
  if (searchParams.get('manage') === 'flutterwave') {
    return <FlutterwaveConnectionPanel onBack={() => router.push('/apps')} />;
  }
  return <ConnectedAppsCatalog />;
}

function ConnectedAppsFallback() {
  const t = useTranslations('apps');
  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <Topbar title={t('title')} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8" />
    </div>
  );
}

export default function AppsPage() {
  return (
    <React.Suspense fallback={<ConnectedAppsFallback />}>
      <ConnectedAppsSurface />
    </React.Suspense>
  );
}
