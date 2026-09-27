'use client';

import * as React from 'react';

export interface DashboardContextType {
  isOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  isNotificationsOpen: boolean;
  openNotifications: () => void;
  closeNotifications: () => void;
  toggleNotifications: () => void;
  isNewResOpen: boolean;
  openNewReservation: () => void;
  closeNewReservation: () => void;
}

const defaultDashboardContext: DashboardContextType = {
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
};

// The dashboard shell and each page are compiled into separate bundles. A module-level
// createContext() would then be two different contexts, and the top bar actions would no-op.
const contextKey = '__senaDashboardContext';
const host = globalThis as typeof globalThis & { [contextKey]?: React.Context<DashboardContextType> };
export const DashboardContext = host[contextKey] || (host[contextKey] = React.createContext<DashboardContextType>(defaultDashboardContext));

export function useMobileNav() {
  return React.useContext(DashboardContext);
}

export function useDashboard() {
  return React.useContext(DashboardContext);
}
