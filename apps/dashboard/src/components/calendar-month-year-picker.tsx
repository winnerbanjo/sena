'use client';

import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@sena/ui';
import { useDialogA11y } from './use-dialog-a11y';
import { LOCALE_META, parseLocale } from '../i18n/config';

type Props = {
  month: number; // 0-11
  year: number;
  onSelect: (month: number, year: number) => void;
  className?: string;
};

function monthLabel(locale: string, monthIndex: number, style: 'long' | 'short' = 'long') {
  return new Intl.DateTimeFormat(locale, { month: style }).format(new Date(2020, monthIndex, 1));
}

export function CalendarMonthYearPicker({ month, year, onSelect, className }: Props) {
  const t = useTranslations('calendar');
  const localeCode = useLocale();
  const appLocale = parseLocale(localeCode);
  const intlLocale = LOCALE_META[appLocale].htmlLang;
  const [open, setOpen] = React.useState(false);
  const [pickerYear, setPickerYear] = React.useState(year);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = useDialogA11y<HTMLDivElement>(open, () => setOpen(false));

  React.useEffect(() => {
    if (open) setPickerYear(year);
  }, [open, year]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, panelRef]);

  const label = new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  );

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('pickMonthYear')}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-left text-xl font-serif text-[#191816] transition-colors hover:bg-[#FAF7F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E]/40"
      >
        <span className="capitalize">{label}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-[#7A7267] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('pickMonthYear')}
          className="absolute start-0 top-full z-40 mt-1.5 w-[min(100vw-2rem,16.5rem)] rounded-md border border-[#E8E2DA] bg-white p-3 shadow-md"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={t('previousYear')}
              onClick={() => setPickerYear((y) => y - 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-[#7A7267] hover:bg-[#FAF7F2] hover:text-[#191816] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E]/40"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </button>
            <div className="flex items-center gap-1 text-sm font-medium tabular-nums text-[#191816]">
              <button
                type="button"
                onClick={() => setPickerYear(pickerYear - 1)}
                className={cn(
                  'rounded px-1.5 py-0.5 hover:bg-[#FAF7F2]',
                  pickerYear === year - 1 && 'bg-[#FAF7F2] text-[#B85C3E]',
                )}
              >
                {pickerYear - 1}
              </button>
              <span className="rounded bg-[#191816] px-2 py-0.5 text-white">{pickerYear}</span>
              <button
                type="button"
                onClick={() => setPickerYear(pickerYear + 1)}
                className={cn(
                  'rounded px-1.5 py-0.5 hover:bg-[#FAF7F2]',
                  pickerYear === year + 1 && 'bg-[#FAF7F2] text-[#B85C3E]',
                )}
              >
                {pickerYear + 1}
              </button>
            </div>
            <button
              type="button"
              aria-label={t('nextYear')}
              onClick={() => setPickerYear((y) => y + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-[#7A7267] hover:bg-[#FAF7F2] hover:text-[#191816] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E]/40"
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }, (_, index) => {
              const active = index === month && pickerYear === year;
              return (
                <button
                  key={index}
                  type="button"
                  aria-current={active ? 'date' : undefined}
                  onClick={() => {
                    onSelect(index, pickerYear);
                    setOpen(false);
                  }}
                  className={cn(
                    'rounded-md px-1.5 py-2 text-center text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E]/40',
                    active ? 'bg-[#191816] text-white' : 'text-[#3D3935] hover:bg-[#FAF7F2]',
                  )}
                >
                  {monthLabel(intlLocale, index, 'short')}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
