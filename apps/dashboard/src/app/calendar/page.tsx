'use client';

import * as React from 'react';
import { Badge, Button } from '@sena/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { INITIAL_RESERVATIONS, INITIAL_ROOMS, type ReservationItem } from '../../components/mock-data';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { ReservationDrawer } from '../../components/reservation-drawer';
import { Topbar } from '../../components/topbar';

const CALENDAR_DATES = [
  { day: 'TUE', date: '22', full: '2026-09-22' },
  { day: 'WED', date: '23', full: '2026-09-23', isToday: true },
  { day: 'THU', date: '24', full: '2026-09-24' },
  { day: 'FRI', date: '25', full: '2026-09-25' },
  { day: 'SAT', date: '26', full: '2026-09-26' },
  { day: 'SUN', date: '27', full: '2026-09-27' },
  { day: 'MON', date: '28', full: '2026-09-28' },
];

export default function CalendarPage() {
  const [reservations, setReservations] = React.useState<ReservationItem[]>(INITIAL_RESERVATIONS);
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newResOpen, setNewResOpen] = React.useState(false);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title="Master Calendar"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-white">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-serif text-[#191816]">
              September 2026
            </h2>
            <div className="flex items-center gap-1 border border-[#E8E2DA] rounded bg-white p-0.5">
              <button className="p-1 hover:bg-[#FAFAFA] rounded text-[#7A7267]">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="px-2 py-0.5 text-xs font-semibold text-[#191816] hover:bg-[#FAFAFA] rounded">
                Today
              </button>
              <button className="p-1 hover:bg-[#FAFAFA] rounded text-[#7A7267]">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-xs text-[#7A7267] flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#B85C3E]" />
              Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#71382D]" />
              Checked In
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#FAFAFA] border border-[#E8E2DA]" />
              Available
            </span>
          </div>
        </div>

        {/* Master Calendar Matrix */}
        <div className="bg-white border border-[#E8E2DA] rounded-md overflow-x-auto shadow-none">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-[#E8E2DA] bg-[#FAFAFA] text-xs">
                <th className="p-3 text-left font-serif font-normal text-[#7A7267] w-48 border-r border-[#E8E2DA]">
                  ROOM / CATEGORY
                </th>
                {CALENDAR_DATES.map((d) => (
                  <th
                    key={d.full}
                    className={`p-3 text-center font-medium border-r border-[#E8E2DA] ${
                      d.isToday ? 'bg-[#FAF0E4]/70 text-[#B85C3E]' : 'text-[#7A7267]'
                    }`}
                  >
                    <span className="text-[10px] block font-mono">{d.day}</span>
                    <strong className="text-sm font-serif block">{d.date}</strong>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2DA] text-xs">
              {INITIAL_ROOMS.map((room) => {
                const res = reservations.find((r) => r.roomNumber === room.number);

                return (
                  <tr key={room.id} className="hover:bg-[#FAFAFA] transition-colors">
                    {/* Room title */}
                    <td className="p-3 border-r border-[#E8E2DA] bg-[#FAFAFA]/50">
                      <strong className="block text-sm font-serif text-[#191816]">
                        Room {room.number}
                      </strong>
                      <span className="text-[11px] text-[#7A7267]">
                        {room.type}
                      </span>
                    </td>

                    {/* Timeline columns */}
                    {CALENDAR_DATES.map((dateObj) => {
                      const isOccupied =
                        res &&
                        dateObj.full >= res.checkInDate &&
                        dateObj.full < res.checkOutDate;

                      const isCheckInDay = res && dateObj.full === res.checkInDate;

                      if (isOccupied && isCheckInDay) {
                        return (
                          <td
                            key={dateObj.full}
                            colSpan={res.nights}
                            onClick={() => {
                              setSelectedRes(res);
                              setDrawerOpen(true);
                            }}
                            className="p-1 border-r border-[#E8E2DA] cursor-pointer"
                          >
                            <div
                              className={`h-9 px-3 rounded flex items-center justify-between text-xs text-white shadow-none transition-opacity hover:opacity-90 ${
                                res.status === 'checked_in'
                                  ? 'bg-[#71382D]'
                                  : 'bg-[#B85C3E]'
                              }`}
                            >
                              <div className="truncate">
                                <strong className="font-medium mr-2">
                                  {res.guestName}
                                </strong>
                                <span className="opacity-80 text-[11px]">
                                  {res.nights}n · {res.source}
                                </span>
                              </div>
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/20">
                                {res.paymentStatus}
                              </span>
                            </div>
                          </td>
                        );
                      }

                      if (
                        res &&
                        dateObj.full > res.checkInDate &&
                        dateObj.full < res.checkOutDate
                      ) {
                        return null;
                      }

                      return (
                        <td
                          key={dateObj.full}
                          onClick={() => setNewResOpen(true)}
                          className={`p-3 text-center border-r border-[#E8E2DA] hover:bg-[#FAFAFA] cursor-pointer text-[#7A7267]/40 ${
                            dateObj.isToday ? 'bg-[#FAF0E4]/30' : ''
                          }`}
                        >
                          <span className="text-[10px] text-[#7A7267]/40 font-mono">
                            Available
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      <ReservationDrawer
        reservation={selectedRes}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={(newRes) => setReservations((prev) => [newRes, ...prev])}
      />
    </div>
  );
}
