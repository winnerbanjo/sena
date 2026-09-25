'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent } from '@sena/ui';
import { ReservationItem } from './mock-data';
import { formatNaira } from '@sena/config';
import { Check, Copy, Calendar, User, BedDouble, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ReservationSuccessModalProps {
  reservation: ReservationItem | null;
  open: boolean;
  onClose: () => void;
}

export function ReservationSuccessModal({
  reservation,
  open,
  onClose,
}: ReservationSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  if (!reservation) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(reservation.reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-white border border-[#E8E2DA] rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          {/* Success Icon */}
          <div className="w-14 h-14 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center mb-4 text-[#059669]">
            <Check className="w-7 h-7 stroke-[2.5]" />
          </div>

          <h3 className="text-xl font-semibold text-[#191816]">
            Reservation Confirmed
          </h3>
          <p className="text-sm text-[#7D7571] mt-1">
            The booking has been successfully recorded in the roster.
          </p>

          {/* Reference pill with Copy */}
          <div className="mt-4 flex items-center gap-2 bg-[#F9F6F0] border border-[#E8E2DA] px-3.5 py-1.5 rounded-full">
            <span className="text-xs uppercase tracking-wider text-[#7D7571] font-medium">Reference:</span>
            <span className="font-mono text-sm font-bold text-[#71382D]">{reservation.reference}</span>
            <button
              onClick={handleCopy}
              className="ml-1 text-[#7D7571] hover:text-[#191816] transition-colors p-1"
              title="Copy reference"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Details Card */}
          <div className="w-full mt-6 bg-[#FAF9F6] border border-[#EFECE6] rounded-xl p-4 text-left space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFECE6]">
              <div className="flex items-center gap-2 text-sm text-[#191816] font-medium">
                <User className="w-4 h-4 text-[#7D7571]" />
                <span>{reservation.guestName}</span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] font-medium capitalize">
                {reservation.status.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-[#7D7571]">
              <div className="flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-[#A89F91]" />
                <span className="text-[#191816] font-medium">{reservation.roomType}</span>
              </div>
              <span>{reservation.nights} night{reservation.nights > 1 ? 's' : ''}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-[#7D7571]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#A89F91]" />
                <span>{reservation.checkInDate} → {reservation.checkOutDate}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#EFECE6] flex items-center justify-between">
              <span className="text-xs text-[#7D7571]">Total Amount</span>
              <span className="text-base font-semibold text-[#191816]">
                {formatNaira(reservation.totalAmountMinorUnits)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="w-full mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 text-sm font-medium border border-[#E8E2DA] rounded-xl text-[#191816] hover:bg-[#F9F6F0] transition-colors"
            >
              Done
            </button>
            <Link
              href="/front-desk"
              onClick={onClose}
              className="w-full py-2.5 px-4 text-sm font-medium bg-[#71382D] hover:bg-[#5D2E25] text-white rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <span>Front Desk</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
