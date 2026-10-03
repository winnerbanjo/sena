'use client';

import * as React from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { APP_LOCALES, LOCALE_META, type AppLocale } from '@/i18n/config';
import { useAppLocale } from '@/i18n/provider';
import { useTranslations } from 'next-intl';

export function LanguageSelect({
  id,
  className,
  onPicked,
}: {
  id?: string;
  className?: string;
  onPicked?: () => void;
}) {
  const t = useTranslations('common');
  const { locale, setLocale, switching } = useAppLocale();
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentMeta = LOCALE_META[locale] || LOCALE_META.en;

  return (
    <div ref={containerRef} className="relative inline-block text-start">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${t('language')}: ${currentMeta.nativeName}`}
        disabled={switching}
        onClick={() => setIsOpen((prev) => !prev)}
        className={
          className ||
          'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium text-[#5C564D] hover:text-[#191816] hover:bg-[#F2EFEA]/70 border border-[#E8E2DA] bg-white transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B85C3E]'
        }
      >
        <Globe className="w-3.5 h-3.5 text-[#7A7267] flex-shrink-0" aria-hidden="true" />
        <span className="tracking-tight">{currentMeta.nativeName}</span>
        <ChevronDown
          className={`w-3 h-3 text-[#A69E92] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={t('language')}
          className="absolute end-0 top-full mt-1.5 w-44 rounded-lg border border-[#E8E2DA] bg-white p-1 shadow-[0_4px_16px_rgba(25,24,22,0.08)] z-50 text-xs"
        >
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
                  setIsOpen(false);
                  await setLocale(code as AppLocale);
                  onPicked?.();
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-start transition-colors ${
                  isSelected
                    ? 'bg-[#FAF8F6] text-[#B85C3E] font-medium'
                    : 'text-[#191816] hover:bg-[#F7F5F2]'
                }`}
              >
                <span>{meta.nativeName}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#B85C3E]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
