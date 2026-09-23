import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '../components/sidebar';

export const metadata: Metadata = {
  title: 'Sena — Hospitality, Simplified',
  description: 'Operating system for modern hotels and serviced apartments.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-[#191816] flex h-screen overflow-hidden antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
          {children}
        </div>
      </body>
    </html>
  );
}
