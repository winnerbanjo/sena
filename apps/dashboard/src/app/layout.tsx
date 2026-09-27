import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { DashboardShell } from '../components/dashboard-shell';
import { PostHogProvider } from '../components/posthog-provider';
import { redirect } from 'next/navigation';
import { resolveServerWorkspace, type ServerWorkspaceResult } from '@/lib/workspace';

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

  return (
    <html lang="en">
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
          {isPublicSite ? (
            <div className="min-h-screen bg-white text-[#191816] w-full">{children}</div>
          ) : (
            <DashboardShell workspaceResult={workspaceResult}>{children}</DashboardShell>
          )}
        </PostHogProvider>
      </body>
    </html>
  );
}
