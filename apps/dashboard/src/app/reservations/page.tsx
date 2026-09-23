'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { formatNaira, formatStayDates } from '@sena/config';
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@sena/ui';
import { Plus, Search } from 'lucide-react';
import { INITIAL_RESERVATIONS, type ReservationItem } from '../../components/mock-data';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { ReservationDrawer } from '../../components/reservation-drawer';
import { Topbar } from '../../components/topbar';

function ReservationsContent() {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search');
  const [reservations, setReservations] = React.useState<ReservationItem[]>(INITIAL_RESERVATIONS);
  const [activeTab, setActiveTab] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState(urlSearch || '');
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [newResOpen, setNewResOpen] = React.useState(false);

  React.useEffect(() => {
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [urlSearch]);

  const filtered = reservations.filter((r) => {
    // Tab filter
    if (activeTab === 'upcoming' && r.status !== 'confirmed') return false;
    if (activeTab === 'in_house' && r.status !== 'checked_in') return false;
    if (activeTab === 'completed' && r.status !== 'checked_out') return false;
    if (activeTab === 'cancelled' && r.status !== 'cancelled') return false;

    // Search query
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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title="Reservations"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              All Reservations
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Manage every stay at Stay Connect Lekki.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#7A7267]" />
              <input
                type="text"
                placeholder="Filter by guest, ref, room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816] w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
              />
            </div>
          </div>
        </div>

        {/* Tabs: All, Upcoming, In house, Completed, Cancelled */}
        <div className="flex items-center gap-2 border-b border-[#E8E2DA] pb-2 text-xs overflow-x-auto whitespace-nowrap">
          {[
            { id: 'all', label: 'All Stays' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'in_house', label: 'In house' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded font-medium transition-colors flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#71382D] text-white'
                  : 'text-[#7A7267] hover:bg-[#FAFAFA]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Reservations Data Table */}
        <div className="bg-white border border-[#E8E2DA] rounded-md overflow-x-auto shadow-none">
          <Table className="min-w-[750px]">
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Nights</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((res) => (
                <TableRow
                  key={res.id}
                  onClick={() => {
                    setSelectedRes(res);
                    setDrawerOpen(true);
                  }}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-xs font-semibold text-[#B85C3E]">
                    {res.reference}
                  </TableCell>
                  <TableCell>
                    <strong className="block font-medium text-sm text-[#191816]">
                      {res.guestName}
                    </strong>
                    <span className="text-xs text-[#7A7267]">{res.guestPhone}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block text-xs font-semibold text-[#191816]">
                      Room {res.roomNumber}
                    </span>
                    <span className="text-[11px] text-[#7A7267]">{res.roomType}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatStayDates(res.checkInDate, res.checkOutDate)}
                  </TableCell>
                  <TableCell className="text-xs">{res.nights}n</TableCell>
                  <TableCell className="capitalize text-xs text-[#7A7267]">
                    {res.source.replace('_', ' ')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={res.paymentStatus === 'paid' ? 'paid' : 'pending'}>
                      {res.paymentStatus.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        res.status === 'checked_in'
                          ? 'occupied'
                          : res.status === 'checked_out'
                          ? 'clean'
                          : 'available'
                      }
                    >
                      {res.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>

      <ReservationDrawer
        reservation={selectedRes}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCheckIn={(id) => {
          setReservations((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status: 'checked_in' } : r))
          );
          if (selectedRes && selectedRes.id === id) {
            setSelectedRes((prev) => prev ? { ...prev, status: 'checked_in' } : null);
          }
        }}
        onCheckOut={(id) => {
          setReservations((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status: 'checked_out' } : r))
          );
          if (selectedRes && selectedRes.id === id) {
            setSelectedRes((prev) => prev ? { ...prev, status: 'checked_out' } : null);
          }
        }}
      />

      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={(newRes) => setReservations((prev) => [newRes, ...prev])}
      />
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <React.Suspense fallback={<div className="flex-1 bg-white p-8 text-xs text-[#7A7267]">Loading reservations...</div>}>
      <ReservationsContent />
    </React.Suspense>
  );
}
