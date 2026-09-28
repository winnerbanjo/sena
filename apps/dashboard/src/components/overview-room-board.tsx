'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import {
  overviewBoardStatus,
  overviewRoomCategory,
  overviewRoomNumber,
  sortRoomsByNumber,
  type OverviewBoardRoom,
  type OverviewBoardStatus,
} from '../lib/overview-room-board';

const STATUS_TREATMENT: Record<
  OverviewBoardStatus,
  { card: string; dot: string; label: string }
> = {
  available: {
    card: 'border-[#E8E2DA] bg-[#FFFDFB] hover:border-[#D5CFC7] hover:bg-[#FAF7F2]',
    dot: 'bg-[#2E6B4F]',
    label: 'text-[#5C564D]',
  },
  occupied: {
    card: 'border-[#E8E2DA] bg-[#F4F1EC] hover:border-[#D5CFC7] hover:bg-[#EEEAE4]',
    dot: 'bg-[#71382D]',
    label: 'text-[#5C564D]',
  },
  needs_cleaning: {
    card: 'border-[#E5D4BC] bg-[#F7F1E8] hover:border-[#D9C4A8] hover:bg-[#F3EBE0]',
    dot: 'bg-[#B85C3E]',
    label: 'text-[#71382D]',
  },
  cleaning: {
    card: 'border-[#E8E2DA] bg-[#F7F5F1] hover:border-[#D5CFC7] hover:bg-[#F1EEE9]',
    dot: 'bg-[#8C8275]',
    label: 'text-[#5C564D]',
  },
  out_of_service: {
    card: 'border-[#D5CFC7] bg-[#EFECEA] hover:border-[#C4B8A5] hover:bg-[#E8E4E0]',
    dot: 'bg-[#7A7267]',
    label: 'text-[#5C564D]',
  },
};

type OverviewRoomBoardProps = {
  rooms: OverviewBoardRoom[];
  occupiedCount: number;
  attentionCount: number;
  onSelectRoom: (room: OverviewBoardRoom) => void;
};

export function OverviewRoomBoard({
  rooms,
  occupiedCount,
  attentionCount,
  onSelectRoom,
}: OverviewRoomBoardProps) {
  const t = useTranslations('overview');
  const tRooms = useTranslations('rooms');
  const tCommon = useTranslations('common');
  const orderedRooms = React.useMemo(() => sortRoomsByNumber(rooms), [rooms]);

  function statusLabel(status: OverviewBoardStatus): string {
    switch (status) {
      case 'occupied':
        return t('boardStatusOccupied');
      case 'needs_cleaning':
        return t('boardStatusNeedsCleaning');
      case 'cleaning':
        return t('boardStatusCleaning');
      case 'out_of_service':
        return t('boardStatusOutOfService');
      default:
        return t('boardStatusAvailable');
    }
  }

  return (
    <section aria-labelledby="overview-room-board-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-0.5">
          <h2 id="overview-room-board-heading" className="font-serif text-xl text-[#191816]">
            {tRooms('title')}
          </h2>
          <p className="text-xs text-[#7A7267]">
            {t('boardCount', { count: rooms.length })}
            <span className="mx-1.5 text-[#C4B8A5]">·</span>
            {t('boardOccupied', { count: occupiedCount })}
            <span className="mx-1.5 text-[#C4B8A5]">·</span>
            {t('boardAttention', { count: attentionCount })}
          </p>
        </div>
        <Link
          href="/rooms"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-[#71382D] hover:text-[#5E2B21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71382D] rounded-sm"
        >
          <span>{t('viewAllRooms')}</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="rounded-lg border border-[#E8E2DA] bg-[#FBF8F4] p-2 sm:p-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {orderedRooms.map((room) => {
            const status = overviewBoardStatus(room);
            const treatment = STATUS_TREATMENT[status];
            const number = overviewRoomNumber(room);
            const category = overviewRoomCategory(room) || tCommon('room');
            const label = statusLabel(status);
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onSelectRoom(room)}
                className={`flex min-h-[5.75rem] flex-col rounded-md border p-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71382D] focus-visible:ring-offset-1 ${treatment.card}`}
                aria-label={t('roomCardAria', { number, category, status: label })}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-serif text-[15px] leading-tight tracking-tight text-[#191816] ltr-isolate">
                    {number}
                  </span>
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${treatment.dot}`} aria-hidden />
                </div>
                <p className="mt-1 truncate text-[11px] leading-snug text-[#5C564D]">{category}</p>
                <p className={`mt-auto pt-1.5 truncate text-[11px] leading-snug ${treatment.label}`}>{label}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
