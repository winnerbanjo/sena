import type { Metadata, Viewport } from 'next';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-[#191816] antialiased">
        <PostHogProvider>
          <DashboardShell>{children}</DashboardShell>
        </PostHogProvider>
      </body>
    </html>
  );
}
