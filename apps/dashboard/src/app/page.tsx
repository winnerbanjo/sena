'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatStayDates, formatNaira } from '@sena/config';
import {
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { pageMain } from '../components/design';
import { formatAssignedRoom } from '../components/reservation-room';
import { CheckInRoomDialog, type RoomAssignmentMode } from '../components/check-in-room-dialog';
import { PageLoadState } from '../components/page-load-state';
import { classifyLoadFailure, type LoadFailureKind } from '../lib/page-load';
import { type ReservationItem } from '../components/mock-data';
import { NewReservationDialog } from '../components/new-reservation-dialog';
import { useToast } from '../components/toast-notification';
import { ReservationSuccessModal } from '../components/reservation-success-modal';
import { OccupancyChart } from '../components/occupancy-chart';
import { ReservationDrawer } from '../components/reservation-drawer';
import { Topbar } from '../components/topbar';

interface OverviewPayload {
  property: {
    id: string;
    name: string;
    slug: string;
    address: string;
    timezone: string;
    currency: string;
    checkInTime: string;
    checkOutTime: string;
  };
  todayIso: string;
  vitals: {
    arrivals: {
      total: number;
      pending: number;
      checkedIn: number;
      items: ReservationItem[];
    };
    departures: {
      total: number;
      pending: number;
      completed: number;
      overdue: number;
      items: ReservationItem[];
      overdueItems: ReservationItem[];
    };
    inHouse: {
      total: number;
      onSchedule: number;
      overdue: number;
      items: ReservationItem[];
    };
    inventory: {
      totalConfigured: number;
      totalRooms: number;
      totalApartments: number;
      outOfService: number;
      outOfServiceRooms: number;
      outOfServiceApartments: number;
      bookableInventory: number;
      occupiedCount: number;
      occupancyRate: number;
    };
    housekeeping: {
      readyCount: number;
      readyRooms: number;
      readyApartments: number;
      dirtyCount: number;
      cleaningCount: number;
      readinessRate: number;
    };
    deskFinancials: {
      uncollectedMinorUnits: number;
      unpaidStaysCount: number;
      pendingProofsCount: number;
      items: ReservationItem[];
    };
    attention: {
      pendingArrivalsCount: number;
      unassignedArrivalsCount: number;
      unassignedArrivals: ReservationItem[];
      pendingDeparturesCount: number;
      overdueDeparturesCount: number;
      dirtyRoomsWithArrivalsCount: number;
      unpaidStaysCount: number;
      pendingProofsCount: number;
    };
  };
  sevenDayVelocity: {
    windowStartIso: string;
    windowEndIso: string;
    days: any[];
  };
  rooms: any[];
  apartments: any[];
}

interface OperationRow {
  reservation: ReservationItem;
  movementType: 'arrival' | 'departure';
  isOverdue?: boolean;
}

export default function OverviewPage() {
  const t = useTranslations('overview');
  const toast = useToast();

  const [data, setData] = React.useState<OverviewPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [failureKind, setFailureKind] = React.useState<LoadFailureKind>('error');

  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [successReservation, setSuccessReservation] = React.useState<ReservationItem | null>(null);
  const [assignment, setAssignment] = React.useState<{
    reservation: ReservationItem;
    mode: RoomAssignmentMode;
  } | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/overview');
      if (!res.ok) {
        throw new Error(`Could not load overview (${res.status})`);
      }
      const json: OverviewPayload = await res.json();
      setData(json);
    } catch (error) {
      setFailureKind(
        classifyLoadFailure(error, typeof navigator === 'undefined' ? true : navigator.onLine)
      );
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openAssignment(res: ReservationItem, mode: RoomAssignmentMode) {
    setAssignment({ reservation: res, mode });
  }

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
          setSelectedRes((prev) => (prev ? { ...prev, status: 'checked_out' } : null));
        }
      }
    } catch (e: any) {
      toast.error('Check-out Error', e.message || 'Check out failed');
    }
  }

  function handleCreateReservation(newRes: ReservationItem) {
    fetchData();
    setSuccessReservation(newRes);
  }

  if (loading || loadError || !data) {
    return (
      <PageLoadState
        title={t('title')}
        failed={loadError}
        failureKind={failureKind}
        retry={fetchData}
      />
    );
  }

  const { vitals, sevenDayVelocity, rooms } = data;

  // Formatted operational date (e.g. Sunday, 4 October)
  const operationalDateStr = new Date(data.todayIso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Combine today's guest movements into ONE coherent list
  const operationalRows: OperationRow[] = [
    // 1. Departures overdue
    ...(vitals.departures.overdueItems || []).map((r) => ({
      reservation: r,
      movementType: 'departure' as const,
      isOverdue: true,
    })),
    // 2. Departures scheduled today
    ...(vitals.departures.items || []).map((r) => ({
      reservation: r,
      movementType: 'departure' as const,
      isOverdue: false,
    })),
    // 3. Arrivals scheduled today
    ...(vitals.arrivals.items || []).map((r) => ({
      reservation: r,
      movementType: 'arrival' as const,
      isOverdue: false,
    })),
  ].filter((item, index, self) => self.findIndex((i) => i.reservation.id === item.reservation.id) === index);

  // Filter prioritized attention items (max 3)
  const overdueStays = vitals.departures.overdueItems || [];
  const unassignedArrivals = vitals.attention.unassignedArrivals || [];
  const dirtyArrivalRooms = rooms.filter((r) => {
    if (r.housekeepingStatus !== 'dirty') return false;
    return vitals.arrivals.items.some((a) => a.roomId === r.id && a.status === 'confirmed');
  });
  const unverifiedProofs = (vitals.deskFinancials.items || []).filter((r) => r.pendingTransferProof);

  interface AttentionItem {
    id: string;
    text: string;
    isUrgent?: boolean;
    actionLabel: string;
    onAction: () => void;
  }

  const attentionList: AttentionItem[] = [];

  for (const stay of overdueStays) {
    if (attentionList.length >= 3) break;
    attentionList.push({
      id: `overdue-${stay.id}`,
      text: `Departure overdue: ${stay.guestName} (${formatAssignedRoom(stay.roomNumber)})`,
      isUrgent: true,
      actionLabel: 'Resolve',
      onAction: () => {
        setSelectedRes(stay);
        setDrawerOpen(true);
      },
    });
  }

  for (const stay of unassignedArrivals) {
    if (attentionList.length >= 3) break;
    attentionList.push({
      id: `unassigned-${stay.id}`,
      text: `1 reservation has no room assigned (${stay.guestName})`,
      actionLabel: 'Assign',
      onAction: () => openAssignment(stay, 'assign'),
    });
  }

  for (const room of dirtyArrivalRooms) {
    if (attentionList.length >= 3) break;
    attentionList.push({
      id: `dirty-${room.id}`,
      text: `Room ${room.roomNumber} needs cleaning before today's arrival`,
      actionLabel: 'Housekeeping',
      onAction: () => {
        window.location.href = '/housekeeping';
      },
    });
  }

  for (const stay of unverifiedProofs) {
    if (attentionList.length >= 3) break;
    attentionList.push({
      id: `proof-${stay.id}`,
      text: `1 bank transfer awaiting verification (${stay.guestName})`,
      actionLabel: 'Verify',
      onAction: () => {
        window.location.href = '/payments';
      },
    });
  }

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden bg-[#FAF8F6] text-[#191816]">
      {/* 1. HEADER: Overview | Search | ONE New reservation button */}
      <Topbar
        title="Overview"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className={`${pageMain} space-y-6 pb-12`}>
        {/* 2. TODAY: Concise operational sentence */}
        <section aria-label="Today summary" className="space-y-0.5">
          <h2 className="text-sm font-semibold text-[#191816]">Today</h2>
          <p className="text-xs text-[#7A7267] font-medium">
            {operationalDateStr}
          </p>
          <p className="text-sm text-[#191816] pt-1">
            <span>{vitals.arrivals.pending} {vitals.arrivals.pending === 1 ? 'arrival' : 'arrivals'}</span>
            <span className="mx-2 text-[#D5CFC7]">·</span>
            <span>{vitals.inHouse.total} in house</span>
            <span className="mx-2 text-[#D5CFC7]">·</span>
            <span>{vitals.departures.pending} {vitals.departures.pending === 1 ? 'departure' : 'departures'}</span>
            <span className="mx-2 text-[#D5CFC7]">·</span>
            <span>{vitals.housekeeping.dirtyCount} need cleaning</span>
          </p>
        </section>

        {/* 3. CORE METRICS: Exactly four metrics in one quiet horizontal block */}
        <section aria-label="Core metrics">
          <div className="grid grid-cols-2 sm:grid-cols-4 rounded-lg border border-[#E8E2DA] bg-white divide-y sm:divide-y-0 sm:divide-x divide-[#E8E2DA] overflow-hidden">
            {/* Arrivals */}
            <div className="p-4 sm:p-5 space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C8275] block">
                Arrivals
              </span>
              <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-[#191816] mt-1">
                {vitals.arrivals.pending}
              </div>
              <span className="text-xs text-[#7A7267] block">Today</span>
            </div>

            {/* In house */}
            <div className="p-4 sm:p-5 space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C8275] block">
                In house
              </span>
              <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-[#191816] mt-1">
                {vitals.inHouse.total}
              </div>
              <span className="text-xs text-[#7A7267] block">Checked in</span>
            </div>

            {/* Departures */}
            <div className="p-4 sm:p-5 space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C8275] block">
                Departures
              </span>
              <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-[#191816] mt-1">
                {vitals.departures.pending}
              </div>
              <span className="text-xs text-[#7A7267] block">Today</span>
            </div>

            {/* Occupancy */}
            <div className="p-4 sm:p-5 space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C8275] block">
                Occupancy
              </span>
              <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-[#191816] mt-1">
                {vitals.inventory.occupancyRate}%
              </div>
              <span className="text-xs text-[#7A7267] block">
                {vitals.inventory.occupiedCount} of {vitals.inventory.bookableInventory} units
              </span>
            </div>
          </div>
        </section>

        {/* 4. TODAY'S OPERATIONS: Combined, clean operational table */}
        <section aria-labelledby="operations-heading" className="rounded-lg border border-[#E8E2DA] bg-white overflow-hidden">
          <div className="p-4 border-b border-[#E8E2DA] flex items-center justify-between">
            <h3 id="operations-heading" className="text-sm font-semibold text-[#191816]">
              Today's operations
            </h3>
            <span className="text-xs text-[#7A7267]">
              {operationalRows.length} {operationalRows.length === 1 ? 'movement' : 'movements'}
            </span>
          </div>

          {operationalRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7A7267]">
              No guest movements scheduled for today.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E2DA] bg-[#FAF8F6] text-[#7A7267] text-[11px] font-medium">
                    <th className="py-2.5 px-4 text-start font-medium">Guest</th>
                    <th className="py-2.5 px-3 text-start font-medium">Movement</th>
                    <th className="py-2.5 px-3 text-start font-medium">Accommodation</th>
                    <th className="py-2.5 px-3 text-start font-medium">Stay</th>
                    <th className="py-2.5 px-3 text-start font-medium">Payment</th>
                    <th className="py-2.5 px-3 text-start font-medium">Status</th>
                    <th className="py-2.5 px-4 text-end font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0ECE6]">
                  {operationalRows.map(({ reservation: res, movementType, isOverdue }) => {
                    const balance = Math.max(0, (res.totalAmountMinorUnits || 0) - (res.paidAmountMinorUnits || 0));
                    const isFullyPaid = balance === 0;

                    const hasRoom = Boolean(res.roomId || res.roomNumber);

                    return (
                      <tr
                        key={`${movementType}-${res.id}`}
                        onClick={() => {
                          setSelectedRes(res);
                          setDrawerOpen(true);
                        }}
                        className="hover:bg-[#FAF8F6] cursor-pointer transition-colors"
                      >
                        {/* Guest */}
                        <td className="py-3 px-4 font-medium text-[#191816]">
                          <span className="block truncate max-w-[160px] font-semibold">
                            {res.guestName}
                          </span>
                          <span className="block text-[11px] text-[#8C8275] font-mono">
                            {res.reference}
                          </span>
                        </td>

                        {/* Movement */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${
                              movementType === 'arrival'
                                ? 'bg-[#FAEDE8] text-[#B85C3E]'
                                : 'bg-[#F2ECE4] text-[#71382D]'
                            }`}
                          >
                            {movementType === 'arrival' ? 'Arrival' : 'Departure'}
                          </span>
                        </td>

                        {/* Accommodation */}
                        <td className="py-3 px-3">
                          {hasRoom ? (
                            <span className="font-medium text-[#191816]">
                              {formatAssignedRoom(res.roomNumber)}
                            </span>
                          ) : (
                            <span className="text-[#B85C3E] font-medium">
                              Unassigned
                            </span>
                          )}
                          <span className="block text-[11px] text-[#7A7267] truncate max-w-[140px]">
                            {res.roomType || 'Accommodation'}
                          </span>
                        </td>

                        {/* Stay */}
                        <td className="py-3 px-3 font-mono text-[11px] text-[#5C564D] whitespace-nowrap">
                          {formatStayDates(res.checkInDate, res.checkOutDate)}
                        </td>

                        {/* Payment */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isFullyPaid ? (
                            <span className="text-emerald-700 font-medium">Paid</span>
                          ) : (
                            <span className="text-[#71382D] font-medium font-mono">
                              {formatNaira(balance)} due
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isOverdue ? (
                            <span className="text-[#A83226] font-semibold">Overdue</span>
                          ) : res.status === 'confirmed' ? (
                            <span className="text-[#5C564D]">Confirmed</span>
                          ) : res.status === 'checked_in' ? (
                            <span className="text-emerald-700">Checked in</span>
                          ) : (
                            <span className="text-[#7A7267]">Completed</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-end whitespace-nowrap">
                          {res.status === 'confirmed' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAssignment(res, 'check-in');
                              }}
                              className="h-7 px-2.5 rounded bg-[#B85C3E] hover:bg-[#A34F33] text-white text-xs font-medium transition-colors"
                            >
                              Check in
                            </button>
                          ) : isOverdue ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRes(res);
                                setDrawerOpen(true);
                              }}
                              className="h-7 px-2.5 rounded border border-[#E8E2DA] hover:bg-white text-[#A83226] text-xs font-medium transition-colors"
                            >
                              Resolve
                            </button>
                          ) : res.status === 'checked_in' && res.checkOutDate <= data.todayIso ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCheckOut(res.id);
                              }}
                              className="h-7 px-2.5 rounded border border-[#E8E2DA] hover:bg-[#FAF8F6] text-[#191816] text-xs font-medium transition-colors"
                            >
                              Check out
                            </button>
                          ) : (
                            <span className="text-xs text-[#71382D] font-medium">
                              View
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 5. SECONDARY GRID: Needs attention (left) & Room status (right) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          {/* Needs attention (Max 3 concise items) */}
          <section aria-labelledby="attention-heading" className="rounded-lg border border-[#E8E2DA] bg-white p-4 space-y-3">
            <h3 id="attention-heading" className="text-sm font-semibold text-[#191816]">
              Needs attention
            </h3>

            {attentionList.length === 0 ? (
              <div className="py-3 text-xs text-[#7A7267] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>All clear — No operational issues need your attention.</span>
              </div>
            ) : (
              <div className="divide-y divide-[#F0ECE6]">
                {attentionList.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          item.isUrgent ? 'bg-[#A83226]' : 'bg-[#B85C3E]'
                        }`}
                      />
                      <span className="text-[#191816] font-medium truncate">
                        {item.text}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={item.onAction}
                      className="h-6 px-2 text-[11px] font-medium text-[#71382D] hover:bg-[#FAF8F6] rounded border border-[#E8E2DA] flex-shrink-0 transition-colors"
                    >
                      {item.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Room status (Compact summary) */}
          <section aria-labelledby="room-status-heading" className="rounded-lg border border-[#E8E2DA] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 id="room-status-heading" className="text-sm font-semibold text-[#191816]">
                Room status
              </h3>
              <Link
                href="/rooms"
                className="text-xs text-[#71382D] hover:text-[#5E2B21] font-medium inline-flex items-center gap-0.5 transition-colors"
              >
                <span>View rooms</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-lg font-semibold tabular-nums text-[#191816] block">
                  {vitals.housekeeping.readyCount}
                </span>
                <span className="text-[#7A7267]">Ready</span>
              </div>
              <div>
                <span className="text-lg font-semibold tabular-nums text-[#191816] block">
                  {vitals.housekeeping.dirtyCount}
                </span>
                <span className="text-[#7A7267]">Need cleaning</span>
              </div>
              <div>
                <span className="text-lg font-semibold tabular-nums text-[#191816] block">
                  {vitals.inventory.occupiedCount}
                </span>
                <span className="text-[#7A7267]">Occupied</span>
              </div>
              <div>
                <span className="text-lg font-semibold tabular-nums text-[#191816] block">
                  {vitals.inventory.outOfService}
                </span>
                <span className="text-[#7A7267]">Out of service</span>
              </div>
            </div>

            {/* Segmented bar */}
            <div className="w-full bg-[#F5F2EB] h-1.5 rounded-full overflow-hidden flex gap-0.5 mt-2">
              <div
                className="bg-emerald-600 h-full rounded-l-full"
                style={{
                  width: `${Math.round(
                    (vitals.housekeeping.readyCount / (vitals.inventory.totalConfigured || 1)) * 100
                  )}%`,
                }}
              />
              <div
                className="bg-rose-500 h-full"
                style={{
                  width: `${Math.round(
                    (vitals.housekeeping.dirtyCount / (vitals.inventory.totalConfigured || 1)) * 100
                  )}%`,
                }}
              />
              <div
                className="bg-[#71382D] h-full"
                style={{
                  width: `${Math.round(
                    (vitals.inventory.occupiedCount / (vitals.inventory.totalConfigured || 1)) * 100
                  )}%`,
                }}
              />
              {vitals.inventory.outOfService > 0 && (
                <div
                  className="bg-[#8C8275] h-full rounded-r-full"
                  style={{
                    width: `${Math.round(
                      (vitals.inventory.outOfService / (vitals.inventory.totalConfigured || 1)) * 100
                    )}%`,
                  }}
                />
              )}
            </div>
          </section>
        </div>

        {/* 6. OCCUPANCY TREND: Clean, restrained 7-day chart */}
        <OccupancyChart
          velocityDays={sevenDayVelocity.days}
          bookableInventory={vitals.inventory.bookableInventory}
        />
      </main>

      {/* Reservation Drawer */}
      <ReservationDrawer
        reservation={selectedRes}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCheckIn={() => {
          if (selectedRes) openAssignment(selectedRes, 'check-in');
        }}
        onAssignRoom={() => {
          if (selectedRes) openAssignment(selectedRes, selectedRes.roomId ? 'change' : 'assign');
        }}
        onCheckOut={handleCheckOut}
        onPaymentRecorded={() => fetchData()}
        onUpdated={(updated) => {
          setSelectedRes(updated);
          fetchData();
        }}
      />

      {/* Check In / Room Assignment Dialog */}
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
          fetchData();
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

      {/* In-App Confirmation Modal */}
      <ReservationSuccessModal
        reservation={successReservation}
        open={!!successReservation}
        onClose={() => setSuccessReservation(null)}
      />
    </div>
  );
}
