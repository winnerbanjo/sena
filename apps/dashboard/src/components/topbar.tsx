'use client';

import * as React from 'react';
import { Bell, Menu, Plus, Search } from 'lucide-react';
import { Button } from '@sena/ui';
import { useMobileNav } from './dashboard-shell';

interface TopbarProps {
  title: string;
  onOpenNewReservation: () => void;
  onOpenSearch?: () => void;
}

export function Topbar({ title, onOpenNewReservation, onOpenSearch }: TopbarProps) {
  const { openMobileNav } = useMobileNav();

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
        onOpenNewReservation();
      } else if (e.key === '/') {
        e.preventDefault();
        onOpenSearch?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenNewReservation, onOpenSearch]);

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
          onClick={onOpenSearch}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#7A7267] hover:border-[#B85C3E]/50 transition-colors w-36 lg:w-48 justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Search Sena...</span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded border border-[#E8E2DA] bg-[#F7F7F7] text-[10px] text-[#7A7267] font-mono">
            /
          </kbd>
        </button>

        {/* Quick search icon (mobile only) */}
        <button
          onClick={onOpenSearch}
          className="md:hidden w-8 h-8 rounded border border-[#E8E2DA] bg-white flex items-center justify-center text-[#7A7267] hover:bg-[#FAFAFA] transition-colors"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Global Primary Action */}
        <Button
          onClick={onOpenNewReservation}
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
          className="w-8 h-8 sm:w-9 sm:h-9 rounded border border-[#E8E2DA] bg-white flex items-center justify-center text-[#191816] hover:bg-[#F9F9F9] transition-colors relative flex-shrink-0"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-[#B85C3E] absolute top-1.5 right-1.5 ring-2 ring-white" />
        </button>
      </div>
    </header>
  );
}
