'use client';

import * as React from 'react';
import { NextIntlClientProvider, IntlErrorCode, type IntlError } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  type AppLocale,
  localeDir,
  parseLocale,
} from './config';
import { loadEnglishMessages, loadLocaleMessages, lookupMessage, type DashboardMessages } from './messages';
import { hasUnsavedWork } from './unsaved';

type I18nContextValue = {
  locale: AppLocale;
  dir: 'ltr' | 'rtl';
  setLocale: (next: AppLocale) => Promise<boolean>;
  switching: boolean;
};

const I18nContext = React.createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  dir: 'ltr',
  setLocale: async () => false,
  switching: false,
});

export function useAppLocale() {
  return React.useContext(I18nContext);
}

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === 'undefined') return;
  const dir = localeDir(locale);
  document.documentElement.lang = LOCALE_META[locale].htmlLang;
  document.documentElement.dir = dir;
}

export function I18nRoot({
  locale,
  messages,
  timeZone,
  children,
}: {
  locale: AppLocale;
  messages: DashboardMessages;
  timeZone?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const englishRef = React.useRef<DashboardMessages | null>(null);
  const [activeLocale, setActiveLocale] = React.useState(locale);
  const [activeMessages, setActiveMessages] = React.useState(messages);
  const [switching, setSwitching] = React.useState(false);

  React.useEffect(() => {
    setActiveLocale(locale);
    setActiveMessages(messages);
    applyDocumentLocale(locale);
  }, [locale, messages]);

  const setLocale = React.useCallback(
    async (nextRaw: AppLocale) => {
      const next = parseLocale(nextRaw);
      if (next === activeLocale) return true;
      if (hasUnsavedWork() && typeof window !== 'undefined') {
        const proceed = window.confirm(
          lookupMessage(activeMessages, 'settings.languageUnsavedWarning') ||
            'You have unsaved changes. Switch language anyway?',
        );
        if (!proceed) return false;
      }
      setSwitching(true);
      try {
        const nextMessages = await loadLocaleMessages(next);
        const response = await fetch('/api/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: next }),
        });
        if (!response.ok) throw new Error('locale_persist_failed');
        setActiveMessages(nextMessages);
        setActiveLocale(next);
        applyDocumentLocale(next);
        router.refresh();
        return true;
      } catch {
        return false;
      } finally {
        setSwitching(false);
      }
    },
    [activeLocale, activeMessages, router],
  );

  const getMessageFallback = React.useCallback(
    ({ namespace, key }: { namespace?: string; key: string }) => {
      const path = namespace ? `${namespace}.${key}` : key;
      const english = englishRef.current;
      if (english) return lookupMessage(english, path) || '';
      const current = lookupMessage(activeMessages, path);
      return current || '';
    },
    [activeMessages],
  );

  React.useEffect(() => {
    loadEnglishMessages().then((en) => {
      englishRef.current = en;
    });
  }, []);

  const onError = React.useCallback((error: IntlError) => {
    if (error.code === IntlErrorCode.MISSING_MESSAGE) return;
    if (process.env.NODE_ENV !== 'production') console.warn(error);
  }, []);

  const value = React.useMemo(
    () => ({ locale: activeLocale, dir: localeDir(activeLocale), setLocale, switching }),
    [activeLocale, setLocale, switching],
  );

  return (
    <I18nContext.Provider value={value}>
      <NextIntlClientProvider
        locale={activeLocale}
        messages={activeMessages}
        timeZone={timeZone || 'Africa/Lagos'}
        onError={onError}
        getMessageFallback={getMessageFallback}
      >
        {children}
      </NextIntlClientProvider>
    </I18nContext.Provider>
  );
}
