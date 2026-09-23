import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DashboardShell } from '../components/dashboard-shell';

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
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
