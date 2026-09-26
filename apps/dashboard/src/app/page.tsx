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

export default function OverviewPage() {
  const toast = useToast();
  const workspace = useWorkspace();
  const [reservations, setReservations] = React.useState<ReservationItem[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [timezone, setTimezone] = React.useState('Africa/Lagos');
  const [loading, setLoading] = React.useState(true);
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF4ED] to-[#F5ECE0] border border-[#E8DACB] p-6 sm:p-8 shadow-xs">
          {/* Subtle Ambient Decorative Glow */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-gradient-to-br from-[#B85C3E]/10 to-[#71382D]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-white/90 text-[#71382D] border border-[#E5DACD] shadow-2xs">
                  <Clock className="w-3 h-3 text-[#B85C3E]" />
                  {currentDateStr || 'Today'} &middot; Run of House
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Front Desk Operational
                </span>
                <a
                  href={directWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-white text-[#71382D] hover:bg-[#FAF4EF] border border-[#E8DACB] transition-colors shadow-2xs"
                  title="Visit live public website"
                >
                  <Globe className="w-3 h-3 text-[#B85C3E]" />
                  {propertySlug}.sena.ng
                  <ExternalLink className="w-2.5 h-2.5 text-[#A8583B]" />
                </a>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-[#191816] font-normal tracking-tight">
                Good day,{' '}
                {userName
                  ? userName.split(' ')[0]
                  : <span className="inline-block w-20 h-4 bg-[#E8E2DA] rounded animate-pulse align-middle" />}
              </h1>
              <p className="text-xs sm:text-sm text-[#7A7267] max-w-2xl leading-relaxed">
                Here is today's overview for{' '}
                <strong className="text-[#71382D] font-semibold">
                  {propertyName || <span className="inline-block w-32 h-3.5 bg-[#E8E2DA] rounded animate-pulse align-middle" />}
                </strong>
                . Review arrivals, room availability, and outstanding tasks.
              </p>
            </div>

            {/* Quick Action Ribbon */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setNewResOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-all hover:shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Reservation</span>
              </button>

              <Link
                href="/front-desk"
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-stone-50 border border-[#D5CFC7] text-xs font-medium text-[#191816] transition-all shadow-2xs"
              >
                <DoorOpen className="w-4 h-4 text-[#B85C3E]" />
                <span>Front desk</span>
              </Link>

              <Link
                href="/invoices"
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-stone-50 border border-[#D5CFC7] text-xs font-medium text-[#191816] transition-all shadow-2xs"
              >
                <FileText className="w-4 h-4 text-[#3B66A8]" />
                <span>Invoices</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 5 Distinct Colorful Operational KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Live Occupancy */}
          <div className="relative overflow-hidden bg-[#FAF8F5] border border-[#E8DACB] hover:border-[#C86D51] hover:bg-white transition-all rounded-2xl p-5 shadow-xs hover:shadow-md group">
            <div className="h-1 bg-gradient-to-r from-[#B85C3E] to-[#71382D] absolute top-0 left-0 right-0" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#A8583B] font-semibold">
                Live Occupancy
              </span>
              <div className="w-8 h-8 rounded-lg bg-white border border-[#E8DACB]/60 text-[#71382D] flex items-center justify-center shadow-2xs">
                <BedDouble className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-serif text-[#71382D] font-normal">
                {occupancyRate}%
              </span>
              <span className="text-xs text-[#7A7267]">
                ({occupiedCount}/{rooms.length} rooms)
              </span>
            </div>
            {/* Visual occupancy bar */}
            <div className="mt-3 w-full bg-white border border-[#E8DACB]/60 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#B85C3E] to-[#71382D] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(occupancyRate, 3)}%` }}
              />
            </div>
            <span className="text-[11px] text-[#8C6D58] block mt-2.5">
              {readyRooms.length} rooms available tonight
            </span>
          </div>

          {/* 2. Arrivals Today */}
          <Link
            href="/front-desk"
            className="relative overflow-hidden bg-[#FAF8F5] border border-[#E8DACB] hover:border-amber-400 hover:bg-white transition-all rounded-2xl p-5 shadow-xs hover:shadow-md group block"
          >
            <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-600 absolute top-0 left-0 right-0" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#9E6E17] font-semibold group-hover:text-amber-800 transition-colors">
                Arrivals Today
              </span>
              <div className="w-8 h-8 rounded-lg bg-white border border-amber-200/60 text-amber-800 flex items-center justify-center shadow-2xs">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-serif text-[#191816] font-normal group-hover:text-[#71382D] transition-colors">
                {arrivals.length}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-amber-800 border border-amber-200/80 font-medium">
                {inHouse.length} in-house
              </span>
            </div>
            <span className="text-[11px] text-[#7A7267] block mt-4">
              Scheduled check-ins for today
            </span>
          </Link>

          {/* 3. Departures */}
          <Link
            href="/front-desk"
            className="relative overflow-hidden bg-[#FAF8F5] border border-[#E8DACB] hover:border-sky-400 hover:bg-white transition-all rounded-2xl p-5 shadow-xs hover:shadow-md group block"
          >
            <div className="h-1 bg-gradient-to-r from-sky-400 to-blue-600 absolute top-0 left-0 right-0" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#3B66A8] font-semibold group-hover:text-blue-800 transition-colors">
                Departures
              </span>
              <div className="w-8 h-8 rounded-lg bg-white border border-sky-200/60 text-sky-800 flex items-center justify-center shadow-2xs">
                <LogOut className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-serif text-[#191816] font-normal group-hover:text-[#71382D] transition-colors">
                {departures.length}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-sky-800 border border-sky-200/80 font-medium">
                Checkout {workspace?.property.checkOutTime || '—'}
              </span>
            </div>
            <span className="text-[11px] text-[#7A7267] block mt-4">
              Expected room releases today
            </span>
          </Link>

          {/* 4. Housekeeping */}
          <Link
            href="/housekeeping"
            className="relative overflow-hidden bg-[#FAF8F5] border border-[#E8DACB] hover:border-[#71382D] hover:bg-white transition-all rounded-2xl p-5 shadow-xs hover:shadow-md group block"
          >
            <div className="h-1 bg-gradient-to-r from-[#8C7A6B] to-[#71382D] absolute top-0 left-0 right-0" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#7A7267] font-semibold group-hover:text-[#71382D] transition-colors">
                Housekeeping
              </span>
              <div className="w-8 h-8 rounded-lg bg-white border border-[#E8DACB]/60 text-[#71382D] flex items-center justify-center shadow-2xs">
                <Brush className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-serif text-[#191816] font-normal group-hover:text-[#71382D] transition-colors">
                {dirtyRooms.length}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-[#5C564D] border border-[#E8DFD5] font-medium font-mono">
                {cleanRooms.length} clean &amp; ready
              </span>
            </div>
            <span className="text-[11px] text-[#7A7267] block mt-4">
              {dirtyRooms.length === 0 ? 'All rooms inspected & clean' : 'Rooms awaiting turnover'}
            </span>
          </Link>

          {/* 5. Recorded Payments */}
          <Link
            href="/payments"
            className="relative overflow-hidden bg-[#FAF8F5] border border-[#E8DACB] hover:border-emerald-400 hover:bg-white transition-all rounded-2xl p-5 shadow-xs hover:shadow-md group block"
          >
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 absolute top-0 left-0 right-0" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#1F7A46] font-semibold group-hover:text-emerald-900 transition-colors">
                Recorded Payments
              </span>
              <div className="w-8 h-8 rounded-lg bg-white border border-emerald-200/60 text-emerald-800 flex items-center justify-center shadow-2xs">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-serif text-[#166534] font-normal group-hover:text-emerald-800 transition-colors">
                {formatNaira(monthRevenueMinorUnits)}
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 font-medium block mt-4">
              0% Sena commission kept
            </span>
          </Link>
        </div>

        {/* Live Room Key Rack / Real Inventory Strip */}
        {rooms.length > 0 && (
          <div className="bg-[#FAF8F5] border border-[#E8DACB] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8DACB]/80 pb-3">
              <div>
                <h3 className="font-serif text-base text-[#191816] font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#71382D]" />
                  Live Room Rack &amp; Inventory Status
                </h3>
                <p className="text-xs text-[#7A7267] mt-0.5">
                  Real-time status of all {rooms.length} rooms configured at {propertyName}.
                </p>
              </div>

              <Link
                href="/rooms"
                className="text-xs text-[#71382D] hover:text-[#B85C3E] font-medium inline-flex items-center gap-1 self-start sm:self-auto"
              >
                <span>Manage Inventory &rarr;</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {rooms.map((rm) => {
                const isOccupied = rm.operational === 'occupied' || rm.operationalStatus === 'occupied';
                const isDirty = rm.housekeeping === 'dirty' || rm.housekeepingStatus === 'dirty';
                const isClean = !isDirty;

                return (
                  <div
                    key={rm.id}
                    className="p-3.5 rounded-xl border border-[#E8DFD5] bg-white hover:border-[#71382D]/40 hover:shadow-xs transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[#191816]">
                          Room {rm.roomNumber || rm.number}
                        </span>
                        <span className="text-xs text-[#7A7267]">
                          &middot; {rm.roomType?.name || rm.roomTypeName || 'Suite'}
                        </span>
                      </div>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isOccupied
                            ? 'bg-amber-500 ring-4 ring-amber-100'
                            : isDirty
                            ? 'bg-rose-500 ring-4 ring-rose-100'
                            : 'bg-emerald-500 ring-4 ring-emerald-100'
                        }`}
                        title={isOccupied ? 'Occupied' : isDirty ? 'Needs Cleaning' : 'Clean & Available'}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E8DFD5]/60">
                      <span className="text-[11px] text-[#7A7267] font-mono">
                        {rm.roomType?.bedType || rm.bedType || ''}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${
                          isOccupied
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : isDirty
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isOccupied ? 'Occupied' : isDirty ? 'Awaiting Clean' : 'Clean & Available'}
                      </span>
                    </div>
                  </div>
                );
              })}
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
