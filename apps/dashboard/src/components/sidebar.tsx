'use client';

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
} from 'lucide-react';
import { useMobileNav } from './dashboard-shell';
import { usePwa } from './pwa-provider';

interface NavSection {
  title?: string;
  items: {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: 'Overview', href: '/', icon: Home }],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Reservations', href: '/reservations', icon: ClipboardList },
      { label: 'Calendar', href: '/calendar', icon: Calendar },
      { label: 'Front Desk', href: '/front-desk', icon: DoorOpen },
      { label: 'Rooms', href: '/rooms', icon: Layers },
      { label: 'Housekeeping', href: '/housekeeping', icon: Brush },
      { label: 'Guests', href: '/guests', icon: Users },
    ],
  },
  {
    title: 'SALES',
    items: [
      { label: 'Website', href: '/website', icon: Globe },
      { label: 'Reviews', href: '/website?tab=reviews', icon: Star },
      { label: 'Direct Booking', href: '/booking-preview', icon: Compass },
      { label: 'Payments', href: '/payments', icon: CreditCard },
      { label: 'Invoices', href: '/invoices', icon: Receipt },
      { label: 'Offers', href: '/offers', icon: Tag },
      { label: 'Channels', href: '/channels', icon: Layers },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { label: 'Analytics', href: '/analytics', icon: TrendingUp },
      { label: 'Reports', href: '/reports', icon: ClipboardList },
    ],
  },
  {
    title: 'MANAGE',
    items: [
      { label: 'Staff', href: '/staff', icon: Users },
      { label: 'Billing & Plan', href: '/billing', icon: CreditCard },
      { label: 'Settings', href: '/settings', icon: Settings },
      { label: 'Setup Wizard', href: '/onboarding', icon: HelpCircle },
    ],
  },
];

function SidebarNavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [profile, setProfile] = React.useState({
    name: 'Winner',
    email: 'technile0@gmail.com',
    role: 'Owner',
    property: 'Amami',
    city: 'Central District',
  });

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('sena_auth_user');
      const draft = localStorage.getItem('sena_onboarding_draft');
      const propName = localStorage.getItem('sena_property_name');
      const propAddress = localStorage.getItem('sena_property_address');
      const authUser = stored ? JSON.parse(stored) : null;
      const draftObj = draft ? JSON.parse(draft) : null;

      const resolvedName = authUser?.fullName || authUser?.name || draftObj?.name || 'Winner';
      const resolvedProp = propName || authUser?.property || draftObj?.propName || 'Amami';
      const resolvedRole = authUser?.role || 'Owner';
      const resolvedCity = propAddress || draftObj?.city || 'Central District';

      setProfile({
        name: resolvedName,
        email: authUser?.email || draftObj?.email || '',
        role: resolvedRole,
        property: resolvedProp,
        city: resolvedCity,
      });
    } catch {}

    // Fetch fresh profile and property from /api/me
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const u = data.user;
        const p = data.property;

        if (p?.name) {
          localStorage.setItem('sena_property_name', p.name);
          if (p.address || p.city) {
            localStorage.setItem('sena_property_address', p.address || p.city);
          }
        }

        if (u?.name) {
          try {
            const currentAuth = JSON.parse(localStorage.getItem('sena_auth_user') || '{}');
            localStorage.setItem(
              'sena_auth_user',
              JSON.stringify({
                ...currentAuth,
                name: u.name,
                fullName: u.name,
                email: u.email || currentAuth.email,
                role: u.role || 'Owner',
                property: p?.name || 'Amami',
              })
            );
          } catch {}
        }

        setProfile({
          name: u?.name || 'Winner',
          email: u?.email || '',
          role: u?.role || 'Owner',
          property: p?.name || 'Amami',
          city: p?.address || p?.city || 'Central District',
        });
      })
      .catch(() => {});
  }, []);

  const propInitials = (profile.property || 'Amami')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase())
    .join('') || 'A';

  const userInitials = (profile.name || 'Winner')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase())
    .join('') || 'W';

  const { isInstallable, isInstalled, installApp, openInstallGuide, purgeAndLogout } = usePwa();

  return (
    <>
      <div className="p-5 pb-4">
        {/* Brand header with official logo image */}
        <Link href="/" onClick={onNavigate} className="block mb-6 group">
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
            hospitality, simplified.
          </p>
        </Link>

        {/* Property Switcher */}
        <button
          onClick={onNavigate}
          className="w-full flex items-center justify-between p-2.5 rounded border border-[#E8E2DA] bg-[#FAFAFA] text-left hover:border-[#B85C3E]/50 hover:bg-white transition-colors mb-6 shadow-none"
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
          <ChevronDown className="w-3.5 h-3.5 text-[#7A7267] flex-shrink-0 ml-1" />
        </button>

        {/* Navigation Sections */}
        <nav className="space-y-5">
          {NAV_SECTIONS.map((section, idx) => (
            <div key={idx}>
              {section.title && (
                <div className="text-[10px] font-medium tracking-widest uppercase text-[#7A7267]/70 px-2 mb-1.5">
                  {section.title}
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
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      onClick={onNavigate}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-[#F9F7F5] text-[#191816] font-semibold border border-[#E8E2DA]'
                          : 'text-[#191816]/75 hover:text-[#191816] hover:bg-[#FAFAFA]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${
                            isActive ? 'text-[#B85C3E]' : 'text-[#7A7267]'
                          }`}
                        />
                        <span>{item.label}</span>
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
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-[#71382D] bg-[#FAF8F5] hover:bg-[#F5EFE9] border border-[#E8E2DA] transition-all hover:border-[#B85C3E]/50 group shadow-2xs cursor-pointer"
              title="Install Sena on your device"
            >
              <div className="flex items-center gap-2.5">
                <Download className="w-3.5 h-3.5 text-[#B85C3E] group-hover:scale-110 transition-transform flex-shrink-0" />
                <span className="font-semibold text-xs tracking-tight">Install Sena App</span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FAF2EB] text-[#B85C3E] border border-[#F0D5C3]">
                PWA
              </span>
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

        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            purgeAndLogout();
          }}
          title="Sign out & Purge session"
          className="p-1.5 text-[#7A7267] hover:text-[#B85C3E] hover:bg-[#FAF9F7] rounded transition-colors flex-shrink-0 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const { isOpen, closeMobileNav } = useMobileNav();

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-60 min-w-60 flex-shrink-0 border-r border-[#E8E2DA] bg-white flex-col justify-between h-screen sticky top-0 overflow-y-auto">
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
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white border-r border-[#E8E2DA] flex flex-col justify-between h-full overflow-y-auto z-50 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={closeMobileNav}
                className="p-1.5 rounded-md text-[#7A7267] hover:text-[#191816] hover:bg-[#FAFAFA] transition-colors"
                aria-label="Close menu"
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
