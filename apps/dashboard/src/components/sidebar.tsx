'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  ClipboardList,
  CreditCard,
  DoorOpen,
  Globe,
  Home,
  Layers,
  Brush,
  Building2,
  Users,
  Settings,
  Receipt,
  X,
  Plug,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useWorkspace } from './workspace-access';
import { useMobileNav } from './dashboard-shell';
import { usePwa } from './pwa-provider';
import { useTranslations } from 'next-intl';
import { LanguageMenu } from './language-menu';
import { PropertySwitcher } from './property-switcher';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_OPERATIONS: NavItem[] = [
  { id: 'reservations', label: 'Reservations', href: '/reservations', icon: ClipboardList },
  { id: 'frontDesk', label: 'Front Desk', href: '/front-desk', icon: DoorOpen },
  { id: 'rooms', label: 'Rooms', href: '/rooms', icon: Layers },
  { id: 'guests', label: 'Guests', href: '/guests', icon: Users },
];

const PRIMARY_MONEY: NavItem[] = [
  { id: 'payments', label: 'Payments', href: '/payments', icon: CreditCard },
  { id: 'invoices', label: 'Invoices', href: '/invoices', icon: Receipt },
];

const SECONDARY_MORE: NavItem[] = [
  { id: 'calendar', label: 'Calendar', href: '/calendar', icon: Calendar },
  { id: 'housekeeping', label: 'Housekeeping', href: '/housekeeping', icon: Brush },
  { id: 'apartments', label: 'Apartments', href: '/apartments', icon: Building2 },
  { id: 'website', label: 'Website', href: '/website', icon: Globe },
  { id: 'apps', label: 'Connected Apps', href: '/apps', icon: Plug },
  { id: 'reports', label: 'Reports', href: '/reports', icon: ClipboardList },
  { id: 'staff', label: 'Staff', href: '/staff', icon: Users },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];

function SidebarNavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const workspace = useWorkspace();
  const tCommon = useTranslations('common');
  const profile = {
    name: workspace?.user.name || '',
    email: workspace?.user.email || '',
    role: workspace?.user.role || '',
    property: workspace?.property.name || '',
  };

  // Auto-expand "More" if the active page is inside it
  const isMoreActive = SECONDARY_MORE.some((item) => pathname.startsWith(item.href));
  const [moreExpanded, setMoreExpanded] = React.useState(isMoreActive);

  React.useEffect(() => {
    if (isMoreActive) {
      setMoreExpanded(true);
    }
  }, [isMoreActive]);

  const userInitials = profile.name
    ? profile.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w: string) => w[0]?.toUpperCase())
        .join('')
    : 'S';

  const { purgeAndLogout } = usePwa();

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="px-3 py-4">
        {/* Brand header */}
        <Link href="/" prefetch={false} onClick={onNavigate} className="block mb-3.5 px-1">
          <div className="h-6 flex items-center">
            <Image
              src="/assets/sena-logo.png"
              alt="Sena"
              width={84}
              height={24}
              priority
              className="h-5 w-auto object-contain"
            />
          </div>
        </Link>

        {/* Compact Property Switcher */}
        <PropertySwitcher onNavigate={onNavigate} />

        {/* Navigation */}
        <nav className="mt-3.5 space-y-3" aria-label="Sidebar navigation">
          {/* Overview */}
          <Link
            href="/"
            prefetch={false}
            onClick={onNavigate}
            className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
              pathname === '/'
                ? 'border-s-2 border-[#B85C3E] bg-[#F6F1EA] text-[#191816] font-semibold'
                : 'text-[#5C564D] hover:bg-[#FAF8F6] hover:text-[#191816]'
            }`}
          >
            <Home
              className={`h-4 w-4 flex-shrink-0 ${
                pathname === '/' ? 'text-[#B85C3E]' : 'text-[#7A7267]'
              }`}
            />
            <span>Overview</span>
          </Link>

          {/* Operations */}
          <div className="space-y-0.5">
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8C8275]">
              Operations
            </div>
            {PRIMARY_OPERATIONS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={false}
                  onClick={onNavigate}
                  className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'border-s-2 border-[#B85C3E] bg-[#F6F1EA] text-[#191816] font-semibold'
                      : 'text-[#5C564D] hover:bg-[#FAF8F6] hover:text-[#191816]'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 flex-shrink-0 ${
                      isActive ? 'text-[#B85C3E]' : 'text-[#7A7267]'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Money */}
          <div className="space-y-0.5">
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8C8275]">
              Money
            </div>
            {PRIMARY_MONEY.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={false}
                  onClick={onNavigate}
                  className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'border-s-2 border-[#B85C3E] bg-[#F6F1EA] text-[#191816] font-semibold'
                      : 'text-[#5C564D] hover:bg-[#FAF8F6] hover:text-[#191816]'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 flex-shrink-0 ${
                      isActive ? 'text-[#B85C3E]' : 'text-[#7A7267]'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Expandable More Tools Section */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setMoreExpanded((prev) => !prev)}
              aria-expanded={moreExpanded}
              className="group flex w-full h-7 items-center justify-between rounded-md px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#8C8275] hover:bg-[#FAF8F6] hover:text-[#191816] transition-colors"
            >
              <span>More tools</span>
              <ChevronDown
                className={`h-3 w-3 text-[#8C8275] transition-transform duration-150 group-hover:text-[#5C564D] ${
                  moreExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {moreExpanded && (
              <div className="mt-1.5 ms-2 border-s border-[#E8E2DA]/80 ps-2 space-y-1 pt-0.5">
                {SECONDARY_MORE.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      prefetch={false}
                      onClick={onNavigate}
                      className={`group flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] transition-colors ${
                        isActive
                          ? 'border-s-2 border-[#B85C3E] bg-[#F6F1EA] text-[#191816] font-medium'
                          : 'text-[#6B6357] hover:bg-[#FAF8F6] hover:text-[#191816]'
                      }`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 flex-shrink-0 transition-colors ${
                          isActive ? 'text-[#B85C3E]' : 'text-[#8C8275] group-hover:text-[#5C564D]'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* User profile footer */}
      <div className="border-t border-[#E8E2DA] bg-[#FAF8F6] p-3 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6.5 h-6.5 rounded-full bg-[#E5D4BC] text-[#71382D] flex items-center justify-center font-medium text-[11px] flex-shrink-0">
            {userInitials}
          </div>
          <div className="truncate">
            <span className="block text-xs font-medium text-[#191816] truncate">
              {profile.name || profile.email}
            </span>
            <span className="block text-[10px] text-[#7A7267] truncate">
              {profile.role || 'Staff'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <LanguageMenu onNavigate={onNavigate} />
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              purgeAndLogout();
            }}
            title={tCommon('signOut')}
            aria-label={tCommon('signOut')}
            className="p-1.5 text-[#7A7267] hover:text-[#B85C3E] hover:bg-[#F2ECE4] rounded-md transition-colors flex-shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isOpen, closeMobileNav } = useMobileNav();
  const tCommon = useTranslations('common');

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-56 min-w-56 flex-shrink-0 border-e border-[#E8E2DA] bg-white flex-col justify-between h-screen sticky top-0 overflow-y-auto">
        <SidebarNavItems />
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-[#191816]/30 backdrop-blur-2xs transition-opacity duration-150"
            onClick={closeMobileNav}
            aria-hidden="true"
          />

          <aside className="fixed inset-y-0 start-0 z-50 flex h-full w-64 max-w-[85vw] flex-col justify-between overflow-y-auto border-e border-[#E8E2DA] bg-white shadow-lg">
            <div className="absolute top-3 end-3 z-10">
              <button
                onClick={closeMobileNav}
                className="p-1.5 rounded-md text-[#7A7267] hover:text-[#191816] hover:bg-[#F5F2EB] transition-colors"
                aria-label={tCommon('closeMenu')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarNavItems onNavigate={closeMobileNav} />
          </aside>
        </div>
      )}
    </>
  );
}
