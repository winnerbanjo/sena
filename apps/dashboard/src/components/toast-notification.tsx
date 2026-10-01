'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (opts: { title: string; message?: string; type?: ToastType }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback safe dummy if rendered outside provider
    return {
      showToast: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message, type = 'info' }: { title: string; message?: string; type?: ToastType }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, title, message, type };
      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5 toasts

      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const success = useCallback((title: string, message?: string) => showToast({ title, message, type: 'success' }), [showToast]);
  const error = useCallback((title: string, message?: string) => showToast({ title, message, type: 'error' }), [showToast]);
  const info = useCallback((title: string, message?: string) => showToast({ title, message, type: 'info' }), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      {/* Toast Render Viewport */}
      <div className="pointer-events-none fixed end-4 top-4 z-[9999] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-md border bg-white p-3 text-[#191816] shadow-sm ${
              t.type === 'success'
                ? 'border-[#C6E4CC]'
                : t.type === 'error'
                ? 'border-[#F0C9C2]'
                : 'border-[#E8E2DA]'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 className="h-4 w-4 text-[#1F5C40]" />}
              {t.type === 'error' && <AlertCircle className="h-4 w-4 text-[#8C2F24]" />}
              {t.type === 'info' && <Info className="h-4 w-4 text-[#71382D]" />}
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="text-sm font-medium text-[#191816]">{t.title}</h5>
              {t.message && <p className="mt-0.5 text-xs leading-5 text-[#7A7267]">{t.message}</p>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="inline-flex h-8 w-8 items-center justify-center text-[#7A7267] hover:text-[#191816]"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
