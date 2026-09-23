'use client';

import * as React from 'react';
import { Sidebar } from './sidebar';

interface MobileNavContextType {
  isOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
}

export const MobileNavContext = React.createContext<MobileNavContextType>({
  isOpen: false,
  openMobileNav: () => {},
  closeMobileNav: () => {},
  toggleMobileNav: () => {},
});

export function useMobileNav() {
  return React.useContext(MobileNavContext);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <MobileNavContext.Provider
      value={{
        isOpen,
        openMobileNav: () => setIsOpen(true),
        closeMobileNav: () => setIsOpen(false),
        toggleMobileNav: () => setIsOpen((prev) => !prev),
      }}
    >
      <div className="flex h-screen overflow-hidden bg-white w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white min-w-0">
          {children}
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}
