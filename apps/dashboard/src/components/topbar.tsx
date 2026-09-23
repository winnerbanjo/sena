'use client';

import * as React from 'react';
import { Bell, Plus, Search } from 'lucide-react';
import { Button } from '@sena/ui';

interface TopbarProps {
  title: string;
  onOpenNewReservation: () => void;
  onOpenSearch?: () => void;
}

export function Topbar({ title, onOpenNewReservation, onOpenSearch }: TopbarProps) {
  // Desktop shortcuts: N for New reservation, / for Search
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input
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
    <header className="h-16 border-b border-[#E2D8CC] bg-[#F7F1E8]/40 px-8 flex items-center justify-between sticky top-0 z-30 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <h1 className="font-serif text-2xl font-normal text-[#191816] tracking-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Quick search input */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#E2D8CC] bg-white text-xs text-[#7A7267] hover:border-[#B85C3E]/50 transition-colors w-48 justify-between"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            <span>Search Sena...</span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded border border-[#E2D8CC] bg-[#F7F1E8] text-[10px] text-[#7A7267] font-mono">
            /
          </kbd>
        </button>

        {/* Global Primary Action */}
        <Button
          onClick={onOpenNewReservation}
          className="flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>New reservation</span>
          <kbd className="ml-1 px-1 py-0.2 rounded bg-black/20 text-[10px] font-mono opacity-80">
            N
          </kbd>
        </Button>

        {/* Notifications */}
        <button className="w-9 h-9 rounded border border-[#E2D8CC] bg-white flex items-center justify-center text-[#191816] hover:bg-[#F7F1E8] transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-[#B85C3E] absolute top-2 right-2 ring-2 ring-white" />
        </button>
      </div>
    </header>
  );
}
