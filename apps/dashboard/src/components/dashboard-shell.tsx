'use client';

import { WorkspaceAccess } from './workspace-access';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { CommandPalette } from './command-palette';
import { NotificationsPopover } from './notifications-popover';
import { NewReservationDialog } from './new-reservation-dialog';
import { type ReservationItem } from './mock-data';
import { PwaProvider } from './pwa-provider';
import { NetworkStatusBanner } from './network-status';
import { PwaInstallDialog } from './pwa-install-dialog';
import { ToastProvider } from './toast-notification';
import { ReservationSuccessModal } from './reservation-success-modal';
import type { ServerWorkspaceResult } from '@/lib/workspace';
import { DashboardContext } from './dashboard-context';

export { useDashboard, useMobileNav } from './dashboard-context';
export { DashboardContext };

export function DashboardShell({ children, workspaceResult }: { children: React.ReactNode; workspaceResult: ServerWorkspaceResult | null }) {
  const pathname = usePathname();
  const [isTenantHost, setIsTenantHost] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      const RESERVED_HOSTS = ['app.sena.ng', 'sena.ng', 'www.sena.ng', 'admin.sena.ng', 'api.sena.ng', 'localhost', '127.0.0.1', '::1', 'app.localhost'];
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

  const isTenantPublic =
    isTenantHost ||
    pathname?.startsWith('/site') ||
    pathname?.startsWith('/invoice/') ||
    pathname?.startsWith('/embed/');

  const isAuthPath =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/verify-email' ||
    pathname === '/onboarding' ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/signup') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/verify-email') ||
    pathname?.startsWith('/onboarding');

  const [isOpen, setIsOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isNewResOpen, setIsNewResOpen] = React.useState(false);
  const [successReservation, setSuccessReservation] = React.useState<ReservationItem | null>(null);

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

  if (isTenantPublic) {
    return <main className="min-h-screen bg-white text-[#191816] w-full">{children}</main>;
  }

  if (isAuthPath) {
    return (
      <PwaProvider>
        <main className="min-h-screen bg-white text-[#191816] w-full">{children}</main>
      </PwaProvider>
    );
  }

  return (
    <WorkspaceAccess result={workspaceResult}><PwaProvider>
      <ToastProvider>
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
            <NetworkStatusBanner />
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
            setSuccessReservation(newRes);
          }}
        />

        {/* Customer-Facing In-App Confirmation Modal */}
        <ReservationSuccessModal
          reservation={successReservation}
          open={!!successReservation}
          onClose={() => setSuccessReservation(null)}
        />

        {/* Global PWA Install Guidance Dialog */}
        <PwaInstallDialog />
      </DashboardContext.Provider>
      </ToastProvider>
    </PwaProvider></WorkspaceAccess>
  );
}
