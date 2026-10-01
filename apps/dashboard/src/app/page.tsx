'use client';
import { pageMain } from '../components/design';
import { useTranslations } from 'next-intl';
import { formatAssignedRoom, mapReservationItem } from '../components/reservation-room';
import { CheckInRoomDialog, type RoomAssignmentMode } from '../components/check-in-room-dialog';
import { DeskPaymentBadge } from '../components/check-in-payment-status';

import { useWorkspace } from '../components/workspace-access';
import { PageLoadState } from '../components/page-load-state';
import { classifyLoadFailure, type LoadFailureKind } from '../lib/page-load';
import * as React from 'react';
import Link from 'next/link';
import { formatStayDates } from '@sena/config';
import { Brush, ArrowRight, ArrowUpRight } from 'lucide-react';
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
import { OverviewRoomBoard } from '../components/overview-room-board';

export default function OverviewPage() {
  const t = useTranslations('overview');
  const toast = useToast();
  const workspace = useWorkspace();
  const [reservations, setReservations] = React.useState<ReservationItem[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [failureKind, setFailureKind] = React.useState<LoadFailureKind>('error');
  const [timezone, setTimezone] = React.useState('Africa/Lagos');
  const [loading, setLoading] = React.useState(true);
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [selectedRoom, setSelectedRoom] = React.useState<any>(null);
  const roomDialogRef = useDialogA11y(Boolean(selectedRoom), () => setSelectedRoom(null));
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [successReservation, setSuccessReservation] = React.useState<ReservationItem | null>(null);
  const [currentDateStr, setCurrentDateStr] = React.useState('');
  const [propertyName, setPropertyName] = React.useState('');
  const [propertySlug, setPropertySlug] = React.useState('');
  const [assignment, setAssignment] = React.useState<{
    reservation: ReservationItem;
    mode: RoomAssignmentMode;
  } | null>(null);

  React.useEffect(() => {
    if (!workspace) return;
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

      if (!resRes.ok || !roomRes.ok) {
        throw new Error(`Could not load overview (${!resRes.ok ? resRes.status : roomRes.status})`);
      }
      const data = await resRes.json();
      if (data.reservations) {
        const mapped: ReservationItem[] = data.reservations.map(mapReservationItem);
        setReservations(mapped);
      }

      const roomData = await roomRes.json();
      if (roomData.rooms) setRooms(roomData.rooms);
    } catch (error) {
      setFailureKind(classifyLoadFailure(error, typeof navigator === 'undefined' ? true : navigator.onLine));
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openAssignment(id: string, mode: RoomAssignmentMode) {
    const reservation = reservations.find((item) => item.id === id) || selectedRes;
    if (!reservation) return;
    setAssignment({ reservation, mode });
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
  const directWebsiteUrl = propertySlug ? `https://${propertySlug}.sena.ng` : '/website';
  const arrivalsText = arrivals.length === 1 ? '1 arrival today' : `${arrivals.length} arrivals today`;
  const departuresText = departures.length === 1 ? '1 departure' : `${departures.length} departures`;
  const roomsAttentionText = dirtyRooms.length === 0 ? 'No rooms need attention' : `${dirtyRooms.length} ${dirtyRooms.length === 1 ? 'room needs' : 'rooms need'} attention`;

  if (loading || loadError) return <PageLoadState title={t('title')} failed={loadError} failureKind={failureKind} retry={fetchData} />;

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden bg-[#FAF8F6] text-[#191816]">
      <Topbar
        title={t('title')}
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className={pageMain}>
        {/* Warm Executive Hospitality Briefing Banner */}
        <section aria-label="Overview briefing" className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-[#7A7267]">
              {currentDateStr || 'Today'}
              <span className="px-1.5 text-[#C4B8A5]">·</span>
              <span className="text-[#191816]">{propertyName}</span>
            </p>
            <h2 className="text-base font-medium text-[#191816]">
              {arrivalsText}
              <span className="px-1.5 font-normal text-[#C4B8A5]">·</span>
              <span className="font-normal">{departuresText}</span>
              <span className="px-1.5 font-normal text-[#C4B8A5]">·</span>
              <span className="font-normal">{roomsAttentionText}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={directWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-1.5 rounded border border-[#E8E2DA] bg-white px-3 text-[13px] font-medium text-[#191816] hover:bg-[#FAF8F6] sm:h-9"
            >
              View website
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[#E8E2DA] bg-[#E8E2DA] sm:grid-cols-3 lg:grid-cols-5">
          <Link href="/front-desk" className="space-y-1 bg-white p-4">
            <p className="text-xs text-[#7A7267]">Arrivals</p>
            <p className="text-2xl font-medium tabular-nums">{arrivals.length}</p>
            <p className="text-xs text-[#5C564D]">Today</p>
          </Link>
          <Link href="/front-desk" className="space-y-1 bg-white p-4">
            <p className="text-xs text-[#7A7267]">In house</p>
            <p className="text-2xl font-medium tabular-nums">{inHouse.length}</p>
            <p className="text-xs text-[#5C564D]">Checked in</p>
          </Link>
          <Link href="/front-desk" className="space-y-1 bg-white p-4">
            <p className="text-xs text-[#7A7267]">Departures</p>
            <p className="text-2xl font-medium tabular-nums">{departures.length}</p>
            <p className="text-xs text-[#5C564D]">Today</p>
          </Link>
          <Link href="/housekeeping" className="space-y-1 bg-white p-4">
            <p className="text-xs text-[#7A7267]">Needs cleaning</p>
            <p className="text-2xl font-medium tabular-nums">{dirtyRooms.length}</p>
            <p className="text-xs text-[#5C564D]">{readyRooms.length} ready</p>
          </Link>
          <Link href="/rooms" className="col-span-2 space-y-1 bg-white p-4 sm:col-span-1">
            <p className="text-xs text-[#7A7267]">Occupancy</p>
            <p className="text-2xl font-medium tabular-nums">{occupancyRate}%</p>
            <p className="text-xs text-[#5C564D]">{occupiedCount} of {rooms.length}</p>
          </Link>
        </div>

        {rooms.length > 0 && (
          <OverviewRoomBoard
            rooms={rooms}
            occupiedCount={occupiedCount}
            attentionCount={dirtyRooms.length}
            onSelectRoom={setSelectedRoom}
          />
        )}
        {selectedRoom && (
          <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
            <button className="flex-1" aria-label="Close room" onClick={() => setSelectedRoom(null)} />
            <div ref={roomDialogRef} role="dialog" aria-modal="true" aria-labelledby="room-dialog-title" className="w-full max-w-sm bg-white h-full p-6 space-y-3 overflow-y-auto">
              <h2 id="room-dialog-title" className="text-2xl font-semibold">Room {selectedRoom.roomNumber || selectedRoom.number}</h2>
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
                <h2 className="text-lg text-[#191816] font-semibold">
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
              <div className="rounded-md border border-dashed border-[#E8E2DA] px-6 py-10 text-center">
                <p className="text-sm font-medium text-[#191816]">No arrivals left today</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[#7A7267]">
                  Expected stays are checked in, or none are due.
                </p>
                <Link href="/front-desk" className="mt-4 inline-flex h-11 items-center text-sm font-medium text-[#71382D] underline-offset-4 hover:underline sm:h-9">
                  Open front desk
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#E8E2DA] overflow-hidden rounded-md border border-[#E8E2DA] bg-white">
                {arrivals.map((res) => {
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
                        <div className="w-10 h-10 rounded-full bg-[#FAF0E6] text-[#71382D] border border-[#E8D5C2] flex items-center justify-center text-sm font-semibold flex-shrink-0 shadow-2xs">
                          {res.guestName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base text-[#191816] group-hover:text-[#B85C3E] transition-colors truncate font-medium">
                              {res.guestName}
                            </span>
                            <span className="text-[11px] font-mono text-[#8C8275] bg-stone-100 px-2 py-0.5 rounded">
                              {res.reference}
                            </span>
                          </div>
                          <span className="text-xs text-[#7A7267] block truncate mt-0.5">
                            {res.roomType} &middot; <strong className="text-[#71382D] font-medium">{formatAssignedRoom(res.roomNumber)}</strong>
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
                          <DeskPaymentBadge
                            compact
                            totalAmountMinorUnits={res.totalAmountMinorUnits}
                            paidAmountMinorUnits={res.paidAmountMinorUnits}
                            pendingTransferProof={res.pendingTransferProof}
                          />

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAssignment(res.id, 'check-in');
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
            <div className="space-y-4 rounded-md border border-[#E8E2DA] bg-white p-4">
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
            <div className="space-y-3 rounded-md border border-[#E8E2DA] bg-white p-4">
              <p className="text-xs text-[#7A7267]">Direct booking</p>
              <h3 className="truncate text-sm font-medium text-[#191816]">
                {propertySlug ? `${propertySlug}.sena.ng` : 'Website'}
              </h3>
              <p className="text-sm text-[#7A7267]">
                Share the property link so guests can book without a commission.
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={directWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center rounded bg-[#B85C3E] px-3 text-[13px] font-medium text-white hover:bg-[#A34F33] sm:h-9"
                >
                  Open website
                </a>
                <Link href="/website" className="inline-flex h-11 items-center rounded border border-[#E8E2DA] px-3 text-[13px] font-medium text-[#191816] hover:bg-[#FAF8F6] sm:h-9">
                  Edit
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
        onCheckIn={(id) => openAssignment(id, 'check-in')}
        onAssignRoom={(id) => openAssignment(id, selectedRes && selectedRes.roomId ? 'change' : 'assign')}
        onCheckOut={handleCheckOut}
        onPaymentRecorded={() => fetchData()}
      />

      <CheckInRoomDialog
        reservation={assignment?.reservation || null}
        mode={assignment?.mode || 'check-in'}
        open={!!assignment}
        onOpenChange={(open) => {
          if (!open) setAssignment(null);
        }}
        onCompleted={(update) => {
          fetchData();
          setSelectedRes((prev) =>
            prev && assignment && prev.id === assignment.reservation.id
              ? { ...prev, roomId: update.roomId, roomNumber: update.roomNumber, status: update.status || prev.status }
              : prev
          );
        }}
        onFolioUpdated={(update) => {
          setReservations((prev) =>
            prev.map((item) =>
              assignment && item.id === assignment.reservation.id
                ? {
                    ...item,
                    paidAmountMinorUnits: update.paidAmountMinorUnits,
                    totalAmountMinorUnits: update.totalAmountMinorUnits,
                    pendingTransferProof: update.pendingTransferProof,
                  }
                : item
            )
          );
          setSelectedRes((prev) =>
            prev && assignment && prev.id === assignment.reservation.id
              ? {
                  ...prev,
                  paidAmountMinorUnits: update.paidAmountMinorUnits,
                  totalAmountMinorUnits: update.totalAmountMinorUnits,
                  pendingTransferProof: update.pendingTransferProof,
                }
              : prev
          );
        }}
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
