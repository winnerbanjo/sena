'use client';

import * as React from 'react';
import { Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { APP_LOCALES, LOCALE_META, type AppLocale } from '@/i18n/config';
import { useAppLocale } from '@/i18n/provider';

export function LanguageMenu({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('common');
  const { locale, setLocale, switching } = useAppLocale();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language')}
        title={t('language')}
        onClick={() => setOpen((value) => !value)}
        className="p-1.5 text-[#7A7267] hover:text-[#B85C3E] hover:bg-[#FAF9F7] rounded transition-colors flex-shrink-0"
      >
        <Languages className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t('language')}
          className="absolute end-0 bottom-full mb-2 w-44 rounded-lg border border-[#E8E2DA] bg-white shadow-lg py-1 z-50"
        >
          {APP_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="option"
              lang={LOCALE_META[code].htmlLang}
              aria-selected={code === locale}
              disabled={switching}
              onClick={async () => {
                const ok = await setLocale(code as AppLocale);
                if (ok) {
                  setOpen(false);
                  onNavigate?.();
                }
              }}
              className={`w-full text-start px-3 py-2 text-xs min-h-11 ${
                code === locale ? 'bg-[#F9F7F5] text-[#71382D] font-semibold' : 'text-[#191816] hover:bg-[#FAFAFA]'
              }`}
            >
              {LOCALE_META[code].nativeName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
