'use client';

import * as React from 'react';
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
import { Calendar, CheckCircle2, Clock, CreditCard, Mail, Phone, User } from 'lucide-react';

interface ReservationDrawerProps {
  reservation: ReservationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckIn?: (id: string) => void;
  onCheckOut?: (id: string) => void;
}

export function ReservationDrawer({
  reservation,
  open,
  onOpenChange,
  onCheckIn,
  onCheckOut,
}: ReservationDrawerProps) {
  if (!reservation) return null;

  const isCheckedIn = reservation.status === 'checked_in';
  const isConfirmed = reservation.status === 'confirmed';

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
          <DrawerTitle className="text-2xl font-serif text-[#191816]">
            {reservation.guestName}
          </DrawerTitle>
          <p className="text-xs text-[#7A7267] mt-1">
            {reservation.roomType} · Room {reservation.roomNumber}
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
            {isCheckedIn && (
              <Button
                size="sm"
                variant="dark"
                onClick={() => onCheckOut?.(reservation.id)}
              >
                Check out
              </Button>
            )}
            <Button size="sm" variant="secondary">
              Record payment
            </Button>
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
                <div className="text-base font-serif text-[#191816] font-medium">
                  {formatStayDates(reservation.checkInDate, reservation.checkOutDate)}
                </div>
                <div className="text-xs text-[#7A7267] mt-1">
                  {reservation.nights} nights · {reservation.numGuests} guests
                </div>
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
                    Room {reservation.roomNumber}
                  </strong>
                </div>
              </div>
            </TabsContent>

            {/* GUEST TAB */}
            <TabsContent value="guest" className="space-y-4 pt-2">
              <div className="p-4 rounded border border-[#E8E2DA] bg-white space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#E5D4BC] text-[#71382D] flex items-center justify-center font-serif font-bold text-sm">
                    {reservation.guestName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <strong className="text-base font-serif text-[#191816] block">
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

              <div className="p-4 rounded border border-[#E8E2DA] bg-[#FAFAFA]">
                <span className="text-[11px] text-[#7A7267] uppercase tracking-wider font-medium block mb-1">
                  Preferences & Notes
                </span>
                <p className="text-xs text-[#191816]">
                  Prefers upper floor and extra quiet room.
                </p>
              </div>
            </TabsContent>

            {/* PAYMENT TAB */}
            <TabsContent value="payment" className="space-y-4 pt-2">
              <div className="p-5 rounded border border-[#E8E2DA] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#7A7267] font-medium uppercase tracking-wider">
                    Total Amount
                  </span>
                  <Badge variant={reservation.paymentStatus === 'paid' ? 'paid' : 'pending'}>
                    {reservation.paymentStatus.replace('_', ' ')}
                  </Badge>
                </div>
                <strong className="text-2xl font-serif text-[#191816] block">
                  {formatNaira(reservation.totalAmountMinorUnits)}
                </strong>
                <div className="flex items-center justify-between text-xs text-[#7A7267] pt-2 border-t border-[#E8E2DA]">
                  <span>Paid so far:</span>
                  <strong className="text-[#2E6B4F]">
                    {formatNaira(reservation.paidAmountMinorUnits)}
                  </strong>
                </div>
                {reservation.totalAmountMinorUnits > reservation.paidAmountMinorUnits && (
                  <div className="flex items-center justify-between text-xs text-[#7A7267]">
                    <span>Outstanding balance:</span>
                    <strong className="text-[#B85C3E]">
                      {formatNaira(reservation.totalAmountMinorUnits - reservation.paidAmountMinorUnits)}
                    </strong>
                  </div>
                )}
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
      </DrawerContent>
    </Drawer>
  );
}
