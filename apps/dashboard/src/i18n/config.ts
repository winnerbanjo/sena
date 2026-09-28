export const APP_LOCALES = ['en', 'fr', 'ar', 'sw', 'yo', 'ha', 'ig'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'en';
export const LOCALE_COOKIE = 'sena_locale';
export const RTL_LOCALES = new Set<AppLocale>(['ar']);

export const LOCALE_META: Record<
  AppLocale,
  { nativeName: string; englishName: string; dir: 'ltr' | 'rtl'; htmlLang: string }
> = {
  en: { nativeName: 'English', englishName: 'English', dir: 'ltr', htmlLang: 'en' },
  fr: { nativeName: 'Français', englishName: 'French', dir: 'ltr', htmlLang: 'fr' },
  ar: { nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', htmlLang: 'ar' },
  sw: { nativeName: 'Kiswahili', englishName: 'Swahili', dir: 'ltr', htmlLang: 'sw' },
  yo: { nativeName: 'Yorùbá', englishName: 'Yoruba', dir: 'ltr', htmlLang: 'yo' },
  ha: { nativeName: 'Hausa', englishName: 'Hausa', dir: 'ltr', htmlLang: 'ha' },
  ig: { nativeName: 'Igbo', englishName: 'Igbo', dir: 'ltr', htmlLang: 'ig' },
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}

export function parseLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

export function localeDir(locale: AppLocale): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

/** Why next-intl: Next.js App Router + TypeScript, ICU interpolation/plurals, locale-only payload, no URL prefix required. */
export const I18N_LIBRARY = 'next-intl';
