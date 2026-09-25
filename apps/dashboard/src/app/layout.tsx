import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { DashboardShell } from '../components/dashboard-shell';
import { PostHogProvider } from '../components/posthog-provider';

export const metadata: Metadata = {
  title: 'Sena — Hospitality, Simplified',
  description: 'Operating system for modern hotels and serviced apartments.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const host = (headerList.get('host') || '').split(':')[0].toLowerCase();
  const isTenantHeader = headerList.get('x-sena-is-tenant') === 'true';

  const RESERVED_HOSTS = new Set([
    'app.sena.ng',
    'sena.ng',
    'www.sena.ng',
    'admin.sena.ng',
    'api.sena.ng',
    'localhost',
    'app.localhost',
  ]);

  const isTenantHost =
    !RESERVED_HOSTS.has(host) &&
    (host.endsWith('.sena.ng') ||
      host.endsWith('.localhost') ||
      (!host.includes('sena.ng') && !host.includes('localhost') && !host.includes('vercel.app')));

  const isPublicSite = isTenantHeader || isTenantHost;

  return (
    <html lang="en">
      <body className="bg-white text-[#191816] antialiased">
        <PostHogProvider>
          {isPublicSite ? (
            <div className="min-h-screen bg-white text-[#191816] w-full">{children}</div>
          ) : (
            <DashboardShell>{children}</DashboardShell>
          )}
        </PostHogProvider>
      </body>
    </html>
  );
}
