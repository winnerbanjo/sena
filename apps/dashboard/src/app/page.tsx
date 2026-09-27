'use client';
import { findReadyRoom } from '../components/reservation-room';

import { useWorkspace } from '../components/workspace-access';
import * as React from 'react';
import Link from 'next/link';
import { formatStayDates, formatNaira } from '@sena/config';
import {
  BedDouble,
  KeyRound,
  LogOut,
  Brush,
  TrendingUp,
  Plus,
  Globe,
  Calendar,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  Building2,
  FileText,
  CreditCard,
  DoorOpen,
  ShieldCheck,
  ArrowUpRight,
  Zap,
} from 'lucide-react';
import {
  type ReservationItem,
} from '../components/mock-data';
import { NewReservationDialog } from '../components/new-reservation-dialog';
import { useToast } from '../components/toast-notification';
import { ReservationSuccessModal } from '../components/reservation-success-modal';
import { OccupancyChart } from '../components/occupancy-chart';
import { ReservationDrawer } from '../components/reservation-drawer';
import { Topbar } from '../components/topbar';
import { useDialogA11y } from '../components/use-dialog-a11y';

export default function OverviewPage() {
  const toast = useToast();
  const workspace = useWorkspace();
  const [reservations, setReservations] = React.useState<ReservationItem[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [timezone, setTimezone] = React.useState('Africa/Lagos');
  const [loading, setLoading] = React.useState(true);
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [selectedRoom, setSelectedRoom] = React.useState<any>(null);
  const roomDialogRef = useDialogA11y(Boolean(selectedRoom), () => setSelectedRoom(null));
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [successReservation, setSuccessReservation] = React.useState<ReservationItem | null>(null);
  const [currentDateStr, setCurrentDateStr] = React.useState('');
  const [userName, setUserName] = React.useState('');
  const [propertyName, setPropertyName] = React.useState('');
  const [propertySlug, setPropertySlug] = React.useState('');

  React.useEffect(() => {
    if (!workspace) return;
    setUserName(workspace.user.name);
    setPropertyName(workspace.property.name);
    setPropertySlug(workspace.property.slug || '');
    setTimezone(workspace.property.timezone);
  }, [workspace]);

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
    setLoadError(false);
    try {
      const [resRes, roomRes] = await Promise.all([
        fetch('/api/reservations'),
        fetch('/api/rooms'),
      ]);

      if (!resRes.ok || !roomRes.ok) throw new Error('Could not load overview');
      if (resRes.ok) {
        const data = await resRes.json();
        if (data.reservations) {
          const mapped: ReservationItem[] = data.reservations.map((r: any) => ({
            id: r.id,
            reference: r.reference,
            guestName: r.guestName || 'Unnamed Guest',
            guestEmail: r.guestEmail || '',
            guestPhone: r.guestPhone || '',
            roomType: r.roomTypeName || 'Room type unavailable',
            roomTypeId: r.roomTypeId,
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
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check In handler
  async function handleCheckIn(id: string) {
    try {
      const availableRoom = findReadyRoom(rooms, reservations.find(reservation => reservation.id === id));
      if (!availableRoom) {
        toast.error('No clean rooms available', 'Please assign or clean a room before checking in.');
        return;
      }
      const res = await fetch(`/api/reservations/${id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: availableRoom.id }),
      });
      if (res.ok) {
        toast.success('Guest Checked In', `Room ${availableRoom.number || availableRoom.roomNumber} assigned successfully.`);
        fetchData();
        if (selectedRes && selectedRes.id === id) {
          setSelectedRes((prev) => prev ? { ...prev, status: 'checked_in' } : null);
        }
      }
    } catch (e: any) {
      toast.error('Check-in Error', e.message || 'Check in failed');
    }
  }

  // Check Out handler
  async function handleCheckOut(id: string) {
    try {
      const res = await fetch(`/api/reservations/${id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (res.ok) {
        toast.success('Guest Checked Out', 'Reservation marked completed.');
        fetchData();
        if (selectedRes && selectedRes.id === id) {
          setSelectedRes((prev) => prev ? { ...prev, status: 'checked_out' } : null);
        }
      }
    } catch (e: any) {
      toast.error('Check-out Error', e.message || 'Check out failed');
    }
  }

  function handleCreateReservation(newRes: ReservationItem) {
    setReservations((prev) => [newRes, ...prev]);
    fetchData();
    setSuccessReservation(newRes);
  }

  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const arrivals = reservations.filter((r) => r.status === 'confirmed' && r.checkInDate === todayIso);
  const inHouse = reservations.filter((r) => r.status === 'checked_in');
  const departures = inHouse.filter((r) => r.checkOutDate === todayIso);
  const dirtyRooms = rooms.filter((r) => r.housekeeping === 'dirty' || r.housekeepingStatus === 'dirty');
  const cleanRooms = rooms.filter((room) => ['clean', 'inspected'].includes(room.housekeepingStatus || room.housekeeping));
  const readyRooms = cleanRooms.filter((room) => (room.operationalStatus || room.operational) === 'available');
  const occupiedCount = rooms.filter((r) => r.operational === 'occupied' || r.operationalStatus === 'occupied').length;
  const totalRoomsCount = rooms.length || 1;
  const occupancyRate = rooms.length > 0 ? Math.round((occupiedCount / totalRoomsCount) * 100) : 0;
  const monthRevenueMinorUnits = reservations.reduce((acc, curr) => acc + (curr.paidAmountMinorUnits || 0), 0);

  const directWebsiteUrl = propertySlug ? `https://${propertySlug}.sena.ng` : '/website';

  if (loading || loadError) return <div className="flex-1 flex flex-col"><Topbar title="Overview" /><main className="p-6 space-y-4" aria-live="polite">{loadError ? <><h2 className="text-xl font-serif">We could not load your overview</h2><p>Check your connection and try again.</p><button onClick={fetchData} className="min-h-11 px-4 rounded bg-[#71382D] text-white">Try again</button></> : <><span className="sr-only">Loading your overview</span><div className="h-40 bg-[#F7F1E8] rounded-xl animate-pulse" /><div className="h-64 bg-[#F7F1E8] rounded-xl animate-pulse" /></>}</main></div>;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white text-[#191816]">
      <Topbar
        title="Overview"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 space-y-8 max-w-7xl w-full mx-auto">
        {/* Warm Executive Hospitality Briefing Banner */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-sm text-[#7A7267]">{currentDateStr || 'Today'} · {propertyName}</p>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#191816]">
              Good day, {userName ? userName.split(' ')[0] : 'there'}
            </h1>
            <p className="text-sm text-[#5C564D]">{arrivals.length} arrivals · {departures.length} departures · {dirtyRooms.length} rooms need attention</p>
          </div>
          <div className="flex items-center gap-3">
            <a href={directWebsiteUrl} className="text-sm text-[#5C564D] underline">{propertySlug ? `${propertySlug}.sena.ng` : 'Website'}</a>
            <button type="button" onClick={() => setNewResOpen(true)} className="px-4 py-2.5 rounded-md bg-[#71382D] text-white text-sm">New reservation</button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 border-y border-[#E8E2DA] py-6">
          <Link href="/rooms" className="space-y-1">
            <p className="text-sm text-[#7A7267]">Occupancy</p>
            <p className="font-serif text-3xl">{occupancyRate}%</p>
            <p className="text-sm text-[#5C564D]">{occupiedCount} of {rooms.length} rooms</p>
          </Link>
          <Link href="/front-desk" className="space-y-1">
            <p className="text-sm text-[#7A7267]">Arrivals</p>
            <p className="font-serif text-3xl">{arrivals.length}</p>
            <p className="text-sm text-[#5C564D]">Today</p>
          </Link>
          <Link href="/front-desk" className="space-y-1">
            <p className="text-sm text-[#7A7267]">Departures</p>
            <p className="font-serif text-3xl">{departures.length}</p>
            <p className="text-sm text-[#5C564D]">Today</p>
          </Link>
          <Link href="/housekeeping" className="space-y-1">
            <p className="text-sm text-[#7A7267]">Housekeeping</p>
            <p className="font-serif text-3xl">{dirtyRooms.length}</p>
            <p className="text-sm text-[#5C564D]">{dirtyRooms.length === 0 ? 'No rooms waiting' : 'Rooms waiting'}</p>
          </Link>
          <Link href="/payments" className="space-y-1">
            <p className="text-sm text-[#7A7267]">Payments</p>
            <p className="font-serif text-3xl">{formatNaira(monthRevenueMinorUnits)}</p>
            <p className="text-sm text-[#5C564D]">Recorded</p>
          </Link>
        </div>

        {/* Live Room Key Rack / Real Inventory Strip */}
        {rooms.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-xl">Rooms</h2>
              <Link href="/rooms" className="text-sm text-[#5C564D]">All rooms</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {rooms.map((rm) => {
                const occupied = rm.operational === 'occupied' || rm.operationalStatus === 'occupied';
                const dirty = rm.housekeeping === 'dirty' || rm.housekeepingStatus === 'dirty';
                const state = occupied ? 'Occupied' : dirty ? 'Needs cleaning' : 'Available';
                return (
                  <button key={rm.id} type="button" onClick={() => setSelectedRoom(rm)} className="text-left p-3 rounded-md hover:bg-[#FAF7F2]">
                    <p className="font-serif text-lg">{rm.roomNumber || rm.number}</p>
                    <p className="text-sm text-[#5C564D]">{rm.roomType?.name || rm.roomTypeName || 'Room'}</p>
                    <p className="text-sm text-[#7A7267]">{state}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        {selectedRoom && (
          <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
            <button className="flex-1" aria-label="Close room" onClick={() => setSelectedRoom(null)} />
            <div ref={roomDialogRef} role="dialog" aria-modal="true" aria-labelledby="room-dialog-title" className="w-full max-w-sm bg-white h-full p-6 space-y-3 overflow-y-auto">
              <h2 id="room-dialog-title" className="font-serif text-2xl">Room {selectedRoom.roomNumber || selectedRoom.number}</h2>
              <p>{selectedRoom.roomType?.name || selectedRoom.roomTypeName || 'Room'}</p>
              <p className="text-sm text-[#5C564D]">Housekeeping: {selectedRoom.housekeepingStatus || selectedRoom.housekeeping || 'Unknown'}</p>
              <button type="button" className="min-h-11 text-sm underline" onClick={() => setSelectedRoom(null)}>Close</button>
            </div>
          </div>
        )}

        {/* Occupancy Velocity Rhythm */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#8C8275] font-semibold">
              7-Day Booking Overview
            </span>
            <Link href="/calendar" className="text-[#71382D] hover:text-[#B85C3E] font-medium transition-colors inline-flex items-center gap-1">
              <span>Open 30-day calendar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <OccupancyChart reservations={reservations} rooms={rooms} />
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
              <div className="py-12 px-6 rounded-2xl border border-[#E8DACB] text-center space-y-3 bg-gradient-to-br from-[#FFFDF9] to-[#FAF4ED] shadow-xs">
                <div className="w-12 h-12 rounded-full bg-[#FAF0E6] text-[#71382D] mx-auto flex items-center justify-center border border-[#E8D5C2]">
                  <CheckCircle2 className="w-6 h-6 text-[#2E6B4F]" />
                </div>
                <h4 className="text-base font-serif text-[#191816]">Front Desk is Clear</h4>
                <p className="text-xs text-[#7A7267] max-w-sm mx-auto leading-relaxed">
                  All expected guest stays for today are either checked in or awaiting direct booking engine reservations.
                </p>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <Link
                    href="/front-desk"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-[#D5CFC7] text-xs font-medium text-[#191816] hover:bg-stone-50 transition-colors shadow-2xs"
                  >
                    <span>View Front desk</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#B85C3E]" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="border border-[#E8DACB] rounded-2xl overflow-hidden divide-y divide-[#E8DACB] bg-[#FAF8F5] shadow-xs">
                {arrivals.map((res) => {
                  const isPaid = res.paymentStatus === 'paid';
                  return (
                    <div
                      key={res.id}
                      onClick={() => {
                        setSelectedRes(res);
                        setDrawerOpen(true);
                      }}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#FAF0E6] text-[#71382D] border border-[#E8D5C2] flex items-center justify-center font-serif text-sm font-semibold flex-shrink-0 shadow-2xs">
                          {res.guestName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-base text-[#191816] group-hover:text-[#B85C3E] transition-colors truncate font-medium">
                              {res.guestName}
                            </span>
                            <span className="text-[11px] font-mono text-[#8C8275] bg-stone-100 px-2 py-0.5 rounded">
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
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {isPaid ? 'Settled' : 'Pay at Desk'}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckIn(res.id);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-colors"
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
            <div className="bg-[#FAF8F5] rounded-2xl border border-[#E8DACB] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#E8DACB]/80 pb-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#71382D] font-semibold flex items-center gap-1.5">
                  <Brush className="w-3.5 h-3.5 text-[#B85C3E]" />
                  Housekeeping Status
                </span>
                <Link href="/housekeeping" className="text-xs text-[#71382D] hover:text-[#B85C3E] font-medium">
                  Roster &rarr;
                </Link>
              </div>

              {/* Segmented visual health bar */}
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden flex gap-0.5">
                <div
                  className="bg-emerald-500 h-full rounded-l-full transition-all"
                  style={{ width: `${Math.round(((cleanRooms.length) / (rooms.length || 1)) * 100)}%` }}
                  title="Clean Rooms"
                />
                <div
                  className="bg-rose-500 h-full rounded-r-full transition-all"
                  style={{ width: `${Math.round((dirtyRooms.length / (rooms.length || 1)) * 100)}%` }}
                  title="Dirty Rooms"
                />
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-stone-100">
                  <span className="text-[#5C564D] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Clean &amp; Inspected Rooms
                  </span>
                  <strong className="font-mono text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {cleanRooms.length}
                  </strong>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-stone-100">
                  <span className="text-[#5C564D] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Rooms Awaiting Clean
                  </span>
                  <strong className="font-mono text-rose-800 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {dirtyRooms.length}
                  </strong>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#5C564D]">Expected Next Turnaround</span>
                  <span className="text-[#7A7267] font-mono">{workspace?.property.checkInTime || '—'} Check-in</span>
                </div>
              </div>
            </div>

            {/* Direct Booking Engine Highlight */}
            <div className="rounded-2xl border border-[#E8DACB] p-6 space-y-3.5 bg-gradient-to-br from-[#FFFDF9] via-[#FAF5EE] to-[#F7EFE4] shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#A8583B] font-semibold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#B85C3E]" />
                  Direct Booking Engine
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Zero Commission
                </span>
              </div>
              <h3 className="text-base font-serif text-[#191816]">
                Share {propertySlug}.sena.ng
              </h3>
              <p className="text-xs text-[#7A7267] leading-relaxed">
                Add your direct link to your Instagram bio, WhatsApp business auto-responder, and Google Business Profile to capture guests with instant confirmation.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <a
                  href={directWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-2 px-3 rounded-xl bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <span>Open Website</span>
                  <ExternalLink className="w-3 h-3 text-[#E8DACB]" />
                </a>
                <Link
                  href="/website"
                  className="py-2 px-3 rounded-xl bg-white hover:bg-stone-50 border border-[#D5CFC7] text-xs font-medium text-[#191816] transition-colors shadow-2xs"
                >
                  Edit CMS
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

      {/* Customer-Facing In-App Confirmation Modal */}
      <ReservationSuccessModal
        reservation={successReservation}
        open={!!successReservation}
        onClose={() => setSuccessReservation(null)}
      />
    </div>
  );
}
