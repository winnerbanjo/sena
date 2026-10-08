'use client';
import { pageMain } from '../../components/design';
import { useTranslations } from 'next-intl';

import { PageLoadState } from '../../components/page-load-state';
import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../../components/toast-notification';
import { CalendarMonthYearPicker } from '../../components/calendar-month-year-picker';
import { type ReservationItem } from '../../components/mock-data';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { ReservationDrawer } from '../../components/reservation-drawer';
import { CheckInRoomDialog, type RoomAssignmentMode } from '../../components/check-in-room-dialog';
import { NoteCount } from '../../components/reservation-notes';
import { Topbar } from '../../components/topbar';

function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateDates(baseDate = new Date(), numDays = 7) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dates = [];
  const todayStr = formatDateKey(new Date());

  for (let i = 0; i < numDays; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i, 12, 0, 0);
    const full = formatDateKey(d);
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
  const t = useTranslations('calendar');
  const tNav = useTranslations('navigation');
  const toast = useToast();
  const [baseDate, setBaseDate] = React.useState(new Date());
  const [calendarDates, setCalendarDates] = React.useState(() => generateDates(new Date(), 7));
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [reservations, setReservations] = React.useState<ReservationItem[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [assignment, setAssignment] = React.useState<{ reservation: ReservationItem; mode: RoomAssignmentMode } | null>(null);

  const handlePrevWeek = () => {
    setBaseDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7, 12, 0, 0);
      setCalendarDates(generateDates(next, 7));
      return next;
    });
  };

  const handleNextWeek = () => {
    setBaseDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7, 12, 0, 0);
      setCalendarDates(generateDates(next, 7));
      return next;
    });
  };

  const handleToday = () => {
    const today = new Date();
    setBaseDate(today);
    setCalendarDates(generateDates(today, 7));
  };

  const handleJumpToMonth = (month: number, year: number) => {
    const next = new Date(year, month, 1, 12, 0, 0);
    setBaseDate(next);
    setCalendarDates(generateDates(next, 7));
  };

  const fetchCalendar = React.useCallback(async () => {
    try {
      const startDate = calendarDates[0]?.full || formatDateKey(new Date());
      const endDate = calendarDates[calendarDates.length - 1]?.full || formatDateKey(new Date());
      const res = await fetch(`/api/calendar?startDate=${startDate}&endDate=${endDate}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error('Page unavailable');
      if (res.ok) {
        const data = await res.json();
        if (data.rooms) setRooms(data.rooms);
        if (data.reservations) {
          const mapped: ReservationItem[] = data.reservations.map((r: any) => ({
            id: r.id,
            reference: r.reference,
            bookingGroupId: r.bookingGroupId || null,
            guestName: r.guestName || 'Unnamed Guest',
            guestEmail: '',
            guestPhone: '',
            roomType: r.roomTypeName || '',
            roomNumber: r.roomNumber || '',
            roomId: r.roomId,
            apartmentId: r.apartmentId,
            apartmentName: r.apartmentName,
            checkInDate: r.checkInDate,
            checkOutDate: r.checkOutDate,
            nights: Math.max(1, Math.round((Date.parse(r.checkOutDate) - Date.parse(r.checkInDate)) / 86400000)),
            numGuests: 1,
            source: r.source || 'direct',
            status: r.status,
            paymentStatus: r.paymentStatus,
            noteCount: r.noteCount || 0,
            totalAmountMinorUnits: r.totalAmountMinorUnits || 0,
            paidAmountMinorUnits: r.paidAmountMinorUnits || 0,
            timeline: [],
          }));
          setReservations(mapped);
        }
      }
    } catch (err) {
      setLoadError(true);
      console.error('Failed to load calendar data:', err);
    } finally {
      setLoading(false);
    }
  }, [calendarDates]);

  React.useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  if (loading || loadError) return <PageLoadState title={t('title')} failed={loadError} />;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title={t('title')}
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className={pageMain}>
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <CalendarMonthYearPicker
              month={baseDate.getMonth()}
              year={baseDate.getFullYear()}
              onSelect={handleJumpToMonth}
            />
            <div className="flex items-center gap-1 border border-[#E8E2DA] rounded bg-white p-0.5">
              <button
                type="button"
                onClick={handlePrevWeek}
                className="p-1 hover:bg-[#FAF7F2] rounded text-[#7A7267] transition-colors"
                title="Previous 7 days"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-2 py-0.5 text-xs font-semibold text-[#191816] hover:bg-[#FAF7F2] rounded transition-colors"
              >
                {t('today')}
              </button>
              <button
                type="button"
                onClick={handleNextWeek}
                className="p-1 hover:bg-[#FAF7F2] rounded text-[#7A7267] transition-colors"
                title="Next 7 days"
              >
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
              <span className="w-2.5 h-2.5 rounded-sm bg-[#FAF7F2] border border-[#E8E2DA]" />
              Available
            </span>
          </div>
        </div>

        {/* Master Calendar Matrix */}
        <div className="bg-white border border-[#E8E2DA] rounded-md overflow-x-auto shadow-none">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-[#E8E2DA] bg-[#FAFAFA] text-xs">
                <th className="p-3 text-left font-semibold text-[#7A7267] w-48 border-r border-[#E8E2DA]">
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
                    <strong className="text-sm block font-medium">{d.date}</strong>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2DA] text-xs">
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={calendarDates.length + 1} className="p-8 text-center text-[#7A7267]">
                    {loading ? 'Loading rooms...' : 'No rooms configured yet. Onboard rooms in Settings or Rooms tab.'}
                  </td>
                </tr>
              ) : (
                rooms.map((room, index) => {
                  const previous = rooms[index - 1];
                  const showGroup = room.group && room.group !== previous?.group && rooms.some((row) => row.group === 'apartments') && rooms.some((row) => row.group === 'rooms');

                  const roomReservations = reservations.filter((r) =>
                    room.kind === 'apartment'
                      ? (r as any).apartmentId === room.id
                      : ((r as any).roomId === room.id || (r.roomNumber && r.roomNumber === room.roomNumber))
                  );

                  // Render row cells for visible 7-day range
                  const cells: React.ReactNode[] = [];
                  let colIdx = 0;

                  while (colIdx < calendarDates.length) {
                    const dateObj = calendarDates[colIdx];
                    const dateKey = dateObj.full;

                    // Find reservation occupying this night
                    const activeRes = roomReservations.find(
                      (r) => r.checkInDate <= dateKey && dateKey < r.checkOutDate
                    );

                    if (activeRes) {
                      let span = 1;
                      while (
                        colIdx + span < calendarDates.length &&
                        calendarDates[colIdx + span].full < activeRes.checkOutDate
                      ) {
                        span++;
                      }

                      const isContinuingStay = activeRes.checkInDate < calendarDates[0].full;
                      const isCheckedIn = activeRes.status === 'checked_in';

                      cells.push(
                        <td
                          key={dateKey}
                          colSpan={span}
                          onClick={() => {
                            setSelectedRes(activeRes);
                            setDrawerOpen(true);
                          }}
                          className="p-1 border-r border-[#E8E2DA] cursor-pointer"
                        >
                          <div
                            className={`h-10 px-3 rounded-md flex items-center justify-between text-xs text-white shadow-xs transition-transform active:scale-[0.99] hover:brightness-105 ${
                              isCheckedIn
                                ? 'bg-[#71382D]'
                                : 'bg-[#B85C3E]'
                            }`}
                          >
                            <div className="truncate flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                              <strong className="tracking-tight font-medium text-xs truncate max-w-[120px] sm:max-w-[160px]">
                                {activeRes.guestName}
                              </strong>
                              <span className="opacity-75 text-[10px] font-semibold hidden sm:inline">
                                · {activeRes.nights} {activeRes.nights === 1 ? 'nt' : 'nts'}
                              </span>
                              {isContinuingStay && (
                                <span className="opacity-75 text-[10px] font-mono hidden md:inline">
                                  (staying)
                                </span>
                              )}
                              <NoteCount count={activeRes.noteCount} className="inline-flex items-center gap-0.5 text-[10px] text-white/90" />
                            </div>
                            <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-black/25 text-white/90 shrink-0">
                              {isCheckedIn ? 'Checked in' : activeRes.paymentStatus === 'paid' ? 'Settled' : 'Confirmed'}
                            </span>
                          </div>
                        </td>
                      );

                      colIdx += span;
                    } else {
                      const isWeekend = dateObj.day === 'SAT' || dateObj.day === 'SUN';
                      cells.push(
                        <td
                          key={dateKey}
                          onClick={() => setNewResOpen(true)}
                          className={`p-2 text-center border-r border-[#E8E2DA] hover:bg-[#FAF0E4]/40 cursor-pointer group transition-colors ${
                            dateObj.isToday
                              ? 'bg-[#FAF0E4]/30'
                              : isWeekend
                              ? 'bg-[#FAF7F2]/40'
                              : ''
                          }`}
                        >
                          <span className="opacity-0 group-hover:opacity-100 text-[11px] text-[#B85C3E] font-medium transition-opacity">
                            + book
                          </span>
                        </td>
                      );
                      colIdx += 1;
                    }
                  }

                  return (
                    <React.Fragment key={room.id}>
                    {showGroup ? (
                      <tr>
                        <td colSpan={calendarDates.length + 1} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#7A7267] bg-[#F4EFE8]">
                          {room.group === 'apartments' ? tNav('apartments') : tNav('rooms')}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="hover:bg-[#FAF7F2]/40 transition-colors">
                      <td className="p-3 border-r border-[#E8E2DA] bg-[#FAF9F6]">
                        <div className="flex items-baseline justify-between">
                          <strong className="text-sm text-[#191816] font-semibold">
                            {room.kind === 'apartment' ? room.roomNumber : `Room ${room.roomNumber}`}
                          </strong>
                          {room.kind === 'apartment' ? null : (
                            <span className="text-[10px] font-mono text-[#7A7267] uppercase">
                              {room.floor || 'FL 1'}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#7A7267] block truncate">
                          {room.roomTypeName || 'Deluxe'}
                        </span>
                      </td>

                      {/* Timeline columns */}
                      {cells}
                    </tr>
                    </React.Fragment>
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
        onCheckIn={(id) => {
          const res = reservations.find((item) => item.id === id) || selectedRes;
          if (res) setAssignment({ reservation: res, mode: 'check-in' });
        }}
        onAssignRoom={(id) => {
          const res = reservations.find((item) => item.id === id) || selectedRes;
          if (res) setAssignment({ reservation: res, mode: res.roomId ? 'change' : 'assign' });
        }}
        onCheckOut={async (id) => {
          const reservation = reservations.find((item) => item.id === id) || selectedRes;
          const balance = reservation
            ? reservation.totalAmountMinorUnits - reservation.paidAmountMinorUnits
            : 0;
          try {
            const res = await fetch(`/api/reservations/${id}/check-out`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ force: balance > 0 }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              toast.success('Check-out Successful', 'Reservation marked as checked out');
              fetchCalendar();
              if (selectedRes && selectedRes.id === id) {
                setSelectedRes((prev) => (prev ? { ...prev, status: 'checked_out' } : null));
              }
            } else {
              toast.error('Check-out Failed', data.error || 'Check out failed');
            }
          } catch (e: any) {
            toast.error('Check-out Error', e.message || 'Check out failed');
          }
        }}
        onPaymentRecorded={() => fetchCalendar()}
        onNotesChanged={() => fetchCalendar()}
        onUpdated={(updated) => {
          setSelectedRes(updated);
          fetchCalendar();
        }}
      />

      <CheckInRoomDialog
        reservation={assignment?.reservation || null}
        mode={assignment?.mode || 'check-in'}
        open={!!assignment}
        onOpenChange={(open) => {
          if (!open) setAssignment(null);
        }}
        onCompleted={(update) => {
          fetchCalendar();
          setSelectedRes((prev) =>
            prev && assignment && prev.id === assignment.reservation.id
              ? { ...prev, roomId: update.roomId, roomNumber: update.roomNumber, status: update.status || prev.status }
              : prev
          );
        }}
        onFolioUpdated={() => {
          fetchCalendar();
        }}
      />

      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={() => {
          fetchCalendar();
        }}
      />
    </div>
  );
}
