import { DEFAULT_LOCALE, type AppLocale } from './config';
import type en from '../../messages/en.json';

export type DashboardMessages = typeof en;

const loaders: Record<AppLocale, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('../../messages/en.json'),
  fr: () => import('../../messages/fr.json'),
  ar: () => import('../../messages/ar.json'),
  sw: () => import('../../messages/sw.json'),
  yo: () => import('../../messages/yo.json'),
  ha: () => import('../../messages/ha.json'),
  ig: () => import('../../messages/ig.json'),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function deepMergeMessages<T>(base: T, overlay: unknown): T {
  if (!isRecord(base) || !isRecord(overlay)) return (overlay as T) ?? base;
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined || value === null || value === '') continue;
    const current = next[key];
    next[key] = isRecord(current) && isRecord(value) ? deepMergeMessages(current, value) : value;
  }
  return next as T;
}

let englishCache: DashboardMessages | null = null;

export async function loadEnglishMessages(): Promise<DashboardMessages> {
  if (englishCache) return englishCache;
  const enMessages = (await loaders.en()).default as unknown as DashboardMessages;
  englishCache = enMessages;
  return enMessages;
}

export async function loadLocaleMessages(locale: AppLocale): Promise<DashboardMessages> {
  const english = await loadEnglishMessages();
  if (locale === DEFAULT_LOCALE) return english;
  try {
    const overlay = (await loaders[locale]()).default;
    return deepMergeMessages(english, overlay);
  } catch {
    return english;
  }
}

export function lookupMessage(messages: DashboardMessages, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = messages;
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}
