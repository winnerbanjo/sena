'use client';

import * as React from 'react';
import { Globe, Check } from 'lucide-react';
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

  const currentMeta = LOCALE_META[locale] || LOCALE_META.en;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('language')}: ${currentMeta.nativeName}`}
        title={`${t('language')}: ${currentMeta.nativeName}`}
        disabled={switching}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 p-1.5 px-2 text-[#5C564D] hover:text-[#191816] hover:bg-[#FAF8F5] rounded-md transition-colors flex-shrink-0 border border-transparent hover:border-[#E8E2DA] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B85C3E]"
      >
        <Globe className="w-3.5 h-3.5 text-[#7A7267] flex-shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-medium tracking-tight uppercase text-[#7A7267]">
          {locale}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('language')}
          className="absolute end-0 bottom-full mb-2 w-48 rounded-lg border border-[#E8E2DA] bg-white p-1 shadow-[0_4px_20px_rgba(25,24,22,0.08)] z-50 text-xs"
        >
          <div className="px-2.5 py-1.5 border-b border-[#F0ECE6] mb-1">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#8C8275]">
              {t('language')}
            </p>
          </div>

          <div className="space-y-0.5">
            {APP_LOCALES.map((code) => {
              const meta = LOCALE_META[code];
              const isSelected = code === locale;

              return (
                <button
                  key={code}
                  type="button"
                  role="option"
                  lang={meta.htmlLang}
                  dir={meta.dir}
                  aria-selected={isSelected}
                  disabled={switching}
                  onClick={async () => {
                    setOpen(false);
                    const ok = await setLocale(code as AppLocale);
                    if (ok) {
                      onNavigate?.();
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-start transition-colors ${
                    isSelected
                      ? 'bg-[#F7F2EB] text-[#71382D] font-medium'
                      : 'text-[#191816] hover:bg-[#FAF8F6]'
                  }`}
                >
                  <span className="tracking-tight">{meta.nativeName}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#71382D] flex-shrink-0 ms-1.5" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
