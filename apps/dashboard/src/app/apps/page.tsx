'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Building2,
  Calculator,
  CalendarDays,
  CreditCard,
  Globe,
  Home,
  MessageCircle,
  Search,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { ConnectedAppCard, type ConnectedAppStatusTone } from '@/components/connected-app-card';
import { PaystackConnectionPanel } from '@/components/paystack-connection-panel';
import { FlutterwaveConnectionPanel } from '@/components/flutterwave-connection-panel';
import { ConnectedAppDetailPanel } from '@/components/connected-app-detail-panel';

type CatalogApp = {
  provider: string;
  name: string;
  category: string;
  description: string;
  availability: string;
  connectionStatus: string;
  healthStatus: string | null;
  mode?: string | null;
  recommended?: boolean;
  canConnect: boolean;
  canManage: boolean;
};

type ProviderCatalogState = {
  status?: string;
  displayStatus?: 'disconnected' | 'connected' | 'needs_attention' | 'disabled';
  mode?: 'test' | 'live';
  enabled?: boolean;
  acceptOnlinePayments?: boolean;
};

const CATEGORIES = [
  { id: 'all', labelKey: 'filterAll' as const },
  { id: 'connected', labelKey: 'filterConnected' as const },
  { id: 'recommended', labelKey: 'filterRecommended' as const },
  { id: 'payments', labelKey: 'paymentsCategory' as const },
  { id: 'accounting', labelKey: 'accountingCategory' as const },
  { id: 'calendar', labelKey: 'calendarCategory' as const },
  { id: 'communications', labelKey: 'communicationsCategory' as const },
  { id: 'channel_management', labelKey: 'bookingChannelsCategory' as const },
  { id: 'productivity', labelKey: 'productivityCategory' as const },
  { id: 'crm', labelKey: 'crmCategory' as const },
];

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

function toneFor(status: string): ConnectedAppStatusTone {
  if (status === 'connected') return 'connected';
  if (status === 'needs_attention' || status === 'error') return 'attention';
  if (status === 'coming_soon') return 'coming_soon';
  if (status === 'paused') return 'disabled';
  return 'disconnected';
}

function iconFor(provider: string, category: string) {
  if (provider === 'paystack') return <CreditCard className="h-5 w-5 text-[#71382D]" />;
  if (provider === 'flutterwave') return <Wallet className="h-5 w-5 text-[#71382D]" />;
  if (provider === 'zoho_invoice' || category === 'accounting') return <Calculator className="h-5 w-5 text-[#71382D]" />;
  if (provider === 'google_calendar' || category === 'calendar') return <CalendarDays className="h-5 w-5 text-[#71382D]" />;
  if (provider === 'whatsapp' || category === 'communications') return <MessageCircle className="h-5 w-5 text-[#71382D]" />;
  if (provider === 'booking_com') return <Building2 className="h-5 w-5 text-[#71382D]" />;
  if (provider === 'airbnb') return <Home className="h-5 w-5 text-[#71382D]" />;
  if (provider === 'expedia') return <Globe className="h-5 w-5 text-[#71382D]" />;
  return <Sparkles className="h-5 w-5 text-[#71382D]" />;
}

function ConnectedAppsCatalog() {
  const t = useTranslations('apps');
  const tCommon = useTranslations('common');
  const [apps, setApps] = React.useState<CatalogApp[]>([]);
  const [paystack, setPaystack] = React.useState<ProviderCatalogState | null>(null);
  const [flutterwave, setFlutterwave] = React.useState<ProviderCatalogState | null>(null);
  const [preferred, setPreferred] = React.useState<'paystack' | 'flutterwave' | null>(null);
  const [enabledProviders, setEnabledProviders] = React.useState<string[]>([]);
  const [canManage, setCanManage] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [preferredBusy, setPreferredBusy] = React.useState(false);
  const [category, setCategory] = React.useState('all');
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`/api/apps/catalog?category=${encodeURIComponent(category)}&q=${encodeURIComponent(query)}`, { cache: 'no-store' }),
      fetch('/api/apps/payments', { cache: 'no-store' }),
    ])
      .then(async ([catalogRes, paymentsRes]) => {
        if (cancelled) return;
        if (catalogRes.ok) {
          const catalog = await catalogRes.json();
          setCanManage(Boolean(catalog.canManage));
          setApps(Array.isArray(catalog.apps) ? catalog.apps : []);
        }
        if (paymentsRes.ok) {
          const data = await paymentsRes.json();
          setCanManage(Boolean(data.canManage));
          setPaystack(data.paystack || null);
          setFlutterwave(data.flutterwave || null);
          setPreferred(data.preferredOnlineProvider || null);
          setEnabledProviders(Array.isArray(data.enabledProviders) ? data.enabledProviders : []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [category, query]);

  const paystackSummary = providerCatalogStatus(paystack);
  const flutterwaveSummary = providerCatalogStatus(flutterwave);
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

  const grouped = React.useMemo(() => {
    const order = ['payments', 'accounting', 'calendar', 'communications', 'channel_management', 'productivity', 'crm', 'storage', 'analytics'];
    const map = new Map<string, CatalogApp[]>();
    for (const raw of apps) {
      const app = { ...raw };
      if (app.provider === 'paystack' && paystack) {
        app.connectionStatus =
          paystackSummary.statusKey === 'statusConnectedEnabled'
            ? 'connected'
            : paystackSummary.statusKey === 'statusActionRequired'
              ? 'needs_attention'
              : paystackSummary.statusKey === 'statusConnectedDisabled'
                ? 'paused'
                : 'disconnected';
      }
      if (app.provider === 'flutterwave' && flutterwave) {
        app.connectionStatus =
          flutterwaveSummary.statusKey === 'statusConnectedEnabled'
            ? 'connected'
            : flutterwaveSummary.statusKey === 'statusActionRequired'
              ? 'needs_attention'
              : flutterwaveSummary.statusKey === 'statusConnectedDisabled'
                ? 'paused'
                : 'disconnected';
      }
      const list = map.get(app.category) || [];
      list.push(app);
      map.set(app.category, list);
    }
    return order.filter((key) => map.has(key)).map((key) => ({ category: key, apps: map.get(key)! }));
  }, [apps, paystack, flutterwave, paystackSummary.statusKey, flutterwaveSummary.statusKey]);

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <Topbar title={t('title')} />
      <main className="flex-1 space-y-8 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="font-serif text-2xl text-[#191816]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[#7A7267]">{t('subtitle')}</p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setCategory(entry.id)}
                className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-medium ${
                  category === entry.id ? 'border-[#71382D] bg-[#F5EEE9] text-[#71382D]' : 'border-[#E8E2DA] text-[#7A7267]'
                }`}
              >
                {t(entry.labelKey)}
              </button>
            ))}
          </div>
          <label className="relative block w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A7267]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="min-h-11 w-full rounded-lg border border-[#E8E2DA] bg-white pl-9 pr-3 text-sm text-[#191816] outline-none focus:border-[#71382D]"
            />
          </label>
        </div>

        {grouped.map((group) => (
          <section key={group.category} aria-labelledby={`connected-apps-${group.category}`}>
            <h2 id={`connected-apps-${group.category}`} className="text-[11px] font-medium uppercase tracking-widest text-[#7A7267]">
              {categoryLabel(t, group.category)}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.apps.map((app) => {
                const isPayment = app.provider === 'paystack' || app.provider === 'flutterwave';
                const paymentSummary = app.provider === 'paystack' ? paystackSummary : app.provider === 'flutterwave' ? flutterwaveSummary : null;
                const statusLabel = !loaded
                  ? tCommon('loading')
                  : paymentSummary
                    ? t(paymentSummary.statusKey)
                    : app.connectionStatus === 'coming_soon'
                      ? t('statusComingSoon')
                      : app.connectionStatus === 'connected'
                        ? t('statusConnectedEnabled')
                        : app.connectionStatus === 'needs_attention'
                          ? t('statusActionRequired')
                          : app.connectionStatus === 'paused'
                            ? t('statusConnectedDisabled')
                            : t('statusNotConnected');
                const href =
                  canManage && loaded && app.availability === 'available'
                    ? `/apps?manage=${app.provider}`
                    : undefined;
                const actionLabel =
                  canManage && loaded && app.availability === 'available'
                    ? app.connectionStatus === 'disconnected'
                      ? t('connect')
                      : t('manage')
                    : undefined;
                const modeLabel =
                  isPayment && loaded && paymentSummary && paymentSummary.statusKey !== 'statusNotConnected'
                    ? (app.provider === 'paystack' ? paystack?.mode : flutterwave?.mode) === 'live'
                      ? t('liveMode')
                      : (app.provider === 'paystack' ? paystack?.mode : flutterwave?.mode) === 'test'
                        ? t('testMode')
                        : undefined
                    : undefined;

                return (
                  <ConnectedAppCard
                    key={app.provider}
                    name={app.name}
                    description={app.description}
                    icon={iconFor(app.provider, app.category)}
                    statusLabel={statusLabel}
                    statusTone={loaded ? (paymentSummary ? paymentSummary.tone : toneFor(app.connectionStatus)) : 'disconnected'}
                    modeLabel={modeLabel}
                    actionLabel={actionLabel}
                    actionHref={href}
                  />
                );
              })}
            </div>
            {group.category === 'payments' && showPreferred ? (
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
        ))}
      </main>
    </div>
  );
}

function categoryLabel(t: ReturnType<typeof useTranslations<'apps'>>, category: string) {
  switch (category) {
    case 'payments':
      return t('paymentsCategory');
    case 'accounting':
      return t('accountingCategory');
    case 'calendar':
      return t('calendarCategory');
    case 'communications':
      return t('communicationsCategory');
    case 'channel_management':
      return t('bookingChannelsCategory');
    case 'productivity':
      return t('productivityCategory');
    case 'crm':
      return t('crmCategory');
    case 'storage':
      return t('storageCategory');
    default:
      return category;
  }
}

function ConnectedAppsSurface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const manage = searchParams.get('manage');
  if (manage === 'paystack') {
    return <PaystackConnectionPanel onBack={() => router.push('/apps')} />;
  }
  if (manage === 'flutterwave') {
    return <FlutterwaveConnectionPanel onBack={() => router.push('/apps')} />;
  }
  if (manage) {
    return <ConnectedAppDetailPanel provider={manage} onBack={() => router.push('/apps')} />;
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
