import type { useTranslations } from 'next-intl';

type Translate = ReturnType<typeof useTranslations>;

export function localizeApiError(
  payload: { error?: string; code?: string } | null | undefined,
  t: Translate,
  fallback?: string,
) {
  const code = payload?.code;
  if (code) {
    const key = `codes.${code}`;
    if (t.has(key as never)) return t(key as never);
  }
  return payload?.error || fallback || t('generic');
}
