'use client';

import * as React from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  installApp: () => Promise<'accepted' | 'dismissed' | null>;
  purgeAndLogout: () => Promise<void>;
}

const PwaContext = React.createContext<PwaContextType>({
  isInstallable: false,
  isInstalled: false,
  installApp: async () => null,
  purgeAndLogout: async () => {},
});

export function usePwa() {
  return React.useContext(PwaContext);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running in standalone display mode
    const checkIsInstalled = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(isStandaloneMedia || isIosStandalone);
    };

    checkIsInstalled();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };
    mediaQuery.addEventListener?.('change', handleMediaChange);

    // Capture install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Register Service Worker conditionally (strictly for merchant host, never on tenant site)
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const host = window.location.hostname.toLowerCase();
      const RESERVED_HOSTS = ['app.sena.ng', 'sena.ng', 'www.sena.ng', 'admin.sena.ng', 'api.sena.ng', 'localhost', 'app.localhost'];
      const isPublicTenant =
        !RESERVED_HOSTS.includes(host) &&
        (host.endsWith('.sena.ng') ||
          host.endsWith('.localhost') ||
          (!host.includes('sena.ng') && !host.includes('localhost') && !host.includes('vercel.app')));

      if (!isPublicTenant) {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((registration) => {
            // Check for updates periodically
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[Sena PWA] New update available.');
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('[Sena PWA] Service Worker registration failed:', err);
          });
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener?.('change', handleMediaChange);
    };
  }, []);

  const installApp = async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferredPrompt) return null;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return choice.outcome;
    } catch (err) {
      console.error('[Sena PWA] Install prompt failed:', err);
      return null;
    }
  };

  const purgeAndLogout = async () => {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'PURGE_ALL_DATA' });
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (err) {
      console.warn('[Sena PWA] Cache purge during signout error:', err);
    } finally {
      // Clear all tenant / session state from local/session storage
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      window.location.href = '/login';
    }
  };

  return (
    <PwaContext.Provider
      value={{
        isInstallable: !!deferredPrompt && !isInstalled,
        isInstalled,
        installApp,
        purgeAndLogout,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}
