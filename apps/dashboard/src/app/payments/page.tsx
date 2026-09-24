'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
import {
  Badge,
  Button,
  MetricCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sena/ui';
import { CreditCard, Download, Plus } from 'lucide-react';
import { Topbar } from '../../components/topbar';

interface PaymentItem {
  id: string;
  reference: string;
  guestName: string;
  amountMinorUnits: number;
  provider: 'paystack' | 'manual';
  method: 'card' | 'bank_transfer' | 'pos' | 'cash';
  status: 'successful' | 'pending' | 'refunded';
  date: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = React.useState<PaymentItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/payments')
      .then((res) => res.json())
      .then((data) => {
        if (data.payments) {
          const mapped: PaymentItem[] = data.payments.map((p: any) => ({
            id: p.id,
            reference: p.providerReference || `PAY-${p.id.slice(0, 6)}`,
            guestName: p.guestName || 'Walk-in Guest',
            amountMinorUnits: p.amountMinorUnits,
            provider: p.provider || 'manual',
            method: p.method || 'cash',
            status: p.status || 'successful',
            date: new Date(p.createdAt).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
          }));
          setPayments(mapped);
        }
      })
      .catch((e) => console.error('Failed to load payments:', e))
      .finally(() => setLoading(false));
  }, []);

  const totalCollectedMinorUnits = payments
    .filter((p) => p.status === 'successful')
    .reduce((sum, p) => sum + p.amountMinorUnits, 0);
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title="Payments" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              Financials & Transactions
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Recorded revenue, Paystack verified transactions, and outstanding guest balances.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button variant="secondary" size="sm" className="text-xs">
              <Download className="w-3.5 h-3.5 mr-1" />
              Export CSV
            </Button>
            <Button size="sm" className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Record payment
            </Button>
          </div>
        </div>

        {/* Financial Statement Overview */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6 p-6 rounded-lg bg-[#FAF9F6] border border-[#E8E2DA] flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7267] block mb-1">
                Settled Revenue · Realtime
              </span>
              <strong className="text-3xl sm:text-4xl font-serif font-normal text-[#191816] tracking-tight">
                {formatNaira(totalCollectedMinorUnits)}
              </strong>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#7A7267] pt-2 border-t border-[#E8E2DA]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Verified server-side via Paystack webhook automation</span>
            </div>
          </div>

          <div className="md:col-span-3 p-5 rounded-lg bg-white border border-[#E8E2DA] flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7267] block mb-1">
                Pending Folios
              </span>
              <strong className="text-2xl font-serif font-normal text-[#B85C3E]">
                ₦480,000
              </strong>
            </div>
            <p className="text-[11px] text-[#7A7267]">
              Unsettled balances due at front desk upon check-in or checkout.
            </p>
          </div>

          <div className="md:col-span-3 p-5 rounded-lg bg-white border border-[#E8E2DA] flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7267] block mb-1">
                Direct Booking Share
              </span>
              <strong className="text-2xl font-serif font-normal text-[#71382D]">
                42%
              </strong>
            </div>
            <p className="text-[11px] text-[#7A7267]">
              Zero-commission stays captured via your property website.
            </p>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-x-auto">
          <div className="p-4 border-b border-[#E8E2DA] bg-[#FAF9F6] flex items-center justify-between">
            <strong className="text-sm font-serif font-normal text-[#191816]">
              Settlement Ledger
            </strong>
            <span className="text-xs text-[#7A7267]">
              Showing confirmed payments
            </span>
          </div>

          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-[#FAF9F6] border-b border-[#E8E2DA]">
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Reference</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Guest</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Amount</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Provider</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Method</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs">Status</TableHead>
                <TableHead className="font-serif font-normal text-[#7A7267] text-xs text-right">Date & Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#E8E2DA]">
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-8 text-center text-[#7A7267] text-xs">
                    {loading ? 'Loading payments from PostgreSQL...' : 'No transactions recorded yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((pay) => (
                  <TableRow key={pay.id}>
                    <TableCell className="font-mono text-xs font-semibold text-[#B85C3E]">
                      {pay.reference}
                  </TableCell>
                  <TableCell className="font-medium text-sm text-[#191816]">
                    {pay.guestName}
                  </TableCell>
                  <TableCell className="font-serif font-medium text-sm text-[#191816]">
                    {formatNaira(pay.amountMinorUnits)}
                  </TableCell>
                  <TableCell className="capitalize text-xs text-[#7A7267]">
                    {pay.provider}
                  </TableCell>
                  <TableCell className="capitalize text-xs text-[#7A7267]">
                    {pay.method.replace('_', ' ')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pay.status === 'successful' ? 'paid' : 'pending'}>
                      {pay.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-[#7A7267] text-right font-mono">{pay.date}</TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
