'use client';

import { useWorkspace } from './workspace-access';
import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  ClipboardList,
  Compass,
  CreditCard,
  DoorOpen,
  Globe,
  Home,
  Layers,
  Brush,
  Building2,
  Tag,
  TrendingUp,
  Users,
  Settings,
  Bell,
  HelpCircle,
  ChevronDown,
  LogOut,
  Star,
  Receipt,
  X,
  Download,
  Plug,
} from 'lucide-react';
import { useMobileNav } from './dashboard-shell';
import { usePwa } from './pwa-provider';
import { useTranslations } from 'next-intl';
import { LanguageMenu } from './language-menu';

interface NavSection {
  titleKey?: 'operations' | 'sales' | 'insights' | 'manage';
  items: {
    id: string;
    labelKey:
      | 'overview'
      | 'reservations'
      | 'calendar'
      | 'frontDesk'
      | 'rooms'
      | 'apartments'
      | 'housekeeping'
      | 'guests'
      | 'website'
      | 'reviews'
      | 'directBooking'
      | 'payments'
      | 'invoices'
      | 'offers'
      | 'analytics'
      | 'reports'
      | 'staff'
      | 'apps'
      | 'billing'
      | 'settings'
      | 'setupWizard';
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ id: 'overview', labelKey: 'overview', href: '/', icon: Home }],
  },
  {
    titleKey: 'operations',
    items: [
      { id: 'reservations', labelKey: 'reservations', href: '/reservations', icon: ClipboardList },
      { id: 'calendar', labelKey: 'calendar', href: '/calendar', icon: Calendar },
      { id: 'frontDesk', labelKey: 'frontDesk', href: '/front-desk', icon: DoorOpen },
      { id: 'rooms', labelKey: 'rooms', href: '/rooms', icon: Layers },
      { id: 'apartments', labelKey: 'apartments', href: '/apartments', icon: Building2 },
      { id: 'housekeeping', labelKey: 'housekeeping', href: '/housekeeping', icon: Brush },
      { id: 'guests', labelKey: 'guests', href: '/guests', icon: Users },
    ],
  },
  {
    titleKey: 'sales',
    items: [
      { id: 'website', labelKey: 'website', href: '/website', icon: Globe },
      { id: 'reviews', labelKey: 'reviews', href: '/website?tab=reviews', icon: Star },
      { id: 'directBooking', labelKey: 'directBooking', href: '/booking-preview', icon: Compass },
      { id: 'payments', labelKey: 'payments', href: '/payments', icon: CreditCard },
      { id: 'invoices', labelKey: 'invoices', href: '/invoices', icon: Receipt },
      { id: 'offers', labelKey: 'offers', href: '/offers', icon: Tag },
    ],
  },
  {
    titleKey: 'insights',
    items: [
      { id: 'analytics', labelKey: 'analytics', href: '/analytics', icon: TrendingUp },
      { id: 'reports', labelKey: 'reports', href: '/reports', icon: ClipboardList },
    ],
  },
  {
    titleKey: 'manage',
    items: [
      { id: 'staff', labelKey: 'staff', href: '/staff', icon: Users },
      { id: 'apps', labelKey: 'apps', href: '/apps', icon: Plug },
      { id: 'billing', labelKey: 'billing', href: '/billing', icon: CreditCard },
      { id: 'settings', labelKey: 'settings', href: '/settings', icon: Settings },
      { id: 'setupWizard', labelKey: 'setupWizard', href: '/onboarding', icon: HelpCircle },
    ],
  },
];

function SidebarNavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const workspace = useWorkspace();
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const profile = { name: workspace?.user.name || '', email: workspace?.user.email || '', role: workspace?.user.role || '', property: workspace?.property.name || '', city: workspace?.property.address || '' };

  const roleLower = (profile.role || '').toLowerCase();
  const isFrontDesk = (roleLower.includes('front desk') || roleLower === 'front_desk') || roleLower.includes('reception');
  const isHousekeeping = roleLower.includes('housekeep');

  const visibleNavSections = React.useMemo(() => {
    return NAV_SECTIONS.map((section) => {
      let items = section.items;
      if (isFrontDesk) {
        if (section.titleKey === 'manage') {
          items = [];
        } else if (section.titleKey === 'sales') {
          items = items.filter((i) => ['payments', 'invoices'].includes(i.id));
        }
      } else if (isHousekeeping) {
        if (section.titleKey === 'operations') {
          items = items.filter((i) => ['housekeeping', 'rooms', 'apartments'].includes(i.id));
        } else if (section.titleKey && ['sales', 'insights', 'manage'].includes(section.titleKey)) {
          items = [];
        }
      }
      return { ...section, items };
    }).filter((section) => section.items.length > 0);
  }, [isFrontDesk, isHousekeeping]);

  const propInitials = profile.property
    ? profile.property.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('')
    : '…';

  const userInitials = profile.name
    ? profile.name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('')
    : '…';

  const { isInstallable, isInstalled, installApp, openInstallGuide, purgeAndLogout } = usePwa();

  return (
    <>
      <div className="p-5 pb-4">
        {/* Brand header with official logo image */}
        <Link href="/" prefetch={false} onClick={onNavigate} className="block mb-6 group">
          <div className="h-8 flex items-center">
            <Image
              src="/assets/sena-logo.png"
              alt="Sena"
              width={112}
              height={36}
              priority
              className="h-8 w-auto object-contain"
            />
          </div>
          <p className="text-[10px] text-[#7A7267] tracking-wider mt-1">
            {tCommon('tagline')}
          </p>
        </Link>

        {/* Property Switcher */}
        <button
          onClick={onNavigate}
          className="mb-5 flex w-full items-center justify-between rounded border border-[#E8E2DA] bg-[#FAFAF8] p-2 text-start hover:bg-white"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded bg-[#71382D] text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {propInitials}
            </span>
            <div className="truncate">
              <span className="block text-xs font-semibold text-[#191816] truncate">
                {profile.property}
              </span>
              <span className="block text-[10px] text-[#7A7267] truncate">
                {profile.city}
              </span>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-[#7A7267] flex-shrink-0 ms-1" />
        </button>

        {/* Navigation Sections */}
        <nav className="space-y-5">
          {visibleNavSections.map((section, idx) => (
            <div key={idx}>
              {section.titleKey && (
                <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wide text-[#7A7267]">
                  {tNav(section.titleKey)}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      prefetch={false}
                      onClick={onNavigate}
                      className={`flex items-center justify-between rounded px-2.5 py-2 text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-[#F6F1EA] text-[#191816]'
                          : 'text-[#3F3A34] hover:bg-[#FAF8F6] hover:text-[#191816]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${
                            isActive ? 'text-[#B85C3E]' : 'text-[#7A7267]'
                          }`}
                        />
                        <span>{tNav(item.labelKey)}</span>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-[#B85C3E] text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Clean PWA Install action down on the menu */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                if (isInstallable) {
                  installApp();
                } else {
                  openInstallGuide();
                }
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 text-[13px] font-medium text-[#3F3A34] hover:bg-[#FAF8F6]"
              title={tCommon('installAppTitle')}
            >
              <div className="flex items-center gap-2.5">
                <Download className="h-4 w-4 flex-shrink-0 text-[#7A7267]" />
                <span>{tCommon('installApp')}</span>
              </div>
            </button>
          </div>
        </nav>
      </div>

      {/* User profile footer */}
      <div className="p-3.5 border-t border-[#E8E2DA] bg-white mt-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#E5D4BC] text-[#71382D] flex items-center justify-center font-medium text-xs flex-shrink-0">
            {userInitials}
          </div>
          <div className="truncate">
            <span className="block text-xs font-semibold text-[#191816] truncate">
              {profile.name}
            </span>
            <span className="block text-[10px] text-[#7A7267] truncate">
              {profile.role} &middot; {profile.property}
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
          className="p-1.5 text-[#7A7267] hover:text-[#B85C3E] hover:bg-[#FAF9F7] rounded transition-colors flex-shrink-0 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const { isOpen, closeMobileNav } = useMobileNav();
  const tCommon = useTranslations('common');

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-60 min-w-60 flex-shrink-0 border-e border-[#E8E2DA] bg-white flex-col justify-between h-screen sticky top-0 overflow-y-auto">
        <SidebarNavItems />
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
            onClick={closeMobileNav}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside className="fixed inset-y-0 start-0 z-50 flex h-full w-72 max-w-[85vw] flex-col justify-between overflow-y-auto border-e border-[#E8E2DA] bg-white">
            <div className="absolute top-4 end-4 z-10">
              <button
                onClick={closeMobileNav}
                className="p-1.5 rounded-md text-[#7A7267] hover:text-[#191816] hover:bg-[#FAFAFA] transition-colors"
                aria-label={tCommon('closeMenu')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarNavItems onNavigate={closeMobileNav} />
          </aside>
        </div>
      )}
    </>
  );
}
