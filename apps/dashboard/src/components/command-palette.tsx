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
  Plug,
  Dumbbell,
  QrCode,
  Utensils,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from './workspace-access';

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
  aliases?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export function CommandPalette({ open, onClose, onOpenNewReservation }: CommandPaletteProps) {
  const router = useRouter();
  const tNav = useTranslations('navigation');
  const tStatus = useTranslations('statuses.reservation');
  const tHk = useTranslations('statuses.housekeeping');
  const tCommon = useTranslations('common');
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [liveReservations, setLiveReservations] = React.useState<any[]>([]);
  const [liveRooms, setLiveRooms] = React.useState<any[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const workspace = useWorkspace();
  const industry = workspace?.property?.industry || 'hotel';
  const [liveMembers, setLiveMembers] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);

      if (industry === 'gym') {
        fetch('/api/gym/members')
          .then((res) => res.json())
          .then((data) => {
            if (data?.members) setLiveMembers(data.members);
          })
          .catch(() => {});
      } else if (industry === 'hotel') {
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
    }
  }, [open, industry]);

  // Pages definition
  const pages: CommandItem[] = [
    { id: 'p-home', category: 'pages', title: tNav('overview'), subtitle: tNav('overviewSubtitle'), aliases: 'Overview Dashboard', icon: Home, action: () => router.push('/') },
    { id: 'p-res', category: 'pages', title: tNav('reservations'), subtitle: tNav('reservationsSubtitle'), aliases: 'Reservations', icon: ClipboardList, action: () => router.push('/reservations') },
    { id: 'p-cal', category: 'pages', title: tNav('calendar'), subtitle: tNav('calendarSubtitle'), aliases: 'Calendar Master', icon: Calendar, action: () => router.push('/calendar') },
    { id: 'p-front', category: 'pages', title: tNav('frontDesk'), subtitle: tNav('frontDeskSubtitle'), aliases: 'Front Desk', icon: DoorOpen, action: () => router.push('/front-desk') },
    { id: 'p-rooms', category: 'pages', title: tNav('rooms'), subtitle: tNav('roomsSubtitle'), aliases: 'Rooms Inventory', icon: Layers, action: () => router.push('/rooms') },
    { id: 'p-apartments', category: 'pages', title: tNav('apartments'), subtitle: tNav('apartmentsSubtitle'), aliases: 'Apartments Shortlets Serviced', icon: Layers, action: () => router.push('/apartments') },
    { id: 'p-hk', category: 'pages', title: tNav('housekeeping'), subtitle: tNav('housekeepingSubtitle'), aliases: 'Housekeeping', icon: Brush, action: () => router.push('/housekeeping') },
    { id: 'p-guests', category: 'pages', title: tNav('guests'), subtitle: tNav('guestsSubtitle'), aliases: 'Guests Directory', icon: Users, action: () => router.push('/guests') },
    { id: 'p-web', category: 'pages', title: tNav('website'), subtitle: tNav('websiteSubtitle'), aliases: 'Website CMS', icon: Globe, action: () => router.push('/website') },
    { id: 'p-booking', category: 'pages', title: tNav('directBooking'), subtitle: tNav('directBookingSubtitle'), aliases: 'Direct Booking', icon: Compass, action: () => router.push('/booking-preview') },
    { id: 'p-payments', category: 'pages', title: tNav('payments'), subtitle: tNav('paymentsSubtitle'), aliases: 'Payments', icon: CreditCard, action: () => router.push('/payments') },
    { id: 'p-invoices', category: 'pages', title: tNav('invoices'), subtitle: tNav('invoicesSubtitle'), aliases: 'Invoices Folios', icon: FileSpreadsheet, action: () => router.push('/invoices') },
    { id: 'p-offers', category: 'pages', title: tNav('offers'), subtitle: tNav('offersSubtitle'), aliases: 'Offers Promotions', icon: Tag, action: () => router.push('/offers') },
    { id: 'p-analytics', category: 'pages', title: tNav('analytics'), subtitle: tNav('analyticsSubtitle'), aliases: 'Analytics Insights', icon: TrendingUp, action: () => router.push('/analytics') },
    { id: 'p-reports', category: 'pages', title: tNav('reports'), subtitle: tNav('reportsSubtitle'), aliases: 'Reports Audits', icon: FileSpreadsheet, action: () => router.push('/reports') },
    { id: 'p-staff', category: 'pages', title: tNav('staff'), subtitle: tNav('staffSubtitle'), aliases: 'Staff Roster', icon: Users, action: () => router.push('/staff') },
    { id: 'p-apps', category: 'pages', title: tNav('apps'), subtitle: tNav('appsSubtitle'), aliases: 'Connected Apps Apps Channels OTAs Booking.com Airbnb Expedia Paystack', icon: Plug, action: () => router.push('/apps') },
    { id: 'p-billing', category: 'pages', title: tNav('billing'), subtitle: tNav('billingSubtitle'), aliases: 'Billing Plan', icon: CreditCard, action: () => router.push('/billing') },
    { id: 'p-settings', category: 'pages', title: tNav('settings'), subtitle: tNav('settingsSubtitle'), aliases: 'Settings Property', icon: Settings, action: () => router.push('/settings') },
  ];

  // Quick actions
  const actions: CommandItem[] = [
    {
      id: 'act-new-res',
      category: 'actions',
      title: tNav('createReservation'),
      subtitle: tNav('createReservationSubtitle'),
      badge: tNav('shortcutN'),
      aliases: 'Create New Reservation',
      icon: Plus,
      action: () => {
        onClose();
        onOpenNewReservation?.();
      },
    },
    {
      id: 'act-add-room',
      category: 'actions',
      title: tNav('addRoom'),
      subtitle: tNav('addRoomSubtitle'),
      badge: tNav('rooms'),
      aliases: 'Add New Room',
      icon: Plus,
      action: () => router.push('/rooms'),
    },
    {
      id: 'act-manage-categories',
      category: 'actions',
      title: tNav('manageCategories'),
      subtitle: tNav('manageCategoriesSubtitle'),
      badge: tNav('rooms'),
      aliases: 'Manage Room Categories',
      icon: BedDouble,
      action: () => router.push('/rooms'),
    },
    {
      id: 'act-clean-rooms',
      category: 'actions',
      title: tNav('housekeepingQueue'),
      subtitle: tNav('housekeepingSubtitle'),
      badge: tNav('housekeeping'),
      aliases: 'Housekeeping Queue',
      icon: Brush,
      action: () => router.push('/housekeeping'),
    },
    {
      id: 'act-front-arrivals',
      category: 'actions',
      title: tNav('checkInArrivals'),
      subtitle: tNav('frontDeskSubtitle'),
      badge: tNav('frontDesk'),
      aliases: 'Check In Arriving Guests Front Desk',
      icon: DoorOpen,
      action: () => router.push('/front-desk'),
    },
  ];

  // Reservation items from PostgreSQL
  const reservations: CommandItem[] = liveReservations.map((r) => ({
    id: `res-${r.id}`,
    category: 'reservations',
    title: `${r.guestName || tCommon('guest')} (${r.reference || ''})`,
    subtitle: `${r.roomTypeName || tCommon('room')} · ${tStatus.has(r.status as never) ? tStatus(r.status as never) : tStatus('confirmed')}`,
    badge: r.status === 'checked_in' ? tStatus('checked_in') : tStatus.has(r.status as never) ? tStatus(r.status as never) : tStatus('confirmed'),
    icon: User,
    action: () => router.push(`/reservations?search=${encodeURIComponent(r.guestName || '')}`),
  }));

  // Room items from PostgreSQL
  const rooms: CommandItem[] = liveRooms.map((rm) => ({
    id: `room-${rm.id}`,
    category: 'rooms',
    title: `${tCommon('room')} ${rm.roomNumber || rm.number} — ${rm.roomTypeName || rm.type || 'Standard'}`,
    subtitle: `${rm.floor || ''} · ${tHk.has((rm.housekeepingStatus || rm.housekeeping || 'clean') as never) ? tHk((rm.housekeepingStatus || rm.housekeeping || 'clean') as never) : tHk('clean')}`,
    badge: rm.operationalStatus || rm.operational || 'available',
    icon: BedDouble,
    action: () => router.push(`/rooms`),
  }));

  // Gym specific pages & actions
  const gymPages: CommandItem[] = [
    { id: 'p-gym-dash', category: 'pages', title: 'Command Center', subtitle: 'Live floor capacity & gym overview', aliases: 'Gym Command Center Dashboard', icon: Dumbbell, action: () => { onClose(); router.push('/gym'); } },
    { id: 'p-gym-members', category: 'pages', title: 'Member Directory', subtitle: 'View, search, and register gym members', aliases: 'Gym Members Directory', icon: Users, action: () => { onClose(); router.push('/gym/members'); } },
    { id: 'p-gym-term', category: 'pages', title: 'Access Terminal', subtitle: 'QR scan entry and door access gate', aliases: 'QR Check-in Access Terminal', icon: QrCode, action: () => { onClose(); router.push('/gym/access-terminal'); } },
    { id: 'p-gym-plans', category: 'pages', title: 'Plans & Passes', subtitle: 'Membership tiers, passes, and pricing', aliases: 'Gym Plans Subscriptions Passes', icon: ClipboardList, action: () => { onClose(); router.push('/gym/plans'); } },
    { id: 'p-gym-classes', category: 'pages', title: 'Classes & Schedule', subtitle: 'Group fitness classes & timetable', aliases: 'Gym Classes Fitness Schedule Timetable', icon: Calendar, action: () => { onClose(); router.push('/gym/classes'); } },
    { id: 'p-gym-trainers', category: 'pages', title: 'Trainers & Instructors', subtitle: 'Fitness coaches and class leads', aliases: 'Gym Trainers Instructors Coaches', icon: Layers, action: () => { onClose(); router.push('/gym/trainers'); } },
    { id: 'p-payments', category: 'pages', title: 'Payments', subtitle: 'Subscription settlements & transactions', aliases: 'Payments', icon: CreditCard, action: () => { onClose(); router.push('/payments'); } },
    { id: 'p-invoices', category: 'pages', title: 'Invoices', subtitle: 'Membership dues & corporate billing', aliases: 'Invoices Billing', icon: FileSpreadsheet, action: () => { onClose(); router.push('/invoices'); } },
    { id: 'p-reports', category: 'pages', title: 'Reports & Attendance', subtitle: 'Member attendance and check-in audit', aliases: 'Reports Attendance', icon: FileSpreadsheet, action: () => { onClose(); router.push('/reports'); } },
    { id: 'p-staff', category: 'pages', title: 'Staff & Reception', subtitle: 'Gym desk and operational team', aliases: 'Staff Reception', icon: Users, action: () => { onClose(); router.push('/staff'); } },
    { id: 'p-settings', category: 'pages', title: 'Gym Settings', subtitle: 'Facility hours, tax, and property details', aliases: 'Settings Facility', icon: Settings, action: () => { onClose(); router.push('/settings'); } },
  ];

  const gymActions: CommandItem[] = [
    {
      id: 'act-gym-terminal',
      category: 'actions',
      title: 'Launch Access Terminal',
      subtitle: 'Open live QR code scanner gate',
      badge: 'QR',
      aliases: 'Scan Check-in Terminal Gate',
      icon: QrCode,
      action: () => {
        onClose();
        router.push('/gym/access-terminal');
      },
    },
    {
      id: 'act-gym-reg',
      category: 'actions',
      title: 'Register New Member',
      subtitle: 'Add member and assign membership plan',
      badge: 'Gym',
      aliases: 'Add Register Member Enrol',
      icon: Plus,
      action: () => {
        onClose();
        router.push('/gym/members');
      },
    },
    {
      id: 'act-gym-class',
      category: 'actions',
      title: 'Schedule Fitness Class',
      subtitle: 'Create group workout session',
      badge: 'Classes',
      aliases: 'Add Class Workout Session',
      icon: Calendar,
      action: () => {
        onClose();
        router.push('/gym/classes');
      },
    },
  ];

  const memberItems: CommandItem[] = liveMembers.map((m) => ({
    id: `member-${m.id}`,
    category: 'guests',
    title: m.fullName,
    subtitle: `${m.memberNumber} · ${m.phone} · ${m.status.toUpperCase()}`,
    badge: 'Member',
    aliases: `${m.memberNumber} ${m.phone} ${m.email || ''}`,
    icon: User,
    action: () => {
      onClose();
      router.push('/gym/members');
    },
  }));

  const allItems: CommandItem[] =
    industry === 'gym'
      ? [...gymActions, ...gymPages, ...memberItems]
      : [...actions, ...pages, ...reservations, ...rooms];

  const filteredItems = React.useMemo(() => {
    if (!query.trim()) {
      if (industry === 'gym') {
        return [...gymActions, ...gymPages.slice(0, 5), ...memberItems.slice(0, 3)];
      }
      return [...actions, ...pages.slice(0, 6), ...reservations.slice(0, 3)];
    }
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.aliases && item.aliases.toLowerCase().includes(q))
    );
  }, [query, allItems, industry]);

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
            placeholder={tNav('commandPlaceholder')}
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
              {tNav('noResults')}
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
                    className={`w-full text-start px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors ${
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
            <span>↑↓ {tNav('navigateHint')}</span>
            <span>↵ {tNav('selectHint')}</span>
            <span>ESC {tNav('closeHint')}</span>
          </div>
          <span className="text-[#B85C3E] font-medium">{tNav('instantSearch')}</span>
        </div>
      </div>
    </div>
  );
}
