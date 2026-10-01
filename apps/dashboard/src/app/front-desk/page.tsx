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

export default function FrontDeskPage() {
  const toast = useToast();
  const t = useTranslations('frontDesk');
  const tCommon = useTranslations('common');
  const workspace = useWorkspace();
  const [loadError, setLoadError] = React.useState(false);
  const [failureKind, setFailureKind] = React.useState<LoadFailureKind>('error');
  const [reservations, setReservations] = React.useState<ReservationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'arriving' | 'in_house' | 'departing'>('arriving');
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

  const fetchReservations = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/reservations');
      if (!res.ok) throw new Error(`Could not load reservations (${res.status})`);
      const data = await res.json();
      if (data.reservations) {
        const mapped: ReservationItem[] = data.reservations.map(mapReservationItem);
        setReservations(mapped);
      }
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
    const reservation = reservations.find((item) => item.id === id) || selectedRes;
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

  const arrivingList = reservations.filter((r) => r.status === 'confirmed');
  const inHouseList = reservations.filter((r) => r.status === 'checked_in');
  const departingList = reservations.filter((r) => r.status === 'checked_in');

  const currentList =
    activeTab === 'arriving'
      ? arrivingList
      : activeTab === 'in_house'
      ? inHouseList
      : departingList;

  if (loading || loadError) return <PageLoadState title={t('title')} failed={loadError} failureKind={failureKind} retry={fetchReservations} />;

  return (
    <div className={pageStack + ' h-screen'}>
      <Topbar
        title={t('title')}
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className={pageMain}>
        {/* Operational Filter Tabs */}
        <div className="flex items-center gap-6 border-b border-[#E8E1D5] text-xs">
          <button
            onClick={() => setActiveTab('arriving')}
            className={`pb-3 font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'arriving' ? 'text-[#71382D]' : 'text-[#8C8275] hover:text-[#191816]'
            }`}
          >
            <span>{t('expectedArrivals')}</span>
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC]">
              {arrivingList.length}
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
              {inHouseList.length}
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
              {departingList.length}
            </span>
            {activeTab === 'departing' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#71382D]" />
            )}
          </button>
        </div>

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
                          <span className="text-[#191816] block">
                            {formatStayDates(res.checkInDate, res.checkOutDate)}
                          </span>
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
