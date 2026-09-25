'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@sena/ui';
import { Check, Globe, Layers, ArrowRight, ShieldCheck, Mail, MessageSquare, CreditCard } from 'lucide-react';
import { Topbar } from '../../components/topbar';

interface IntegrationItem {
  id: string;
  name: string;
  category: 'Booking & Distribution' | 'Payments' | 'Communication';
  status: 'active' | 'coming_soon';
  description: string;
  actionText?: string;
  actionHref?: string;
}

const INTEGRATIONS: IntegrationItem[] = [
  // 1. Booking & Distribution
  {
    id: 'sena_direct',
    name: 'Sena Direct Booking Engine',
    category: 'Booking & Distribution',
    status: 'active',
    description: 'Commission-free direct booking engine hosted automatically on your hotel website.',
    actionText: 'Configure Engine',
    actionHref: '/website',
  },
  {
    id: 'sena_connect',
    name: 'Sena Connect (API & Embeds)',
    category: 'Booking & Distribution',
    status: 'active',
    description: 'Plug booking buttons, inline search widgets, or our Developer REST API directly into your custom website (Next.js, Webflow, WordPress).',
    actionText: 'Developer Hub',
    actionHref: '/website?tab=connect',
  },
  {
    id: 'booking_com',
    name: 'Booking.com',
    category: 'Booking & Distribution',
    status: 'coming_soon',
    description: 'Two-way iCal and channel manager sync is in development for V1.1. Join the waitlist to be notified when it goes live.',
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    category: 'Booking & Distribution',
    status: 'coming_soon',
    description: 'Calendar and rate synchronization for serviced apartments. Launching in V1.1.',
  },
  {
    id: 'expedia',
    name: 'Expedia Partner Solutions',
    category: 'Booking & Distribution',
    status: 'coming_soon',
    description: 'Channel manager distribution across the Expedia global network. Launching in V1.1.',
  },
  {
    id: 'agoda',
    name: 'Agoda',
    category: 'Booking & Distribution',
    status: 'coming_soon',
    description: 'Direct distribution across Agoda and Asian hospitality corridors. Launching in V1.1.',
  },

  // 2. Payments
  {
    id: 'paystack',
    name: 'Paystack Gateway',
    category: 'Payments',
    status: 'active',
    description: 'Accept instant online debit/credit cards and Nigerian bank transfers with automated payment reconciliation.',
    actionText: 'Manage Gateway',
    actionHref: '/payments',
  },
  {
    id: 'bank_transfer',
    name: 'Bank Transfer (Manual Verification)',
    category: 'Payments',
    status: 'active',
    description: 'Direct guest payments to your dedicated corporate bank account with front desk approval workflows.',
    actionText: 'View Settings',
    actionHref: '/settings',
  },
  {
    id: 'cash',
    name: 'Cash / POS at Check-in',
    category: 'Payments',
    status: 'active',
    description: 'Front desk terminal settlement with real-time room folio balancing and guest receipt generation.',
    actionText: 'Front Desk',
    actionHref: '/front-desk',
  },
  {
    id: 'monnify',
    name: 'Monnify by TeamApt',
    category: 'Payments',
    status: 'coming_soon',
    description: 'Dedicated virtual bank account numbers for instant auto-cleared bank transfers. Coming in V1.1.',
  },
  {
    id: 'flutterwave',
    name: 'Flutterwave',
    category: 'Payments',
    status: 'coming_soon',
    description: 'Alternative multi-currency gateway for international guest bookings and pan-African cards. In development.',
  },

  // 3. Communication
  {
    id: 'resend',
    name: 'Resend (Transactional Email)',
    category: 'Communication',
    status: 'active',
    description: 'Automated booking confirmations, guest check-in reminders, invoices, and review requests dispatched seamlessly.',
    actionText: 'Email Logs',
    actionHref: '/settings',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business API',
    category: 'Communication',
    status: 'coming_soon',
    description: 'Automated WhatsApp confirmation messages, digital room keys, and concierge chat. Under certification.',
  },
  {
    id: 'termii',
    name: 'Termii (SMS Gateway)',
    category: 'Communication',
    status: 'coming_soon',
    description: 'High-deliverability Nigerian route SMS for reservation PINs and arrival notifications.',
  },
];

export default function ChannelsPage() {
  const [selectedChannel, setSelectedChannel] = React.useState<IntegrationItem | null>(null);
  const [emailSubmitted, setEmailSubmitted] = React.useState(false);
  const [interestEmail, setInterestEmail] = React.useState('');

  function handleNotify(e: React.FormEvent) {
    e.preventDefault();
    if (!interestEmail) return;
    setEmailSubmitted(true);
    setTimeout(() => {
      setSelectedChannel(null);
      setEmailSubmitted(false);
      setInterestEmail('');
    }, 1800);
  }

  const categories: ('Booking & Distribution' | 'Payments' | 'Communication')[] = [
    'Booking & Distribution',
    'Payments',
    'Communication',
  ];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title="Channels & Integrations" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <div className="border-b border-[#E8E2DA] pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
                Channels & Integrations
              </h2>
              <p className="text-xs text-[#7A7267] mt-1">
                Truthful, certified connections powering guest acquisition, payment processing, and guest communication.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/website?tab=connect"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#191816] text-[#FAF8F5] hover:bg-[#2C2A26] transition-colors"
              >
                <span>Open Developer API Hub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {categories.map((category) => {
          const items = INTEGRATIONS.filter((item) => item.category === category);

          return (
            <section key={category} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#191816]">
                  {category}
                </span>
                <span className="text-xs text-[#7A7267]">({items.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((item) => {
                  const isActive = item.status === 'active';

                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-[#E8E2DA] p-5 rounded-md flex flex-col justify-between space-y-4 transition-all hover:border-[#7A7267]"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7267]">
                            {item.category}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-[#EBF3EE] text-[#2E6B4F] border border-[#2E6B4F]/20'
                                : 'bg-[#FAF8F5] text-[#7A7267] border border-[#E8E2DA]'
                            }`}
                          >
                            {isActive ? 'Active' : 'Coming Soon'}
                          </span>
                        </div>
                        <strong className="text-base font-serif text-[#191816] block">
                          {item.name}
                        </strong>
                        <p className="text-xs text-[#7A7267] mt-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#E8E2DA] flex items-center justify-between">
                        {isActive ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs text-[#2E6B4F] font-medium flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Certified & Online
                            </span>
                            {item.actionHref && (
                              <Link
                                href={item.actionHref}
                                className="text-xs font-medium text-[#191816] hover:text-[#B85C3E] flex items-center gap-1"
                              >
                                <span>{item.actionText || 'Manage'}</span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedChannel(item)}
                            className="w-full text-xs"
                          >
                            Join Waitlist ↗
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      {/* Waitlist Modal */}
      {selectedChannel && (
        <Dialog
          open={Boolean(selectedChannel)}
          onOpenChange={() => setSelectedChannel(null)}
        >
          <DialogContent>
            {emailSubmitted ? (
              <div className="py-8 text-center space-y-2">
                <Check className="w-8 h-8 mx-auto text-[#2E6B4F]" />
                <DialogTitle>Waitlist Confirmed</DialogTitle>
                <DialogDescription>
                  You are registered for early access to {selectedChannel.name}. We will notify you the moment live certification begins.
                </DialogDescription>
              </div>
            ) : (
              <form onSubmit={handleNotify}>
                <DialogHeader>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#B85C3E]">
                    Integration Waitlist
                  </span>
                  <DialogTitle>{selectedChannel.name}</DialogTitle>
                  <DialogDescription>
                    {selectedChannel.description}
                  </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-2">
                  <label className="text-xs font-medium text-[#191816]">Work Email Address</label>
                  <Input
                    type="email"
                    placeholder="manager@hotel.com"
                    value={interestEmail}
                    onChange={(e) => setInterestEmail(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-[#7A7267]">
                    Zero spam. Only technical release announcements and integration guides.
                  </p>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedChannel(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Join Waitlist</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
