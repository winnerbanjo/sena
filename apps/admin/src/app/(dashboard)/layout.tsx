import Link from 'next/link';
import { Building, Users, CreditCard, LayoutDashboard, LogOut, Menu } from 'lucide-react';
import { logoutAdmin } from '../actions';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-[#191816] flex flex-col sm:flex-row w-full">
      {/* Mobile Header */}
      <div className="sm:hidden flex items-center justify-between p-4 border-b border-[#E8E2DA] bg-[#FAFAFA]">
        <div>
          <strong className="text-lg font-serif tracking-tight">Sena Admin</strong>
        </div>
        <form action={logoutAdmin}>
          <button type="submit" className="flex items-center gap-1 text-xs text-[#B85C3E] font-medium border border-[#E8E2DA] px-2 py-1 rounded bg-white">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </form>
      </div>

      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-[#E8E2DA] bg-[#FAFAFA] flex-col hidden sm:flex">
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
        <div className="p-4 border-t border-[#E8E2DA] space-y-4">
          <form action={logoutAdmin}>
            <button type="submit" className="flex items-center gap-2 text-sm text-[#B85C3E] hover:text-[#71382D] w-full text-left p-2 rounded hover:bg-[#F2EFEA] transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </form>
          <div className="text-xs text-[#7A7267] px-2">
            v1.0.0 (Admin)
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-[calc(100vh-65px)] sm:h-screen overflow-y-auto bg-white">
        {children}
      </main>
    </div>
  );
}
