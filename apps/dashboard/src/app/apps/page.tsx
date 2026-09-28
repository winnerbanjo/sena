'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Building2, CreditCard, Globe, Home } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { ConnectedAppCard, type ConnectedAppStatusTone } from '@/components/connected-app-card';
import { PaystackConnectionPanel } from '@/components/paystack-connection-panel';

type PaystackCatalogState = {
  status?: string;
  displayStatus?: 'disconnected' | 'connected' | 'needs_attention' | 'disabled';
  mode?: 'test' | 'live';
  enabled?: boolean;
  acceptOnlinePayments?: boolean;
};

function paystackCatalogStatus(paystack: PaystackCatalogState | null): {
  tone: ConnectedAppStatusTone;
  statusKey: 'statusNotConnected' | 'statusConnectedEnabled' | 'statusConnectedDisabled' | 'statusActionRequired';
} {
  const display = paystack?.displayStatus || (paystack?.status === 'disconnected' || !paystack ? 'disconnected' : 'connected');
  if (display === 'disconnected') return { tone: 'disconnected', statusKey: 'statusNotConnected' };
  if (display === 'needs_attention') return { tone: 'attention', statusKey: 'statusActionRequired' };
  if (display === 'disabled') return { tone: 'disabled', statusKey: 'statusConnectedDisabled' };
  const enabled = paystack?.enabled !== false && paystack?.acceptOnlinePayments !== false;
  if (!enabled) return { tone: 'disabled', statusKey: 'statusConnectedDisabled' };
  return { tone: 'connected', statusKey: 'statusConnectedEnabled' };
}

function ConnectedAppsCatalog() {
  const t = useTranslations('apps');
  const tCommon = useTranslations('common');
  const [paystack, setPaystack] = React.useState<PaystackCatalogState | null>(null);
  const [canManage, setCanManage] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetch('/api/apps/paystack', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setCanManage(Boolean(data.canManage));
        setPaystack(data.paystack || null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = paystackCatalogStatus(paystack);
  const modeLabel =
    summary.statusKey === 'statusNotConnected'
      ? undefined
      : paystack?.mode === 'live'
        ? t('liveMode')
        : paystack?.mode === 'test'
          ? t('testMode')
          : undefined;
  const paystackHref = canManage ? '/apps?manage=paystack' : undefined;
  const paystackAction =
    canManage && loaded
      ? summary.statusKey === 'statusNotConnected'
        ? t('connect')
        : t('manage')
      : undefined;

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
              statusLabel={loaded ? t(summary.statusKey) : tCommon('loading')}
              statusTone={loaded ? summary.tone : 'disconnected'}
              modeLabel={loaded ? modeLabel : undefined}
              actionLabel={paystackAction}
              actionHref={paystackHref}
            />
          </div>
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
