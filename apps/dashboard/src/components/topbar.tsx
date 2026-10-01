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
  { test: (path) => path.startsWith('/channels'), key: 'apps.title' },
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
    <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-between border-b border-[#E8E2DA] bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={openMobileNav}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded text-[#191816] hover:bg-[#F6F1EA] lg:hidden"
          aria-label={t('openNavigation')}
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="truncate text-base font-medium tracking-tight text-[#191816]">
          {heading}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Quick search input (desktop/tablet) */}
        <button
          type="button"
          onClick={handleOpenSearch}
          className="hidden h-9 w-44 cursor-pointer items-center justify-between gap-2 rounded border border-[#E8E2DA] bg-white px-3 text-xs text-[#7A7267] hover:bg-[#FAF8F6] md:flex lg:w-56"
          title={t('searchHint')}
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-[#7A7267]" />
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
          className="inline-flex h-11 w-11 items-center justify-center rounded border border-[#E8E2DA] bg-white text-[#7A7267] hover:bg-[#FAF8F6] md:hidden"
          aria-label={t('search')}
          title={t('search')}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Global Primary Action */}
        <Button
          onClick={handleOpenNewRes}
          className="px-2.5 text-xs sm:px-3"
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
          className="relative inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded border border-[#E8E2DA] bg-white text-[#191816] hover:bg-[#FAF8F6]"
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
