'use client';

import * as React from 'react';
import { formatNaira } from '@sena/config';
import {
  Badge,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sena/ui';
import { Mail, Phone, Search, Star } from 'lucide-react';
import { Topbar } from '../../components/topbar';

interface GuestProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  stays: number;
  nights: number;
  lastStay: string;
  lifetimeValueMinorUnits: number;
  preferences: string[];
  notes: string;
}

const GUESTS_DATA: GuestProfile[] = [
  {
    id: 'g-1',
    name: 'Ada James',
    phone: '+234 802 345 6789',
    email: 'ada.james@example.com',
    stays: 4,
    nights: 12,
    lastStay: '12 Aug 2026',
    lifetimeValueMinorUnits: 142000000, // ₦1.42m
    preferences: ['Late checkout', 'Upper floor', 'Extra quiet'],
    notes: 'Prefers quiet rooms facing the courtyard. Long-time loyal guest.',
  },
  {
    id: 'g-2',
    name: 'Tobi Ade',
    phone: '+234 813 987 6543',
    email: 'tobi.ade@example.com',
    stays: 2,
    nights: 5,
    lastStay: '05 Jul 2026',
    lifetimeValueMinorUnits: 62000000,
    preferences: ['High speed Wi-Fi', 'King bed'],
    notes: 'Business traveler from Abuja.',
  },
  {
    id: 'g-3',
    name: 'David Okoro',
    phone: '+234 701 444 5566',
    email: 'david.okoro@example.com',
    stays: 3,
    nights: 9,
    lastStay: '22 Sep 2026',
    lifetimeValueMinorUnits: 98000000,
    preferences: ['Airport pickup', 'Breakfast included'],
    notes: 'Bookings usually come through Booking.com.',
  },
  {
    id: 'g-4',
    name: 'Sarah Bello',
    phone: '+234 809 777 8899',
    email: 'sarah.bello@example.com',
    stays: 1,
    nights: 2,
    lastStay: '21 Sep 2026',
    lifetimeValueMinorUnits: 16000000,
    preferences: ['Extra pillows'],
    notes: 'Walk-in guest.',
  },
];

export default function GuestsPage() {
  const [search, setSearch] = React.useState('');
  const [selectedGuest, setSelectedGuest] = React.useState<GuestProfile | null>(null);

  const filtered = GUESTS_DATA.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.phone.includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title="Guest Directory" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              Guests
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Guest profiles, visit histories, preferences, and lifetime relationship value.
            </p>
          </div>

          <div className="relative w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#7A7267]" />
            <input
              type="text"
              placeholder="Search by name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816] w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
            />
          </div>
        </div>

        <div className="bg-white border border-[#E8E2DA] rounded-md overflow-x-auto">
          <Table className="min-w-[650px]">
            <TableHeader>
              <TableRow>
                <TableHead>Guest Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Total Stays</TableHead>
                <TableHead>Nights</TableHead>
                <TableHead>Last Stay</TableHead>
                <TableHead>Lifetime Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((guest) => (
                <TableRow
                  key={guest.id}
                  onClick={() => setSelectedGuest(guest)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#E5D4BC] text-[#71382D] flex items-center justify-center font-serif text-xs font-bold">
                        {guest.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div>
                        <strong className="text-sm font-serif text-[#191816] block">
                          {guest.name}
                        </strong>
                        {guest.stays > 1 && (
                          <span className="text-[10px] text-[#B85C3E] font-medium flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" /> Returning guest
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="block text-xs text-[#191816]">{guest.phone}</span>
                    <span className="block text-[11px] text-[#7A7267]">{guest.email}</span>
                  </TableCell>
                  <TableCell className="text-xs font-medium">{guest.stays} stays</TableCell>
                  <TableCell className="text-xs">{guest.nights} nights</TableCell>
                  <TableCell className="text-xs text-[#7A7267]">{guest.lastStay}</TableCell>
                  <TableCell className="font-serif font-medium text-sm text-[#191816]">
                    {formatNaira(guest.lifetimeValueMinorUnits)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Section 52: Guest Profile Drawer */}
      {selectedGuest && (
        <Drawer
          open={Boolean(selectedGuest)}
          onOpenChange={() => setSelectedGuest(null)}
        >
          <DrawerContent className="p-6 space-y-6 bg-white border-l border-[#E8E2DA]">
            <div className="border-b border-[#E8E2DA] pb-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#B85C3E] block mb-1">
                Guest Profile
              </span>
              <DrawerTitle className="text-2xl font-serif text-[#191816]">
                {selectedGuest.name}
              </DrawerTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={selectedGuest.stays > 1 ? 'clean' : 'default'}>
                  {selectedGuest.stays > 1 ? 'Returning Guest' : 'First Visit'}
                </Badge>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded border border-[#E8E2DA] bg-[#FAFAFA] text-center">
                <span className="text-[10px] uppercase text-[#7A7267] block">Stays</span>
                <strong className="text-lg font-serif text-[#191816]">{selectedGuest.stays}</strong>
              </div>
              <div className="p-3 rounded border border-[#E8E2DA] bg-[#FAFAFA] text-center">
                <span className="text-[10px] uppercase text-[#7A7267] block">Nights</span>
                <strong className="text-lg font-serif text-[#191816]">{selectedGuest.nights}</strong>
              </div>
              <div className="p-3 rounded border border-[#E8E2DA] bg-[#FAFAFA] text-center">
                <span className="text-[10px] uppercase text-[#7A7267] block">Total Spent</span>
                <strong className="text-sm font-serif text-[#191816] block mt-1">
                  {formatNaira(selectedGuest.lifetimeValueMinorUnits)}
                </strong>
              </div>
            </div>

            {/* Contact */}
            <div className="p-4 rounded border border-[#E8E2DA] bg-white space-y-2 text-xs">
              <span className="text-[10px] uppercase font-mono text-[#7A7267] block mb-2">
                Contact Details
              </span>
              <div className="flex items-center gap-2 text-[#191816]">
                <Phone className="w-3.5 h-3.5 text-[#7A7267]" />
                <span>{selectedGuest.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-[#191816]">
                <Mail className="w-3.5 h-3.5 text-[#7A7267]" />
                <span>{selectedGuest.email}</span>
              </div>
            </div>

            {/* Preferences */}
            <div className="p-4 rounded border border-[#E8E2DA] bg-[#FAFAFA] space-y-2">
              <span className="text-[10px] uppercase font-mono text-[#7A7267] block mb-1">
                Guest Preferences
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedGuest.preferences.map((p, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816]"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Staff Notes */}
            <div className="p-4 rounded border border-[#E8E2DA] bg-white">
              <span className="text-[10px] uppercase font-mono text-[#7A7267] block mb-1">
                Internal Team Note
              </span>
              <p className="text-xs text-[#191816] leading-relaxed">
                {selectedGuest.notes}
              </p>
            </div>

            {/* Cross-module Action */}
            <div className="pt-2">
              <a
                href={`/reservations?search=${encodeURIComponent(selectedGuest.name)}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded border border-[#B85C3E] text-[#B85C3E] hover:bg-[#B85C3E] hover:text-white transition-colors text-xs font-medium cursor-pointer"
              >
                View Guest's Reservations →
              </a>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
