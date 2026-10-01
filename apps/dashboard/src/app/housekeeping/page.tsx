'use client';
import { pageMain } from '../../components/design';
import { useTranslations } from 'next-intl';

import { PageLoadState } from '../../components/page-load-state';
import * as React from 'react';
import { Button } from '@sena/ui';
import { CheckCircle2, Play } from 'lucide-react';
import { Topbar } from '../../components/topbar';

type HousekeepingRoom = {
  id: string;
  kind: 'room' | 'apartment';
  number: string;
  type: string;
  floor: string;
  operational: string;
  housekeeping: string;
  assignedToUserId: string | null;
  assignedTo: string | null;
  updatedAt?: string;
};

type StaffOption = { userId: string; name: string; role: string };

function readinessLabel(room: HousekeepingRoom) {
  if (room.operational === 'maintenance' || room.operational === 'blocked') return 'Out of service';
  if (room.housekeeping === 'dirty') return room.assignedTo ? `Needs cleaning · ${room.assignedTo}` : 'Needs cleaning';
  if (room.housekeeping === 'cleaning') return room.assignedTo ? `Cleaning · ${room.assignedTo}` : 'Cleaning';
  return 'Clean & Ready';
}

export default function HousekeepingPage() {
  const t = useTranslations('housekeeping');
  const [rooms, setRooms] = React.useState<HousekeepingRoom[]>([]);
  const [staff, setStaff] = React.useState<StaffOption[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<'all' | 'dirty' | 'assigned' | 'cleaning' | 'clean' | 'mine'>('all');

  const fetchHousekeeping = React.useCallback(async () => {
    try {
      const res = await fetch('/api/housekeeping', { cache: 'no-store' });
      if (!res.ok) throw new Error('Page unavailable');
      const data = await res.json();
      if (data.rooms) {
        setRooms(
          data.rooms.map((r: any) => ({
            id: r.id,
            kind: r.kind === 'apartment' ? 'apartment' : 'room',
            number: r.roomNumber,
            type: r.roomTypeName,
            floor: r.floor || 'Floor 1',
            operational: r.operationalStatus,
            housekeeping: r.housekeepingStatus,
            assignedToUserId: r.assignedToUserId || null,
            assignedTo: r.assignedTo || null,
            updatedAt: r.taskUpdatedAt || r.updatedAt,
          }))
        );
      }
      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setCurrentUserId(data.currentUserId || null);
    } catch (e) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchHousekeeping();
  }, [fetchHousekeeping]);

  async function mutate(roomId: string, body: Record<string, unknown>) {
    setBusyId(roomId);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/housekeeping', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(rooms.find((room) => room.id === roomId)?.kind === 'apartment' ? { apartmentId: roomId, ...body } : { roomId, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update this room.');
      await fetchHousekeeping();
    } catch (error: any) {
      setErrorMsg(error.message || 'Could not update this room.');
    } finally {
      setBusyId(null);
    }
  }

  const dirtyCount = rooms.filter((r) => r.housekeeping === 'dirty').length;
  const cleaningCount = rooms.filter((r) => r.housekeeping === 'cleaning').length;
  const cleanCount = rooms.filter((r) => r.housekeeping === 'clean' || r.housekeeping === 'inspection').length;
  const assignedCount = rooms.filter((r) => (r.housekeeping === 'dirty' || r.housekeeping === 'cleaning') && r.assignedToUserId).length;

  const filteredRooms = rooms.filter((r) => {
    if (filter === 'dirty') return r.housekeeping === 'dirty';
    if (filter === 'assigned') return Boolean(r.assignedToUserId) && (r.housekeeping === 'dirty' || r.housekeeping === 'cleaning');
    if (filter === 'cleaning') return r.housekeeping === 'cleaning';
    if (filter === 'clean') return r.housekeeping === 'clean' || r.housekeeping === 'inspection';
    if (filter === 'mine') return currentUserId && r.assignedToUserId === currentUserId && (r.housekeeping === 'dirty' || r.housekeeping === 'cleaning');
    return true;
  });

  if (loading || loadError) return <PageLoadState title={t('title')} failed={loadError} />;

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden bg-[#FAF8F6]">
      <Topbar title={t('title')} />

      <main className={pageMain}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#71382D]">
            <span className="w-2 h-2 rounded-full bg-[#B85C3E]" />
            {dirtyCount} need cleaning
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 px-4 rounded-lg bg-[#FAF9F6] border border-[#E8E2DA] text-xs">
          {([
            ['all', `All (${rooms.length})`],
            ['dirty', `Needs Cleaning (${dirtyCount})`],
            ['assigned', `Assigned (${assignedCount})`],
            ['cleaning', `In Progress (${cleaningCount})`],
            ['clean', `Ready (${cleanCount})`],
            ['mine', 'My Rooms'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={filter === key ? 'text-[#191816] font-semibold underline underline-offset-4 decoration-[#B85C3E]' : 'text-[#7A7267] hover:text-[#191816]'}
            >
              {label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <p className="rounded bg-red-50 text-red-700 px-3 py-2 text-xs font-medium" role="alert">
            {errorMsg}
          </p>
        )}

        <div className="space-y-3">
          {filteredRooms.length === 0 ? (
            <div className="p-8 text-center border border-[#E8E2DA] rounded-lg bg-[#FAF9F6]">
              <p className="text-xs text-[#7A7267]">No rooms match the selected status.</p>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isDirty = room.housekeeping === 'dirty';
              const isCleaning = room.housekeeping === 'cleaning';
              const isReady = room.housekeeping === 'clean' || room.housekeeping === 'inspection';
              const busy = busyId === room.id;

              return (
                <div
                  key={room.id}
                  className={`p-4 rounded-lg border flex flex-col gap-3 ${
                    isDirty ? 'bg-[#FDFBF7] border-[#E5D4BC]' : isCleaning ? 'bg-[#F7FAFC] border-[#C3D9EB]' : 'bg-white border-[#E8E2DA]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-lg font-semibold text-[#191816]">{room.kind === 'apartment' ? room.number : `Room ${room.number}`}</strong>
                        <span className="text-xs text-[#7A7267]">{room.type}</span>
                      </div>
                      <p className={`text-xs font-medium ${isDirty ? 'text-[#B85C3E]' : isCleaning ? 'text-[#3B6699]' : 'text-[#2E6B4F]'}`}>
                        {readinessLabel(room)}
                      </p>
                      <p className="text-[11px] text-[#8C8275]">
                        Assigned to: {room.assignedTo || 'Unassigned'}
                        {room.updatedAt ? ` · Updated ${new Date(room.updatedAt).toLocaleString()}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                      {(isDirty || isCleaning) && (
                        <label className="text-[11px] text-[#8C8275] w-full sm:w-52">
                          Assign
                          <select
                            aria-label={`Assign housekeeping for room ${room.number}`}
                            className="mt-1 flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 text-xs text-[#191816]"
                            value={room.assignedToUserId || ''}
                            disabled={busy}
                            onChange={(event) => mutate(room.id, { action: 'assign', assignedToUserId: event.target.value || null })}
                          >
                            <option value="">Unassigned</option>
                            {staff.map((member) => (
                              <option key={member.userId} value={member.userId}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {isDirty && (
                          <Button size="sm" disabled={busy} onClick={() => mutate(room.id, { status: 'cleaning' })} className="text-xs bg-[#B85C3E] hover:bg-[#A04F34] text-white">
                            <Play className="w-3.5 h-3.5 mr-1" />
                            Start cleaning
                          </Button>
                        )}
                        {isCleaning && (
                          <Button size="sm" disabled={busy} onClick={() => mutate(room.id, { status: 'clean' })} className="text-xs bg-[#2E6B4F] hover:bg-[#255740] text-white">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Mark clean & ready
                          </Button>
                        )}
                        {isReady && (
                          <>
                            <span className="text-xs text-[#2E6B4F] font-medium flex items-center gap-1.5 py-1.5 px-3 rounded bg-emerald-50 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                            </span>
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => mutate(room.id, { action: 'send_to_housekeeping' })} className="text-xs">
                              Send back
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
