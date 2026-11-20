'use client';
import { pageMain, pageStack } from '../../components/design';
import { formatAssignedRoom, mapReservationItem } from '../../components/reservation-room';
import { CheckInRoomDialog, type RoomAssignmentMode } from '../../components/check-in-room-dialog';
import { DeskPaymentBadge } from '../../components/check-in-payment-status';

import { PageLoadState } from '../../components/page-load-state';
import { classifyLoadFailure, type LoadFailureKind } from '../../lib/page-load';
import { useWorkspace } from '../../components/workspace-access';
import * as React from 'react';
import { formatNaira, formatStayDates } from '@sena/config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sena/ui';
import { type ReservationItem } from '../../components/mock-data';
import { ReservationDrawer } from '../../components/reservation-drawer';
import { NoteCount } from '../../components/reservation-notes';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { ReservationSuccessModal } from '../../components/reservation-success-modal';
import { Topbar } from '../../components/topbar';
import { useToast } from '../../components/toast-notification';
import { useTranslations } from 'next-intl';
import { isolateLtr, Ltr } from '../../components/ltr';

type FrontDeskList = { items: ReservationItem[]; total: number; truncated: boolean };
type FrontDeskBoard = {
  arrivalsToday: FrontDeskList;
  arrivalsAll: FrontDeskList;
  inHouse: FrontDeskList;
  departuresToday: FrontDeskList;
};

export default function FrontDeskPage() {
  const toast = useToast();
  const t = useTranslations('frontDesk');
  const tCommon = useTranslations('common');
  const workspace = useWorkspace();
  const [loadError, setLoadError] = React.useState(false);
  const [failureKind, setFailureKind] = React.useState<LoadFailureKind>('error');
  const [board, setBoard] = React.useState<FrontDeskBoard>({
    arrivalsToday: { items: [], total: 0, truncated: false },
    arrivalsAll: { items: [], total: 0, truncated: false },
    inHouse: { items: [], total: 0, truncated: false },
    departuresToday: { items: [], total: 0, truncated: false },
  });
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'arriving' | 'in_house' | 'departing'>('arriving');
  const [arrivalScope, setArrivalScope] = React.useState<'today' | 'all'>('today');
  const [departureScope, setDepartureScope] = React.useState<'today' | 'all'>('today');
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [successReservation, setSuccessReservation] = React.useState<ReservationItem | null>(null);
  const [checkoutWarning, setCheckoutWarning] = React.useState<{
    res: ReservationItem;
    balanceMinorUnits: number;
  } | null>(null);
  const [assignment, setAssignment] = React.useState<{
    reservation: ReservationItem;
    mode: RoomAssignmentMode;
  } | null>(null);
  const requireCheckoutSettlement = workspace?.property.checkOutPaymentPolicy === 'require_settlement';
  const timezone = workspace?.property.timezone || 'Africa/Lagos';
  const [operationalTime, setOperationalTime] = React.useState('');

  const todayStr = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }, [timezone]);

  React.useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(now);
        setOperationalTime(formatted);
      } catch {
        setOperationalTime('');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [timezone]);

  const fetchReservations = React.useCallback(async () => {
    setLoadError(false);
    try {
      // The board is a server-side bounded query: today's arrivals, in-house
      // stays and today's departures. It never walks the property history.
      const res = await fetch('/api/front-desk', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Could not load the front desk (${res.status})`);
      const data = await res.json();
      const list = (bucket: any): FrontDeskList => ({
        items: (bucket?.items || []).map(mapReservationItem),
        total: Number(bucket?.total) || 0,
        truncated: Boolean(bucket?.truncated),
      });
      setBoard({
        arrivalsToday: list(data.arrivals?.today),
        arrivalsAll: list(data.arrivals?.all),
        inHouse: list(data.inHouse),
        departuresToday: list(data.departures?.today),
      });
    } catch (error) {
      setFailureKind(classifyLoadFailure(error, typeof navigator === 'undefined' ? true : navigator.onLine));
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  function openAssignment(id: string, mode: RoomAssignmentMode) {
    const reservation = [
      ...board.arrivalsToday.items,
      ...board.arrivalsAll.items,
      ...board.inHouse.items,
      ...board.departuresToday.items,
    ].find((item) => item.id === id) || selectedRes;
    if (!reservation) return;
    setAssignment({ reservation, mode });
  }

  function initiateCheckOut(res: ReservationItem) {
    const balance = res.totalAmountMinorUnits - res.paidAmountMinorUnits;
    if (balance > 0) {
      setCheckoutWarning({ res, balanceMinorUnits: balance });
    } else {
      executeCheckOut(res.id, false);
    }
  }

  async function executeCheckOut(id: string, force: boolean) {
    try {
      const res = await fetch(`/api/reservations/${id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      if (res.ok) {
        toast.success(t('checkedOutTitle'), t('checkedOutBody'));
        setCheckoutWarning(null);
        fetchReservations();
      } else {
        let errMsg = t('failedToCheckOut');
        try {
          const err = await res.json();
          if (err.error) errMsg = err.error;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        toast.error(t('checkOutFailed'), errMsg);
      }
    } catch (err: any) {
      toast.error(t('checkOutError'), err.message || t('failedToCheckOut'));
    }
  }

  const arrivingTodayList = board.arrivalsToday.items;
  const allUpcomingArrivingList = board.arrivalsAll.items;
  const inHouseList = board.inHouse.items;
  const departingTodayList = board.departuresToday.items;
  const allDepartingList = inHouseList;

  const arrivingList = arrivalScope === 'today' ? arrivingTodayList : allUpcomingArrivingList;
  const departingList = departureScope === 'today' ? departingTodayList : allDepartingList;

  const currentList =
    activeTab === 'arriving'
      ? arrivingList
      : activeTab === 'in_house'
      ? inHouseList
      : departingList;

  const currentBucket =
    activeTab === 'arriving'
      ? (arrivalScope === 'today' ? board.arrivalsToday : board.arrivalsAll)
      : activeTab === 'in_house'
      ? board.inHouse
      : (departureScope === 'today' ? board.departuresToday : board.inHouse);

  if (loading || loadError) return <PageLoadState title={t('title')} failed={loadError} failureKind={failureKind} retry={fetchReservations} />;

  return (
    <div className={pageStack + ' h-screen'}>
      <Topbar
        title={t('title')}
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className={pageMain}>
        {/* Operational Filter Tabs & Property Operational Local Time */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#E8E1D5] text-xs gap-3">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('arriving')}
              className={`pb-3 font-medium transition-colors relative flex items-center gap-2 ${
                activeTab === 'arriving' ? 'text-[#71382D]' : 'text-[#8C8275] hover:text-[#191816]'
              }`}
            >
              <span>{t('expectedArrivals')}</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC]">
                {board.arrivalsToday.total}
              </span>
              {activeTab === 'arriving' && (
                <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#71382D]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('in_house')}
              className={`pb-3 font-medium transition-colors relative flex items-center gap-2 ${
                activeTab === 'in_house' ? 'text-[#71382D]' : 'text-[#8C8275] hover:text-[#191816]'
              }`}
            >
              <span>{t('currentlyInHouse')}</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC]">
                {board.inHouse.total}
              </span>
              {activeTab === 'in_house' && (
                <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#71382D]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('departing')}
              className={`pb-3 font-medium transition-colors relative flex items-center gap-2 ${
                activeTab === 'departing' ? 'text-[#71382D]' : 'text-[#8C8275] hover:text-[#191816]'
              }`}
            >
              <span>{t('departures')}</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC]">
                {board.departuresToday.total}
              </span>
              {activeTab === 'departing' && (
                <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#71382D]" />
              )}
            </button>
          </div>

          {operationalTime && (
            <div className="hidden sm:flex items-center gap-1.5 pb-2.5 text-[11px] text-[#7A7267]">
              <span className="w-2 h-2 rounded-full bg-[#2E6B4F]" />
              <span>Operational Time: <strong className="text-[#191816] font-mono">{operationalTime}</strong></span>
            </div>
          )}
        </div>

        {/* Operational Scope Filter Pills */}
        {activeTab === 'arriving' && (
          <div className="flex items-center gap-2 py-1 text-xs">
            <span className="text-[11px] font-mono text-[#8C8275] uppercase tracking-wider">Arrivals View:</span>
            <button
              type="button"
              onClick={() => setArrivalScope('today')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                arrivalScope === 'today'
                  ? 'bg-[#71382D] text-white shadow-xs'
                  : 'bg-[#FAF7F2] text-[#7A7267] hover:text-[#191816] border border-[#E8E1D5]'
              }`}
            >
              Today & Overdue ({board.arrivalsToday.total})
            </button>
            <button
              type="button"
              onClick={() => setArrivalScope('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                arrivalScope === 'all'
                  ? 'bg-[#71382D] text-white shadow-xs'
                  : 'bg-[#FAF7F2] text-[#7A7267] hover:text-[#191816] border border-[#E8E1D5]'
              }`}
            >
              All Upcoming ({board.arrivalsAll.total})
            </button>
          </div>
        )}

        {activeTab === 'departing' && (
          <div className="flex items-center gap-2 py-1 text-xs">
            <span className="text-[11px] font-mono text-[#8C8275] uppercase tracking-wider">Departures View:</span>
            <button
              type="button"
              onClick={() => setDepartureScope('today')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                departureScope === 'today'
                  ? 'bg-[#71382D] text-white shadow-xs'
                  : 'bg-[#FAF7F2] text-[#7A7267] hover:text-[#191816] border border-[#E8E1D5]'
              }`}
            >
              Departing Today & Overdue ({board.departuresToday.total})
            </button>
            <button
              type="button"
              onClick={() => setDepartureScope('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                departureScope === 'all'
                  ? 'bg-[#71382D] text-white shadow-xs'
                  : 'bg-[#FAF7F2] text-[#7A7267] hover:text-[#191816] border border-[#E8E1D5]'
              }`}
            >
              All In-House ({board.inHouse.total})
            </button>
          </div>
        )}

        {currentBucket.truncated && (
          <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            Showing the first {currentBucket.items.length} of {currentBucket.total} stays. This property has more
            operational rows than the board loads at once; narrow the view or open Reservations to find a specific booking.
          </p>
        )}

        {/* Operational Front Desk Roster: Clean Table Layout Instead of Random Cards */}
        <div className="border border-[#E8E1D5] rounded-xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[#E8E1D5] bg-[#FAF7F2]/60 text-[11px] font-mono uppercase tracking-wider text-[#8C8275]">
                  <th className="py-3 px-5 font-medium">{t('guestFolio')}</th>
                  <th className="py-3 px-5 font-medium">{t('roomAssigned')}</th>
                  <th className="py-3 px-5 font-medium">{t('stayWindow')}</th>
                  <th className="py-3 px-5 font-medium">{t('settlement')}</th>
                  <th className="py-3 px-5 font-medium">{t('contact')}</th>
                  <th className="py-3 px-5 font-medium text-end">{t('deskAction')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D5] text-xs">
                {currentList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-[#8C8275] block">
                          {t('roster')}
                        </span>
                        <h3 className="text-lg text-[#71382D] font-semibold">
                          {activeTab === 'arriving'
                            ? t('emptyArrivingTitle')
                            : activeTab === 'in_house'
                            ? t('emptyInHouseTitle')
                            : t('emptyDepartingTitle')}
                        </h3>
                        <p className="text-xs text-[#7A7267] leading-relaxed">
                          {activeTab === 'arriving'
                            ? t('emptyArrivingBody')
                            : activeTab === 'in_house'
                            ? t('emptyInHouseBody')
                            : t('emptyDepartingBody')}
                        </p>
                        <div className="pt-2 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setNewResOpen(true)}
                            className="px-4 py-2 rounded-md bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-medium transition-colors cursor-pointer"
                          >
                            {t('recordWalkIn')}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentList.map((res) => {
                    return (
                      <tr
                        key={res.id}
                        onClick={() => {
                          setSelectedRes(res);
                          setDrawerOpen(true);
                        }}
                        className="hover:bg-[#FAF7F2]/60 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-5">
                          <strong className="block text-sm text-[#191816] group-hover:text-[#B85C3E] transition-colors font-semibold">
                            {res.guestName}
                          </strong>
                          <NoteCount count={res.noteCount} />
                          <span className="text-[11px] font-mono text-[#8C8275]"><Ltr>{res.reference}</Ltr></span>
                        </td>
                        <td className="py-4 px-5">
                          <span className="font-medium text-[#71382D] block">
                            <Ltr>{formatAssignedRoom(res.roomNumber, res.apartmentName)}</Ltr>
                          </span>
                          <span className="text-[11px] text-[#8C8275]">{res.roomType}</span>
                        </td>
                        <td className="py-4 px-5 font-mono">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="text-[#191816] font-medium">
                              {formatStayDates(res.checkInDate, res.checkOutDate)}
                            </span>
                            {res.status === 'confirmed' && res.checkInDate < todayStr && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-sans font-medium bg-red-100 text-red-800 border border-red-200">
                                Overdue Arrival
                              </span>
                            )}
                            {res.status === 'confirmed' && res.checkInDate === todayStr && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-sans font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Today
                              </span>
                            )}
                            {res.status === 'checked_in' && res.checkOutDate < todayStr && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-sans font-medium bg-red-100 text-red-800 border border-red-200 animate-pulse">
                                Overdue Checkout
                              </span>
                            )}
                            {res.status === 'checked_in' && res.checkOutDate === todayStr && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-sans font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                Due Today
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#8C8275]">
                            {tCommon(res.nights === 1 ? 'nights_one' : 'nights_other', { count: res.nights })}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <DeskPaymentBadge
                            compact
                            totalAmountMinorUnits={res.totalAmountMinorUnits}
                            paidAmountMinorUnits={res.paidAmountMinorUnits}
                            pendingTransferProof={res.pendingTransferProof}
                          />
                        </td>
                        <td className="py-4 px-5 text-[#8C8275]">
                          {res.guestPhone || res.guestEmail}
                        </td>
                        <td className="py-4 px-5 text-end" onClick={(e) => e.stopPropagation()}>
                          {activeTab === 'arriving' ? (
                            <button
                              type="button"
                              onClick={() => openAssignment(res.id, 'check-in')}
                              className="px-3.5 py-1.5 rounded-md bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-medium transition-colors"
                            >
                              {t('checkIn')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => initiateCheckOut(res)}
                              className="px-3.5 py-1.5 rounded-md border border-[#E8E1D5] hover:bg-[#FAF7F2] text-[#191816] text-xs font-medium transition-colors"
                            >
                              {t('checkOut')}
                            </button>
                          )}
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

      {/* Balance Warning Dialog */}
      {checkoutWarning && (
        <Dialog open={true} onOpenChange={() => setCheckoutWarning(null)}>
          <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
            <DialogHeader>
              <DialogTitle className="text-lg text-[#71382D] font-semibold">
                {t('outstandingTitle')}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#7A7267] pt-1 leading-relaxed">
                {t('outstandingBody', {
                  name: checkoutWarning.res.guestName,
                  amount: isolateLtr(formatNaira(checkoutWarning.balanceMinorUnits)),
                })}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <button
                type="button"
                onClick={() => setCheckoutWarning(null)}
                className="px-3.5 py-1.5 rounded-md border border-[#E8E1D5] text-xs font-medium text-[#191816] hover:bg-[#FAF7F2]"
              >
                {t('recordPaymentFirst')}
              </button>
              {!requireCheckoutSettlement && (
              <button
                type="button"
                onClick={() => executeCheckOut(checkoutWarning.res.id, true)}
                className="px-3.5 py-1.5 rounded-md bg-[#71382D] text-white text-xs font-medium hover:bg-[#5A2C23]"
              >
                {t('checkOutWithBalance')}
              </button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reservation Drawer */}
      <ReservationDrawer
        reservation={selectedRes}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCheckIn={(id) => openAssignment(id, 'check-in')}
        onAssignRoom={(id) => openAssignment(id, selectedRes && selectedRes.roomId ? 'change' : 'assign')}
        onCheckOut={(id) => {
          if (selectedRes) initiateCheckOut(selectedRes);
        }}
        onPaymentRecorded={() => fetchReservations()}
        onNotesChanged={() => fetchReservations()}
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
          if (assignment) {
            const patch = (bucket: FrontDeskList): FrontDeskList => ({
              ...bucket,
              items: bucket.items.map((item) =>
                item.id === assignment.reservation.id
                  ? {
                      ...item,
                      paidAmountMinorUnits: update.paidAmountMinorUnits,
                      totalAmountMinorUnits: update.totalAmountMinorUnits,
                      pendingTransferProof: update.pendingTransferProof,
                    }
                  : item
              ),
            });
            setBoard((prev) => ({
              arrivalsToday: patch(prev.arrivalsToday),
              arrivalsAll: patch(prev.arrivalsAll),
              inHouse: patch(prev.inHouse),
              departuresToday: patch(prev.departuresToday),
            }));
          }
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

      {/* Walk-in Reservation Dialog */}
      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={(newRes) => {
          setSuccessReservation(newRes);
          fetchReservations();
        }}
      />

      {/* Reservation Success Modal */}
      {successReservation && (
        <ReservationSuccessModal
          reservation={successReservation}
          open={!!successReservation}
          onClose={() => setSuccessReservation(null)}
        />
      )}
    </div>
  );
}
