'use client';

import * as React from 'react';
import Link from 'next/link';
import { formatStayDates } from '@sena/config';
import { Badge, Button, MetricCard } from '@sena/ui';
import { CheckCircle2, Clock, MoveRight } from 'lucide-react';
import {
  INITIAL_ACTIVITY,
  INITIAL_RESERVATIONS,
  type ReservationItem,
} from '../components/mock-data';
import { NewReservationDialog } from '../components/new-reservation-dialog';
import { OccupancyChart } from '../components/occupancy-chart';
import { ReservationDrawer } from '../components/reservation-drawer';
import { Topbar } from '../components/topbar';

export default function OverviewPage() {
  const [reservations, setReservations] = React.useState<ReservationItem[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [activity, setActivity] = React.useState<any[]>([]);

  const fetchData = React.useCallback(async () => {
    try {
      const [resRes, roomRes] = await Promise.all([
        fetch('/api/reservations'),
        fetch('/api/rooms'),
      ]);

      if (resRes.ok) {
        const data = await resRes.json();
        if (data.reservations) {
          const mapped: ReservationItem[] = data.reservations.map((r: any) => ({
            id: r.id,
            reference: r.reference,
            guestName: r.guestName || 'Unnamed Guest',
            guestEmail: r.guestEmail || '',
            guestPhone: r.guestPhone || '',
            roomType: r.roomTypeName || 'Standard Room',
            roomNumber: r.roomNumber || 'Unassigned',
            checkInDate: r.checkInDate,
            checkOutDate: r.checkOutDate,
            nights: r.nights,
            numGuests: r.numGuests || 1,
            source: r.source || 'direct',
            status: r.status,
            paymentStatus: r.paymentStatus,
            totalAmountMinorUnits: r.totalAmountMinorUnits,
            paidAmountMinorUnits: r.paidAmountMinorUnits,
            timeline: r.timeline || [],
          }));
          setReservations(mapped);
        }
      }

      if (roomRes.ok) {
        const roomData = await roomRes.json();
        if (roomData.rooms) setRooms(roomData.rooms);
      }
    } catch (e) {
      console.error('Failed to load overview data from DB:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check In handler via PostgreSQL
  async function handleCheckIn(id: string) {
    try {
      const availableRoom = rooms.find((rm) => rm.operational === 'available' || rm.operationalStatus === 'available');
      if (!availableRoom) {
        alert('No available rooms found in database to assign for check-in');
        return;
      }
      const res = await fetch(`/api/reservations/${id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: availableRoom.id }),
      });
      if (res.ok) {
        fetchData();
        if (selectedRes && selectedRes.id === id) {
          setSelectedRes((prev) => prev ? { ...prev, status: 'checked_in' } : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Check Out handler via PostgreSQL
  async function handleCheckOut(id: string) {
    try {
      const res = await fetch(`/api/reservations/${id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (res.ok) {
        fetchData();
        if (selectedRes && selectedRes.id === id) {
          setSelectedRes((prev) => prev ? { ...prev, status: 'checked_out' } : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Add newly created reservation
  function handleCreateReservation(newRes: ReservationItem) {
    setReservations((prev) => [newRes, ...prev]);
    fetchData();
  }

  // Filter today's arrivals
  const arrivals = reservations.filter((r) => r.status === 'confirmed');
  const occupiedCount = rooms.filter((r) => r.operational === 'occupied' || r.operationalStatus === 'occupied').length;
  const totalRoomsCount = rooms.length || 1;
  const occupancyRate = Math.round((occupiedCount / totalRoomsCount) * 100);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title="Overview"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 bg-white">
        {/* Morning Greeting Section 26 */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#E8E2DA] pb-4 sm:pb-6">
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono tracking-widest uppercase text-[#7A7267] block mb-1">
              WEDNESDAY, 23 SEPTEMBER 2026
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[#191816]">
              Good morning, Amara <span className="text-[#B85C3E]">☼</span>
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Here's what's happening at Stay Connect Lekki today.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-[#EBF5ED] text-[#2E6B4F] font-medium border border-[#C6E4CC]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E6B4F] animate-pulse" />
              All systems live
            </span>
          </div>
        </div>

        {/* 4 Primary Restrained Metrics with direct operational links */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link href="/front-desk" className="block focus:outline-none focus:ring-1 focus:ring-[#B85C3E]">
            <MetricCard
              label="Arrivals"
              value="12"
              subtext="3 checked in · 9 expected"
              subValue="Front desk →"
              className="hover:border-[#B85C3E]/60 hover:bg-[#FAFAFA] transition-all cursor-pointer h-full"
            />
          </Link>
          <Link href="/calendar" className="block focus:outline-none focus:ring-1 focus:ring-[#B85C3E]">
            <MetricCard
              label="Occupancy"
              value={`${occupancyRate}%`}
              subtext={`${occupiedCount} of ${rooms.length} rooms occupied`}
              subValue="Calendar →"
              className="hover:border-[#B85C3E]/60 hover:bg-[#FAFAFA] transition-all cursor-pointer h-full"
            />
          </Link>
          <Link href="/payments" className="block focus:outline-none focus:ring-1 focus:ring-[#B85C3E]">
            <MetricCard
              label="Booking value"
              value="₦2.48m"
              subtext="Recorded revenue this month"
              subValue="Payments →"
              className="hover:border-[#B85C3E]/60 hover:bg-[#FAFAFA] transition-all cursor-pointer h-full"
            />
          </Link>
          <Link href="/housekeeping" className="block focus:outline-none focus:ring-1 focus:ring-[#B85C3E]">
            <MetricCard
              label="Rooms to clean"
              value="6"
              subtext="2 currently cleaning · 4 dirty"
              subValue="Housekeeping →"
              className="hover:border-[#B85C3E]/60 hover:bg-[#FAFAFA] transition-all cursor-pointer h-full"
            />
          </Link>
        </div>

        {/* Live Weekly Occupancy & Revenue Velocity Graph */}
        <OccupancyChart />

        {/* Main Content Layout: Section 28 & 29 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Arrivals List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-[#E8E2DA] rounded-md overflow-hidden shadow-none">
              <div className="p-3.5 sm:p-4 border-b border-[#E8E2DA] flex items-center justify-between bg-[#FAFAFA]">
                <div>
                  <h3 className="text-sm sm:text-base font-serif font-normal text-[#191816]">
                    Today's Expected Arrivals
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#7A7267]">
                    Click any guest to open their stay details without leaving the page.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#B85C3E]">
                    {arrivals.length} reservations
                  </span>
                  <Link
                    href="/front-desk"
                    className="text-xs font-medium text-[#71382D] hover:text-[#B85C3E] transition-colors hidden sm:inline-flex items-center gap-1"
                  >
                    View Front Desk <MoveRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Arrivals Table */}
              <div className="divide-y divide-[#E8E2DA]">
                {arrivals.map((res) => (
                  <div
                    key={res.id}
                    onClick={() => {
                      setSelectedRes(res);
                      setDrawerOpen(true);
                    }}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAFAFA] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#E5D4BC] text-[#71382D] flex items-center justify-center font-serif text-xs font-bold flex-shrink-0">
                        {res.guestName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-sm font-serif text-[#191816] group-hover:text-[#B85C3E] transition-colors truncate">
                            {res.guestName}
                          </strong>
                          <span className="text-[11px] text-[#7A7267] font-mono">
                            {res.reference}
                          </span>
                        </div>
                        <span className="text-xs text-[#7A7267] block truncate">
                          {res.roomType} · Room {res.roomNumber}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-4 w-full sm:w-auto">
                      <div className="text-left sm:text-right">
                        <span className="text-xs font-medium text-[#191816] block">
                          {formatStayDates(res.checkInDate, res.checkOutDate)}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-[#7A7267]">
                          {res.nights} {res.nights === 1 ? 'night' : 'nights'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant={res.paymentStatus === 'paid' ? 'paid' : 'pending'}
                        >
                          {res.paymentStatus.replace('_', ' ')}
                        </Badge>

                        {res.status === 'confirmed' ? (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckIn(res.id);
                            }}
                            className="bg-[#2E6B4F] hover:bg-[#255740] text-xs px-2.5 py-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Check in
                          </Button>
                        ) : res.status === 'checked_in' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckOut(res.id);
                            }}
                            className="text-xs px-2.5 py-1"
                          >
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            Check out
                          </Button>
                        ) : (
                          <Badge variant="clean">Checked out</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Today at a Glance + Activity Stream */}
          <div className="space-y-6">
            {/* Section 28: Today at a Glance with deep links */}
            <div className="bg-white border border-[#E8E2DA] p-5 rounded-md space-y-3 shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium tracking-wider uppercase text-[#7A7267] block">
                  Today at a glance
                </span>
                <Link href="/front-desk" className="text-[11px] text-[#B85C3E] hover:underline font-mono">
                  All Activity →
                </Link>
              </div>
              <div className="space-y-1 text-xs">
                <Link
                  href="/front-desk"
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded hover:bg-[#FAF9F7] border-b border-[#E8E2DA]/60 transition-colors group"
                >
                  <span className="text-[#191816] group-hover:text-[#B85C3E] transition-colors">Arrivals</span>
                  <strong className="font-serif text-sm">12</strong>
                </Link>
                <Link
                  href="/front-desk"
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded hover:bg-[#FAF9F7] border-b border-[#E8E2DA]/60 transition-colors group"
                >
                  <span className="text-[#191816] group-hover:text-[#B85C3E] transition-colors">Departures</span>
                  <strong className="font-serif text-sm">8</strong>
                </Link>
                <Link
                  href="/front-desk"
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded hover:bg-[#FAF9F7] border-b border-[#E8E2DA]/60 transition-colors group"
                >
                  <span className="text-[#191816] group-hover:text-[#B85C3E] transition-colors">In-house guests</span>
                  <strong className="font-serif text-sm">34</strong>
                </Link>
                <Link
                  href="/rooms"
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded hover:bg-[#FAF9F7] border-b border-[#E8E2DA]/60 transition-colors group"
                >
                  <span className="text-[#191816] group-hover:text-[#B85C3E] transition-colors">Available rooms</span>
                  <strong className="font-serif text-sm text-[#2E6B4F]">5</strong>
                </Link>
                <Link
                  href="/housekeeping"
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded hover:bg-[#FAF9F7] border-b border-[#E8E2DA]/60 transition-colors group"
                >
                  <span className="text-[#191816] group-hover:text-[#B85C3E] transition-colors">Rooms to clean</span>
                  <strong className="font-serif text-sm text-[#B85C3E]">6</strong>
                </Link>
                <Link
                  href="/payments"
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded hover:bg-[#FAF9F7] transition-colors group"
                >
                  <span className="text-[#191816] group-hover:text-[#B85C3E] transition-colors">Outstanding payments</span>
                  <strong className="font-serif text-sm text-[#B85C3E]">₦480,000</strong>
                </Link>
              </div>
            </div>

            {/* Section 30: Recent Activity Stream */}
            <div className="bg-white border border-[#E8E2DA] p-5 rounded-md shadow-none">
              <span className="text-[11px] font-medium tracking-wider uppercase text-[#7A7267] block mb-3">
                Recent Activity
              </span>
              <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-[#E8E2DA]">
                {activity.slice(0, 5).map((act) => (
                  <div key={act.id} className="relative pl-5 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B85C3E] absolute left-1.5 top-1.5 ring-2 ring-white" />
                    <p className="text-[#191816] font-medium leading-relaxed">
                      {act.text}
                    </p>
                    <span className="text-[10px] text-[#7A7267]">{act.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Reservation Drawer */}
      <ReservationDrawer
        reservation={selectedRes}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
      />

      {/* New Reservation Dialog */}
      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={handleCreateReservation}
      />
    </div>
  );
}
