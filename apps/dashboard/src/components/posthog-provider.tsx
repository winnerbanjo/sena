'use client';

import { useEffect } from 'react';

export function PostHogProvider({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    if (posthogKey && typeof window !== 'undefined') {
      void import('posthog-js').then(({ default: posthog }) => {
        posthog.init(posthogKey, {
          api_host: posthogHost,
          person_profiles: 'identified_only',
          capture_pageview: false,
        });
      });
    }
  }, [enabled]);

  return <>{children}</>;
}
