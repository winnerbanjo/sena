'use client';

import * as React from 'react';
import { formatNaira, formatStayDates } from '@sena/config';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sena/ui';
import { AlertCircle, CheckCircle2, DoorOpen, LogOut } from 'lucide-react';
import { INITIAL_RESERVATIONS, type ReservationItem } from '../../components/mock-data';
import { ReservationDrawer } from '../../components/reservation-drawer';
import { Topbar } from '../../components/topbar';

export default function FrontDeskPage() {
  const [reservations, setReservations] = React.useState<ReservationItem[]>(INITIAL_RESERVATIONS);
  const [activeTab, setActiveTab] = React.useState<'arriving' | 'in_house' | 'departing'>('arriving');
  const [selectedRes, setSelectedRes] = React.useState<ReservationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Balance checkout warning dialog
  const [checkoutWarning, setCheckoutWarning] = React.useState<{
    res: ReservationItem;
    balanceMinorUnits: number;
  } | null>(null);

  // Check In
  function handleCheckIn(id: string) {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'checked_in' } : r))
    );
  }

  // Check Out
  function initiateCheckOut(res: ReservationItem) {
    const balance = res.totalAmountMinorUnits - res.paidAmountMinorUnits;
    if (balance > 0) {
      setCheckoutWarning({ res, balanceMinorUnits: balance });
    } else {
      executeCheckOut(res.id);
    }
  }

  function executeCheckOut(id: string) {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'checked_out' } : r))
    );
    setCheckoutWarning(null);
  }

  const arrivingList = reservations.filter(
    (r) => r.checkInDate === '2026-09-23' && r.status === 'confirmed'
  );
  const inHouseList = reservations.filter((r) => r.status === 'checked_in');
  const departingList = reservations.filter(
    (r) => r.checkOutDate === '2026-09-23' && r.status === 'checked_in'
  );

  const currentList =
    activeTab === 'arriving'
      ? arrivingList
      : activeTab === 'in_house'
      ? inHouseList
      : departingList;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar
        title="Front Desk"
        onOpenNewReservation={() => {}}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              Front Desk Operations
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Optimized for arrivals, check-ins, guest stays, and departures today.
            </p>
          </div>
        </div>

        {/* Operational Filter Tabs */}
        <div className="flex items-center gap-2 sm:gap-3 border-b border-[#E8E2DA] pb-3 text-xs overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab('arriving')}
            className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'arriving'
                ? 'bg-[#71382D] text-white'
                : 'text-[#7A7267] hover:bg-white'
            }`}
          >
            <span>Arriving</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {arrivingList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('in_house')}
            className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'in_house'
                ? 'bg-[#71382D] text-white'
                : 'text-[#7A7267] hover:bg-white'
            }`}
          >
            <span>In House</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {inHouseList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('departing')}
            className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'departing'
                ? 'bg-[#71382D] text-white'
                : 'text-[#7A7267] hover:bg-white'
            }`}
          >
            <span>Departing Today</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {departingList.length}
            </span>
          </button>
        </div>

        {/* Operational List Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentList.map((res) => (
            <div
              key={res.id}
              onClick={() => {
                setSelectedRes(res);
                setDrawerOpen(true);
              }}
              className="bg-white border border-[#E8E2DA] p-5 rounded-md flex flex-col justify-between hover:border-[#B85C3E]/60 transition-all cursor-pointer space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold text-[#B85C3E]">
                    {res.reference}
                  </span>
                  <Badge variant={res.paymentStatus === 'paid' ? 'paid' : 'pending'}>
                    {res.paymentStatus.replace('_', ' ')}
                  </Badge>
                </div>

                <strong className="text-lg font-serif text-[#191816] block">
                  {res.guestName}
                </strong>
                <p className="text-xs text-[#7A7267]">
                  {res.roomType} · Room {res.roomNumber}
                </p>
                <div className="mt-2 text-xs text-[#191816]">
                  {formatStayDates(res.checkInDate, res.checkOutDate)} ({res.nights}n)
                </div>
              </div>

              <div className="pt-3 border-t border-[#E8E2DA] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#7A7267] block">
                    Total
                  </span>
                  <strong className="text-sm font-serif text-[#191816]">
                    {formatNaira(res.totalAmountMinorUnits)}
                  </strong>
                </div>

                {res.status === 'confirmed' && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCheckIn(res.id);
                    }}
                    className="bg-[#2E6B4F] hover:bg-[#255740]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Check in
                  </Button>
                )}

                {res.status === 'checked_in' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      initiateCheckOut(res);
                    }}
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1 text-[#9E382A]" />
                    Check out
                  </Button>
                )}
              </div>
            </div>
          ))}

          {currentList.length === 0 && (
            <div className="col-span-3 p-12 text-center bg-white border border-[#E8E2DA] rounded-md">
              <p className="text-sm text-[#7A7267]">
                No guests in this view right now.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Outstanding Balance Warning Dialog (Section 46 of PRD) */}
      {checkoutWarning && (
        <Dialog
          open={Boolean(checkoutWarning)}
          onOpenChange={() => setCheckoutWarning(null)}
        >
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-2 text-[#9E382A] mb-1">
                <AlertCircle className="w-5 h-5" />
                <DialogTitle>Outstanding Balance Detected</DialogTitle>
              </div>
              <DialogDescription>
                <strong>{checkoutWarning.res.guestName}</strong> has an outstanding
                balance of{' '}
                <strong className="text-[#9E382A]">
                  {formatNaira(checkoutWarning.balanceMinorUnits)}
                </strong>{' '}
                for stay {checkoutWarning.res.reference}.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 text-xs text-[#7A7267]">
              Would you like to record the payment now or authorize checkout anyway?
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => executeCheckOut(checkoutWarning.res.id)}
              >
                Check out anyway
              </Button>
              <Button
                onClick={() => {
                  // Simulate recording payment and checking out
                  setReservations((prev) =>
                    prev.map((r) =>
                      r.id === checkoutWarning.res.id
                        ? {
                            ...r,
                            paidAmountMinorUnits: r.totalAmountMinorUnits,
                            paymentStatus: 'paid',
                            status: 'checked_out',
                          }
                        : r
                    )
                  );
                  setCheckoutWarning(null);
                }}
              >
                Record Payment & Check Out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ReservationDrawer
        reservation={selectedRes}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCheckIn={handleCheckIn}
        onCheckOut={(id) => {
          const target = reservations.find((r) => r.id === id);
          if (target) initiateCheckOut(target);
        }}
      />
    </div>
  );
}
