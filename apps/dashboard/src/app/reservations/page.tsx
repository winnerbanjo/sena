'use client';
import { pageMain } from '../../components/design';
import { formatAssignedRoom, mapReservationItem } from '../../components/reservation-room';
import { CheckInRoomDialog, type RoomAssignmentMode } from '../../components/check-in-room-dialog';
import { DeskPaymentBadge } from '../../components/check-in-payment-status';

import { PageLoadState, readJsonResponse } from '../../components/page-load-state';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { formatStayDates } from '@sena/config';
import { Search } from 'lucide-react';
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
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white text-[#191816]">
      <Topbar
        title={t('title')}
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className={pageMain}>
        {/* Editorial Ledger Header */}
        <div className="border-b border-[#E8E1D5] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-base font-medium text-[#191816]">
              {t('heading')}
            </h1>
            <p className="text-xs text-[#7A7267] mt-1">
              {t('subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-[#8C8275]" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-md border border-[#E8E1D5] bg-[#FAF7F2]/40 text-xs text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#71382D] transition-colors"
              />
            </div>
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
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-[#71382D]'
                  : 'text-[#8C8275] hover:text-[#191816]'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#71382D]" />
              )}
            </button>
          ))}
        </div>

        {/* The Guest Folio Ledger */}
        <div className="border border-[#E8E1D5] rounded-xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[#E8E1D5] bg-[#FAF7F2]/60 text-[11px] font-mono uppercase tracking-wider text-[#8C8275]">
                  <th className="py-3 px-5 font-medium">{t('folioRef')}</th>
                  <th className="py-3 px-5 font-medium">{t('guest')}</th>
                  <th className="py-3 px-5 font-medium">{t('roomAssigned')}</th>
                  <th className="py-3 px-5 font-medium">{t('stayWindow')}</th>
                  <th className="py-3 px-5 font-medium">{t('channel')}</th>
                  <th className="py-3 px-5 font-medium">{t('settlement')}</th>
                  <th className="py-3 px-5 font-medium">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D5] text-xs">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-[#8C8275] block">
                          Reservation Folio Ledger
                        </span>
                        <h3 className="text-lg text-[#71382D] font-semibold">
                          {reservations.length === 0 ? t('emptyTitle') : t('emptyFilteredTitle')}
                        </h3>
                        <p className="text-xs text-[#7A7267] leading-relaxed">
                          {reservations.length === 0 ? t('emptyBody') : t('emptyFilteredBody')}
                        </p>
                        {reservations.length === 0 && (
                          <div className="pt-2 flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => setNewResOpen(true)}
                              className="px-4 py-2 rounded-md bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-medium transition-colors"
                            >
                              {t('walkIn')}
                            </button>
                            <a
                              href="/booking-preview"
                              className="px-4 py-2 rounded-md border border-[#E5D4BC] bg-[#FAF7F2] hover:bg-[#F2EAE0] text-[#71382D] text-xs font-medium transition-colors"
                            >
                              {t('viewDirectBooking')}
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((res) => {
                    return (
                      <tr
                        key={res.id}
                        onClick={() => {
                          setSelectedRes(res);
                          setDrawerOpen(true);
                        }}
                        className="hover:bg-[#FAF7F2]/60 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-5 font-mono text-xs text-[#71382D] font-medium">
                          <span className="ltr-isolate" dir="ltr">{res.reference}</span>
                        </td>
                        <td className="py-4 px-5">
                          <strong className="block text-sm text-[#191816] group-hover:text-[#B85C3E] transition-colors font-semibold">
                            {res.guestName}
                          </strong>
                          <NoteCount count={res.noteCount} />
                          <span className="text-[11px] text-[#8C8275]">{res.guestPhone || res.guestEmail}</span>
                        </td>
                        <td className="py-4 px-5">
                          <span className="font-medium text-[#191816] block">
                            {formatAssignedRoom(res.roomNumber, res.apartmentName)}
                          </span>
                          <span className="text-[11px] text-[#8C8275]">{res.roomType}</span>
                        </td>
                        <td className="py-4 px-5 font-mono">
                          <span className="text-[#191816] block">
                            {formatStayDates(res.checkInDate, res.checkOutDate)}
                          </span>
                          <span className="text-[11px] text-[#8C8275]">
                            {t('nights', { count: res.nights })}
                          </span>
                        </td>
                        <td className="py-4 px-5 capitalize text-[#7A7267]">
                          {res.source === 'direct' ? (
                            <span className="text-[#71382D] font-medium">{t('direct')}</span>
                          ) : res.source === 'walk_in' ? (
                            t('walkIn')
                          ) : (
                            res.source.replace('_', ' ')
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <DeskPaymentBadge
                            compact
                            totalAmountMinorUnits={res.totalAmountMinorUnits}
                            paidAmountMinorUnits={res.paidAmountMinorUnits}
                            pendingTransferProof={res.pendingTransferProof}
                          />
                        </td>
                        <td className="py-4 px-5">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono tracking-wide uppercase bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC]">
                            {tStatus.has(res.status as never) ? tStatus(res.status as never) : res.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
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
