'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatNaira, formatStayDates } from '@sena/config';
import {
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sena/ui';
import type { ReservationItem } from './mock-data';
import { formatAssignedRoom, isPhysicalRoomAssigned } from './reservation-room';
import { deskPaymentStatus, folioBalance } from '../lib/financial-status';
import { RecordPaymentDialog } from './record-payment-dialog';
import { CheckInPaymentStatus } from './check-in-payment-status';
import { ReservationNotes } from './reservation-notes';
import { EditReservationDialog } from './edit-reservation-dialog';
import { Calendar, CheckCircle2, Mail, Phone } from 'lucide-react';

interface ReservationDrawerProps {
  reservation: ReservationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckIn?: (id: string) => void;
  onAssignRoom?: (id: string) => void;
  onCheckOut?: (id: string) => void;
  onPaymentRecorded?: () => void;
  onNotesChanged?: () => void;
  onUpdated?: (reservation: ReservationItem) => void;
}

export function ReservationDrawer({
  reservation,
  open,
  onOpenChange,
  onCheckIn,
  onAssignRoom,
  onCheckOut,
  onPaymentRecorded,
  onNotesChanged,
  onUpdated,
}: ReservationDrawerProps) {
  const t = useTranslations('payments');
  const [payOpen, setPayOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [groupRooms, setGroupRooms] = React.useState<Array<{ id: string; reference: string; roomNumber: string | null; status: string }>>([]);
  const [history, setHistory] = React.useState<any[]>([]);
  const [historyVersion, setHistoryVersion] = React.useState(0);

  React.useEffect(() => {
    if (!open || !reservation) return;
    fetch(`/api/payments?reservationId=${reservation.id}`)
      .then((res) => (res.ok ? res.json() : { payments: [] }))
      .then((data) => setHistory(Array.isArray(data.payments) ? data.payments : []))
      .catch(() => setHistory([]));
  }, [open, reservation, historyVersion]);

  React.useEffect(() => {
    if (!open || !reservation?.bookingGroupId) {
      setGroupRooms([]);
      return;
    }
    fetch(`/api/booking-groups/${reservation.bookingGroupId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setGroupRooms(Array.isArray(data?.bookingGroup?.reservations) ? data.bookingGroup.reservations : []))
      .catch(() => setGroupRooms([]));
  }, [open, reservation?.bookingGroupId]);

  if (!reservation) return null;

  const isCheckedIn = reservation.status === 'checked_in';
  const isConfirmed = reservation.status === 'confirmed';
  const isCheckedOut = reservation.status === 'checked_out';
  const hasRoom = isPhysicalRoomAssigned(reservation);
  const outstanding = folioBalance(reservation.totalAmountMinorUnits, reservation.paidAmountMinorUnits);
  const payment = deskPaymentStatus({
    totalAmountMinorUnits: reservation.totalAmountMinorUnits,
    paidAmountMinorUnits: reservation.paidAmountMinorUnits,
    pendingTransferProof: reservation.pendingTransferProof,
  });
  const paymentActionLabel = 'Record payment';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-0 flex flex-col bg-white border-l border-[#E8E2DA]">
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#E8E2DA] bg-[#FAFAFA]">
          <div className="flex items-center justify-between pr-8 mb-2">
            <span className="text-xs font-mono font-semibold tracking-wider text-[#B85C3E]">
              {reservation.reference}
            </span>
            <Badge
              variant={
                reservation.status === 'checked_in'
                  ? 'occupied'
                  : reservation.status === 'checked_out'
                  ? 'clean'
                  : 'available'
              }
            >
              {reservation.status.replace('_', ' ')}
            </Badge>
          </div>
          <DrawerTitle className="text-2xl text-[#191816] font-semibold">
            {reservation.guestName}
          </DrawerTitle>
          <p className="text-xs text-[#7A7267] mt-1">
            {reservation.apartmentName ? reservation.apartmentName : `${reservation.roomType} · ${formatAssignedRoom(reservation.roomNumber)}`}
          </p>
        </div>

        {/* Action bar */}
        <div className="px-6 py-3 border-b border-[#E8E2DA] bg-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isConfirmed && (
              <Button
                size="sm"
                onClick={() => onCheckIn?.(reservation.id)}
                className="bg-[#2E6B4F] hover:bg-[#255740]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Check in
              </Button>
            )}
            {(isConfirmed || isCheckedIn) && (
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                Edit stay
              </Button>
            )}
            {isConfirmed && !reservation.apartmentId && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onAssignRoom?.(reservation.id)}
              >
                {hasRoom ? 'Change Room' : 'Assign Room'}
              </Button>
            )}
            {isCheckedIn && (
              <Button
                size="sm"
                variant="dark"
                onClick={() => onCheckOut?.(reservation.id)}
              >
                Check out
              </Button>
            )}
            {outstanding > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setPayOpen(true)}>
                {paymentActionLabel}
              </Button>
            )}
            {outstanding <= 0 && isCheckedOut && (
              <span className="text-xs font-medium text-[#2E6B4F]">Paid</span>
            )}
          </div>
          <span className="text-xs text-[#7A7267]">
            Source: <strong className="text-[#191816] capitalize">{reservation.source.replace('_', ' ')}</strong>
          </span>
        </div>

        {/* Tabbed details */}
        <div className="p-6 flex-1 overflow-y-auto bg-white">
          <Tabs defaultValue="stay" className="w-full">
            <TabsList>
              <TabsTrigger value="stay">Stay</TabsTrigger>
              <TabsTrigger value="guest">Guest</TabsTrigger>
              <TabsTrigger value="payment">Payment</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            {/* STAY TAB */}
            <TabsContent value="stay" className="space-y-4 pt-2">
              <div className="bg-[#FAFAFA] p-4 rounded border border-[#E8E2DA]">
                <div className="flex items-center gap-2 text-xs text-[#7A7267] mb-1">
                  <Calendar className="w-4 h-4 text-[#B85C3E]" />
                  <span>DATES & DURATION</span>
                </div>
                <div className="text-base text-[#191816] font-medium">
                  {formatStayDates(reservation.checkInDate, reservation.checkOutDate)}
                </div>
                <div className="text-xs text-[#7A7267] mt-1">
                  {reservation.nights} nights · {reservation.numGuests} guests
                </div>
                {groupRooms.length > 1 ? (
                  <div className="mt-3 space-y-1">
                    <span className="text-[11px] uppercase tracking-wider text-[#7A7267]">Rooms in this booking</span>
                    {groupRooms.map((stay) => (
                      <div key={stay.id} className="flex items-center justify-between text-xs text-[#191816]">
                        <span>Room {stay.roomNumber || 'Unassigned'} · {stay.reference}</span>
                        <span className="text-[#7A7267]">{stay.status.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded border border-[#E8E2DA] bg-white">
                  <span className="text-[11px] text-[#7A7267] font-medium uppercase tracking-wider block mb-1">
                    Room Category
                  </span>
                  <strong className="text-sm text-[#191816] block">
                    {reservation.roomType}
                  </strong>
                </div>
                <div className="p-4 rounded border border-[#E8E2DA] bg-white">
                  <span className="text-[11px] text-[#7A7267] font-medium uppercase tracking-wider block mb-1">
                    Assigned Room
                  </span>
                  <strong className="text-sm text-[#191816] block">
                    {reservation.apartmentName || formatAssignedRoom(reservation.roomNumber)}
                  </strong>
                </div>
              </div>
              <ReservationNotes reservationId={reservation.id} onChanged={onNotesChanged} />
            </TabsContent>

            {/* GUEST TAB */}
            <TabsContent value="guest" className="space-y-4 pt-2">
              <div className="p-4 rounded border border-[#E8E2DA] bg-white space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#E5D4BC] text-[#71382D] flex items-center justify-center font-bold text-sm">
                    {reservation.guestName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <strong className="text-base text-[#191816] block font-semibold">
                      {reservation.guestName}
                    </strong>
                    <span className="text-xs text-[#7A7267]">
                      Returning guest · 4 stays
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E8E2DA] space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-[#191816]">
                    <Mail className="w-3.5 h-3.5 text-[#7A7267]" />
                    <span>{reservation.guestEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#191816]">
                    <Phone className="w-3.5 h-3.5 text-[#7A7267]" />
                    <span>{reservation.guestPhone}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* PAYMENT TAB */}
            <TabsContent value="payment" className="space-y-4 pt-2">
              <CheckInPaymentStatus
                totalAmountMinorUnits={reservation.totalAmountMinorUnits}
                paidAmountMinorUnits={reservation.paidAmountMinorUnits}
                pendingTransferProof={reservation.pendingTransferProof}
              />
              <div className="p-5 rounded border border-[#E8E2DA] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#7A7267] font-medium uppercase tracking-wider">
                    Total Amount
                  </span>
                  <Badge variant={outstanding <= 0 ? 'paid' : 'pending'}>
                    {payment.label}
                  </Badge>
                </div>
                <strong className="text-2xl text-[#191816] block font-semibold">
                  {formatNaira(reservation.totalAmountMinorUnits)}
                </strong>
                <div className="flex items-center justify-between text-xs text-[#7A7267] pt-2 border-t border-[#E8E2DA]">
                  <span>Paid so far:</span>
                  <strong className="text-[#2E6B4F]">
                    {formatNaira(reservation.paidAmountMinorUnits)}
                  </strong>
                </div>
                {outstanding > 0 && (
                  <div className="flex items-center justify-between text-xs text-[#7A7267]">
                    <span>Amount due:</span>
                    <strong className="text-[#B85C3E]">
                      {formatNaira(outstanding)}
                    </strong>
                  </div>
                )}
                {outstanding > 0 && (
                  <Button size="sm" className="w-full" onClick={() => setPayOpen(true)}>
                    {paymentActionLabel}
                  </Button>
                )}
                <div className="pt-2 border-t border-[#E8E2DA] space-y-2">
                  {history.map((payment) => (
                    <div key={payment.id} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span>{payment.method === 'bank_transfer' ? 'Bank transfer' : payment.method === 'pos' ? 'POS' : payment.provider === 'paystack' ? 'Paystack' : 'Cash'}</span>
                        <strong>{formatNaira(payment.amountMinorUnits)}</strong>
                      </div>
                      {payment.hasReceipt && (
                        <div className="flex flex-wrap gap-x-3">
                          <a className="text-[#71382D] underline" href={`/api/payments/${payment.id}/receipt`} target="_blank" rel="noopener noreferrer">{t('viewReceipt')}</a>
                          <a className="text-[#71382D] underline" href={`/api/payments/${payment.id}/receipt?download=1`} target="_blank" rel="noopener noreferrer">{t('downloadReceipt')}</a>
                        </div>
                      )}
                    </div>
                  ))}
                  <Link
                    href={`/invoices?search=${encodeURIComponent(reservation.reference)}`}
                    className="inline-flex items-center gap-1 text-xs text-[#71382D] hover:underline font-medium"
                  >
                    <span>View or issue official stay folio invoice &rarr;</span>
                  </Link>
                </div>
              </div>
            </TabsContent>

            {/* TIMELINE TAB */}
            <TabsContent value="timeline" className="pt-2">
              <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-[#E8E2DA]">
                {reservation.timeline.map((event, idx) => (
                  <div key={idx} className="flex items-start gap-4 relative pl-6">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B85C3E] absolute left-1.5 top-1 ring-4 ring-white" />
                    <div>
                      <p className="text-xs font-medium text-[#191816]">
                        {event.text}
                      </p>
                      <span className="text-[11px] text-[#7A7267]">
                        {event.time} · {event.actor}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <EditReservationDialog
          reservation={reservation}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={(updated) => {
            onUpdated?.(updated);
            onNotesChanged?.();
          }}
        />
        <RecordPaymentDialog
          open={payOpen}
          onClose={() => setPayOpen(false)}
          reservationId={reservation.id}
          guestName={reservation.guestName}
          reference={reservation.reference}
          outstandingMinorUnits={outstanding}
          checkedOut={isCheckedOut}
          onRecorded={() => {
            setHistoryVersion((version) => version + 1);
            onPaymentRecorded?.();
          }}
        />
      </DrawerContent>
    </Drawer>
  );
}
