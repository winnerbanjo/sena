'use client';

import * as React from 'react';
import { Bell, Menu, Plus, Search } from 'lucide-react';
import { Button } from '@sena/ui';
import { useDashboard } from './dashboard-shell';

interface TopbarProps {
  title: string;
  onOpenNewReservation?: () => void;
  onOpenSearch?: () => void;
}

export function Topbar({ title, onOpenNewReservation, onOpenSearch }: TopbarProps) {
  const {
    openMobileNav,
    openSearch: contextOpenSearch,
    toggleNotifications,
    openNewReservation: contextOpenNewReservation,
  } = useDashboard();

  const handleOpenSearch = onOpenSearch || contextOpenSearch;
  const handleOpenNewRes = onOpenNewReservation || contextOpenNewReservation;

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
          className="p-1.5 -ml-1 rounded-md text-[#191816] hover:bg-[#FAFAFA] lg:hidden flex-shrink-0 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="font-serif text-lg sm:text-2xl font-normal text-[#191816] tracking-tight truncate">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Quick search input (desktop/tablet) */}
        <button
          type="button"
          onClick={handleOpenSearch}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#7A7267] hover:border-[#B85C3E]/50 hover:bg-[#FAF9F7] transition-all w-40 lg:w-56 justify-between cursor-pointer group"
          title="Search Sena (Press / or ⌘K)"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 flex-shrink-0 text-[#7A7267] group-hover:text-[#B85C3E] transition-colors" />
            <span className="truncate">Search Sena...</span>
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
          aria-label="Search"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Global Primary Action */}
        <Button
          onClick={handleOpenNewRes}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 text-xs"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">New reservation</span>
          <span className="sm:hidden">New</span>
          <kbd className="hidden lg:inline ml-1 px-1 py-0.2 rounded bg-black/20 text-[10px] font-mono opacity-80">
            N
          </kbd>
        </Button>

        {/* Notifications */}
        <button
          type="button"
          onClick={toggleNotifications}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded border border-[#E8E2DA] bg-white flex items-center justify-center text-[#191816] hover:bg-[#F9F9F9] transition-colors relative flex-shrink-0 cursor-pointer"
          aria-label="Notifications"
          title="View recent alerts and events"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-[#B85C3E] absolute top-1.5 right-1.5 ring-2 ring-white" />
        </button>
      </div>
    </header>
  );
}
