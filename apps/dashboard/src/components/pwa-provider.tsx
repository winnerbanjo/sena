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

export type PwaPlatform = 'ios' | 'mac-safari' | 'android' | 'chromium' | 'other';

interface PwaContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  platform: PwaPlatform;
  isIOS: boolean;
  isMacSafari: boolean;
  isAndroid: boolean;
  isChromium: boolean;
  isInstallGuideOpen: boolean;
  openInstallGuide: () => void;
  closeInstallGuide: () => void;
  installApp: () => Promise<'accepted' | 'dismissed' | null>;
  purgeAndLogout: () => Promise<void>;
}

const PwaContext = React.createContext<PwaContextType>({
  isInstallable: false,
  isInstalled: false,
  platform: 'other',
  isIOS: false,
  isMacSafari: false,
  isAndroid: false,
  isChromium: false,
  isInstallGuideOpen: false,
  openInstallGuide: () => {},
  closeInstallGuide: () => {},
  installApp: async () => null,
  purgeAndLogout: async () => {},
});

export function usePwa() {
  return React.useContext(PwaContext);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [platform, setPlatform] = React.useState<PwaPlatform>('other');
  const [isInstallGuideOpen, setIsInstallGuideOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect platform
    const ua = navigator.userAgent || '';
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const isAndroidDevice = /Android/i.test(ua);
    const isMacDevice = /Macintosh|Mac OS X/i.test(ua);
    const isChromiumBrowser =
      typeof (window as unknown as { chrome?: unknown }).chrome !== 'undefined' ||
      /Chrome|Chromium|Edg|OPR/i.test(ua);

    if (isIOSDevice) {
      setPlatform('ios');
    } else if (isAndroidDevice) {
      setPlatform('android');
    } else if (isMacDevice && !isChromiumBrowser && /Safari/i.test(ua)) {
      setPlatform('mac-safari');
    } else if (isChromiumBrowser) {
      setPlatform('chromium');
    } else {
      setPlatform('other');
    }

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
      setIsInstallGuideOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Register Service Worker conditionally (strictly for merchant host, never on tenant site)
    if ('serviceWorker' in navigator) {
      const host = window.location.hostname.toLowerCase();
      const RESERVED_HOSTS = [
        'app.sena.ng',
        'sena.ng',
        'www.sena.ng',
        'admin.sena.ng',
        'api.sena.ng',
        'localhost',
        'app.localhost',
      ];
      const isPublicTenant =
        !RESERVED_HOSTS.includes(host) &&
        (host.endsWith('.sena.ng') ||
          host.endsWith('.localhost') ||
          (!host.includes('sena.ng') && !host.includes('localhost') && !host.includes('vercel.app')));

      if (!isPublicTenant) {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((registration) => {
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[Sena PWA] New update ready.');
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('[Sena PWA] Service Worker registration note:', err);
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
    if (!deferredPrompt) {
      // If native prompt is not available, open guide modal
      setIsInstallGuideOpen(true);
      return null;
    }
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallGuideOpen(false);
      }
      setDeferredPrompt(null);
      return choice.outcome;
    } catch (err) {
      console.error('[Sena PWA] Install prompt failed:', err);
      setIsInstallGuideOpen(true);
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
      console.warn('[Sena PWA] Cache purge error:', err);
    } finally {
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
        platform,
        isIOS: platform === 'ios',
        isMacSafari: platform === 'mac-safari',
        isAndroid: platform === 'android',
        isChromium: platform === 'chromium',
        isInstallGuideOpen,
        openInstallGuide: () => setIsInstallGuideOpen(true),
        closeInstallGuide: () => setIsInstallGuideOpen(false),
        installApp,
        purgeAndLogout,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}
