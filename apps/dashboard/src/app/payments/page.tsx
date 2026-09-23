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

const PAYMENTS_DATA: PaymentItem[] = [
  {
    id: 'pay-1',
    reference: 'SEN-PAY-8821',
    guestName: 'Ada James',
    amountMinorUnits: 36000000,
    provider: 'paystack',
    method: 'card',
    status: 'successful',
    date: '23 Sep 2026, 10:43',
  },
  {
    id: 'pay-2',
    reference: 'SEN-PAY-7714',
    guestName: 'Tobi Ade',
    amountMinorUnits: 36000000,
    provider: 'paystack',
    method: 'bank_transfer',
    status: 'successful',
    date: '22 Sep 2026, 16:16',
  },
  {
    id: 'pay-3',
    reference: 'SEN-PAY-4409',
    guestName: 'Sarah Bello',
    amountMinorUnits: 12000000,
    provider: 'manual',
    method: 'pos',
    status: 'successful',
    date: '21 Sep 2026, 15:05',
  },
  {
    id: 'pay-4',
    reference: 'SEN-PAY-1190',
    guestName: 'David Okoro',
    amountMinorUnits: 48000000,
    provider: 'paystack',
    method: 'card',
    status: 'successful',
    date: '22 Sep 2026, 14:12',
  },
];

export default function PaymentsPage() {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title="Payments" onOpenNewReservation={() => {}} />

      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-2xl font-serif font-normal text-[#191816]">
              Financials & Transactions
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Recorded revenue, Paystack verified transactions, and outstanding guest balances.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm">
              <Download className="w-3.5 h-3.5 mr-1" />
              Export CSV
            </Button>
            <Button size="sm">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Record payment
            </Button>
          </div>
        </div>

        {/* Financial Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            label="Collected Revenue"
            value="₦2.48m"
            subtext="Confirmed payments this month"
            subValue="September"
          />
          <MetricCard
            label="Outstanding Balances"
            value="₦480,000"
            subtext="Due upon checkout or arrival"
            subValue="Pending"
          />
          <MetricCard
            label="Direct Revenue Share"
            value="42%"
            subtext="Zero-commission direct bookings"
            subValue="Direct"
          />
        </div>

        {/* Transactions Table */}
        <div className="bg-white border border-[#E8E2DA] rounded-md overflow-hidden">
          <div className="p-4 border-b border-[#E8E2DA] bg-[#FAFAFA] flex items-center justify-between">
            <strong className="text-sm font-serif text-[#191816]">
              Recent Transactions
            </strong>
            <span className="text-xs text-[#7A7267]">
              Verified server-side via Paystack webhooks
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date & Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PAYMENTS_DATA.map((pay) => (
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
                  <TableCell className="text-xs text-[#7A7267]">{pay.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
