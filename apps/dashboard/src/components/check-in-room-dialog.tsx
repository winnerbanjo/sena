'use client';

import * as React from 'react';
import { formatNaira, formatStayDates } from '@sena/config';
import { deskPaymentStatus, folioBalance } from '../lib/financial-status';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@sena/ui';
import type { ReservationItem } from './mock-data';
import { CheckInPaymentStatus } from './check-in-payment-status';
import { RecordPaymentDialog } from './record-payment-dialog';
import { formatAssignedRoom, isPhysicalRoomAssigned, type EligiblePhysicalRoom } from './reservation-room';
import { PhysicalRoomSelect } from './physical-room-select';
import { useToast } from './toast-notification';
import { useTranslations } from 'next-intl';
import { isolateLtr, Ltr } from './ltr';
import { localizeApiError } from '@/i18n/errors';
import { useWorkspace } from './workspace-access';

export type RoomAssignmentMode = 'check-in' | 'assign' | 'change';

interface CheckInRoomDialogProps {
  reservation: ReservationItem | null;
  mode: RoomAssignmentMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (update: { roomId: string; roomNumber: string; status?: ReservationItem['status'] }) => void;
  onFolioUpdated?: (update: {
    paidAmountMinorUnits: number;
    totalAmountMinorUnits: number;
    pendingTransferProof?: boolean;
  }) => void;
}

type FolioState = {
  totalAmountMinorUnits: number;
  paidAmountMinorUnits: number;
  pendingTransferProof: boolean;
  invoices: Array<{ id: string; invoiceNumber: string; publicToken: string; status: string }>;
};

export function CheckInRoomDialog({
  reservation,
  mode,
  open,
  onOpenChange,
  onCompleted,
  onFolioUpdated,
}: CheckInRoomDialogProps) {
  const toast = useToast();
  const t = useTranslations('frontDesk');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const workspace = useWorkspace();
  const [rooms, setRooms] = React.useState<EligiblePhysicalRoom[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = React.useState('');
  const [changingRoom, setChangingRoom] = React.useState(false);
  const [checkInPolicy, setCheckInPolicy] = React.useState<'require_full' | 'allow_outstanding'>('allow_outstanding');
  const [folio, setFolio] = React.useState<FolioState | null>(null);
  const [payOpen, setPayOpen] = React.useState(false);
  const [confirmOutstanding, setConfirmOutstanding] = React.useState(false);
  const [outstandingAuthorized, setOutstandingAuthorized] = React.useState(false);
  const [invoiceBusy, setInvoiceBusy] = React.useState(false);

  const assigned = reservation ? isPhysicalRoomAssigned(reservation) : false;
  const forCheckIn = mode === 'check-in';
  const mustChooseRoom = !assigned || changingRoom || mode !== 'check-in';
  const totalAmountMinorUnits = folio?.totalAmountMinorUnits ?? reservation?.totalAmountMinorUnits ?? 0;
  const paidAmountMinorUnits = folio?.paidAmountMinorUnits ?? reservation?.paidAmountMinorUnits ?? 0;
  const pendingTransferProof = folio?.pendingTransferProof ?? Boolean(reservation?.pendingTransferProof);
  const due = folioBalance(totalAmountMinorUnits, paidAmountMinorUnits);
  const payment = deskPaymentStatus({ totalAmountMinorUnits, paidAmountMinorUnits, pendingTransferProof });
  const moneyDue = forCheckIn && due > 0;
  const requireFull = checkInPolicy === 'require_full';
  const canContinueWithoutPayment = moneyDue && !requireFull;
  const checkInBlocked = moneyDue && (requireFull || !outstandingAuthorized);

  const onFolioUpdatedRef = React.useRef(onFolioUpdated);
  onFolioUpdatedRef.current = onFolioUpdated;

  async function applyFolio(data: Partial<FolioState> & { totalAmountMinorUnits?: number; paidAmountMinorUnits?: number }) {
    const next: FolioState = {
      totalAmountMinorUnits: Number(data.totalAmountMinorUnits || 0),
      paidAmountMinorUnits: Number(data.paidAmountMinorUnits || 0),
      pendingTransferProof: Boolean(data.pendingTransferProof),
      invoices: Array.isArray(data.invoices) ? data.invoices : [],
    };
    setFolio(next);
    if (folioBalance(next.totalAmountMinorUnits, next.paidAmountMinorUnits) <= 0) {
      setOutstandingAuthorized(false);
      setConfirmOutstanding(false);
    }
    onFolioUpdatedRef.current?.({
      paidAmountMinorUnits: next.paidAmountMinorUnits,
      totalAmountMinorUnits: next.totalAmountMinorUnits,
      pendingTransferProof: next.pendingTransferProof,
    });
    return next;
  }

  async function refreshFolio() {
    if (!reservation) return;
    const res = await fetch(`/api/reservations/${reservation.id}/folio`);
    if (!res.ok) throw new Error('Could not load payment status.');
    return applyFolio(await res.json());
  }

  React.useEffect(() => {
    if (!open || !reservation) return;
    setErrorMsg(null);
    setChangingRoom(false);
    setSelectedRoomId(reservation.roomId || '');
    setPayOpen(false);
    setConfirmOutstanding(false);
    setOutstandingAuthorized(false);
    setFolio({
      totalAmountMinorUnits: reservation.totalAmountMinorUnits,
      paidAmountMinorUnits: reservation.paidAmountMinorUnits,
      pendingTransferProof: Boolean(reservation.pendingTransferProof),
      invoices: [],
    });
    setLoading(true);
    setCheckInPolicy(workspace?.property.checkInPaymentPolicy === 'require_full' ? 'require_full' : 'allow_outstanding');

    const url =
      mode === 'check-in'
        ? `/api/reservations/${reservation.id}/eligible-rooms?forCheckIn=1`
        : `/api/reservations/${reservation.id}/eligible-rooms`;

    Promise.all([
      reservation.apartmentId
        ? Promise.resolve()
        : fetch(url)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Could not load rooms'))))
        .then((data) => {
          setRooms(Array.isArray(data.rooms) ? data.rooms : []);
          if (data.assignedRoomId) setSelectedRoomId((current) => current || data.assignedRoomId);
        }),
      forCheckIn
        ? fetch(`/api/reservations/${reservation.id}/folio`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Could not load payment status.'))))
            .then((data) => applyFolio(data))
            .catch(() => undefined)
        : Promise.resolve(),
    ])
      .catch(() => setErrorMsg('Could not load eligible rooms.'))
      .finally(() => setLoading(false));
  }, [open, reservation, mode, forCheckIn, workspace?.property.checkInPaymentPolicy]);

  if (!reservation) return null;

  async function handleSubmit() {
    if (!reservation) return;
    if (forCheckIn && due > 0 && requireFull) {
      setErrorMsg('Payment required before check-in');
      return;
    }
    if (forCheckIn && due > 0 && !outstandingAuthorized) {
      setConfirmOutstanding(true);
      return;
    }
    if (reservation.apartmentId && mode === 'check-in') {
      setSubmitting(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/reservations/${reservation.id}/check-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allowOutstandingBalance: forCheckIn && due > 0 && outstandingAuthorized }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Request failed');
        onCompleted({
          roomId: reservation.roomId || '',
          roomNumber: reservation.apartmentName || reservation.roomNumber,
          status: 'checked_in',
        });
        toast.success('Guest Checked In', `${reservation.apartmentName} is now occupied.`);
        onOpenChange(false);
      } catch (error: any) {
        setErrorMsg(error.message || 'Could not complete this request.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (mustChooseRoom && !selectedRoomId) {
      setErrorMsg('Select a physical room.');
      return;
    }
    const roomId = selectedRoomId || reservation.roomId;
    if (!roomId) {
      setErrorMsg('Select a physical room.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const endpoint =
        mode === 'check-in'
          ? `/api/reservations/${reservation.id}/check-in`
          : `/api/reservations/${reservation.id}/assign-room`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, allowOutstandingBalance: forCheckIn && due > 0 && outstandingAuthorized }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'ROOM_ASSIGNMENT_REQUIRED' || /physical room/i.test(data.error || '')) {
          setChangingRoom(true);
        }
        throw new Error(data.error || 'Request failed');
      }

      const selected = rooms.find((room) => room.id === roomId);
      const roomNumber = data.roomNumber || selected?.roomNumber || reservation.roomNumber;
      onCompleted({
        roomId,
        roomNumber,
        status: mode === 'check-in' ? 'checked_in' : reservation.status,
      });
      toast.success(
        mode === 'check-in' ? 'Guest Checked In' : assigned ? 'Room Changed' : 'Room Assigned',
        `Room ${roomNumber} ${mode === 'check-in' ? 'assigned successfully.' : 'is now assigned.'}`
      );
      onOpenChange(false);
    } catch (error: any) {
      setErrorMsg(error.message || 'Could not complete this request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendOrViewInvoice(action: 'send' | 'view') {
    if (!reservation) return;
    setInvoiceBusy(true);
    setErrorMsg(null);
    try {
      let invoice = folio?.invoices[0];
      if (!invoice) {
        const createRes = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceType: 'guest_folio',
            recipientName: reservation.guestName,
            recipientEmail: reservation.guestEmail || undefined,
            reservationId: reservation.id,
            bookingGroupId: reservation.bookingGroupId || undefined,
            items: [
              {
                description: `${reservation.roomType} · ${reservation.nights} night stay`,
                quantity: 1,
                unitPriceMinorUnits: totalAmountMinorUnits,
              },
            ],
          }),
        });
        const created = await createRes.json().catch(() => ({}));
        if (!createRes.ok) throw new Error(created.error || 'Could not create invoice.');
        invoice = created.invoice;
        await refreshFolio().catch(() => undefined);
      }
      if (action === 'view') {
        if (!invoice?.publicToken) throw new Error('Invoice is not available to view yet.');
        window.open(`/invoice/${invoice.publicToken}`, '_blank', 'noopener,noreferrer');
        return;
      }
      if (!invoice?.id) throw new Error('Invoice is not available yet.');
      if (!invoice?.id) throw new Error('Invoice is not available yet.');
      if (!reservation.guestEmail) throw new Error('Add a guest email before sending an invoice.');
      const sendRes = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const sent = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok) throw new Error(sent.error || 'Could not send invoice.');
      toast.success('Invoice sent', sent.message || `Invoice sent to ${reservation.guestEmail}.`);
    } catch (error: any) {
      setErrorMsg(error.message || 'Could not complete the invoice request.');
    } finally {
      setInvoiceBusy(false);
    }
  }

  const title =
    mode === 'check-in' ? t('checkInGuest') : assigned && mode === 'change' ? t('changeRoom') : t('assignRoom');
  const actionLabel =
    mode === 'check-in'
      ? assigned && !changingRoom
        ? t('confirmCheckIn')
        : t('assignAndCheckIn')
      : assigned
        ? t('saveRoom')
        : t('assignRoom');

  const continueLabel =
    payment.kind === 'partially_paid' ? t('continueWithDue', { amount: isolateLtr(formatNaira(due)) }) : t('continueWithoutPayment');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPayOpen(false);
          setConfirmOutstanding(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
        <DialogHeader>
          <DialogTitle className="text-lg text-[#71382D] font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-xs text-[#7A7267]">
            {reservation.guestName} · {reservation.reference}
          </DialogDescription>
        </DialogHeader>

        {payOpen ? (
          <RecordPaymentDialog
            open
            embedded
            onClose={() => setPayOpen(false)}
            reservationId={reservation.id}
            guestName={reservation.guestName}
            reference={reservation.reference}
            outstandingMinorUnits={due}
            onRecorded={() => {
              refreshFolio().catch(() => setErrorMsg('Payment was recorded. Refresh payment status.'));
            }}
          />
        ) : confirmOutstanding ? (
          <div className="space-y-3 py-2 text-xs">
            <p className="text-base text-[#71382D] font-semibold">{t('continueWithoutPaymentQuestion')}</p>
            <p className="text-sm text-[#191816]">{t('willRemainDue', { amount: isolateLtr(formatNaira(due)) })}</p>
            <p className="text-[#7A7267]">{t('guestWillStillOwe', { amount: isolateLtr(formatNaira(due)) })}</p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirmOutstanding(false)}>
                {tCommon('cancel')}
              </Button>
              <Button
                type="button"
                className="min-h-11 bg-[#71382D] hover:bg-[#5A2C23] text-white"
                onClick={() => {
                  setOutstandingAuthorized(true);
                  setConfirmOutstanding(false);
                }}
              >
                {tCommon('continue')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#8C8275]">{tCommon('guest')}</span>
                  <strong className="text-[#191816]">{reservation.guestName}</strong>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#8C8275]">{tCommon('roomType')}</span>
                  <strong className="text-[#191816]">{reservation.roomType}</strong>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#8C8275]">{t('assignedRoom')}</span>
                  <strong className="text-[#191816]">{formatAssignedRoom(reservation.roomNumber)}</strong>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#8C8275]">{tCommon('stay')}</span>
                  <strong className="text-[#191816]">{formatStayDates(reservation.checkInDate, reservation.checkOutDate)}</strong>
                </div>
              </div>

              {forCheckIn && (
                <CheckInPaymentStatus
                  totalAmountMinorUnits={totalAmountMinorUnits}
                  paidAmountMinorUnits={paidAmountMinorUnits}
                  pendingTransferProof={pendingTransferProof}
                />
              )}

              {forCheckIn && moneyDue && (
                <div className="space-y-2">
                  {requireFull ? (
                    <p className="font-medium text-[#71382D]">{t('paymentRequiredBeforeCheckIn')}</p>
                  ) : (
                    <p className="text-[#7A7267]">{t('guestWillStillOwe', { amount: isolateLtr(formatNaira(due)) })}</p>
                  )}
                  <div className="flex flex-col gap-2">
                    <Button type="button" className="min-h-11 bg-[#71382D] hover:bg-[#5A2C23] text-white" onClick={() => setPayOpen(true)}>
                      {t('recordPayment')}
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {folio?.invoices[0] ? (
                        <Button type="button" variant="outline" className="min-h-11 flex-1" disabled={invoiceBusy} onClick={() => handleSendOrViewInvoice('view')}>
                          {t('viewInvoice')}
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" className="min-h-11 flex-1" disabled={invoiceBusy} onClick={() => handleSendOrViewInvoice('send')}>
                        {invoiceBusy ? tCommon('sending') : t('sendInvoice')}
                      </Button>
                    </div>
                  </div>
                  {canContinueWithoutPayment && !outstandingAuthorized && (
                    <button
                      type="button"
                      onClick={() => setConfirmOutstanding(true)}
                      className="text-[#71382D] hover:underline font-medium min-h-11 text-start"
                    >
                      {continueLabel}
                    </button>
                  )}
                </div>
              )}

              {assigned && mode === 'check-in' && !changingRoom && (
                <button
                  type="button"
                  onClick={() => setChangingRoom(true)}
                  className="text-[#71382D] hover:underline font-medium"
                >
                  {t('changeRoom')}
                </button>
              )}

              {mustChooseRoom && (
                <div>
                  <Label id="check-in-room-label">{assigned ? t('selectAnotherRoom') : t('selectRoom')}</Label>
                  <PhysicalRoomSelect
                    rooms={rooms}
                    value={selectedRoomId}
                    onChange={setSelectedRoomId}
                    loading={loading}
                    labelledBy="check-in-room-label"
                    emptyLabel={t('noEligibleRooms')}
                  />
                </div>
              )}

              {errorMsg && (
                <p className="rounded bg-red-50 text-red-700 px-2.5 py-2 font-medium" role="alert">
                  {errorMsg}
                </p>
              )}
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)} disabled={submitting}>
                {tCommon('cancel')}
              </Button>
              <Button
                type="button"
                className="min-h-11 bg-[#71382D] hover:bg-[#5A2C23] text-white"
                disabled={
                  submitting ||
                  loading ||
                  (mustChooseRoom && !selectedRoomId) ||
                  (forCheckIn && checkInBlocked)
                }
                onClick={handleSubmit}
              >
                {submitting ? tCommon('saving') : actionLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
