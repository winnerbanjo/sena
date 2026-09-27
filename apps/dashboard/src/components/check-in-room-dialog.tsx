'use client';

import * as React from 'react';
import { formatStayDates } from '@sena/config';
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
import { formatAssignedRoom, isPhysicalRoomAssigned, type EligiblePhysicalRoom } from './reservation-room';
import { PhysicalRoomSelect } from './physical-room-select';
import { useToast } from './toast-notification';

export type RoomAssignmentMode = 'check-in' | 'assign' | 'change';

interface CheckInRoomDialogProps {
  reservation: ReservationItem | null;
  mode: RoomAssignmentMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (update: { roomId: string; roomNumber: string; status?: ReservationItem['status'] }) => void;
}

export function CheckInRoomDialog({
  reservation,
  mode,
  open,
  onOpenChange,
  onCompleted,
}: CheckInRoomDialogProps) {
  const toast = useToast();
  const [rooms, setRooms] = React.useState<EligiblePhysicalRoom[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = React.useState('');
  const [changingRoom, setChangingRoom] = React.useState(false);

  const assigned = reservation ? isPhysicalRoomAssigned(reservation) : false;
  const forCheckIn = mode === 'check-in';
  const mustChooseRoom = !assigned || changingRoom || mode !== 'check-in';

  React.useEffect(() => {
    if (!open || !reservation) return;
    setErrorMsg(null);
    setChangingRoom(false);
    setSelectedRoomId(reservation.roomId || '');
    setLoading(true);

    const url =
      mode === 'check-in'
        ? `/api/reservations/${reservation.id}/eligible-rooms?forCheckIn=1`
        : `/api/reservations/${reservation.id}/eligible-rooms`;

    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Could not load rooms'))))
      .then((data) => {
        setRooms(Array.isArray(data.rooms) ? data.rooms : []);
        if (data.assignedRoomId) setSelectedRoomId((current) => current || data.assignedRoomId);
      })
      .catch(() => setErrorMsg('Could not load eligible rooms.'))
      .finally(() => setLoading(false));
  }, [open, reservation, mode]);

  if (!reservation) return null;

  async function handleSubmit() {
    if (!reservation) return;
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
        body: JSON.stringify({ roomId }),
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

  const title =
    mode === 'check-in' ? 'Check In Guest' : assigned && mode === 'change' ? 'Change Room' : 'Assign Room';
  const actionLabel =
    mode === 'check-in'
      ? assigned && !changingRoom
        ? 'Confirm Check In'
        : 'Assign & Check In'
      : assigned
        ? 'Save Room'
        : 'Assign Room';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-[#71382D]">{title}</DialogTitle>
          <DialogDescription className="text-xs text-[#7A7267]">
            {reservation.guestName} · {reservation.reference}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-[#8C8275]">Guest</span>
              <strong className="text-[#191816]">{reservation.guestName}</strong>
            </div>
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-[#8C8275]">Room Type</span>
              <strong className="text-[#191816]">{reservation.roomType}</strong>
            </div>
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-[#8C8275]">Assigned Room</span>
              <strong className="text-[#191816]">{formatAssignedRoom(reservation.roomNumber)}</strong>
            </div>
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-[#8C8275]">Stay</span>
              <strong className="text-[#191816]">{formatStayDates(reservation.checkInDate, reservation.checkOutDate)}</strong>
            </div>
          </div>

          {assigned && mode === 'check-in' && !changingRoom && (
            <button
              type="button"
              onClick={() => setChangingRoom(true)}
              className="text-[#71382D] hover:underline font-medium"
            >
              Change Room
            </button>
          )}

          {mustChooseRoom && (
            <div>
              <Label id="check-in-room-label">{assigned ? 'Select another room' : 'Select Room'}</Label>
              <PhysicalRoomSelect
                rooms={rooms}
                value={selectedRoomId}
                onChange={setSelectedRoomId}
                loading={loading}
                labelledBy="check-in-room-label"
                emptyLabel="No eligible rooms for this stay."
              />
            </div>
          )}

          {errorMsg && (
            <p className="rounded bg-red-50 text-red-700 px-2.5 py-2 font-medium" role="alert">
              {errorMsg}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#71382D] hover:bg-[#5A2C23] text-white"
            disabled={submitting || loading || (mustChooseRoom && !selectedRoomId)}
            onClick={handleSubmit}
          >
            {submitting ? 'Saving…' : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
