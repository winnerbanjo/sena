'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { formatNaira } from '@sena/config';

export default function BookingConfirmationPage() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const reference = search.get('reference') || '';
  const confirming = search.get('payment') === 'confirming';
  const txRef = search.get('tx_ref') || '';
  const transactionId = search.get('transaction_id') || '';
  const [booking, setBooking] = React.useState<any>(null);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    let stopped = false;
    async function load() {
      const res = await fetch(`/api/bookings/public?reference=${encodeURIComponent(reference)}&slug=${encodeURIComponent(params.slug)}`);
      if (!res.ok) {
        if (!stopped) setMissing(true);
        return;
      }
      const data = await res.json();
      if (!stopped) setBooking(data);
    }
    if (confirming && txRef) {
      void fetch('/api/payments/public/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_ref: txRef, transaction_id: transactionId || undefined }),
        cache: 'no-store',
      }).catch(() => undefined);
    }
    load();
    if (!confirming) return () => { stopped = true; };
    const timer = window.setInterval(load, 4000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [reference, params.slug, confirming, txRef, transactionId]);

  if (missing) {
    return <main className="min-h-screen bg-[#FAF7F2] px-6 py-16"><h1 className="font-serif text-2xl">This booking is unavailable.</h1></main>;
  }
  if (!booking) {
    return <main className="min-h-screen bg-[#FAF7F2] px-6 py-16"><p>Confirming your payment...</p></main>;
  }

  const paid = booking.paymentStatus === 'paid';
  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-12">
      <div className="mx-auto max-w-lg space-y-3">
        <p className="text-sm text-[#7A7267]">{booking.propertyName}</p>
        <h1 className="font-serif text-3xl">{paid ? 'Payment confirmed' : confirming ? 'Confirming your payment' : 'Reservation confirmed'}</h1>
        <p className="text-sm text-[#5C564D]">
          {paid
            ? `${formatNaira(booking.paidAmountMinorUnits)} paid online.`
            : confirming
              ? 'Reservation received. Payment confirmation is pending until the payment is verified.'
              : `${formatNaira(booking.outstandingMinorUnits)} is due at the property.`}
        </p>
        <p className="text-sm">Reference {booking.reference}</p>
      </div>
    </main>
  );
}
