'use client';
import { pageMain, pageStack } from '../../components/design';
import { formatAssignedRoom, mapReservationItem } from '../../components/reservation-room';
import { CheckInRoomDialog, type RoomAssignmentMode } from '../../components/check-in-room-dialog';
import { DeskPaymentBadge } from '../../components/check-in-payment-status';

import { PageLoadState, readJsonResponse } from '../../components/page-load-state';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { formatStayDates } from '@sena/config';
import { Search } from 'lucide-react';
import { StatusBadge } from '@sena/ui';
import { type ReservationItem } from '../../components/mock-data';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { ReservationDrawer } from '../../components/reservation-drawer';
import { NoteCount } from '../../components/reservation-notes';
import { Topbar } from '../../components/topbar';
import { useToast } from '../../components/toast-notification';
import { ReservationSuccessModal } from '../../components/reservation-success-modal';
import { useTranslations } from 'next-intl';

function ReservationsContent() {
  const t = useTranslations('reservations');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses.reservation');
  const toast = useToast();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search');
  const [reservations, setReservations] = React.useState<ReservationItem[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState(urlSearch || '');
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [successReservation, setSuccessReservation] = React.useState<ReservationItem | null>(null);
  const [assignment, setAssignment] = React.useState<{
    reservation: ReservationItem;
    mode: RoomAssignmentMode;
  } | null>(null);

  const fetchReservations = React.useCallback(async () => {
    try {
      const res = await fetch('/api/reservations');
      if (!res.ok) throw new Error('Page unavailable');
      if (res.ok) {
        const data = await res.json();
        if (data.reservations) {
          const mapped: ReservationItem[] = data.reservations.map(mapReservationItem);
          setReservations(mapped);
        }
      }
    } catch (e) {
      setLoadError(true);
      console.error('Failed to load reservations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  React.useEffect(() => {
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [urlSearch]);

  const filtered = reservations.filter((r) => {
    if (activeTab === 'upcoming' && r.status !== 'confirmed') return false;
    if (activeTab === 'in_house' && r.status !== 'checked_in') return false;
    if (activeTab === 'completed' && r.status !== 'checked_out') return false;
    if (activeTab === 'cancelled' && r.status !== 'cancelled') return false;
    // Voided stays out of every operational view unless it is explicitly asked for.
    if (activeTab !== 'voided' && r.status === 'voided') return false;
    if (activeTab === 'voided' && r.status !== 'voided') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.reference.toLowerCase().includes(q) ||
        r.guestName.toLowerCase().includes(q) ||
        r.roomNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading || loadError) return <PageLoadState title={t('title')} failed={loadError} />;

  return (
    <div className={pageStack + ' h-screen'}>
      <Topbar
        title={t('title')}
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className={pageMain}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full sm:w-72">
            <Search className="absolute start-3.5 top-3 h-3.5 w-3.5 text-[#7A7267]" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[#E8E2DA] bg-white py-2 pe-3.5 ps-9 text-sm text-[#191816] placeholder:text-[#7A7267] transition-colors focus:outline-none focus:ring-2 focus:ring-[#71382D]/30"
            />
          </div>
        </div>

        {/* Quiet, Editorial Tabs */}
        <div className="flex items-center gap-6 border-b border-[#E8E1D5] text-xs">
          {[
            { id: 'all', label: t('allStays') },
            { id: 'upcoming', label: t('upcomingArrivals') },
            { id: 'in_house', label: t('currentlyInHouse') },
            { id: 'completed', label: t('departed') },
            { id: 'cancelled', label: t('cancelled') },
            { id: 'voided', label: t('voided') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 text-sm font-medium transition-colors duration-150 ${
                activeTab === tab.id
                  ? 'text-[#191816]'
                  : 'text-[#7A7267] hover:text-[#191816]'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#B85C3E]" />
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E8E2DA] bg-white px-6 py-10 text-center">
            <h3 className="text-sm font-medium text-[#191816]">
              {reservations.length === 0 ? t('emptyTitle') : t('emptyFilteredTitle')}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#7A7267]">
              {reservations.length === 0 ? t('emptyBody') : t('emptyFilteredBody')}
            </p>
            {reservations.length === 0 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setNewResOpen(true)}
                  className="rounded-md bg-[#B85C3E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#A34F33]"
                >
                  {t('walkIn')}
                </button>
                <a
                  href="/booking-preview"
                  className="rounded-md border border-[#E8E2DA] bg-white px-4 py-2 text-sm font-medium text-[#191816] hover:bg-[#FAF8F6]"
                >
                  {t('viewDirectBooking')}
                </a>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {filtered.map((res) => {
                const statusLabel = tStatus.has(res.status as never) ? tStatus(res.status as never) : res.status;
                return (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => {
                      setSelectedRes(res);
                      setDrawerOpen(true);
                    }}
                    className="w-full rounded-lg border border-[#E8E2DA] bg-white p-4 text-start transition-colors duration-150 hover:border-[#D9D0C5]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <strong className="text-sm font-medium text-[#191816]">{res.guestName}</strong>
                      <StatusBadge status={res.status}>{statusLabel}</StatusBadge>
                    </div>
                    <p className="mt-1 text-[13px] text-[#5C564D]">
                      {formatStayDates(res.checkInDate, res.checkOutDate)}
                      <span className="px-1.5 text-[#C4B8A5]">·</span>
                      {formatAssignedRoom(res.roomNumber, res.apartmentName)}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <DeskPaymentBadge
                        compact
                        totalAmountMinorUnits={res.totalAmountMinorUnits}
                        paidAmountMinorUnits={res.paidAmountMinorUnits}
                        pendingTransferProof={res.pendingTransferProof}
                      />
                      <span className="text-[12px] text-[#7A7267] ltr-isolate" dir="ltr">{res.reference}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="hidden overflow-hidden rounded-lg border border-[#E8E2DA] bg-white md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-start">
                  <thead>
                    <tr className="border-b border-[#E8E2DA] text-[12px] font-medium text-[#7A7267]">
                      <th className="px-4 py-3 text-start font-medium">{t('guest')}</th>
                      <th className="px-4 py-3 text-start font-medium">{t('stayWindow')}</th>
                      <th className="px-4 py-3 text-start font-medium">{t('roomAssigned')}</th>
                      <th className="px-4 py-3 text-start font-medium">{t('status')}</th>
                      <th className="px-4 py-3 text-start font-medium">{t('settlement')}</th>
                      <th className="px-4 py-3 text-start font-medium">{t('folioRef')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2DA] text-sm">
                    {filtered.map((res) => {
                      const statusLabel = tStatus.has(res.status as never) ? tStatus(res.status as never) : res.status;
                      return (
                        <tr
                          key={res.id}
                          onClick={() => {
                            setSelectedRes(res);
                            setDrawerOpen(true);
                          }}
                          className="cursor-pointer transition-colors duration-150 hover:bg-[#FAF8F6]"
                        >
                          <td className="px-4 py-3">
                            <strong className="block text-sm font-medium text-[#191816]">{res.guestName}</strong>
                            <NoteCount count={res.noteCount} />
                            <span className="text-[12px] text-[#7A7267]">{res.guestPhone || res.guestEmail}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="block text-[#191816]">{formatStayDates(res.checkInDate, res.checkOutDate)}</span>
                            <span className="text-[12px] text-[#7A7267]">{t('nights', { count: res.nights })}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="block text-[#191816]">{formatAssignedRoom(res.roomNumber, res.apartmentName)}</span>
                            <span className="text-[12px] text-[#7A7267]">{res.roomType}</span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={res.status}>{statusLabel}</StatusBadge>
                          </td>
                          <td className="px-4 py-3">
                            <DeskPaymentBadge
                              compact
                              totalAmountMinorUnits={res.totalAmountMinorUnits}
                              paidAmountMinorUnits={res.paidAmountMinorUnits}
                              pendingTransferProof={res.pendingTransferProof}
                            />
                          </td>
                          <td className="px-4 py-3 text-[12px] text-[#7A7267]">
                            <span className="ltr-isolate block" dir="ltr">{res.reference}</span>
                            <span>
                              {res.source === 'direct' ? t('direct') : res.source === 'walk_in' ? t('walkIn') : res.source.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      <ReservationDrawer
        reservation={selectedRes}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCheckIn={(id) => {
          const reservation = reservations.find((item) => item.id === id) || selectedRes;
          if (reservation) setAssignment({ reservation, mode: 'check-in' });
        }}
        onAssignRoom={(id) => {
          const reservation = reservations.find((item) => item.id === id) || selectedRes;
          if (reservation) setAssignment({ reservation, mode: reservation.roomId ? 'change' : 'assign' });
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
              toast.success(t('successTitle'), tCommon('saved'));
              fetchReservations();
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
        onPaymentRecorded={() => fetchReservations()}
        onNotesChanged={() => fetchReservations()}
        onCancelled={() => fetchReservations()}
        onMarkedNoShow={() => fetchReservations()}
        onRemoved={() => {
          setSelectedRes(null);
          setDrawerOpen(false);
          fetchReservations();
        }}
        onUpdated={(updated) => {
          setSelectedRes(updated);
          fetchReservations();
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
          fetchReservations();
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

      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={(newRes) => {
          fetchReservations();
          setSuccessReservation(newRes);
        }}
      />

      <ReservationSuccessModal
        reservation={successReservation}
        open={!!successReservation}
        onClose={() => setSuccessReservation(null)}
      />
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-xs text-[#8C8275]">Loading reservations...</div>}>
      <ReservationsContent />
    </React.Suspense>
  );
}
