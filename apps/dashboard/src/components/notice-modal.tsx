'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { Button } from '@sena/ui';
import { useDialogA11y } from './use-dialog-a11y';

export type NoticeTone = 'warning' | 'error' | 'success' | 'info';

export interface NoticeOptions {
  title: string;
  message?: string;
  tone?: NoticeTone;
  dismissLabel?: string;
  /** Runs after the notice closes, whichever way it was dismissed. */
  onDismiss?: () => void;
}

interface NoticeItem extends NoticeOptions {
  id: string;
}

interface NoticeContextValue {
  show: (options: NoticeOptions) => void;
  dismiss: () => void;
}

const NoticeContext = React.createContext<NoticeContextValue | null>(null);

export function useNotice() {
  const ctx = React.useContext(NoticeContext);
  if (!ctx) {
    return {
      show: (options: NoticeOptions) => {
        if (typeof window !== 'undefined') window.alert(options.message ? `${options.title}\n\n${options.message}` : options.title);
      },
      dismiss: () => {},
    };
  }
  return ctx;
}

const TONES: Record<NoticeTone, { icon: React.ElementType; accent: string; ring: string; button: string }> = {
  warning: { icon: AlertTriangle, accent: 'bg-[#FBF1E4]', ring: 'text-[#A6692A]', button: 'bg-[#71382D] hover:bg-[#5E2F25] text-white' },
  error: { icon: XCircle, accent: 'bg-[#FBEDEA]', ring: 'text-[#8C2F24]', button: 'bg-[#8C2F24] hover:bg-[#78271E] text-white' },
  success: { icon: CheckCircle2, accent: 'bg-[#E9F3EC]', ring: 'text-[#1F5C40]', button: 'bg-[#2E6B4F] hover:bg-[#255740] text-white' },
  info: { icon: Info, accent: 'bg-[#F3EEE9]', ring: 'text-[#71382D]', button: 'bg-[#71382D] hover:bg-[#5E2F25] text-white' },
};

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = React.useState<NoticeItem | null>(null);
  const dismissRef = React.useRef<NoticeOptions['onDismiss']>(undefined);

  const dismiss = React.useCallback(() => {
    const callback = dismissRef.current;
    dismissRef.current = undefined;
    setNotice(null);
    callback?.();
  }, []);

  const show = React.useCallback((options: NoticeOptions) => {
    dismissRef.current = options.onDismiss;
    setNotice({ ...options, id: Math.random().toString(36).slice(2, 9) });
  }, []);

  const value = React.useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const tone = TONES[notice?.tone || 'warning'];
  const dialogRef = useDialogA11y<HTMLDivElement>(Boolean(notice), dismiss);

  return (
    <NoticeContext.Provider value={value}>
      {children}
      {notice && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#191816]/50 p-3 backdrop-blur-sm sm:items-center">
          <div
            key={notice.id}
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="app-notice-title"
            aria-describedby={notice.message ? 'app-notice-message' : undefined}
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#E8E2DA] bg-white shadow-2xl"
          >
            <div className="flex items-start gap-3 px-5 pb-1 pt-5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.accent}`}>
                <tone.icon className={`h-5 w-5 ${tone.ring}`} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id="app-notice-title" className="text-base font-semibold leading-6 text-[#191816]">
                  {notice.title}
                </h2>
                {notice.message && (
                  <p id="app-notice-message" className="mt-1.5 text-sm leading-6 text-[#5C564D]">
                    {notice.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="-me-2 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#7A7267] transition-colors hover:bg-[#F3EEE9] hover:text-[#191816]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="px-5 pb-5 pt-4">
              <Button type="button" className={`min-h-11 w-full rounded-lg text-sm font-medium ${tone.button}`} onClick={dismiss}>
                {notice.dismissLabel || 'Got it'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </NoticeContext.Provider>
  );
}
