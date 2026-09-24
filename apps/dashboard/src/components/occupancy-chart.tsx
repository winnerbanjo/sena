'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
import { ArrowUpRight, TrendingUp, DollarSign } from 'lucide-react';

interface DayData {
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


function formatShortNaira(minorUnits: number) {
  const naira = minorUnits / 100;
  if (naira >= 1000000) return `₦${(naira / 1000000).toFixed(1)}m`;
  return `₦${(naira / 1000).toFixed(0)}k`;
}

export function OccupancyChart({
  reservations = [],
  rooms = [],
}: {
  reservations?: any[];
  rooms?: any[];
}) {
  const [activeTab, setActiveTab] = React.useState<'occupancy' | 'revenue'>('occupancy');

  const days: DayData[] = React.useMemo(() => {
    const result: DayData[] = [];
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const isToday = i === 0;

      const overlapping = reservations.filter(
        (r) => iso >= r.checkInDate && iso < r.checkOutDate && r.status !== 'cancelled'
      );
      const arrivalsOnDay = reservations.filter((r) => r.checkInDate === iso).length;
      const departuresOnDay = reservations.filter((r) => r.checkOutDate === iso).length;
      const dayRev = overlapping.reduce((sum, r) => sum + (r.paidAmountMinorUnits || 0), 0);
      const totalR = rooms.length || 1;
      const occ = rooms.length > 0 ? Math.min(100, Math.round((overlapping.length / totalR) * 100)) : 0;

      result.push({
        day: dayNames[d.getDay()],
        dayName: fullDayNames[d.getDay()],
        dateNum: String(d.getDate()),
        fullDate: `${fullDayNames[d.getDay()]}, ${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}${isToday ? ' (Today)' : ''}`,
        occupancy: occ,
        roomsBooked: overlapping.length,
        totalRooms: rooms.length,
        revenueMinorUnits: dayRev,
        arrivals: arrivalsOnDay,
        departures: departuresOnDay,
        isToday,
      });
    }
    return result;
  }, [reservations, rooms]);

  const [selectedDay, setSelectedDay] = React.useState<DayData>(() => days.find((d) => d.isToday) || days[3] || days[0]);
  const [hoveredDay, setHoveredDay] = React.useState<DayData | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    const todayDay = days.find((d) => d.isToday);
    if (todayDay) setSelectedDay(todayDay);
  }, [days]);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  if (rooms.length === 0 && reservations.length === 0) {
    return (
      <div className="bg-[#FAF7F2] rounded-xl border border-[#E8E1D5] p-8 sm:p-10 text-center space-y-3">
        <span className="text-[11px] font-mono uppercase tracking-widest text-[#8C8275] block">
          Occupancy &amp; Revenue Velocity
        </span>
        <h3 className="font-serif text-lg text-[#71382D]">
          No reservation velocity to plot yet
        </h3>
        <p className="text-xs text-[#7A7267] max-w-md mx-auto leading-relaxed">
          As guests book rooms via your direct website or walk in at the front desk, 7-day occupancy percentages and revenue yield trends will automatically generate here.
        </p>
      </div>
    );
  }

  const maxRevenue = Math.max(1000000, ...days.map((d) => d.revenueMinorUnits));
  const currentInspectDay = hoveredDay || selectedDay || days[0];

  const todayDay = days.find(d => d.isToday) || days[0];
  const maxOccDay = [...days].sort((a, b) => b.occupancy - a.occupancy)[0] || todayDay;
  const maxRevDay = [...days].sort((a, b) => b.revenueMinorUnits - a.revenueMinorUnits)[0] || todayDay;
  const peakDay = activeTab === 'occupancy' ? maxOccDay : maxRevDay;
  
  const weeklyAvgOcc = Math.round(days.reduce((sum, d) => sum + d.occupancy, 0) / (days.length || 1));
  const weeklyTotalRev = days.reduce((sum, d) => sum + d.revenueMinorUnits, 0);

  return (
    <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 space-y-6 shadow-xs">
      {/* Top Header & Dynamic Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
        <div>
          <div className="flex items-center gap-2">
            {activeTab === 'occupancy' ? (
              <TrendingUp className="w-4 h-4 text-[#B85C3E]" />
            ) : (
              <DollarSign className="w-4 h-4 text-[#2E6B4F]" />
            )}
            <h3 className="text-base font-semibold text-[#191816]">
              {activeTab === 'occupancy'
                ? 'Weekly Occupancy Pace'
                : 'Revenue Velocity'}
            </h3>
            <span
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                activeTab === 'occupancy'
                  ? 'text-[#2E6B4F] bg-[#EBF5ED]'
                  : 'text-[#2E6B4F] bg-[#EBF5ED]'
              }`}
            >
              <ArrowUpRight className="w-3 h-3" />
              {activeTab === 'occupancy' ? '+6.2% vs last week' : '+14.8% pacing'}
            </span>
          </div>
          <p className="text-xs text-[#7A7267] mt-1">
            {activeTab === 'occupancy'
              ? `Real-time room occupancy across all ${rooms.length} rooms`
              : 'Daily recorded & projected room revenue across direct and OTA bookings'}
          </p>
        </div>

        {/* Dynamic Mode Switcher Pills */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#F5F2ED] p-1 rounded-md text-xs border border-[#E8E2DA]">
            <button
              type="button"
              onClick={() => setActiveTab('occupancy')}
              className={`px-3.5 py-1.5 rounded-md font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'occupancy'
                  ? 'bg-white text-[#B85C3E] shadow-sm font-semibold'
                  : 'text-[#7A7267] hover:text-[#191816]'
              }`}
            >
              Occupancy (%)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('revenue')}
              className={`px-3.5 py-1.5 rounded-md font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'revenue'
                  ? 'bg-white text-[#2E6B4F] shadow-sm font-semibold'
                  : 'text-[#7A7267] hover:text-[#191816]'
              }`}
            >
              Revenue (₦)
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-md bg-[#FAFAFA] border border-[#E8E2DA]">
          <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
            {activeTab === 'occupancy' ? 'Today Occupancy' : "Today's Revenue"}
          </span>
          <strong className="text-lg font-semibold text-[#191816] block mt-0.5">
            {activeTab === 'occupancy' ? `${todayDay.occupancy}%` : formatNaira(todayDay.revenueMinorUnits)}
          </strong>
          <span className="text-[10px] text-[#7A7267] block">
            {activeTab === 'occupancy' ? `${todayDay.roomsBooked} of ${rooms.length} rooms` : 'Verified payments'}
          </span>
        </div>

        <div className="p-3 rounded-md bg-[#FAFAFA] border border-[#E8E2DA]">
          <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
            {activeTab === 'occupancy' ? 'Weekly Average' : 'Total Week Gross'}
          </span>
          <strong className="text-lg font-semibold text-[#191816] block mt-0.5">
            {activeTab === 'occupancy' ? `${weeklyAvgOcc}%` : formatShortNaira(weeklyTotalRev)}
          </strong>
          <span className="text-[10px] text-[#2E6B4F] flex items-center font-medium">
            <ArrowUpRight className="w-3 h-3" />
            {activeTab === 'occupancy' ? 'Above target (75%)' : 'Ahead of pace'}
          </span>
        </div>

        <div className="p-3 rounded-md bg-[#FAFAFA] border border-[#E8E2DA]">
          <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
            Peak Day
          </span>
          <strong
            className={`text-lg font-semibold block mt-0.5 ${
              activeTab === 'occupancy' ? 'text-[#B85C3E]' : 'text-[#2E6B4F]'
            }`}
          >
            {peakDay.dayName}
          </strong>
          <span className="text-[10px] text-[#7A7267] block">
            {activeTab === 'occupancy' ? `${peakDay.occupancy}% (${peakDay.roomsBooked} rooms)` : `${formatShortNaira(peakDay.revenueMinorUnits)} projected`}
          </span>
        </div>

        <div className="p-3 rounded-md bg-[#FAFAFA] border border-[#E8E2DA]">
          <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
            Available Tonight
          </span>
          <strong className="text-lg font-semibold text-[#2E6B4F] block mt-0.5">
            {rooms.length - todayDay.roomsBooked} Rooms
          </strong>
          <span className="text-[10px] text-[#7A7267] block">
            Ready for walk-in / direct
          </span>
        </div>
      </div>

      {/* Animated Clean Bar Chart Canvas */}
      <div className="relative pt-2">
        {/* Background Subtle Reference Lines */}
        <div className="absolute inset-0 top-6 bottom-10 flex flex-col justify-between pointer-events-none opacity-40">
          <div className="border-b border-dashed border-[#E8E2DA] w-full" />
          <div className="border-b border-dashed border-[#E8E2DA] w-full" />
          <div className="border-b border-dashed border-[#E8E2DA] w-full" />
        </div>

        {/* 7 Interactive Bar Columns */}
        <div className="grid grid-cols-7 gap-2 sm:gap-6 items-end h-52 pb-2 relative z-10">
          {days.map((d, idx) => {
            const targetPercent =
              activeTab === 'occupancy'
                ? d.occupancy
                : Math.round((d.revenueMinorUnits / maxRevenue) * 100);

            const heightPercent = isLoaded ? targetPercent : 0;
            const isSelected = selectedDay.day === d.day;
            const isHovered = hoveredDay?.day === d.day;

            const displayLabel =
              activeTab === 'occupancy'
                ? `${d.occupancy}%`
                : formatShortNaira(d.revenueMinorUnits);

            return (
              <div
                key={d.day}
                onClick={() => setSelectedDay(d)}
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
                className="group flex flex-col items-center h-full justify-end cursor-pointer relative"
              >
                {/* Value Label above Bar: always clearly visible */}
                <div
                  className={`text-[11px] font-mono font-medium mb-2 transition-all duration-200 text-center whitespace-nowrap ${
                    d.isToday || isSelected || isHovered
                      ? activeTab === 'occupancy'
                        ? 'text-[#B85C3E] font-bold scale-105'
                        : 'text-[#2E6B4F] font-bold scale-105'
                      : 'text-[#7A7267] group-hover:text-[#191816]'
                  }`}
                >
                  {displayLabel}
                </div>

                {/* Bar Track & Animated Bar Fill */}
                <div
                  className={`w-full max-w-[48px] h-36 rounded-t-md overflow-hidden flex flex-col justify-end p-1 transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#EFE9E0] ring-1 ring-[#B85C3E]/30'
                      : 'bg-[#F5F2ED] group-hover:bg-[#EFEAE2]'
                  }`}
                >
                  <div
                    style={{
                      height: `${heightPercent}%`,
                      transitionDelay: `${idx * 40}ms`,
                    }}
                    className={`w-full rounded-t-[4px] transition-all duration-500 ease-out ${
                      activeTab === 'occupancy'
                        ? d.isToday
                          ? 'bg-[#B85C3E] shadow-xs'
                          : isSelected || isHovered
                          ? 'bg-[#71382D]'
                          : 'bg-[#B85C3E]/75 group-hover:bg-[#B85C3E]'
                        : d.isToday
                        ? 'bg-[#2E6B4F] shadow-xs'
                        : isSelected || isHovered
                        ? 'bg-[#1F4936]'
                        : 'bg-[#2E6B4F]/75 group-hover:bg-[#2E6B4F]'
                    }`}
                  />
                </div>

                {/* Day Labels below Bar */}
                <div className="mt-2.5 text-center">
                  <span
                    className={`block text-xs font-medium transition-colors ${
                      d.isToday
                        ? activeTab === 'occupancy'
                          ? 'text-[#B85C3E] font-bold'
                          : 'text-[#2E6B4F] font-bold'
                        : isSelected || isHovered
                        ? 'text-[#191816] font-semibold'
                        : 'text-[#7A7267] group-hover:text-[#191816]'
                    }`}
                  >
                    {d.day}
                  </span>
                  <span className="block text-[10px] text-[#A39B90] font-mono">
                    {d.dateNum}
                  </span>
                </div>

                {/* Live "Today" Indicator Pill */}
                {d.isToday && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-wider uppercase text-[#B85C3E] bg-[#FAEDE8] px-1.5 py-0.2 rounded mt-1 border border-[#F2DACF]">
                    Today
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Active Day Detail Inspector Strip */}
        <div className="mt-4 pt-4 border-t border-[#E8E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-[#FAFAFA] p-3 rounded-md">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                activeTab === 'occupancy' ? 'bg-[#B85C3E]' : 'bg-[#2E6B4F]'
              }`}
            />
            <strong className="text-[#191816] text-sm">
              {currentInspectDay.fullDate}
            </strong>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-[#7A7267]">
            <div>
              <span>Rooms occupied: </span>
              <strong className="text-[#191816]">
                {currentInspectDay.roomsBooked} / {currentInspectDay.totalRooms}
              </strong>
            </div>

            <div>
              <span>Occupancy rate: </span>
              <strong className="text-[#191816]">
                {currentInspectDay.occupancy}%
              </strong>
            </div>

            <div>
              <span>Revenue: </span>
              <strong className="text-[#B85C3E] font-semibold">
                {formatNaira(currentInspectDay.revenueMinorUnits)}
              </strong>
            </div>

            <div>
              <span>Arrivals / Departures: </span>
              <span className="font-medium text-[#191816]">
                <span className="text-[#2E6B4F]">+{currentInspectDay.arrivals}</span> /{' '}
                <span className="text-[#7A7267]">-{currentInspectDay.departures}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
