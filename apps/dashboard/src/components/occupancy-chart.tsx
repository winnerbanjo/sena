'use client';

import * as React from 'react';

export interface VelocityDayData {
  iso: string;
  day: string;
  dayName: string;
  dateNum: string;
  fullDate: string;
  occupancy: number; // 0 - 100
  roomsBooked: number;
  totalRooms: number;
  revenueMinorUnits: number;
  arrivals: number;
  departures: number;
  isToday?: boolean;
}

interface OccupancyChartProps {
  velocityDays: VelocityDayData[];
  bookableInventory: number;
}

export function OccupancyChart({
  velocityDays = [],
  bookableInventory = 13,
}: OccupancyChartProps) {
  const days = velocityDays;
  const todayDay = days.find((d) => d.isToday) || days[days.length - 1] || days[0];
  const [hoveredDay, setHoveredDay] = React.useState<VelocityDayData | null>(null);

  const activeDay = hoveredDay || todayDay;

  if (!days || days.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[#E8E2DA] bg-white p-4 space-y-3">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-[#191816]">Occupancy</h3>
        <p className="text-xs text-[#7A7267] mt-0.5">Last 7 days</p>
      </div>

      {/* Clean 7-day bar chart */}
      <div className="relative pt-3 pb-1">
        {/* Subtle 50% / 100% reference line */}
        <div className="absolute inset-x-0 top-6 bottom-10 flex flex-col justify-between pointer-events-none opacity-40">
          <div className="border-b border-dashed border-[#E8E2DA] w-full" />
          <div className="border-b border-dashed border-[#E8E2DA] w-full" />
        </div>

        {/* 7 Vertical Bars */}
        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-36 relative z-10">
          {days.map((d) => {
            const isToday = d.isToday;
            const isInspected = activeDay?.iso === d.iso;

            return (
              <div
                key={d.iso}
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
                className="group flex flex-col items-center h-full justify-end cursor-pointer"
              >
                {/* Percentage label above bar */}
                <span
                  className={`text-[11px] font-mono tabular-nums mb-1 transition-colors ${
                    isToday
                      ? 'font-semibold text-[#B85C3E]'
                      : isInspected
                      ? 'font-medium text-[#191816]'
                      : 'text-[#7A7267] group-hover:text-[#191816]'
                  }`}
                >
                  {d.occupancy}%
                </span>

                {/* Vertical Bar */}
                <div className="w-full max-w-[32px] h-24 flex flex-col justify-end">
                  <div
                    style={{ height: `${Math.max(d.occupancy, 4)}%` }}
                    className={`w-full rounded-t-sm transition-all duration-150 ${
                      isToday
                        ? 'bg-[#B85C3E]'
                        : isInspected
                        ? 'bg-[#71382D]'
                        : 'bg-[#E5DACD] group-hover:bg-[#C4896E]'
                    }`}
                  />
                </div>

                {/* Day label below bar */}
                <div className="mt-1.5 text-center">
                  <span
                    className={`block text-xs ${
                      isToday
                        ? 'font-semibold text-[#B85C3E]'
                        : isInspected
                        ? 'font-medium text-[#191816]'
                        : 'text-[#7A7267]'
                    }`}
                  >
                    {d.day}
                  </span>
                  <span className="block text-[10px] text-[#A69E92] font-mono">
                    {d.dateNum}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Restrained hover detail line */}
      {activeDay && (
        <div className="pt-2 border-t border-[#F0ECE6] flex items-center justify-between text-xs text-[#7A7267]">
          <span>{activeDay.fullDate}</span>
          <span className="font-mono text-[#191816]">
            {activeDay.roomsBooked} of {bookableInventory} units ({activeDay.occupancy}%)
          </span>
        </div>
      )}
    </div>
  );
}
