'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  Calendar,
  ClipboardList,
  Compass,
  CreditCard,
  DoorOpen,
  Globe,
  Home,
  Layers,
  Brush,
  Tag,
  TrendingUp,
  Users,
  Settings,
  ArrowRight,
  BedDouble,
  User,
  Plus,
  FileSpreadsheet,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenNewReservation?: () => void;
}

interface CommandItem {
  id: string;
  category: 'pages' | 'reservations' | 'rooms' | 'guests' | 'actions';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export function CommandPalette({ open, onClose, onOpenNewReservation }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [liveReservations, setLiveReservations] = React.useState<any[]>([]);
  const [liveRooms, setLiveRooms] = React.useState<any[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);

      // Fetch live data from PostgreSQL API
      fetch('/api/reservations')
        .then((res) => res.json())
        .then((data) => {
          if (data?.reservations) setLiveReservations(data.reservations);
        })
        .catch(() => {});

      fetch('/api/rooms')
        .then((res) => res.json())
        .then((data) => {
          if (data?.rooms) setLiveRooms(data.rooms);
        })
        .catch(() => {});
    }
  }, [open]);

  // Pages definition
  const pages: CommandItem[] = [
    { id: 'p-home', category: 'pages', title: 'Overview & Dashboard', subtitle: 'Live property vitals and arrivals', icon: Home, action: () => router.push('/') },
    { id: 'p-res', category: 'pages', title: 'Reservations', subtitle: 'Manage upcoming, in-house and past stays', icon: ClipboardList, action: () => router.push('/reservations') },
    { id: 'p-cal', category: 'pages', title: 'Master Calendar', subtitle: 'Interactive 30-day room rack and occupancy timeline', icon: Calendar, action: () => router.push('/calendar') },
    { id: 'p-front', category: 'pages', title: 'Front Desk Operations', subtitle: 'Arrivals, key issuance, and checkout workflows', icon: DoorOpen, action: () => router.push('/front-desk') },
    { id: 'p-rooms', category: 'pages', title: 'Room Inventory', subtitle: 'Room availability and readiness', icon: Layers, action: () => router.push('/rooms') },
    { id: 'p-hk', category: 'pages', title: 'Housekeeping Turnover', subtitle: 'Room readiness, cleaning tasks and inspection scores', icon: Brush, action: () => router.push('/housekeeping') },
    { id: 'p-guests', category: 'pages', title: 'Guest Directory', subtitle: 'Guest profiles, stay counts and lifetime relationship value', icon: Users, action: () => router.push('/guests') },
    { id: 'p-web', category: 'pages', title: 'Hotel Website Builder', subtitle: 'CMS showcase, live domain and content editor', icon: Globe, action: () => router.push('/website') },
    { id: 'p-booking', category: 'pages', title: 'Direct Booking Engine', subtitle: 'Commission-free direct checkout preview & embed snippets', icon: Compass, action: () => router.push('/booking-preview') },
    { id: 'p-payments', category: 'pages', title: 'Payments & Transactions', subtitle: 'Paystack verified settlements and guest bills', icon: CreditCard, action: () => router.push('/payments') },
    { id: 'p-offers', category: 'pages', title: 'Offers & Promotions', subtitle: 'Promotional offers — coming soon', icon: Tag, action: () => router.push('/offers') },
    { id: 'p-channels', category: 'pages', title: 'Channels & OTAs', subtitle: 'Available connections and upcoming channels', icon: Layers, action: () => router.push('/channels') },
    { id: 'p-analytics', category: 'pages', title: 'Analytics & Insights', subtitle: 'Occupancy, booking value, and booking sources', icon: TrendingUp, action: () => router.push('/analytics') },
    { id: 'p-reports', category: 'pages', title: 'Reports & Audits', subtitle: 'Financial summary, VAT tax provisions and CSV exports', icon: FileSpreadsheet, action: () => router.push('/reports') },
    { id: 'p-staff', category: 'pages', title: 'Staff Roster & Permissions', subtitle: 'Team management, active shifts and access controls', icon: Users, action: () => router.push('/staff') },
    { id: 'p-settings', category: 'pages', title: 'Property Settings', subtitle: 'Policies, check-in times, payout bank account', icon: Settings, action: () => router.push('/settings') },
  ];

  // Quick actions
  const actions: CommandItem[] = [
    {
      id: 'act-new-res',
      category: 'actions',
      title: 'Create New Reservation',
      subtitle: 'Book a room for a direct or walk-in guest',
      badge: 'Shortcut N',
      icon: Plus,
      action: () => {
        onClose();
        onOpenNewReservation?.();
      },
    },
    {
      id: 'act-add-room',
      category: 'actions',
      title: 'Add New Room to Inventory',
      subtitle: 'Register a new physical room and assign category tier',
      badge: 'Rooms',
      icon: Plus,
      action: () => router.push('/rooms'),
    },
    {
      id: 'act-manage-categories',
      category: 'actions',
      title: 'Manage Room Categories & Rates',
      subtitle: 'View, edit, and configure room classes, pricing, and amenities',
      badge: 'Rooms',
      icon: BedDouble,
      action: () => router.push('/rooms'),
    },
    {
      id: 'act-clean-rooms',
      category: 'actions',
      title: 'View Housekeeping Queue',
      subtitle: '6 rooms currently dirty or cleaning',
      badge: 'Action',
      icon: Brush,
      action: () => router.push('/housekeeping'),
    },
    {
      id: 'act-front-arrivals',
      category: 'actions',
      title: 'Check In Arriving Guests',
      subtitle: '12 arrivals expected today at front desk',
      badge: 'Today',
      icon: DoorOpen,
      action: () => router.push('/front-desk'),
    },
  ];

  // Reservation items from PostgreSQL
  const reservations: CommandItem[] = liveReservations.map((r) => ({
    id: `res-${r.id}`,
    category: 'reservations',
    title: `${r.guestName || 'Guest'} (${r.reference || ''})`,
    subtitle: `${r.roomTypeName || 'Room'} · ${r.status ? r.status.replace('_', ' ') : 'confirmed'}`,
    badge: r.status === 'checked_in' ? 'In House' : 'Confirmed',
    icon: User,
    action: () => router.push(`/reservations?search=${encodeURIComponent(r.guestName || '')}`),
  }));

  // Room items from PostgreSQL
  const rooms: CommandItem[] = liveRooms.map((rm) => ({
    id: `room-${rm.id}`,
    category: 'rooms',
    title: `Room ${rm.roomNumber || rm.number} — ${rm.roomTypeName || rm.type || 'Standard'}`,
    subtitle: `${rm.floor || 'Floor 1'} · Housekeeping: ${rm.housekeepingStatus || rm.housekeeping || 'clean'}`,
    badge: rm.operationalStatus || rm.operational || 'available',
    icon: BedDouble,
    action: () => router.push(`/rooms`),
  }));

  const allItems: CommandItem[] = [...actions, ...pages, ...reservations, ...rooms];

  const filteredItems = React.useMemo(() => {
    if (!query.trim()) {
      return [...actions, ...pages.slice(0, 6), ...reservations.slice(0, 3)];
    }
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [query]);

  // Keyboard navigation
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredItems, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4">
      {/* Dark backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Palette Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-[#E8E2DA] overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-10 flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#E8E2DA] gap-3">
          <Search className="w-4 h-4 text-[#B85C3E] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search guests, rooms, reservations, or jump to page..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent text-sm text-[#191816] placeholder-[#7A7267] focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-[#7A7267] hover:text-[#191816]"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="px-1.5 py-0.5 rounded border border-[#E8E2DA] bg-[#FAFAFA] text-[10px] text-[#7A7267] font-mono">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 divide-y divide-[#E8E2DA]/40">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7A7267]">
              No results found for "<span className="text-[#191816] font-medium">{query}</span>"
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-[#F9F7F5] border border-[#E8E2DA] text-[#191816]'
                        : 'text-[#191816]/80 hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-[#B85C3E] text-white'
                            : 'bg-[#FAFAFA] border border-[#E8E2DA] text-[#7A7267]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-[#191816] truncate">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="block text-[11px] text-[#7A7267] truncate">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#FAFAFA] border border-[#E8E2DA] text-[#7A7267]">
                          {item.badge}
                        </span>
                      )}
                      <ArrowRight
                        className={`w-3.5 h-3.5 ${
                          isSelected ? 'text-[#B85C3E]' : 'text-transparent'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-2.5 border-t border-[#E8E2DA] bg-[#FAFAFA] flex items-center justify-between text-[11px] text-[#7A7267]">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-[#B85C3E] font-medium">Sena Instant Search</span>
        </div>
      </div>
    </div>
  );
}
