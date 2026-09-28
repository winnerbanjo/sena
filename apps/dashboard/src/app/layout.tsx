import type { Metadata, Viewport } from 'next';
import { headers, cookies } from 'next/headers';
import { Noto_Sans, Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { DashboardShell } from '../components/dashboard-shell';
import { PostHogProvider } from '../components/posthog-provider';
import { redirect } from 'next/navigation';
import { resolveServerWorkspace, type ServerWorkspaceResult } from '@/lib/workspace';
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_META, localeDir, parseLocale, type AppLocale } from '@/i18n/config';
import { loadLocaleMessages } from '@/i18n/messages';
import { I18nRoot } from '@/i18n/provider';

const notoSans = Noto_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
  preload: false,
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sena — Hospitality, Simplified',
  description: 'Operating system for modern hotels and serviced apartments.',
  icons: {
    icon: '/icons/favicon.svg',
    shortcut: '/icons/favicon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#191816',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const host = (headerList.get('host') || '').split(':')[0].toLowerCase();
  const isTenantHeader = headerList.get('x-sena-is-tenant') === 'true';
  const pathname = headerList.get('x-sena-pathname') || '/';

  const RESERVED_HOSTS = new Set([
    'app.sena.ng',
    'sena.ng',
    'www.sena.ng',
    'admin.sena.ng',
    'api.sena.ng',
    'localhost',
    '127.0.0.1',
    '::1',
    'app.localhost',
  ]);

  const isTenantHost =
    !RESERVED_HOSTS.has(host) &&
    (host.endsWith('.sena.ng') ||
      host.endsWith('.localhost') ||
      (!host.includes('sena.ng') && !host.includes('localhost') && !host.includes('vercel.app')));

  const isPublicSite = isTenantHeader || isTenantHost;
  const isPublicOrAuthPath =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/signup' ||
    pathname.startsWith('/signup/') ||
    pathname === '/onboarding' ||
    pathname.startsWith('/onboarding/') ||
    pathname.startsWith('/invoice/') ||
    pathname.startsWith('/embed/') ||
    pathname.startsWith('/site/');

  let workspaceResult: ServerWorkspaceResult | null = null;
  if (!isPublicSite && !isPublicOrAuthPath) {
    workspaceResult = await resolveServerWorkspace();
    if (workspaceResult.state === 'unauthenticated') redirect('/login');
  }

  const cookieLocale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const staffLocale: AppLocale =
    workspaceResult?.state === 'ready' ? parseLocale(workspaceResult.workspace.user.locale) : cookieLocale;
  const locale = isPublicSite ? DEFAULT_LOCALE : staffLocale;
  const dir = isPublicSite ? 'ltr' : localeDir(locale);
  const timeZone =
    workspaceResult?.state === 'ready' ? workspaceResult.workspace.property.timezone : 'Africa/Lagos';
  const messages = isPublicSite ? null : await loadLocaleMessages(locale);

  const content = isPublicSite ? (
    <div className="min-h-screen bg-white text-[#191816] w-full">{children}</div>
  ) : (
    <DashboardShell workspaceResult={workspaceResult}>{children}</DashboardShell>
  );

  return (
    <html
      lang={isPublicSite ? 'en' : LOCALE_META[locale].htmlLang}
      dir={dir}
      className={`${notoSans.variable} ${notoArabic.variable}`}
    >
      <head>
        {!isPublicSite && (
          <>
            <link rel="manifest" href="/manifest.webmanifest" />
            <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            <meta name="apple-mobile-web-app-title" content="Sena" />
            <meta name="application-name" content="Sena" />
            <meta name="mobile-web-app-capable" content="yes" />
          </>
        )}
      </head>
      <body className="bg-white text-[#191816] antialiased">
        <PostHogProvider enabled={isPublicSite || !isPublicOrAuthPath}>
          {messages ? (
            <I18nRoot locale={locale} messages={messages} timeZone={timeZone}>
              {content}
            </I18nRoot>
          ) : (
            content
          )}
        </PostHogProvider>
      </body>
    </html>
  );
}
