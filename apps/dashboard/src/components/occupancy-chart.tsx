'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
import { ArrowUpRight, Calendar, DollarSign, TrendingUp, Users } from 'lucide-react';

interface DayMetric {
  day: string;
  dateStr: string;
  shortDate: string;
  occupancy: number; // percentage 0 - 100
  roomsOccupied: number;
  totalRooms: number;
  revenueMinorUnits: number;
  arrivals: number;
  departures: number;
  isToday?: boolean;
  statusText?: string;
}

const WEEK_DATA: DayMetric[] = [
  {
    day: 'Mon',
    dateStr: 'Monday, 21 Sep',
    shortDate: '21 Sep',
    occupancy: 71,
    roomsOccupied: 22,
    totalRooms: 31,
    revenueMinorUnits: 36000000,
    arrivals: 6,
    departures: 4,
    statusText: 'Normal weekday pace',
  },
  {
    day: 'Tue',
    dateStr: 'Tuesday, 22 Sep',
    shortDate: '22 Sep',
    occupancy: 77,
    roomsOccupied: 24,
    totalRooms: 31,
    revenueMinorUnits: 44000000,
    arrivals: 8,
    departures: 5,
    statusText: 'Corporate check-ins',
  },
  {
    day: 'Wed',
    dateStr: 'Wednesday, 23 Sep',
    shortDate: '23 Sep',
    occupancy: 84,
    roomsOccupied: 26,
    totalRooms: 31,
    revenueMinorUnits: 52000000,
    arrivals: 12,
    departures: 8,
    isToday: true,
    statusText: 'Peak weekday arrivals',
  },
  {
    day: 'Thu',
    dateStr: 'Thursday, 24 Sep',
    shortDate: '24 Sep',
    occupancy: 87,
    roomsOccupied: 27,
    totalRooms: 31,
    revenueMinorUnits: 58000000,
    arrivals: 7,
    departures: 6,
    statusText: 'Strong forward pace',
  },
  {
    day: 'Fri',
    dateStr: 'Friday, 25 Sep',
    shortDate: '25 Sep',
    occupancy: 94,
    roomsOccupied: 29,
    totalRooms: 31,
    revenueMinorUnits: 76000000,
    arrivals: 11,
    departures: 3,
    statusText: 'Weekend getaway surge',
  },
  {
    day: 'Sat',
    dateStr: 'Saturday, 26 Sep',
    shortDate: '26 Sep',
    occupancy: 97,
    roomsOccupied: 30,
    totalRooms: 31,
    revenueMinorUnits: 84000000,
    arrivals: 5,
    departures: 2,
    statusText: 'Near full house (1 suite left)',
  },
  {
    day: 'Sun',
    dateStr: 'Sunday, 27 Sep',
    shortDate: '27 Sep',
    occupancy: 74,
    roomsOccupied: 23,
    totalRooms: 31,
    revenueMinorUnits: 38000000,
    arrivals: 4,
    departures: 14,
    statusText: 'Turnover & deep cleaning',
  },
];

type MetricType = 'occupancy' | 'revenue';

export function OccupancyChart() {
  const [metric, setMetric] = React.useState<MetricType>('occupancy');
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(2); // Default highlight today (Wed)

  // Chart coordinate calculations
  const width = 680;
  const height = 180;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 30;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const maxVal = metric === 'occupancy' ? 100 : 90000000;
  const minVal = 0;

  const points = WEEK_DATA.map((d, index) => {
    const x = paddingX + (index / (WEEK_DATA.length - 1)) * innerWidth;
    const value = metric === 'occupancy' ? d.occupancy : d.revenueMinorUnits;
    const normalized = (value - minVal) / (maxVal - minVal);
    const y = paddingTop + innerHeight - normalized * innerHeight;
    return { x, y, value, d };
  });

  // Generate smooth cubic bezier SVG path
  const linePath = points.reduce((acc, point, i, arr) => {
    if (i === 0) return `M ${point.x},${point.y}`;
    const prev = arr[i - 1];
    const cp1x = prev.x + (point.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (point.x - prev.x) / 2;
    const cp2y = point.y;
    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${point.x},${point.y}`;
  }, '');

  // Generate fill area path
  const areaPath = `${linePath} L ${points[points.length - 1].x},${paddingTop + innerHeight} L ${points[0].x},${paddingTop + innerHeight} Z`;

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : points[2];

  return (
    <div className="bg-white border border-[#E8E2DA] rounded-md p-6 space-y-5 shadow-none">
      {/* Chart Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-[#B85C3E]" />
            <h3 className="text-base font-serif font-normal text-[#191816]">
              Occupancy & Revenue Velocity
            </h3>
          </div>
          <p className="text-xs text-[#7A7267]">
            Real-time week view across all 31 rooms with live forward pacing.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-1 bg-[#FAFAFA] p-1 rounded-md border border-[#E8E2DA] text-xs">
          <button
            onClick={() => setMetric('occupancy')}
            className={`px-3 py-1 rounded font-medium transition-all ${
              metric === 'occupancy'
                ? 'bg-white text-[#191816] shadow-sm font-semibold'
                : 'text-[#7A7267] hover:text-[#191816]'
            }`}
          >
            Occupancy (%)
          </button>
          <button
            onClick={() => setMetric('revenue')}
            className={`px-3 py-1 rounded font-medium transition-all ${
              metric === 'revenue'
                ? 'bg-white text-[#191816] shadow-sm font-semibold'
                : 'text-[#7A7267] hover:text-[#191816]'
            }`}
          >
            Revenue (₦)
          </button>
        </div>
      </div>

      {/* Mini KPI summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E8E2DA]">
          <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
            Avg Occupancy
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <strong className="text-base font-serif text-[#191816]">83.4%</strong>
            <span className="text-[10px] text-[#2E6B4F] flex items-center font-medium">
              <ArrowUpRight className="w-3 h-3" /> +6.8%
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E8E2DA]">
          <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
            Week Gross Revenue
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <strong className="text-base font-serif text-[#191816]">₦3.88m</strong>
            <span className="text-[10px] text-[#2E6B4F] flex items-center font-medium">
              <ArrowUpRight className="w-3 h-3" /> +14.2%
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E8E2DA]">
          <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
            Peak Night
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <strong className="text-base font-serif text-[#B85C3E]">Saturday</strong>
            <span className="text-[10px] text-[#7A7267]">(97%)</span>
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E8E2DA]">
          <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
            RevPAR (Avg)
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <strong className="text-base font-serif text-[#191816]">₦17,900</strong>
            <span className="text-[10px] text-[#7A7267]">/ room</span>
          </div>
        </div>
      </div>

      {/* SVG Interactive Chart */}
      <div className="relative pt-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 sm:h-52 overflow-visible select-none"
        >
          <defs>
            {/* Area gradient */}
            <linearGradient id="senaChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B85C3E" stopOpacity="0.22" />
              <stop offset="70%" stopColor="#B85C3E" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#B85C3E" stopOpacity="0.0" />
            </linearGradient>

            {/* Bar gradient */}
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#71382D" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#71382D" stopOpacity="0.04" />
            </linearGradient>

            <linearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B85C3E" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#B85C3E" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = paddingTop + innerHeight - pct * innerHeight;
            const label =
              metric === 'occupancy'
                ? `${Math.round(pct * 100)}%`
                : pct === 0
                ? '₦0'
                : `₦${((pct * 90) / 10).toFixed(0)}m`;

            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#E8E2DA"
                  strokeWidth="1"
                  strokeDasharray={pct === 0 ? 'none' : '3 3'}
                  opacity={0.8}
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#7A7267"
                  fontFamily="monospace"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Volume Bar Columns */}
          {points.map((p, idx) => {
            const barWidth = 28;
            const barHeight = innerHeight * (p.d.occupancy / 100);
            const barY = paddingTop + innerHeight - barHeight;
            const isHovered = hoveredIndex === idx;

            return (
              <rect
                key={`bar-${idx}`}
                x={p.x - barWidth / 2}
                y={barY}
                width={barWidth}
                height={barHeight}
                rx="4"
                fill={isHovered ? 'url(#barGradActive)' : 'url(#barGrad)'}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
              />
            );
          })}

          {/* Area Fill Under Curve */}
          <path d={areaPath} fill="url(#senaChartGrad)" />

          {/* Trend Line Path */}
          <path
            d={linePath}
            fill="none"
            stroke="#B85C3E"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Today Indicator Vertical Line */}
          {points[2] && (
            <g>
              <line
                x1={points[2].x}
                y1={paddingTop - 12}
                x2={points[2].x}
                y2={paddingTop + innerHeight}
                stroke="#2E6B4F"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <rect
                x={points[2].x - 22}
                y={paddingTop - 22}
                width={44}
                height={15}
                rx="3"
                fill="#2E6B4F"
              />
              <text
                x={points[2].x}
                y={paddingTop - 11}
                textAnchor="middle"
                fontSize="8"
                fill="#FFFFFF"
                fontWeight="bold"
                letterSpacing="0.8"
              >
                TODAY
              </text>
            </g>
          )}

          {/* Interactive Data Point Dots */}
          {points.map((p, idx) => {
            const isHovered = hoveredIndex === idx;
            const isToday = p.d.isToday;

            return (
              <g
                key={`dot-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
              >
                {/* Hit target */}
                <circle cx={p.x} cy={p.y} r="14" fill="transparent" />

                {/* Outer halo on hover */}
                {isHovered && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="8"
                    fill="#B85C3E"
                    fillOpacity="0.25"
                    className="animate-ping"
                  />
                )}

                {/* Main point */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? '5' : isToday ? '4.5' : '3.5'}
                  fill={isToday ? '#2E6B4F' : '#B85C3E'}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />

                {/* Day Labels below chart */}
                <text
                  x={p.x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill={isToday ? '#2E6B4F' : isHovered ? '#191816' : '#7A7267'}
                  fontWeight={isToday || isHovered ? '600' : '400'}
                  fontFamily="system-ui"
                >
                  {p.d.day}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Live Hover Tooltip Panel */}
        {activePoint && (
          <div className="mt-3 p-3.5 bg-[#FAFAFA] border border-[#E8E2DA] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B85C3E] flex-shrink-0" />
              <div>
                <strong className="text-sm font-serif text-[#191816]">
                  {activePoint.d.dateStr}
                </strong>
                <span className="text-[11px] text-[#7A7267] block">
                  {activePoint.d.statusText}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-[10px] text-[#7A7267] block">Occupancy</span>
                <strong className="font-serif text-[#191816] text-sm">
                  {activePoint.d.occupancy}%
                </strong>{' '}
                <span className="text-[10px] text-[#7A7267]">
                  ({activePoint.d.roomsOccupied}/{activePoint.d.totalRooms} rooms)
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#7A7267] block">Revenue</span>
                <strong className="font-serif text-[#B85C3E] text-sm">
                  {formatNaira(activePoint.d.revenueMinorUnits)}
                </strong>
              </div>

              <div>
                <span className="text-[10px] text-[#7A7267] block">Arrivals / Deps</span>
                <span className="font-medium text-[#191816]">
                  <span className="text-[#2E6B4F]">+{activePoint.d.arrivals}</span> /{' '}
                  <span className="text-[#7A7267]">-{activePoint.d.departures}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
