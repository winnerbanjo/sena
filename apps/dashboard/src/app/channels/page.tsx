'use client';

import * as React from 'react';
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
import { Check, Globe, Layers } from 'lucide-react';
import { Topbar } from '../../components/topbar';

interface ChannelItem {
  id: string;
  name: string;
  category: string;
  status: 'connected' | 'coming_soon';
  description: string;
}

const CHANNELS: ChannelItem[] = [
  {
    id: 'direct',
    name: 'Direct Property Website',
    category: 'Booking Engine',
    status: 'connected',
    description: 'Commission-free reservations powered directly by your hotel website.',
  },
  {
    id: 'paystack',
    name: 'Paystack Payments',
    category: 'Payment Gateway',
    status: 'connected',
    description: 'Accept secure card payments and bank transfers with instant verification.',
  },
  {
    id: 'booking_com',
    name: 'Booking.com',
    category: 'Online Travel Agency (OTA)',
    status: 'coming_soon',
    description: 'Synchronize room inventory, rates, and incoming bookings seamlessly.',
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    category: 'Online Travel Agency (OTA)',
    status: 'coming_soon',
    description: 'Sync calendar availability and bookings for serviced apartments and suites.',
  },
  {
    id: 'expedia',
    name: 'Expedia Partner Solutions',
    category: 'Online Travel Agency (OTA)',
    status: 'coming_soon',
    description: 'Distribute your property across the global Expedia traveler network.',
  },
  {
    id: 'agoda',
    name: 'Agoda',
    category: 'Online Travel Agency (OTA)',
    status: 'coming_soon',
    description: 'Connect with international travelers across Asian and global travel markets.',
  },
];

export default function ChannelsPage() {
  const [selectedChannel, setSelectedChannel] = React.useState<ChannelItem | null>(null);
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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title="Channels & Distribution" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="border-b border-[#E8E2DA] pb-4">
          <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
            Channels & Integrations
          </h2>
          <p className="text-xs text-[#7A7267] mt-1">
            Connect Sena with the platforms and gateways where your property sells.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CHANNELS.map((channel) => {
            const isConnected = channel.status === 'connected';

            return (
              <div
                key={channel.id}
                className="bg-white border border-[#E8E2DA] p-6 rounded-md flex flex-col justify-between space-y-4 shadow-none hover:border-[#7A7267] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7267]">
                      {channel.category}
                    </span>
                    <Badge variant={isConnected ? 'clean' : 'default'}>
                      {isConnected ? 'Connected' : 'Coming Soon'}
                    </Badge>
                  </div>
                  <strong className="text-lg font-serif text-[#191816] block">
                    {channel.name}
                  </strong>
                  <p className="text-xs text-[#7A7267] mt-2 leading-relaxed">
                    {channel.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E8E2DA] flex items-center justify-between">
                  {isConnected ? (
                    <span className="text-xs text-[#2E6B4F] font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Active & sync enabled
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedChannel(channel)}
                    >
                      Notify me when ready ↗
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Section 64: Coming Soon Interest Modal */}
      {selectedChannel && (
        <Dialog
          open={Boolean(selectedChannel)}
          onOpenChange={() => setSelectedChannel(null)}
        >
          <DialogContent>
            {emailSubmitted ? (
              <div className="py-8 text-center space-y-2">
                <Check className="w-8 h-8 mx-auto text-[#2E6B4F]" />
                <DialogTitle>Thank you</DialogTitle>
                <DialogDescription>
                  We have noted your interest in {selectedChannel.name} and will notify you as soon as early access opens.
                </DialogDescription>
              </div>
            ) : (
              <form onSubmit={handleNotify}>
                <DialogHeader>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#B85C3E]">
                    Early Access List
                  </span>
                  <DialogTitle>{selectedChannel.name} Connectivity</DialogTitle>
                  <DialogDescription>
                    We're actively working on bringing {selectedChannel.name} channel integration to Sena properties. Leave your email to receive priority onboarding when this integration launches.
                  </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                  <Input
                    type="email"
                    placeholder="amara@stayconnect.com"
                    value={interestEmail}
                    onChange={(e) => setInterestEmail(e.target.value)}
                    required
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedChannel(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Notify me when it's ready</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
