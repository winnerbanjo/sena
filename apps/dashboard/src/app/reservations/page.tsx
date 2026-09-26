'use client';
import { findReadyRoom } from '../../components/reservation-room';

import { PageLoadState, readJsonResponse } from '../../components/page-load-state';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { formatNaira, formatStayDates } from '@sena/config';
import { Search } from 'lucide-react';
import { type ReservationItem } from '../../components/mock-data';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { ReservationDrawer } from '../../components/reservation-drawer';
import { Topbar } from '../../components/topbar';
import { useToast } from '../../components/toast-notification';
import { ReservationSuccessModal } from '../../components/reservation-success-modal';

function ReservationsContent() {
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

  const fetchReservations = React.useCallback(async () => {
    try {
      const res = await fetch('/api/reservations');
      if (!res.ok) throw new Error('Page unavailable');
      if (res.ok) {
        const data = await res.json();
        if (data.reservations) {
          const mapped: ReservationItem[] = data.reservations.map((r: any) => ({
            id: r.id,
            reference: r.reference,
            guestName: r.guestName || 'Unnamed Guest',
            guestEmail: r.guestEmail || '',
            guestPhone: r.guestPhone || '',
            roomType: r.roomTypeName || 'Room type unavailable',
            roomTypeId: r.roomTypeId,
            roomNumber: r.roomNumber || 'Unassigned',
            checkInDate: r.checkInDate,
            checkOutDate: r.checkOutDate,
            nights: r.nights,
            numGuests: r.numGuests || 1,
            source: r.source || 'direct',
            status: r.status,
            paymentStatus: r.paymentStatus,
            totalAmountMinorUnits: r.totalAmountMinorUnits,
            paidAmountMinorUnits: r.paidAmountMinorUnits,
            timeline: r.timeline || [],
          }));
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

  if (loading || loadError) return <PageLoadState title="Reservations" failed={loadError} />;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white text-[#191816]">
      <Topbar
        title="Reservations"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 max-w-7xl w-full mx-auto">
        {/* Editorial Ledger Header */}
        <div className="border-b border-[#E8E1D5] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#8C8275] block mb-1">
              Guest Ledger
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#71382D]">
              Master Reservations
            </h1>
            <p className="text-xs text-[#7A7267] mt-1">
              Complete chronological register of all past, in-house, and upcoming guest stays.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-[#8C8275]" />
              <input
                type="text"
                placeholder="Search guest, code, or room..."
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
            { id: 'all', label: 'All Stays' },
            { id: 'upcoming', label: 'Upcoming Arrivals' },
            { id: 'in_house', label: 'Currently In-House' },
            { id: 'completed', label: 'Departed' },
            { id: 'cancelled', label: 'Cancelled' },
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
                  <th className="py-3 px-5 font-medium">Folio Ref</th>
                  <th className="py-3 px-5 font-medium">Guest</th>
                  <th className="py-3 px-5 font-medium">Room Assigned</th>
                  <th className="py-3 px-5 font-medium">Stay Window</th>
                  <th className="py-3 px-5 font-medium">Channel</th>
                  <th className="py-3 px-5 font-medium">Settlement</th>
                  <th className="py-3 px-5 font-medium">Status</th>
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
                        <h3 className="font-serif text-lg text-[#71382D]">
                          {reservations.length === 0 ? 'No guest reservations recorded yet' : 'No stays found in this view'}
                        </h3>
                        <p className="text-xs text-[#7A7267] leading-relaxed">
                          {reservations.length === 0
                            ? 'Direct bookings captured through your guest website and manual walk-ins logged at the front desk will appear here with automated folio tracking.'
                            : 'Try selecting a different filter tab or clearing your search term.'}
                        </p>
                        {reservations.length === 0 && (
                          <div className="pt-2 flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => setNewResOpen(true)}
                              className="px-4 py-2 rounded-md bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-medium transition-colors"
                            >
                              + Record Walk-in Stay
                            </button>
                            <a
                              href="/booking-preview"
                              className="px-4 py-2 rounded-md border border-[#E5D4BC] bg-[#FAF7F2] hover:bg-[#F2EAE0] text-[#71382D] text-xs font-medium transition-colors"
                            >
                              View Direct Booking Engine &rarr;
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((res) => {
                    const isPaid = res.paymentStatus === 'paid';
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
                          {res.reference}
                        </td>
                        <td className="py-4 px-5">
                          <strong className="block font-serif text-sm text-[#191816] group-hover:text-[#B85C3E] transition-colors">
                            {res.guestName}
                          </strong>
                          <span className="text-[11px] text-[#8C8275]">{res.guestPhone || res.guestEmail}</span>
                        </td>
                        <td className="py-4 px-5">
                          <span className="font-medium text-[#191816] block">
                            Room {res.roomNumber}
                          </span>
                          <span className="text-[11px] text-[#8C8275]">{res.roomType}</span>
                        </td>
                        <td className="py-4 px-5 font-mono">
                          <span className="text-[#191816] block">
                            {formatStayDates(res.checkInDate, res.checkOutDate)}
                          </span>
                          <span className="text-[11px] text-[#8C8275]">
                            {res.nights} {res.nights === 1 ? 'night' : 'nights'}
                          </span>
                        </td>
                        <td className="py-4 px-5 capitalize text-[#7A7267]">
                          {res.source === 'direct' ? (
                            <span className="text-[#71382D] font-medium">Direct (0% fee)</span>
                          ) : (
                            res.source.replace('_', ' ')
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                            <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-[#2E6B4F]' : 'bg-[#A3681F]'}`} />
                            <span className={isPaid ? 'text-[#2E6B4F]' : 'text-[#A3681F]'}>
                              {isPaid ? 'Settled' : 'Balance Due'}
                            </span>
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono tracking-wide uppercase bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC]">
                            {res.status.replace('_', ' ')}
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
        onCheckIn={async (id) => {
          try {
            const roomRes = await fetch('/api/rooms');
            const roomData = await roomRes.json();
            const availableRoom = roomData.rooms?.find((rm: any) => rm.operational === 'available');
            if (!availableRoom) {
              toast.error('No clean rooms available', 'Please assign or clean a room before checking in.');
              return;
            }
            const res = await fetch(`/api/reservations/${id}/check-in`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId: availableRoom.id }),
            });
            if (res.ok) {
              toast.success('Guest Checked In', `Room ${availableRoom.number} assigned.`);
              fetchReservations();
              if (selectedRes && selectedRes.id === id) {
                setSelectedRes((prev) => (prev ? { ...prev, status: 'checked_in', roomNumber: availableRoom.number } : null));
              }
            }
          } catch (e: any) {
            toast.error('Check-in Error', e.message || 'Check in failed');
          }
        }}
        onCheckOut={async (id) => {
          try {
            const res = await fetch(`/api/reservations/${id}/check-out`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ force: true }),
            });
            if (res.ok) {
              toast.success('Guest Checked Out', 'Reservation marked complete.');
              fetchReservations();
              if (selectedRes && selectedRes.id === id) {
                setSelectedRes((prev) => (prev ? { ...prev, status: 'checked_out' } : null));
              }
            }
          } catch (e: any) {
            toast.error('Check-out Error', e.message || 'Check out failed');
          }
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
