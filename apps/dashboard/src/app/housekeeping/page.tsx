'use client';

import { PageLoadState, readJsonResponse } from '../../components/page-load-state';
import * as React from 'react';
import { Badge, Button } from '@sena/ui';
import { Brush, CheckCircle2, Play } from 'lucide-react';

import { Topbar } from '../../components/topbar';

export default function HousekeepingPage() {
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const fetchHousekeeping = React.useCallback(async () => {
    try {
      const res = await fetch('/api/housekeeping');
      if (!res.ok) throw new Error('Page unavailable');
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
      setLoadError(true);
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

  const [filter, setFilter] = React.useState<'all' | 'priority' | 'cleaning' | 'clean'>('all');

  const dirtyCount = rooms.filter((r) => r.housekeeping === 'dirty').length;
  const cleaningCount = rooms.filter((r) => r.housekeeping === 'cleaning').length;
  const cleanCount = rooms.filter((r) => r.housekeeping === 'clean').length;
  const maintenanceCount = rooms.filter((r) => r.operational === 'maintenance').length;

  const filteredRooms = rooms.filter((r) => {
    if (filter === 'priority') return r.housekeeping === 'dirty';
    if (filter === 'cleaning') return r.housekeeping === 'cleaning';
    if (filter === 'clean') return r.housekeeping === 'clean';
    return true;
  });

  if (loading || loadError) return <PageLoadState title="Housekeeping" failed={loadError} />;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar title="Housekeeping" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              Room Readiness & Turnover
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Live housekeeping roster designed for seamless frontline mobile & floor operations.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-[#B85C3E] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#B85C3E] animate-pulse" />
              {dirtyCount} pending turnover
            </span>
          </div>
        </div>

        {/* Editorial Turnover Summary Strip */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-6 py-2.5 px-4 rounded-lg bg-[#FAF9F6] border border-[#E8E2DA] text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`transition-colors ${filter === 'all' ? 'text-[#191816] font-semibold underline underline-offset-4 decoration-[#B85C3E]' : 'text-[#7A7267] hover:text-[#191816]'}`}
          >
            All Inventory ({rooms.length})
          </button>
          <span className="text-[#E8E2DA]">·</span>
          <button
            onClick={() => setFilter('priority')}
            className={`inline-flex items-center gap-1.5 transition-colors ${filter === 'priority' ? 'text-[#191816] font-semibold underline underline-offset-4 decoration-[#B85C3E]' : 'text-[#7A7267] hover:text-[#191816]'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#B85C3E]" />
            Needs Cleaning ({dirtyCount})
          </button>
          <span className="text-[#E8E2DA]">·</span>
          <button
            onClick={() => setFilter('cleaning')}
            className={`inline-flex items-center gap-1.5 transition-colors ${filter === 'cleaning' ? 'text-[#191816] font-semibold underline underline-offset-4 decoration-[#3B6699]' : 'text-[#7A7267] hover:text-[#191816]'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B6699]" />
            In Service ({cleaningCount})
          </button>
          <span className="text-[#E8E2DA]">·</span>
          <button
            onClick={() => setFilter('clean')}
            className={`inline-flex items-center gap-1.5 transition-colors ${filter === 'clean' ? 'text-[#191816] font-semibold underline underline-offset-4 decoration-[#2E6B4F]' : 'text-[#7A7267] hover:text-[#191816]'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E6B4F]" />
            Inspected & Ready ({cleanCount})
          </button>
        </div>

        {/* Actionable Turnover List */}
        <div className="space-y-3">
          {filteredRooms.length === 0 ? (
            <div className="p-8 text-center border border-[#E8E2DA] rounded-lg bg-[#FAF9F6]">
              <p className="text-xs text-[#7A7267]">
                {loading ? 'Checking live room states...' : 'No rooms match the selected status.'}
              </p>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isDirty = room.housekeeping === 'dirty';
              const isCleaning = room.housekeeping === 'cleaning';
              const isClean = room.housekeeping === 'clean';

              return (
                <div
                  key={room.id}
                  className={`p-4 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isDirty
                      ? 'bg-[#FDFBF7] border-[#E5D4BC]'
                      : isCleaning
                      ? 'bg-[#F7FAFC] border-[#C3D9EB]'
                      : 'bg-white border-[#E8E2DA]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <strong className="text-lg font-serif font-normal text-[#191816]">
                        Room {room.number}
                      </strong>
                      <span className="text-xs text-[#7A7267]">
                        {room.type}
                      </span>
                      <span className="text-[10px] font-mono text-[#7A7267] uppercase bg-black/5 px-1.5 py-0.5 rounded">
                        {room.floor}
                      </span>
                    </div>
                    <div className="text-xs text-[#7A7267] flex items-center gap-2">
                      <span className="font-mono text-[11px]">
                        Status:
                      </span>
                      <span className={`font-medium ${isDirty ? 'text-[#B85C3E]' : isCleaning ? 'text-[#3B6699]' : 'text-[#2E6B4F]'}`}>
                        {isDirty ? 'Awaiting Turnover' : isCleaning ? 'Service In Progress' : 'Clean & Inspected'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isDirty && (
                      <Button
                        size="sm"
                        onClick={() => startCleaning(room.id)}
                        className="text-xs bg-[#B85C3E] hover:bg-[#A04F34] text-white"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" />
                        Start service
                      </Button>
                    )}

                    {isCleaning && (
                      <Button
                        size="sm"
                        onClick={() => markClean(room.id)}
                        className="text-xs bg-[#2E6B4F] hover:bg-[#255740] text-white"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Mark clean & ready
                      </Button>
                    )}

                    {isClean && (
                      <span className="text-xs text-[#2E6B4F] font-medium flex items-center gap-1.5 py-1.5 px-3 rounded bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready for arrival
                      </span>
                    )}
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
