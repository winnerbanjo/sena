'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
import { ArrowUpRight } from 'lucide-react';

interface DayData {
  day: string;
  dateNum: string;
  fullDate: string;
  occupancy: number; // 0 - 100
  roomsBooked: number;
  totalRooms: number;
  revenueMinorUnits: number;
  isToday?: boolean;
}

const DAYS: DayData[] = [
  {
    day: 'Mon',
    dateNum: '21',
    fullDate: 'Mon, 21 Sep',
    occupancy: 71,
    roomsBooked: 22,
    totalRooms: 31,
    revenueMinorUnits: 36000000,
  },
  {
    day: 'Tue',
    dateNum: '22',
    fullDate: 'Tue, 22 Sep',
    occupancy: 77,
    roomsBooked: 24,
    totalRooms: 31,
    revenueMinorUnits: 44000000,
  },
  {
    day: 'Wed',
    dateNum: '23',
    fullDate: 'Wed, 23 Sep (Today)',
    occupancy: 84,
    roomsBooked: 26,
    totalRooms: 31,
    revenueMinorUnits: 52000000,
    isToday: true,
  },
  {
    day: 'Thu',
    dateNum: '24',
    fullDate: 'Thu, 24 Sep',
    occupancy: 87,
    roomsBooked: 27,
    totalRooms: 31,
    revenueMinorUnits: 58000000,
  },
  {
    day: 'Fri',
    dateNum: '25',
    fullDate: 'Fri, 25 Sep',
    occupancy: 94,
    roomsBooked: 29,
    totalRooms: 31,
    revenueMinorUnits: 76000000,
  },
  {
    day: 'Sat',
    dateNum: '26',
    fullDate: 'Sat, 26 Sep',
    occupancy: 97,
    roomsBooked: 30,
    totalRooms: 31,
    revenueMinorUnits: 84000000,
  },
  {
    day: 'Sun',
    dateNum: '27',
    fullDate: 'Sun, 27 Sep',
    occupancy: 74,
    roomsBooked: 23,
    totalRooms: 31,
    revenueMinorUnits: 38000000,
  },
];

export function OccupancyChart() {
  const [activeTab, setActiveTab] = React.useState<'occupancy' | 'revenue'>('occupancy');
  const [selectedDay, setSelectedDay] = React.useState<DayData>(DAYS[2]); // Default Wednesday (today)

  const maxRevenue = 90000000;

  return (
    <div className="bg-white border border-[#E8E2DA] rounded-md p-6 space-y-6 shadow-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-[#191816]">
              Weekly Performance
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] text-[#2E6B4F] bg-[#EBF5ED] px-2 py-0.5 rounded-full font-medium">
              <ArrowUpRight className="w-3 h-3" /> +6.2%
            </span>
          </div>
          <p className="text-xs text-[#7A7267] mt-0.5">
            21 Sep – 27 Sep · Pacing across all 31 rooms
          </p>
        </div>

        {/* Toggle & Highlight Stat */}
        <div className="flex items-center gap-3">
          <div className="flex bg-[#F5F2ED] p-0.5 rounded-md text-xs border border-[#E8E2DA]">
            <button
              onClick={() => setActiveTab('occupancy')}
              className={`px-3 py-1 rounded transition-colors ${
                activeTab === 'occupancy'
                  ? 'bg-white text-[#191816] font-medium shadow-xs'
                  : 'text-[#7A7267] hover:text-[#191816]'
              }`}
            >
              Occupancy
            </button>
            <button
              onClick={() => setActiveTab('revenue')}
              className={`px-3 py-1 rounded transition-colors ${
                activeTab === 'revenue'
                  ? 'bg-white text-[#191816] font-medium shadow-xs'
                  : 'text-[#7A7267] hover:text-[#191816]'
              }`}
            >
              Revenue
            </button>
          </div>
        </div>
      </div>

      {/* Sleek Modern Bar Chart */}
      <div className="pt-2">
        <div className="grid grid-cols-7 gap-3 sm:gap-6 items-end h-44 pb-2 border-b border-[#E8E2DA]">
          {DAYS.map((d) => {
            const heightPercent =
              activeTab === 'occupancy'
                ? d.occupancy
                : Math.round((d.revenueMinorUnits / maxRevenue) * 100);

            const isSelected = selectedDay.day === d.day;
            const displayValue =
              activeTab === 'occupancy'
                ? `${d.occupancy}%`
                : formatNaira(d.revenueMinorUnits);

            return (
              <div
                key={d.day}
                onClick={() => setSelectedDay(d)}
                className="group flex flex-col items-center h-full justify-end cursor-pointer relative"
              >
                {/* Floating Value on hover or when selected */}
                <div
                  className={`text-[11px] font-medium mb-1.5 transition-all text-center whitespace-nowrap ${
                    isSelected
                      ? 'text-[#B85C3E] font-semibold opacity-100'
                      : 'text-[#7A7267] opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {displayValue}
                </div>

                {/* Bar Track & Fill */}
                <div className="w-full max-w-[40px] h-32 bg-[#F5F2ED] rounded-t-md overflow-hidden flex flex-col justify-end p-0.5 relative group-hover:bg-[#EFEAE2] transition-colors">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-[3px] transition-all duration-300 ${
                      d.isToday
                        ? 'bg-[#B85C3E]'
                        : isSelected
                        ? 'bg-[#71382D]'
                        : 'bg-[#B85C3E]/75 group-hover:bg-[#B85C3E]'
                    }`}
                  />
                </div>

                {/* Day Labels below */}
                <div className="mt-2.5 text-center">
                  <span
                    className={`block text-xs font-medium transition-colors ${
                      d.isToday
                        ? 'text-[#B85C3E] font-semibold'
                        : isSelected
                        ? 'text-[#191816]'
                        : 'text-[#7A7267] group-hover:text-[#191816]'
                    }`}
                  >
                    {d.day}
                  </span>
                  <span className="block text-[10px] text-[#A39B90]">
                    {d.dateNum}
                  </span>
                </div>

                {/* Little Today indicator dot */}
                {d.isToday && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B85C3E] mt-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Day Quick Inspector Strip */}
        <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#B85C3E]" />
            <strong className="text-[#191816] font-medium">
              {selectedDay.fullDate}
            </strong>
          </div>

          <div className="flex items-center gap-6 text-xs text-[#7A7267]">
            <div>
              <span>Rooms occupied: </span>
              <strong className="text-[#191816] font-medium">
                {selectedDay.roomsBooked} / {selectedDay.totalRooms}
              </strong>
            </div>

            <div>
              <span>Occupancy rate: </span>
              <strong className="text-[#191816] font-medium">
                {selectedDay.occupancy}%
              </strong>
            </div>

            <div>
              <span>Day revenue: </span>
              <strong className="text-[#B85C3E] font-medium">
                {formatNaira(selectedDay.revenueMinorUnits)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
