'use client';

import { PageLoadState, readJsonResponse } from '../../components/page-load-state';
import * as React from 'react';
import Link from 'next/link';
import { formatNaira } from '@sena/config';
import { Button, MetricCard } from '@sena/ui';
import { Bed, Calendar, Globe, Sparkles } from 'lucide-react';
import { Topbar } from '../../components/topbar';

export default function AnalyticsPage() {
  const [reservations, setReservations] = React.useState<any[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [roomTypes, setRoomTypes] = React.useState<any[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      fetch('/api/reservations').then(readJsonResponse),
      fetch('/api/rooms').then(readJsonResponse),
    ])
      .then(([resData, roomData]) => {
        if (resData.reservations) setReservations(resData.reservations);
        if (roomData.rooms) setRooms(roomData.rooms);
        if (roomData.roomTypes) setRoomTypes(roomData.roomTypes);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  // Total Booking Value (gross confirmed)
  const totalBookingValue = reservations
    .filter((r) => r.status !== 'cancelled')
    .reduce((sum, r) => sum + Number(r.totalAmountMinorUnits || 0), 0);

  // Average stay in nights
  const validStays = reservations.filter((r) => r.status !== 'cancelled');
  const avgNights = validStays.length > 0
    ? (validStays.reduce((sum, r) => sum + Number(r.nights || 1), 0) / validStays.length).toFixed(1)
    : '0';

  // Direct Booking Share
  const directCount = reservations.filter((r) => r.source === 'direct').length;
  const directShare = reservations.length > 0
    ? Math.round((directCount / reservations.length) * 100)
    : 0;

  // Occupancy rate calculation
  const occupiedRoomsCount = rooms.filter((rm) => (rm.operationalStatus || rm.operational) === 'occupied').length;
  const occupancyRate = rooms.length > 0
    ? Math.round((occupiedRoomsCount / rooms.length) * 100)
    : 0;

  // Booking sources distribution
  const sourceCounts: Record<string, number> = {
    direct: 0,
    front_desk: 0,
    whatsapp: 0,
    ota: 0,
  };

  reservations.forEach((r) => {
    if (r.source === 'direct') sourceCounts.direct++;
    else if (r.source === 'walk_in' || r.source === 'manual') sourceCounts.front_desk++;
    else if (r.source === 'whatsapp') sourceCounts.whatsapp++;
    else sourceCounts.ota++;
  });

  const totalSources = reservations.length || 1;
  const sourceBreakdown = [
    {
      source: 'Direct Website',
      count: sourceCounts.direct,
      percentage: reservations.length > 0 ? Math.round((sourceCounts.direct / totalSources) * 100) : 0,
      color: 'bg-[#B85C3E]',
    },
    {
      source: 'Walk-in / Front Desk',
      count: sourceCounts.front_desk,
      percentage: reservations.length > 0 ? Math.round((sourceCounts.front_desk / totalSources) * 100) : 0,
      color: 'bg-[#71382D]',
    },
    {
      source: 'WhatsApp / Phone',
      count: sourceCounts.whatsapp,
      percentage: reservations.length > 0 ? Math.round((sourceCounts.whatsapp / totalSources) * 100) : 0,
      color: 'bg-[#E5D4BC]',
    },
    {
      source: 'Other Channels (OTAs)',
      count: sourceCounts.ota,
      percentage: reservations.length > 0 ? Math.round((sourceCounts.ota / totalSources) * 100) : 0,
      color: 'bg-[#7A7267]',
    },
  ];

  // Category performance
  const categoryStats = roomTypes.map((rt) => {
    const categoryRooms = rooms.filter((rm) => rm.roomTypeId === rt.id || rm.roomTypeName === rt.name);
    const categoryRes = reservations.filter((r) => r.roomTypeId === rt.id || r.roomTypeName === rt.name);
    const catRevenue = categoryRes.reduce((sum, r) => sum + Number(r.paidAmountMinorUnits || 0), 0);
    const occupiedInCat = categoryRooms.filter((rm) => (rm.operationalStatus || rm.operational) === 'occupied').length;
    const catOcc = categoryRooms.length > 0 ? Math.round((occupiedInCat / categoryRooms.length) * 100) : 0;

    return {
      id: rt.id,
      name: rt.name,
      roomCount: categoryRooms.length,
      occupancy: catOcc,
      revenueMinorUnits: catRevenue,
    };
  });

  if (loading || loadError) return <PageLoadState title="Analytics" failed={loadError} />;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title="Analytics" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="border-b border-[#E8E2DA] pb-4">
          <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
            Performance & Insights
          </h2>
          <p className="text-xs text-[#7A7267] mt-1">
            Understand the business behind your rooms with clear, restrained metrics.
          </p>
        </div>

        {/* 4 Restrained Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard
            label="Occupancy Rate"
            value={`${occupancyRate}%`}
            subtext={rooms.length > 0 ? `${occupiedRoomsCount} of ${rooms.length} rooms occupied` : 'No rooms configured'}
            subValue={occupancyRate > 70 ? 'High' : occupancyRate > 30 ? 'Moderate' : 'Quiet'}
          />
          <MetricCard
            label="Total Booking Value"
            value={formatNaira(totalBookingValue)}
            subtext={reservations.length > 0 ? `Across ${reservations.length} total stays` : 'No bookings recorded'}
            subValue="Gross"
          />
          <MetricCard
            label="Average Length of Stay"
            value={`${avgNights} ${avgNights === '1.0' || avgNights === '1' ? 'night' : 'nights'}`}
            subtext={validStays.length > 0 ? 'Across confirmed stays' : 'Awaiting reservations'}
            subValue="Nights"
          />
          <MetricCard
            label="Direct Booking Share"
            value={`${directShare}%`}
            subtext={directShare > 0 ? 'Zero-commission reservations' : 'Via direct booking engine'}
            subValue="Direct"
          />
        </div>

        {/* Breakdown Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Booking Sources */}
          <div className="bg-white border border-[#E8E2DA] p-6 rounded-md space-y-4">
            <div>
              <strong className="text-base font-serif text-[#191816] block">
                Booking Sources
              </strong>
              <p className="text-xs text-[#7A7267]">
                Distribution of reservations by acquisition channel.
              </p>
            </div>

            {reservations.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-[#E8E2DA] rounded-lg bg-[#FAF9F6] space-y-2">
                <Globe className="w-5 h-5 mx-auto text-[#7A7267]" />
                <p className="text-xs font-serif text-[#191816]">No booking sources recorded yet</p>
                <p className="text-[11px] text-[#7A7267] max-w-xs mx-auto">
                  Acquisition channels will automatically be attributed as guests book online or walk in.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {sourceBreakdown.map((item) => (
                  <div key={item.source} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#191816] font-medium">{item.source}</span>
                      <strong className="font-mono">{item.percentage}%</strong>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#FAFAFA] border border-[#E8E2DA] overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Room Category Performance */}
          <div className="bg-white border border-[#E8E2DA] p-6 rounded-md space-y-4">
            <div>
              <strong className="text-base font-serif text-[#191816] block">
                Room Category Utilization
              </strong>
              <p className="text-xs text-[#7A7267]">
                Occupancy and revenue contribution by room tier.
              </p>
            </div>

            {categoryStats.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-[#E8E2DA] rounded-lg bg-[#FAF9F6] space-y-3">
                <Bed className="w-5 h-5 mx-auto text-[#7A7267]" />
                <p className="text-xs font-serif text-[#191816]">No room categories configured</p>
                <p className="text-[11px] text-[#7A7267] max-w-xs mx-auto">
                  Add room categories in Room Management to track occupancy and revenue per category.
                </p>
                <Link href="/rooms">
                  <Button size="sm" variant="secondary" className="text-xs mt-1">
                    Manage categories →
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {categoryStats.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded border border-[#E8E2DA] bg-[#FAFAFA] flex items-center justify-between"
                  >
                    <div>
                      <strong className="text-xs font-serif text-[#191816] block">
                        {cat.name} ({cat.roomCount} {cat.roomCount === 1 ? 'room' : 'rooms'})
                      </strong>
                      <span className="text-[11px] text-[#7A7267]">
                        {cat.occupancy}% Current Occupancy
                      </span>
                    </div>
                    <strong className="text-sm font-serif text-[#B85C3E]">
                      {formatNaira(cat.revenueMinorUnits)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
