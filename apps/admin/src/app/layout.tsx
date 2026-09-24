import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Activity, Building, Users, CreditCard, LayoutDashboard } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Internal Admin — Sena Platform',
  description: 'Internal multi-property administration and system operations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-[#191816] flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-[#E8E2DA] bg-[#FAFAFA] flex flex-col hidden sm:flex">
          <div className="p-4 border-b border-[#E8E2DA]">
            <strong className="text-lg font-serif tracking-tight">Sena Admin</strong>
            <div className="text-[10px] uppercase font-mono text-[#7A7267] tracking-wider mt-1">Control Plane</div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <Link href="/" className="flex items-center gap-2 text-sm text-[#4A453E] hover:text-[#191816] p-2 rounded hover:bg-[#F2EFEA]">
              <LayoutDashboard className="w-4 h-4" /> Overview
            </Link>
            <Link href="/properties" className="flex items-center gap-2 text-sm text-[#4A453E] hover:text-[#191816] p-2 rounded hover:bg-[#F2EFEA]">
              <Building className="w-4 h-4" /> Properties
            </Link>
            <Link href="/users" className="flex items-center gap-2 text-sm text-[#4A453E] hover:text-[#191816] p-2 rounded hover:bg-[#F2EFEA]">
              <Users className="w-4 h-4" /> Users
            </Link>
            <Link href="/subscriptions" className="flex items-center gap-2 text-sm text-[#4A453E] hover:text-[#191816] p-2 rounded hover:bg-[#F2EFEA]">
              <CreditCard className="w-4 h-4" /> Subscriptions
            </Link>
          </nav>
          <div className="p-4 border-t border-[#E8E2DA] text-xs text-[#7A7267]">
            v1.0.0 (Admin)
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-white">
          {children}
        </main>
      </body>
    </html>
  );
}
