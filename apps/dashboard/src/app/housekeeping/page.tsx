'use client';

import * as React from 'react';
import { Badge, Button } from '@sena/ui';
import { Brush, CheckCircle2, Play } from 'lucide-react';
import { INITIAL_ROOMS } from '../../components/mock-data';
import { Topbar } from '../../components/topbar';

export default function HousekeepingPage() {
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchHousekeeping = React.useCallback(async () => {
    try {
      const res = await fetch('/api/housekeeping');
      if (res.ok) {
        const data = await res.json();
        if (data.rooms) {
          const mapped = data.rooms.map((r: any) => ({
            id: r.id,
            number: r.roomNumber,
            type: r.roomTypeName,
            floor: r.floor || 'Floor 1',
            operational: r.operationalStatus,
            housekeeping: r.housekeepingStatus,
          }));
          setRooms(mapped);
        }
      }
    } catch (e) {
      console.error('Failed to load housekeeping rooms:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchHousekeeping();
  }, [fetchHousekeeping]);

  // Transitions: Dirty -> Cleaning -> Clean via PostgreSQL
  async function startCleaning(id: string) {
    try {
      const res = await fetch('/api/housekeeping', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: id, status: 'cleaning' }),
      });
      if (res.ok) {
        fetchHousekeeping();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function markClean(id: string) {
    try {
      const res = await fetch('/api/housekeeping', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: id, status: 'clean' }),
      });
      if (res.ok) {
        fetchHousekeeping();
      }
    } catch (e) {
      console.error(e);
    }
  }

  const dirtyCount = rooms.filter((r) => r.housekeeping === 'dirty').length;
  const cleaningCount = rooms.filter((r) => r.housekeeping === 'cleaning').length;
  const cleanCount = rooms.filter((r) => r.housekeeping === 'clean').length;
  const maintenanceCount = rooms.filter((r) => r.operational === 'maintenance').length;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title="Housekeeping" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-4xl mx-auto w-full">
        {/* Mobile-first Header */}
        <div className="border-b border-[#E8E2DA] pb-4">
          <div className="flex items-center gap-2 text-[#B85C3E] mb-1">
            <Brush className="w-4 h-4" />
            <span className="text-[11px] font-mono uppercase tracking-wider">
              Room Readiness & Care
            </span>
          </div>
          <h2 className="text-2xl font-serif font-normal text-[#191816]">
            Let's make room.
          </h2>
          <p className="text-xs text-[#7A7267] mt-1">
            Live housekeeping dashboard optimized for mobile phone & tablet operation.
          </p>
        </div>

        {/* Section 50 Top Summary Counts */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          <div className="p-3 sm:p-4 rounded border border-[#E8E2DA] bg-white text-center">
            <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
              Dirty
            </span>
            <strong className="text-xl sm:text-2xl font-serif text-[#B85C3E]">
              {dirtyCount}
            </strong>
          </div>
          <div className="p-3 sm:p-4 rounded border border-[#E8E2DA] bg-white text-center">
            <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
              Cleaning
            </span>
            <strong className="text-xl sm:text-2xl font-serif text-[#3B6699]">
              {cleaningCount}
            </strong>
          </div>
          <div className="p-3 sm:p-4 rounded border border-[#E8E2DA] bg-white text-center">
            <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
              Clean
            </span>
            <strong className="text-xl sm:text-2xl font-serif text-[#2E6B4F]">
              {cleanCount}
            </strong>
          </div>
          <div className="p-3 sm:p-4 rounded border border-[#E8E2DA] bg-white text-center">
            <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block">
              Maint.
            </span>
            <strong className="text-xl sm:text-2xl font-serif text-[#7A7267]">
              {maintenanceCount}
            </strong>
          </div>
        </div>

        {/* Actionable Room Cards */}
        <div className="space-y-3">
          {rooms.map((room) => {
            const isDirty = room.housekeeping === 'dirty';
            const isCleaning = room.housekeeping === 'cleaning';
            const isClean = room.housekeeping === 'clean';

            return (
              <div
                key={room.id}
                className="bg-white border border-[#E8E2DA] p-4 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-none"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <strong className="text-base font-serif text-[#191816]">
                      Room {room.number}
                    </strong>
                    <Badge
                      variant={
                        isClean
                          ? 'clean'
                          : isCleaning
                          ? 'cleaning'
                          : isDirty
                          ? 'dirty'
                          : 'default'
                      }
                    >
                      {room.housekeeping}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#7A7267]">
                    {room.type} · {room.floor}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isDirty && (
                    <Button
                      size="sm"
                      onClick={() => startCleaning(room.id)}
                      className="w-full sm:w-auto"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Start cleaning
                    </Button>
                  )}

                  {isCleaning && (
                    <Button
                      size="sm"
                      onClick={() => markClean(room.id)}
                      className="w-full sm:w-auto bg-[#2E6B4F] hover:bg-[#255740]"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Mark clean
                    </Button>
                  )}

                  {isClean && (
                    <span className="text-xs text-[#2E6B4F] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Ready for guest
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
