'use client';

import * as React from 'react';
import { Badge, Button } from '@sena/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { INITIAL_RESERVATIONS, INITIAL_ROOMS, type ReservationItem } from '../../components/mock-data';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { ReservationDrawer } from '../../components/reservation-drawer';
import { Topbar } from '../../components/topbar';

function generateDates(baseDate = new Date(), numDays = 7) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dates = [];
  const todayStr = new Date().toISOString().split('T')[0];

  for (let i = 0; i < numDays; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const full = d.toISOString().split('T')[0];
    dates.push({
      day: days[d.getDay()],
      date: String(d.getDate()).padStart(2, '0'),
      full,
      isToday: full === todayStr,
    });
  }
  return dates;
}

export default function CalendarPage() {
  const [calendarDates, setCalendarDates] = React.useState(() => generateDates(new Date(), 7));
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [reservations, setReservations] = React.useState<ReservationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newResOpen, setNewResOpen] = React.useState(false);

  const fetchCalendar = React.useCallback(async () => {
    try {
      const startDate = calendarDates[0]?.full || new Date().toISOString().split('T')[0];
      const endDate = calendarDates[calendarDates.length - 1]?.full || new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/calendar?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        if (data.rooms) setRooms(data.rooms);
        if (data.reservations) {
          const mapped: ReservationItem[] = data.reservations.map((r: any) => ({
            id: r.id,
            reference: r.reference,
            guestName: r.guestName || 'Unnamed Guest',
            guestEmail: '',
            guestPhone: '',
            roomType: '',
            roomNumber: '',
            roomId: r.roomId,
            checkInDate: r.checkInDate,
            checkOutDate: r.checkOutDate,
            nights: 1,
            numGuests: 1,
            source: r.source || 'direct',
            status: r.status,
            paymentStatus: r.paymentStatus,
            totalAmountMinorUnits: 0,
            paidAmountMinorUnits: 0,
            timeline: [],
          }));
          setReservations(mapped);
        }
      }
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setLoading(false);
    }
  }, [calendarDates]);

  React.useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

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
                {calendarDates.map((d) => (
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
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={calendarDates.length + 1} className="p-8 text-center text-[#7A7267]">
                    {loading ? 'Loading rooms from PostgreSQL...' : 'No rooms configured yet. Onboard rooms in Settings or Rooms tab.'}
                  </td>
                </tr>
              ) : (
                rooms.map((room) => {
                  const res = reservations.find((r) => (r as any).roomId === room.id || r.roomNumber === room.roomNumber);

                  return (
                    <tr key={room.id} className="hover:bg-[#FAFAFA] transition-colors">
                      {/* Room title */}
                      <td className="p-3 border-r border-[#E8E2DA] bg-[#FAFAFA]/50">
                        <strong className="block text-sm font-serif text-[#191816]">
                          Room {room.roomNumber}
                        </strong>
                        <span className="text-[11px] text-[#7A7267]">
                          {room.roomTypeName}
                        </span>
                      </td>

                      {/* Timeline columns */}
                      {calendarDates.map((dateObj) => {
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
              }))}
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
