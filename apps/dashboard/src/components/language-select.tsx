'use client';

import * as React from 'react';
import { APP_LOCALES, LOCALE_META, type AppLocale } from '@/i18n/config';
import { useAppLocale } from '@/i18n/provider';
import { useTranslations } from 'next-intl';

export function LanguageSelect({
  id,
  className,
  onPicked,
}: {
  id?: string;
  className?: string;
  onPicked?: () => void;
}) {
  const t = useTranslations('common');
  const { locale, setLocale, switching } = useAppLocale();
  return (
    <select
      id={id}
      aria-label={t('language')}
      disabled={switching}
      value={locale}
      onChange={async (event) => {
        await setLocale(event.target.value as AppLocale);
        onPicked?.();
      }}
      className={
        className ||
        'min-h-11 w-full rounded border border-[#E5D4BC] bg-white px-3 py-2 text-sm text-[#191816] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E]'
      }
    >
      {APP_LOCALES.map((code) => (
        <option key={code} value={code} lang={LOCALE_META[code].htmlLang}>
          {LOCALE_META[code].nativeName}
        </option>
      ))}
    </select>
  );
}
