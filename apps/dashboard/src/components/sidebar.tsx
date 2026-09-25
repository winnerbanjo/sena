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
  const [profile, setProfile] = React.useState<{
    name: string;
    email: string;
    role: string;
    property: string;
    city: string;
  }>({
    name: '',
    email: '',
    role: 'Owner',
    property: '',
    city: '',
  });

  React.useEffect(() => {
    // Only use localStorage for user identity (name/email/role), NOT for property name
    // Property name MUST come from the server to prevent cross-tenant leakage
    let userEmail = '';
    let resolvedName = '';
    let resolvedRole = 'Owner';

    try {
      const stored = localStorage.getItem('sena_auth_user');
      const draft = localStorage.getItem('sena_onboarding_draft');
      const authUser = stored ? JSON.parse(stored) : null;
      const draftObj = draft ? JSON.parse(draft) : null;

      // PURGE stale property keys that caused Amami to bleed across tenants
      localStorage.removeItem('sena_property_name');
      localStorage.removeItem('sena_property_address');
      if (authUser?.property) {
        // Remove stale property field from sena_auth_user without losing identity
        const { property: _removed, ...cleanAuth } = authUser;
        localStorage.setItem('sena_auth_user', JSON.stringify(cleanAuth));
      }

      resolvedName = authUser?.fullName || authUser?.name || draftObj?.name || '';
      resolvedRole = authUser?.role || 'Owner';
      userEmail = authUser?.email || draftObj?.email || '';

      // Show user identity immediately while server fetches authoritative property
      setProfile((prev) => ({
        ...prev,
        name: resolvedName,
        email: userEmail,
        role: resolvedRole,
      }));
    } catch {}

    // Always fetch authoritative property from server — never trust localStorage for property name
    fetch(`/api/me${userEmail ? `?email=${encodeURIComponent(userEmail)}` : ''}`, {
      headers: userEmail ? { 'x-user-email': userEmail } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const u = data.user;
        const p = data.property;

        // Server is the ONLY source of truth for property name
        const effectivePropName = p?.name || '';
        const effectiveCity = p?.address || p?.city || '';
        const effectiveUserName = u?.name || resolvedName;
        const effectiveRole = u?.role || resolvedRole;

        // Update user identity in localStorage but NEVER write property into sena_auth_user
        // — that's what caused stale Amami data to persist for Charles
        if (u?.name) {
          try {
            const currentAuth = JSON.parse(localStorage.getItem('sena_auth_user') || '{}');
            localStorage.setItem(
              'sena_auth_user',
              JSON.stringify({
                ...currentAuth,
                name: effectiveUserName,
                fullName: effectiveUserName,
                email: u.email || currentAuth.email,
                role: effectiveRole,
                // Never cache property here — always resolve from server
              })
            );
          } catch {}
        }

        setProfile({
          name: effectiveUserName,
          email: u?.email || userEmail,
          role: effectiveRole,
          property: effectivePropName,
          city: effectiveCity,
        });
      })
      .catch(() => {});
  }, []);

  const roleLower = (profile.role || '').toLowerCase();
  const isFrontDesk = roleLower.includes('front desk') || roleLower.includes('reception');
  const isHousekeeping = roleLower.includes('housekeep');

  const visibleNavSections = React.useMemo(() => {
    return NAV_SECTIONS.map((section) => {
      let items = section.items;
      if (isFrontDesk) {
        if (section.title === 'MANAGE') {
          items = items.filter((i) => i.label === 'Settings');
        } else if (section.title === 'SALES') {
          items = items.filter((i) => ['Direct Booking', 'Reviews', 'Website'].includes(i.label));
        }
      } else if (isHousekeeping) {
        if (section.title === 'OPERATIONS') {
          items = items.filter((i) => ['Housekeeping', 'Rooms'].includes(i.label));
        } else if (['SALES', 'INSIGHTS', 'MANAGE'].includes(section.title || '')) {
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
          {visibleNavSections.map((section, idx) => (
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
