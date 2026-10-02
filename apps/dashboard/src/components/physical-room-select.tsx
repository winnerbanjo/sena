'use client';

import * as React from 'react';
import { Input, Label } from '@sena/ui';
import type { EligiblePhysicalRoom } from './reservation-room';

interface PhysicalRoomSelectProps {
  rooms: EligiblePhysicalRoom[];
  value: string;
  onChange: (roomId: string) => void;
  loading?: boolean;
  emptyLabel?: string;
  labelledBy?: string;
  multiple?: boolean;
  selectedIds?: string[];
}

export function PhysicalRoomSelect({
  rooms,
  value,
  onChange,
  loading,
  emptyLabel = 'No rooms in this category.',
  labelledBy,
  multiple = false,
  selectedIds = [],
}: PhysicalRoomSelectProps) {
  const [query, setQuery] = React.useState('');
  const showSearch = rooms.length > 8;
  const filtered = rooms.filter((room) => {
    if (!query.trim()) return true;
    const haystack = `${room.roomNumber} ${room.floor || ''} ${room.readinessLabel}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  if (loading) {
    return <p className="text-xs text-[#7A7267]">Loading eligible rooms…</p>;
  }

  if (rooms.length === 0) {
    return <p className="text-xs text-[#7A7267]">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {showSearch && (
        <div>
          <Label htmlFor="physical-room-search">Search rooms</Label>
          <Input
            id="physical-room-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Room number or floor"
          />
        </div>
      )}
      <div
        role="listbox"
        aria-labelledby={labelledBy}
        className="max-h-56 overflow-y-auto rounded border border-[#E8E2DA] divide-y divide-[#E8E2DA]"
      >
        {filtered.map((room) => {
          const selected = multiple ? selectedIds.includes(room.id) : value === room.id;
          return (
            <button
              key={room.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={!room.eligible}
              onClick={() => onChange(room.id)}
              className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                !room.eligible
                  ? 'bg-[#FAFAFA] text-[#8C8275] cursor-not-allowed'
                  : selected
                    ? 'bg-[#FAF4EF] text-[#71382D]'
                    : 'bg-white hover:bg-[#FAF7F2] text-[#191816]'
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span>
                  <strong className="block font-medium">Room {room.roomNumber}</strong>
                  <span className="text-[11px] text-[#8C8275]">
                    {room.floor ? `${room.floor} · ` : ''}
                    {room.readinessLabel}
                  </span>
                </span>
                {!room.eligible && room.reason ? (
                  <span className="text-[11px] text-[#A3681F] max-w-[12rem] text-right">{room.reason}</span>
                ) : null}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-xs text-[#7A7267]">No rooms match that search.</p>
        )}
      </div>
    </div>
  );
}
