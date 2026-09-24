'use client';

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
import { Topbar } from '../../components/topbar';

export default function FrontDeskPage() {
  const [reservations, setReservations] = React.useState<ReservationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'arriving' | 'in_house' | 'departing'>('arriving');
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [checkoutWarning, setCheckoutWarning] = React.useState<{
    res: ReservationItem;
    balanceMinorUnits: number;
  } | null>(null);

  const fetchReservations = React.useCallback(async () => {
    try {
      const res = await fetch('/api/reservations');
      if (res.ok) {
        const data = await res.json();
        if (data.reservations) {
          const mapped: ReservationItem[] = data.reservations.map((r: any) => ({
            id: r.id,
            reference: r.reference,
            guestName: r.guestName || 'Unnamed Guest',
            guestEmail: r.guestEmail || '',
            guestPhone: r.guestPhone || '',
            roomType: r.roomTypeName || 'Standard Room',
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
      console.error('Failed to load reservations in front desk:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  async function handleCheckIn(id: string) {
    try {
      const roomRes = await fetch('/api/rooms');
      const roomData = await roomRes.json();
      const availableRoom = roomData.rooms?.find((rm: any) => rm.operational === 'available');
      if (!availableRoom) {
        alert('No clean available room found in database to assign for check-in.');
        return;
      }
      const res = await fetch(`/api/reservations/${id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: availableRoom.id }),
      });
      if (res.ok) {
        fetchReservations();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to check in');
      }
    } catch (err: any) {
      alert(err.message || 'Check in failed');
    }
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
        setCheckoutWarning(null);
        fetchReservations();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to check out');
      }
    } catch (err: any) {
      alert(err.message || 'Check out failed');
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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white text-[#191816]">
      <Topbar title="Front Desk" />

      <main className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 max-w-7xl w-full mx-auto">
        {/* Header */}
        <div className="border-b border-[#E8E1D5] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#8C8275] block mb-1">
              Reception Roster
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#71382D]">
              Front Desk Operations
            </h1>
            <p className="text-xs text-[#7A7267] mt-1">
              Arrival clearance, key assignment, and in-house guest management.
            </p>
          </div>
        </div>

        {/* Operational Filter Tabs */}
        <div className="flex items-center gap-6 border-b border-[#E8E1D5] text-xs">
          <button
            onClick={() => setActiveTab('arriving')}
            className={`pb-3 font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'arriving' ? 'text-[#71382D]' : 'text-[#8C8275] hover:text-[#191816]'
            }`}
          >
            <span>Expected Arrivals</span>
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC]">
              {arrivingList.length}
            </span>
            {activeTab === 'arriving' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#71382D]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('in_house')}
            className={`pb-3 font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'in_house' ? 'text-[#71382D]' : 'text-[#8C8275] hover:text-[#191816]'
            }`}
          >
            <span>Currently In House</span>
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC]">
              {inHouseList.length}
            </span>
            {activeTab === 'in_house' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#71382D]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('departing')}
            className={`pb-3 font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'departing' ? 'text-[#71382D]' : 'text-[#8C8275] hover:text-[#191816]'
            }`}
          >
            <span>Departures</span>
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC]">
              {departingList.length}
            </span>
            {activeTab === 'departing' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#71382D]" />
            )}
          </button>
        </div>

        {/* Operational Front Desk Roster: Clean Table Layout Instead of Random Cards */}
        <div className="border border-[#E8E1D5] rounded-xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[#E8E1D5] bg-[#FAF7F2]/60 text-[11px] font-mono uppercase tracking-wider text-[#8C8275]">
                  <th className="py-3 px-5 font-medium">Guest &amp; Folio</th>
                  <th className="py-3 px-5 font-medium">Room Assigned</th>
                  <th className="py-3 px-5 font-medium">Stay Window</th>
                  <th className="py-3 px-5 font-medium">Settlement</th>
                  <th className="py-3 px-5 font-medium">Contact</th>
                  <th className="py-3 px-5 font-medium text-right">Desk Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D5] text-xs">
                {currentList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-[#8C8275]">
                      <p className="font-serif text-sm text-[#71382D]">No guests in this roster right now</p>
                      <p className="text-xs mt-1">Check another status or return to overview.</p>
                    </td>
                  </tr>
                ) : (
                  currentList.map((res) => {
                    const isPaid = res.paymentStatus === 'paid';
                    const balance = res.totalAmountMinorUnits - res.paidAmountMinorUnits;

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
                          <strong className="block font-serif text-sm text-[#191816] group-hover:text-[#B85C3E] transition-colors">
                            {res.guestName}
                          </strong>
                          <span className="text-[11px] font-mono text-[#8C8275]">{res.reference}</span>
                        </td>
                        <td className="py-4 px-5">
                          <span className="font-medium text-[#71382D] block">
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
                        <td className="py-4 px-5 font-mono">
                          <span className="inline-flex items-center gap-1.5 text-[11px]">
                            <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-[#2E6B4F]' : 'bg-[#A3681F]'}`} />
                            <span className={isPaid ? 'text-[#2E6B4F]' : 'text-[#A3681F]'}>
                              {isPaid ? 'Settled' : `Due: ${formatNaira(balance)}`}
                            </span>
                          </span>
                        </td>
                        <td className="py-4 px-5 text-[#8C8275]">
                          {res.guestPhone || res.guestEmail}
                        </td>
                        <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                          {activeTab === 'arriving' ? (
                            <button
                              type="button"
                              onClick={() => handleCheckIn(res.id)}
                              className="px-3.5 py-1.5 rounded-md bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-medium transition-colors"
                            >
                              Check In &rarr;
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => initiateCheckOut(res)}
                              className="px-3.5 py-1.5 rounded-md border border-[#E8E1D5] hover:bg-[#FAF7F2] text-[#191816] text-xs font-medium transition-colors"
                            >
                              Check Out
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
              <DialogTitle className="font-serif text-lg text-[#71382D]">
                Outstanding Balance Pending
              </DialogTitle>
              <DialogDescription className="text-xs text-[#7A7267] pt-1 leading-relaxed">
                Guest <strong>{checkoutWarning.res.guestName}</strong> still has an unsettled folio balance of{' '}
                <strong className="text-[#B85C3E] font-mono">{formatNaira(checkoutWarning.balanceMinorUnits)}</strong>.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <button
                type="button"
                onClick={() => setCheckoutWarning(null)}
                className="px-3.5 py-1.5 rounded-md border border-[#E8E1D5] text-xs font-medium text-[#191816] hover:bg-[#FAF7F2]"
              >
                Collect at Desk First
              </button>
              <button
                type="button"
                onClick={() => executeCheckOut(checkoutWarning.res.id, true)}
                className="px-3.5 py-1.5 rounded-md bg-[#71382D] text-white text-xs font-medium hover:bg-[#5A2C23]"
              >
                Proceed &amp; Record Invoice Due
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reservation Drawer */}
      <ReservationDrawer
        reservation={selectedRes}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCheckIn={handleCheckIn}
        onCheckOut={(id) => {
          if (selectedRes) initiateCheckOut(selectedRes);
        }}
      />
    </div>
  );
}
