'use client';

import * as React from 'react';
import { formatStayDates } from '@sena/config';
import { Badge, Button, MetricCard } from '@sena/ui';
import { CheckCircle2, Clock, MoveRight, Sparkles } from 'lucide-react';
import {
  INITIAL_ACTIVITY,
  INITIAL_RESERVATIONS,
  type ReservationItem,
} from '../components/mock-data';
import { NewReservationDialog } from '../components/new-reservation-dialog';
import { ReservationDrawer } from '../components/reservation-drawer';
import { Topbar } from '../components/topbar';

export default function OverviewPage() {
  const [reservations, setReservations] = React.useState<ReservationItem[]>(
    INITIAL_RESERVATIONS
  );
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(
    null
  );
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [activity, setActivity] = React.useState(INITIAL_ACTIVITY);

  // Check In handler
  function handleCheckIn(id: string) {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'checked_in' } : r))
    );
    if (selectedRes && selectedRes.id === id) {
      setSelectedRes((prev) =>
        prev ? { ...prev, status: 'checked_in' } : null
      );
    }
    const target = reservations.find((r) => r.id === id);
    if (target) {
      setActivity((prev) => [
        {
          id: `act-${Date.now()}`,
          text: `${target.guestName} checked into Room ${target.roomNumber}`,
          time: 'Just now',
        },
        ...prev,
      ]);
    }
  }

  // Check Out handler
  function handleCheckOut(id: string) {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'checked_out' } : r))
    );
    if (selectedRes && selectedRes.id === id) {
      setSelectedRes((prev) =>
        prev ? { ...prev, status: 'checked_out' } : null
      );
    }
    const target = reservations.find((r) => r.id === id);
    if (target) {
      setActivity((prev) => [
        {
          id: `act-${Date.now()}`,
          text: `${target.guestName} checked out of Room ${target.roomNumber} (Room marked dirty)`,
          time: 'Just now',
        },
        ...prev,
      ]);
    }
  }

  // Add newly created reservation
  function handleCreateReservation(newRes: ReservationItem) {
    setReservations((prev) => [newRes, ...prev]);
    setActivity((prev) => [
      {
        id: `act-${Date.now()}`,
        text: `New reservation ${newRes.reference} for ${newRes.guestName}`,
        time: 'Just now',
      },
      ...prev,
    ]);
  }

  // Filter today's arrivals
  const arrivals = reservations.filter((r) => r.checkInDate === '2026-09-23');

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar
        title="Overview"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Morning Greeting Section 26 */}
        <div className="flex items-end justify-between border-b border-[#E2D8CC] pb-6">
          <div>
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#7A7267] block mb-1">
              WEDNESDAY, 23 SEPTEMBER 2026
            </span>
            <h2 className="text-3xl font-serif font-normal text-[#191816]">
              Good morning, Amara <span className="text-[#B85C3E]">☼</span>
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Here's what's happening at Stay Connect Lekki today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-[#EBF5ED] text-[#2E6B4F] font-medium border border-[#C6E4CC]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E6B4F] animate-pulse" />
              All systems live
            </span>
          </div>
        </div>

        {/* 4 Primary Restrained Metrics (Section 27) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Arrivals"
            value="12"
            subtext="3 checked in · 9 expected"
            subValue="Today"
          />
          <MetricCard
            label="Occupancy"
            value="84%"
            subtext="26 of 31 rooms occupied"
            subValue="High"
          />
          <MetricCard
            label="Booking value"
            value="₦2.48m"
            subtext="Recorded revenue this month"
            subValue="September"
          />
          <MetricCard
            label="Rooms to clean"
            value="6"
            subtext="2 currently cleaning · 4 dirty"
            subValue="Housekeeping"
          />
        </div>

        {/* Main Content Layout: Section 28 & 29 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Arrivals List (2 columns on large screens) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-[#E2D8CC] rounded-md overflow-hidden">
              <div className="p-4 border-b border-[#E2D8CC] flex items-center justify-between bg-[#F7F1E8]/30">
                <div>
                  <h3 className="text-base font-serif font-normal text-[#191816]">
                    Today's Expected Arrivals
                  </h3>
                  <p className="text-xs text-[#7A7267]">
                    Click any guest to open their stay details without leaving the page.
                  </p>
                </div>
                <span className="text-xs font-mono text-[#B85C3E]">
                  {arrivals.length} reservations
                </span>
              </div>

              {/* Arrivals Table */}
              <div className="divide-y divide-[#E2D8CC]">
                {arrivals.map((res) => (
                  <div
                    key={res.id}
                    onClick={() => {
                      setSelectedRes(res);
                      setDrawerOpen(true);
                    }}
                    className="p-4 flex items-center justify-between hover:bg-[#F7F1E8]/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#E5D4BC] text-[#71382D] flex items-center justify-center font-serif text-xs font-bold">
                        {res.guestName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-serif text-[#191816] group-hover:text-[#B85C3E] transition-colors">
                            {res.guestName}
                          </strong>
                          <span className="text-xs text-[#7A7267] font-mono">
                            {res.reference}
                          </span>
                        </div>
                        <span className="text-xs text-[#7A7267] block">
                          {res.roomType} · Room {res.roomNumber}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <span className="text-xs font-medium text-[#191816] block">
                          {formatStayDates(res.checkInDate, res.checkOutDate)}
                        </span>
                        <span className="text-[11px] text-[#7A7267]">
                          {res.nights} {res.nights === 1 ? 'night' : 'nights'}
                        </span>
                      </div>

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
                          className="bg-[#2E6B4F] hover:bg-[#255740]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Check in
                        </Button>
                      ) : res.status === 'checked_in' ? (
                        <Badge variant="occupied">Checked in</Badge>
                      ) : (
                        <Badge variant="clean">Checked out</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Today at a Glance + Activity Stream */}
          <div className="space-y-6">
            {/* Section 28: Today at a Glance */}
            <div className="bg-white border border-[#E2D8CC] p-5 rounded-md space-y-3">
              <span className="text-[11px] font-medium tracking-wider uppercase text-[#7A7267] block">
                Today at a glance
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-[#E2D8CC]/60">
                  <span className="text-[#191816]">Arrivals</span>
                  <strong className="font-serif text-sm">12</strong>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[#E2D8CC]/60">
                  <span className="text-[#191816]">Departures</span>
                  <strong className="font-serif text-sm">8</strong>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[#E2D8CC]/60">
                  <span className="text-[#191816]">In-house guests</span>
                  <strong className="font-serif text-sm">34</strong>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[#E2D8CC]/60">
                  <span className="text-[#191816]">Available rooms</span>
                  <strong className="font-serif text-sm text-[#2E6B4F]">5</strong>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[#E2D8CC]/60">
                  <span className="text-[#191816]">Rooms to clean</span>
                  <strong className="font-serif text-sm text-[#B85C3E]">6</strong>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[#191816]">Outstanding payments</span>
                  <strong className="font-serif text-sm text-[#B85C3E]">₦480,000</strong>
                </div>
              </div>
            </div>

            {/* Section 30: Recent Activity Stream */}
            <div className="bg-white border border-[#E2D8CC] p-5 rounded-md">
              <span className="text-[11px] font-medium tracking-wider uppercase text-[#7A7267] block mb-3">
                Recent Activity
              </span>
              <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-[#E2D8CC]">
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

      {/* Reservation Drawer (PRD Section 34-35) */}
      <ReservationDrawer
        reservation={selectedRes}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
      />

      {/* New Reservation Dialog (PRD Section 36-38) */}
      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={handleCreateReservation}
      />
    </div>
  );
}
