import { LOCALE_COOKIE, type AppLocale } from './config';

export function localeCookieHeader(locale: AppLocale, secure: boolean) {
  const parts = [
    `${LOCALE_COOKIE}=${locale}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
