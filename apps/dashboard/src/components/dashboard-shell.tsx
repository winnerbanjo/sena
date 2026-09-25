'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { CommandPalette } from './command-palette';
import { NotificationsPopover } from './notifications-popover';
import { NewReservationDialog } from './new-reservation-dialog';
import { type ReservationItem } from './mock-data';

interface DashboardContextType {
  // Mobile Nav
  isOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;

  // Global Search / Command Palette
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;

  // Notifications
  isNotificationsOpen: boolean;
  openNotifications: () => void;
  closeNotifications: () => void;
  toggleNotifications: () => void;

  // Global New Reservation
  isNewResOpen: boolean;
  openNewReservation: () => void;
  closeNewReservation: () => void;
}

export const DashboardContext = React.createContext<DashboardContextType>({
  isOpen: false,
  openMobileNav: () => {},
  closeMobileNav: () => {},
  toggleMobileNav: () => {},

  isSearchOpen: false,
  openSearch: () => {},
  closeSearch: () => {},
  toggleSearch: () => {},

  isNotificationsOpen: false,
  openNotifications: () => {},
  closeNotifications: () => {},
  toggleNotifications: () => {},

  isNewResOpen: false,
  openNewReservation: () => {},
  closeNewReservation: () => {},
});

export function useMobileNav() {
  return React.useContext(DashboardContext);
}

export function useDashboard() {
  return React.useContext(DashboardContext);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isTenantHost, setIsTenantHost] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      const RESERVED_HOSTS = ['app.sena.ng', 'sena.ng', 'www.sena.ng', 'admin.sena.ng', 'api.sena.ng', 'localhost', 'app.localhost'];
      if (
        !RESERVED_HOSTS.includes(host) &&
        (host.endsWith('.sena.ng') ||
          host.endsWith('.localhost') ||
          (!host.includes('sena.ng') && !host.includes('localhost') && !host.includes('vercel.app')))
      ) {
        setIsTenantHost(true);
      }
    }
  }, []);

  const isPublicOrAuth =
    isTenantHost ||
    pathname?.startsWith('/site') ||
    pathname?.startsWith('/invoice/') ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/onboarding' ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/signup') ||
    pathname?.startsWith('/onboarding');

  const [isOpen, setIsOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isNewResOpen, setIsNewResOpen] = React.useState(false);

  // Global keyboard shortcuts
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (e.target as HTMLElement)?.tagName
        )
      ) {
        return;
      }

      // Cmd+K or Ctrl+K or '/' for search
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === '/') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setIsNewResOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isPublicOrAuth) {
    return <main className="min-h-screen bg-white text-[#191816] w-full">{children}</main>;
  }

  return (
    <DashboardContext.Provider
      value={{
        isOpen,
        openMobileNav: () => setIsOpen(true),
        closeMobileNav: () => setIsOpen(false),
        toggleMobileNav: () => setIsOpen((prev) => !prev),

        isSearchOpen,
        openSearch: () => setIsSearchOpen(true),
        closeSearch: () => setIsSearchOpen(false),
        toggleSearch: () => setIsSearchOpen((prev) => !prev),

        isNotificationsOpen,
        openNotifications: () => setIsNotificationsOpen(true),
        closeNotifications: () => setIsNotificationsOpen(false),
        toggleNotifications: () => setIsNotificationsOpen((prev) => !prev),

        isNewResOpen,
        openNewReservation: () => setIsNewResOpen(true),
        closeNewReservation: () => setIsNewResOpen(false),
      }}
    >
      <div className="flex h-screen overflow-hidden bg-white w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white min-w-0">
          {children}
        </div>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onOpenNewReservation={() => setIsNewResOpen(true)}
      />

      {/* Global Notifications Popover */}
      <NotificationsPopover
        open={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* Global New Reservation Dialog */}
      <NewReservationDialog
        open={isNewResOpen}
        onOpenChange={setIsNewResOpen}
        onCreateReservation={(newRes: ReservationItem) => {
          setIsNewResOpen(false);
          alert(`Reservation ${newRes.reference} created successfully for ${newRes.guestName}!`);
        }}
      />
    </DashboardContext.Provider>
  );
}
