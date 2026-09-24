'use client';

import * as React from 'react';
import Link from 'next/link';
import { formatStayDates, formatNaira } from '@sena/config';
import {
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
  const [currentDateStr, setCurrentDateStr] = React.useState('');
  const [propertyName, setPropertyName] = React.useState('Your Property');

  React.useEffect(() => {
    try {
      const stored =
        localStorage.getItem('sena_property_name') ||
        JSON.parse(localStorage.getItem('sena_auth_user') || '{}')?.property ||
        JSON.parse(localStorage.getItem('sena_onboarding_draft') || '{}')?.propName;
      if (stored) setPropertyName(stored);
    } catch {}
  }, []);

  React.useEffect(() => {
    const today = new Date();
    setCurrentDateStr(
      today.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    );
  }, []);

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
        alert('No available rooms currently marked clean to assign for check-in.');
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

  function handleCreateReservation(newRes: ReservationItem) {
    setReservations((prev) => [newRes, ...prev]);
    fetchData();
  }

  const arrivals = reservations.filter((r) => r.status === 'confirmed');
  const inHouse = reservations.filter((r) => r.status === 'checked_in');
  const dirtyRooms = rooms.filter((r) => r.housekeeping === 'dirty' || r.housekeepingStatus === 'dirty');
  const occupiedCount = rooms.filter((r) => r.operational === 'occupied' || r.operationalStatus === 'occupied').length;
  const totalRoomsCount = rooms.length || 1;
  const occupancyRate = Math.round((occupiedCount / totalRoomsCount) * 100);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white text-[#191816]">
      <Topbar
        title="Overview"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-10 max-w-7xl w-full mx-auto">
        {/* Editorial Greeting & Daily Pulse */}
        <div className="border-b border-[#E8E1D5] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#8C8275] block mb-1">
              {currentDateStr || 'Today'} &middot; Run of House
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#71382D]">
              {propertyName}
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-[#2E6B4F]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E6B4F]" />
              Front desk ready
            </span>
            <span className="text-[#D5CABA]">&middot;</span>
            <Link
              href="/front-desk"
              className="text-[#71382D] hover:text-[#B85C3E] font-medium transition-colors"
            >
              Open room tape &rarr;
            </Link>
          </div>
        </div>

        {/* Operational Pulse: Natural Asymmetry Instead of 4 Repetitive Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Prominent Occupancy Anchor */}
          <div className="md:col-span-4 bg-[#FAF7F2] rounded-xl border border-[#E8E1D5] p-6 space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8275] block">
              Live Occupancy
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-serif text-[#71382D]">
                {occupancyRate}%
              </span>
              <span className="text-xs text-[#7A7267]">
                ({occupiedCount} of {rooms.length} occupied)
              </span>
            </div>
            <p className="text-xs text-[#8C8275] pt-1">
              {rooms.length - occupiedCount} rooms available for direct walk-ins or engine bookings today.
            </p>
          </div>

          {/* Core Daily Guest Roster Metrics */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-6 p-2">
            <Link href="/front-desk" className="space-y-1 group">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8275] block group-hover:text-[#B85C3E] transition-colors">
                Arrivals Today
              </span>
              <div className="text-2xl sm:text-3xl font-serif text-[#191816] group-hover:text-[#71382D] transition-colors">
                {arrivals.length}
              </div>
              <span className="text-[11px] text-[#7A7267] block">
                {inHouse.length} in-house now
              </span>
            </Link>

            <Link href="/front-desk" className="space-y-1 group">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8275] block group-hover:text-[#B85C3E] transition-colors">
                Departures
              </span>
              <div className="text-2xl sm:text-3xl font-serif text-[#191816] group-hover:text-[#71382D] transition-colors">
                4
              </div>
              <span className="text-[11px] text-[#7A7267] block">
                Checkout by 11:00
              </span>
            </Link>

            <Link href="/housekeeping" className="space-y-1 group">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8275] block group-hover:text-[#B85C3E] transition-colors">
                Housekeeping
              </span>
              <div className="text-2xl sm:text-3xl font-serif text-[#B85C3E] group-hover:text-[#71382D] transition-colors">
                {dirtyRooms.length}
              </div>
              <span className="text-[11px] text-[#7A7267] block">
                Rooms to turn over
              </span>
            </Link>

            <Link href="/payments" className="space-y-1 group">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8275] block group-hover:text-[#B85C3E] transition-colors">
                Month Revenue
              </span>
              <div className="text-2xl sm:text-3xl font-serif text-[#191816] group-hover:text-[#71382D] transition-colors">
                ₦2.48m
              </div>
              <span className="text-[11px] text-[#2E6B4F] block">
                0% Sena fee kept
              </span>
            </Link>
          </div>
        </div>

        {/* Occupancy Velocity Rhythm */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#8C8275]">
              7-Day Occupancy &amp; Rate Yield Trend
            </span>
            <Link href="/calendar" className="text-[#71382D] hover:text-[#B85C3E] transition-colors">
              Open 30-day calendar &rarr;
            </Link>
          </div>
          <OccupancyChart />
        </div>

        {/* Two-Column Editorial Rhythm: Arrivals Ledger & Operational Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Arrivals Book (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif text-[#191816]">
                  Expected Guest Arrivals
                </h2>
                <p className="text-xs text-[#7A7267] mt-0.5">
                  Guest list for today. Select any stay to view preferences, notes, or settle balances.
                </p>
              </div>
              <span className="text-xs font-mono text-[#8C8275]">
                {arrivals.length} {arrivals.length === 1 ? 'stay' : 'stays'} scheduled
              </span>
            </div>

            {arrivals.length === 0 ? (
              <div className="py-12 px-6 rounded-lg border border-dashed border-[#E8E1D5] text-center space-y-2 bg-[#FAF7F2]/40">
                <p className="text-sm font-serif text-[#71382D]">No more arrivals scheduled for today</p>
                <p className="text-xs text-[#8C8275]">All checked-in or awaiting new direct reservations.</p>
              </div>
            ) : (
              <div className="border border-[#E8E1D5] rounded-xl overflow-hidden divide-y divide-[#E8E1D5] bg-white">
                {arrivals.map((res) => {
                  const isPaid = res.paymentStatus === 'paid';
                  return (
                    <div
                      key={res.id}
                      onClick={() => {
                        setSelectedRes(res);
                        setDrawerOpen(true);
                      }}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF7F2]/60 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC] flex items-center justify-center font-serif text-xs font-medium flex-shrink-0">
                          {res.guestName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-base text-[#191816] group-hover:text-[#B85C3E] transition-colors truncate">
                              {res.guestName}
                            </span>
                            <span className="text-[11px] font-mono text-[#8C8275]">
                              {res.reference}
                            </span>
                          </div>
                          <span className="text-xs text-[#7A7267] block truncate mt-0.5">
                            {res.roomType} &middot; <strong className="text-[#71382D] font-medium">{res.roomNumber}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-5">
                        <div className="text-left sm:text-right">
                          <span className="text-xs text-[#191816] block font-mono">
                            {formatStayDates(res.checkInDate, res.checkOutDate)}
                          </span>
                          <span className="text-[11px] text-[#8C8275] block">
                            {res.nights} {res.nights === 1 ? 'night' : 'nights'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono ${
                            isPaid
                              ? 'bg-[#EFF7F2] text-[#2E6B4F] border border-[#C6E4CC]'
                              : 'bg-[#FEF8EE] text-[#A3681F] border border-[#F2DAC0]'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-[#2E6B4F]' : 'bg-[#A3681F]'}`} />
                            {isPaid ? 'Settled' : 'Pay at Desk'}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckIn(res.id);
                            }}
                            className="px-3 py-1.5 rounded-md bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-medium transition-colors"
                          >
                            Check in
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Operational Side Column (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Turnaround Desk */}
            <div className="bg-[#FAF7F2] rounded-xl border border-[#E8E1D5] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8E1D5] pb-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8275]">
                  Turnaround Status
                </span>
                <Link href="/housekeeping" className="text-xs text-[#71382D] hover:text-[#B85C3E]">
                  Housekeeping &rarr;
                </Link>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-[#F0ECE4]">
                  <span className="text-[#5C564D]">Clean &amp; Inspected Rooms</span>
                  <strong className="font-mono text-[#2E6B4F]">
                    {rooms.length - dirtyRooms.length}
                  </strong>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#F0ECE4]">
                  <span className="text-[#5C564D]">Rooms Awaiting Clean</span>
                  <strong className="font-mono text-[#B85C3E]">
                    {dirtyRooms.length}
                  </strong>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#5C564D]">Expected Next Turnaround</span>
                  <span className="text-[#7A7267] font-mono">14:00 Check-in</span>
                </div>
              </div>
            </div>

            {/* Direct Booking Engine Highlight */}
            <div className="rounded-xl border border-[#E8E1D5] p-6 space-y-3 bg-white">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#B85C3E] block">
                Direct Booking Engine
              </span>
              <h3 className="text-base font-serif text-[#191816]">
                Share your direct rate
              </h3>
              <p className="text-xs text-[#7A7267] leading-relaxed">
                Add your direct link to your Instagram bio and WhatsApp auto-responder to capture reservations with zero OTA commission.
              </p>
              <div className="pt-2">
                <Link
                  href="/booking-preview"
                  className="text-xs text-[#71382D] hover:text-[#B85C3E] font-medium underline underline-offset-4 decoration-[#E5D4BC]"
                >
                  Preview public booking engine &rarr;
                </Link>
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
