'use client';

import * as React from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = React.useState(true);
  const [showRestored, setShowRestored] = React.useState(false);
  const wasOfflineRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        setShowRestored(true);
        const timer = setTimeout(() => {
          setShowRestored(false);
          wasOfflineRef.current = false;
        }, 3500);
        return () => clearTimeout(timer);
      }
    };

    const handleOffline = () => {
      wasOfflineRef.current = true;
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <aside
        aria-label="Offline Mode Notification"
        className="w-full bg-[#FAF0EC] border-b border-[#F2D6CD] px-4 py-2 text-xs text-[#71382D] flex items-center justify-between z-40 transition-all"
      >
        <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B85C3E] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#B85C3E]"></span>
          </span>
          <WifiOff className="w-3.5 h-3.5 text-[#B85C3E] flex-shrink-0" />
          <p className="font-medium truncate">
            Working offline &mdash; Live hotel inventory, bookings, and actions are paused until connection is restored.
          </p>
        </div>
      </aside>
    );
  }

  if (showRestored) {
    return (
      <aside
        aria-label="Online Notification"
        className="w-full bg-[#EDF7ED] border-b border-[#C8E6C9] px-4 py-2 text-xs text-[#1E4620] flex items-center justify-between z-40 transition-all animate-in fade-in duration-300"
      >
        <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2E7D32]"></span>
          <Wifi className="w-3.5 h-3.5 text-[#2E7D32] flex-shrink-0" />
          <p className="font-medium truncate">
            Connection restored &mdash; Hotel data synchronized.
          </p>
        </div>
      </aside>
    );
  }

  return null;
}
