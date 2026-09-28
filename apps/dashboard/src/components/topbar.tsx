'use client';

import * as React from 'react';
import { Bell, Menu, Plus, Search } from 'lucide-react';
import { Button } from '@sena/ui';
import { useDashboard } from './dashboard-shell';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { loadUnreadNotificationCount } from '../lib/notification-unread';

interface TopbarProps {
  title: string;
  onOpenNewReservation?: () => void;
  onOpenSearch?: () => void;
}

const TITLE_KEYS: Array<{ test: (path: string) => boolean; key: string }> = [
  { test: (path) => path === '/', key: 'overview.title' },
  { test: (path) => path.startsWith('/front-desk'), key: 'frontDesk.title' },
  { test: (path) => path.startsWith('/reservations'), key: 'reservations.title' },
  { test: (path) => path.startsWith('/calendar'), key: 'calendar.title' },
  { test: (path) => path.startsWith('/rooms'), key: 'rooms.title' },
  { test: (path) => path.startsWith('/housekeeping'), key: 'housekeeping.title' },
  { test: (path) => path.startsWith('/guests'), key: 'guests.title' },
  { test: (path) => path.startsWith('/website'), key: 'website.title' },
  { test: (path) => path.startsWith('/booking-preview'), key: 'directBooking.title' },
  { test: (path) => path.startsWith('/payments'), key: 'payments.title' },
  { test: (path) => path.startsWith('/invoices'), key: 'invoices.title' },
  { test: (path) => path.startsWith('/offers'), key: 'offers.title' },
  { test: (path) => path.startsWith('/channels'), key: 'channels.title' },
  { test: (path) => path.startsWith('/analytics'), key: 'analytics.title' },
  { test: (path) => path.startsWith('/reports'), key: 'reports.title' },
  { test: (path) => path.startsWith('/staff'), key: 'staff.title' },
  { test: (path) => path.startsWith('/apps'), key: 'apps.title' },
  { test: (path) => path.startsWith('/billing'), key: 'billing.title' },
  { test: (path) => path.startsWith('/settings'), key: 'settings.title' },
];

export function Topbar({ title, onOpenNewReservation, onOpenSearch }: TopbarProps) {
  const t = useTranslations('common');
  const tRoot = useTranslations();
  const pathname = usePathname() || '/';
  const titleKey = TITLE_KEYS.find((entry) => entry.test(pathname))?.key;
  const heading = titleKey && tRoot.has(titleKey as never) ? tRoot(titleKey as never) : title;
  const {
    openMobileNav,
    openSearch: contextOpenSearch,
    toggleNotifications,
    openNewReservation: contextOpenNewReservation,
  } = useDashboard();

  const handleOpenSearch = onOpenSearch || contextOpenSearch;
  const handleOpenNewRes = onOpenNewReservation || contextOpenNewReservation;
  const [unread, setUnread] = React.useState(0);
  React.useEffect(() => {
    loadUnreadNotificationCount().then(setUnread);
  }, []);

  // Desktop shortcuts: N for New reservation, / for Search
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (e.target as HTMLElement)?.tagName
        )
      ) {
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleOpenNewRes();
      } else if (e.key === '/') {
        e.preventDefault();
        handleOpenSearch();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenNewRes, handleOpenSearch]);

  return (
    <header className="h-16 border-b border-[#E8E2DA] bg-white px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={openMobileNav}
          className="p-1.5 -ms-1 rounded-md text-[#191816] hover:bg-[#FAFAFA] lg:hidden flex-shrink-0 transition-colors"
          aria-label={t('openNavigation')}
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="font-serif text-lg sm:text-2xl font-normal text-[#191816] tracking-tight truncate">
          {heading}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Quick search input (desktop/tablet) */}
        <button
          type="button"
          onClick={handleOpenSearch}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#7A7267] hover:border-[#B85C3E]/50 hover:bg-[#FAF9F7] transition-all w-40 lg:w-56 justify-between cursor-pointer group"
          title={t('searchHint')}
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 flex-shrink-0 text-[#7A7267] group-hover:text-[#B85C3E] transition-colors" />
            <span className="truncate">{t('searchSena')}</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-[#E8E2DA] bg-[#F7F7F7] text-[10px] text-[#7A7267] font-mono">
              ⌘K
            </kbd>
          </div>
        </button>

        {/* Quick search icon (mobile only) */}
        <button
          type="button"
          onClick={handleOpenSearch}
          className="md:hidden w-8 h-8 rounded border border-[#E8E2DA] bg-white flex items-center justify-center text-[#7A7267] hover:bg-[#FAFAFA] transition-colors cursor-pointer"
          aria-label={t('search')}
          title={t('search')}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Global Primary Action */}
        <Button
          onClick={handleOpenNewRes}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 text-xs"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">{t('newReservation')}</span>
          <span className="sm:hidden">{t('new')}</span>
          <kbd className="hidden lg:inline ms-1 px-1 py-0.2 rounded bg-black/20 text-[10px] font-mono opacity-80">
            N
          </kbd>
        </Button>

        {/* Notifications */}
        <button
          type="button"
          onClick={toggleNotifications}
          className="min-h-11 min-w-11 rounded border border-[#E8E2DA] bg-white flex items-center justify-center text-[#191816] hover:bg-[#F9F9F9] relative flex-shrink-0"
          aria-label={unread > 0 ? t('notificationsUnread', { count: unread }) : t('notifications')}
          title={t('notifications')}
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && <span className="absolute top-1 end-1 w-2 h-2 rounded-full bg-[#71382D]" />}

        </button>
      </div>
    </header>
  );
}
