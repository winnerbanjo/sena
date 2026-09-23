'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge, Button } from '@sena/ui';
import { Layers, Plus } from 'lucide-react';
import { INITIAL_ROOMS } from '../../components/mock-data';
import { Topbar } from '../../components/topbar';

export default function RoomsPage() {
  const [filter, setFilter] = React.useState('all');

  const filteredRooms = INITIAL_ROOMS.filter((r) => {
    if (filter === 'occupied') return r.operational === 'occupied';
    if (filter === 'available') return r.operational === 'available';
    if (filter === 'maintenance') return r.operational === 'maintenance';
    if (filter === 'dirty') return r.housekeeping === 'dirty';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title="Rooms" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              Know Every Room
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Real-time operational occupancy and housekeeping readiness states.
            </p>
          </div>

          <Button size="sm">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add room
          </Button>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 border-b border-[#E8E2DA] pb-3 text-xs overflow-x-auto whitespace-nowrap">
          {[
            { id: 'all', label: `All (${INITIAL_ROOMS.length})` },
            { id: 'available', label: 'Available' },
            { id: 'occupied', label: 'Occupied' },
            { id: 'dirty', label: 'Needs Cleaning' },
            { id: 'maintenance', label: 'Maintenance' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                filter === f.id
                  ? 'bg-[#71382D] text-white'
                  : 'text-[#7A7267] hover:bg-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Room Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredRooms.map((room) => (
            <div
              key={room.id}
              className="bg-white border border-[#E8E2DA] p-4 rounded-md space-y-3 hover:border-[#7A7267] transition-all"
            >
              <div className="flex items-center justify-between">
                <strong className="text-xl font-serif text-[#191816]">
                  Room {room.number}
                </strong>
                <Badge
                  variant={
                    room.operational === 'occupied'
                      ? 'occupied'
                      : room.operational === 'maintenance'
                      ? 'danger'
                      : 'available'
                  }
                >
                  {room.operational}
                </Badge>
              </div>

              <div>
                <span className="text-xs font-medium text-[#191816] block">
                  {room.type}
                </span>
                <span className="text-[11px] text-[#7A7267]">{room.floor}</span>
              </div>

              <div className="pt-2 border-t border-[#E8E2DA] flex items-center justify-between text-xs">
                <span className="text-[#7A7267]">Housekeeping:</span>
                <Badge
                  variant={
                    room.housekeeping === 'clean'
                      ? 'clean'
                      : room.housekeeping === 'cleaning'
                      ? 'cleaning'
                      : 'dirty'
                  }
                >
                  {room.housekeeping}
                </Badge>
              </div>

              {/* Cross-module contextual shortcuts */}
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono">
                {room.housekeeping === 'dirty' ? (
                  <Link
                    href="/housekeeping"
                    className="text-[#B85C3E] hover:underline flex items-center gap-1 font-sans"
                  >
                    Open Housekeeping Board →
                  </Link>
                ) : room.operational === 'occupied' ? (
                  <Link
                    href={`/reservations?search=${room.number}`}
                    className="text-[#71382D] hover:underline flex items-center gap-1 font-sans"
                  >
                    View Reservation →
                  </Link>
                ) : (
                  <Link
                    href={`/front-desk`}
                    className="text-[#7A7267] hover:text-[#191816] hover:underline flex items-center gap-1 font-sans"
                  >
                    Assign in Front Desk →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
