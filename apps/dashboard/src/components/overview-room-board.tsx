'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface RoomRowItem {
  id: string;
  roomNumber: string;
  floor?: string | null;
  roomTypeName?: string | null;
  operationalStatus: string;
  housekeepingStatus: string;
}

interface OverviewRoomBoardProps {
  rooms: RoomRowItem[];
  occupiedCount: number;
  attentionCount: number;
  onSelectRoom: (room: RoomRowItem) => void;
}

export function OverviewRoomBoard({
  rooms = [],
  occupiedCount,
  attentionCount,
  onSelectRoom,
}: OverviewRoomBoardProps) {
  // Sort naturally by floor and room number
  const sortedRooms = React.useMemo(() => {
    return [...rooms].sort((a, b) => {
      const numA = parseInt(a.roomNumber, 10) || 0;
      const numB = parseInt(b.roomNumber, 10) || 0;
      return numA - numB;
    });
  }, [rooms]);

  return (
    <div className="rounded-lg border border-[#E8E2DA] bg-white overflow-hidden space-y-0">
      {/* Header */}
      <div className="p-4 border-b border-[#E8E2DA] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#191816]">
            Accommodation Summary
          </h3>
          <p className="text-xs text-[#7A7267] mt-0.5">
            {rooms.length} units &middot; {occupiedCount} occupied &middot; {attentionCount} need cleaning
          </p>
        </div>
        <Link
          href="/rooms"
          className="text-xs text-[#71382D] hover:text-[#5E2B21] font-medium inline-flex items-center gap-1 transition-colors"
        >
          <span>All rooms</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Spacious, readable room grid / rows */}
      <div className="divide-y divide-[#F0ECE6]">
        {sortedRooms.map((room) => {
          const isOccupied = room.operationalStatus === 'occupied';
          const isMaintenance = room.operationalStatus === 'maintenance';
          const isDirty = room.housekeepingStatus === 'dirty';
          const isClean = ['clean', 'inspected'].includes(room.housekeepingStatus);

          return (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-[#FAF8F6] cursor-pointer transition-colors"
            >
              {/* Unit & Type */}
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-md bg-[#FAF8F6] border border-[#E8E2DA] font-semibold text-xs text-[#191816] flex items-center justify-center flex-shrink-0 font-mono">
                  {room.roomNumber}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-medium text-[#191816] block truncate">
                    {room.roomTypeName || 'Room'}
                  </span>
                  <span className="text-[11px] text-[#7A7267] block truncate">
                    {room.floor || 'Floor 1'}
                  </span>
                </div>
              </div>

              {/* Status Indicators (Unabbreviated) */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Housekeeping state */}
                <span
                  className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                    isDirty
                      ? 'bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC]'
                      : 'bg-[#EBF5ED] text-[#2E6B4F] border border-[#CDE5D4]'
                  }`}
                >
                  {isDirty ? 'Needs clean' : 'Clean'}
                </span>

                {/* Operational state */}
                <span
                  className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                    isOccupied
                      ? 'bg-[#F5F2EB] text-[#5C564D] border border-[#E8E2DA]'
                      : isMaintenance
                      ? 'bg-[#EFECEA] text-[#7A7267] border border-[#D5CFC7]'
                      : 'bg-[#EBF5ED] text-[#2E6B4F] border border-[#CDE5D4]'
                  }`}
                >
                  {isOccupied ? 'Occupied' : isMaintenance ? 'Maintenance' : 'Available'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
