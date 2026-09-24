'use client';

import * as React from 'react';
import { Topbar } from '../../components/topbar';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { Badge, Button } from '@sena/ui';
import {
  Compass,
  ExternalLink,
  Copy,
  Check,
  Smartphone,
  Monitor,
  Code2,
  Calendar,
  CreditCard,
  Percent,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Users,
  BedDouble,
  Wifi,
  Coffee,
  Tv
} from 'lucide-react';

export default function BookingPreviewPage() {
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [device, setDevice] = React.useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = React.useState<'preview' | 'embed' | 'rules'>('preview');
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [copiedSnippet, setCopiedSnippet] = React.useState(false);
  const [propertyName, setPropertyName] = React.useState('Your Property');
  const [propertySlug, setPropertySlug] = React.useState('your-property');

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('sena_property_name');
      const draftStr = localStorage.getItem('sena_onboarding_draft');
      let name = stored || '';
      if (!name && draftStr) {
        const draft = JSON.parse(draftStr);
        name = draft.propertyName || '';
      }
      if (name) {
        setPropertyName(name);
        setPropertySlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
      }
    } catch {}
  }, []);

  // Booking engine interactive preview state
  const [checkIn, setCheckIn] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [checkOut, setCheckOut] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [guestsCount, setGuestsCount] = React.useState('2 Guests');
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | null>(null);

  // Settings
  const [instantBooking, setInstantBooking] = React.useState(true);
  const [depositPolicy, setDepositPolicy] = React.useState<'full' | 'half' | 'pay_at_property'>('full');
  const [minNights, setMinNights] = React.useState('1');
  const [directDiscountPercent, setDirectDiscountPercent] = React.useState('10');

  const copyUrl = () => {
    navigator.clipboard?.writeText(`https://book.sena.ng/${propertySlug}`);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const copyEmbedSnippet = () => {
    navigator.clipboard?.writeText(
      `<iframe src="https://book.sena.ng/${propertySlug}?embed=true" width="100%" height="700px" frameborder="0" style="border:none;border-radius:12px;overflow:hidden;"></iframe>`
    );
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const rooms = [
    {
      id: 'suite-1',
      name: 'Executive Penthouse Suite',
      badge: 'Most Popular',
      price: 120000,
      otaPrice: 138000,
      size: '65 m²',
      bed: 'King Bed',
      amenities: ['Fiber Wi-Fi', 'Complimentary Breakfast', 'Balcony View', 'Kitchenette'],
      image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'suite-2',
      name: 'Deluxe Residence Room',
      badge: 'Best Value',
      price: 85000,
      otaPrice: 95000,
      size: '42 m²',
      bed: 'Queen Bed',
      amenities: ['Fiber Wi-Fi', 'Smart TV', 'Work Desk', 'En-suite Rain Shower'],
      image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'suite-3',
      name: 'Studio Apartment',
      badge: 'Long Stay',
      price: 65000,
      otaPrice: 74000,
      size: '32 m²',
      bed: 'Queen Bed',
      amenities: ['Fiber Wi-Fi', 'Kitchenette', 'Dedicated Parking'],
      image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title="Direct Booking Engine"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-white">
        {/* Header with Direct Booking URL and Stats */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
                Direct Booking Engine
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                0% OTA Commission
              </span>
            </div>
            <p className="text-xs text-[#7A7267] mt-1">
              Live direct checkout at{' '}
              <a
                href="http://localhost:3002"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#B85C3E] hover:underline font-mono font-medium"
              >
                book.sena.ng/{propertySlug}
              </a>{' '}
              — Keep 100% of guest revenue without middleman fees.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              onClick={copyUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816] hover:bg-[#FAFAFA] transition-colors"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#7A7267]" />
                  <span>Copy Direct URL</span>
                </>
              )}
            </button>

            <a
              href="http://localhost:3002"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded border border-[#E8E2DA] bg-[#FAFAFA] text-xs font-medium text-[#191816] hover:bg-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#B85C3E]" />
              <span>Open Booking Engine</span>
            </a>
          </div>
        </div>

        {/* Value Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Direct Bookings (30d)</span>
            <div className="text-2xl font-serif text-[#191816] mt-1">42% of Total</div>
            <p className="text-[11px] text-emerald-700 mt-1 font-medium">+8% from last month</p>
          </div>
          <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[11px] text-[#7A7267] uppercase font-semibold">OTA Fees Saved</span>
            <div className="text-2xl font-serif text-[#191816] mt-1">₦1,240,000</div>
            <p className="text-[11px] text-[#7A7267] mt-1">Zero commission paid to third-parties</p>
          </div>
          <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Average Direct Booking Time</span>
            <div className="text-2xl font-serif text-[#191816] mt-1">48 seconds</div>
            <p className="text-[11px] text-[#7A7267] mt-1">Frictionless 2-step checkout</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E2DA] gap-2">
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap">
            {[
              { id: 'preview', label: 'Interactive Engine Preview' },
              { id: 'embed', label: 'Embed & Widget Snippets' },
              { id: 'rules', label: 'Booking Rules & Policy' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#B85C3E] text-[#B85C3E] font-semibold'
                    : 'border-transparent text-[#7A7267] hover:text-[#191816]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'preview' && (
            <div className="flex items-center gap-1 p-0.5 rounded border border-[#E8E2DA] bg-[#FAFAFA] mb-2">
              <button
                onClick={() => setDevice('desktop')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                  device === 'desktop'
                    ? 'bg-white shadow-sm text-[#191816] font-medium'
                    : 'text-[#7A7267] hover:text-[#191816]'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="text-[11px]">Desktop</span>
              </button>
              <button
                onClick={() => setDevice('mobile')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                  device === 'mobile'
                    ? 'bg-white shadow-sm text-[#191816] font-medium'
                    : 'text-[#7A7267] hover:text-[#191816]'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="text-[11px]">Mobile</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Interactive Preview */}
        {activeTab === 'preview' && (
          <div className="flex justify-center bg-[#F9F7F5] p-6 rounded-lg border border-[#E8E2DA]">
            <div
              className={`bg-white rounded-xl shadow-lg border border-[#E8E2DA] overflow-hidden transition-all duration-300 ${
                device === 'desktop' ? 'w-full max-w-4xl' : 'w-[375px]'
              }`}
            >
              {/* Header bar */}
              <div className="bg-stone-900 text-white px-6 py-4 flex items-center justify-between border-b border-stone-800">
                <div>
                  <span className="text-sm font-serif tracking-wide block">{propertyName}</span>
                  <span className="text-[10px] text-stone-400">Direct Reservation Guarantee</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-[#B85C3E] text-white px-2 py-0.5 rounded font-medium">
                    Best Rate Guaranteed
                  </span>
                </div>
              </div>

              {/* Step 1: Stay Dates & Occupancy Selector */}
              <div className="p-5 border-b border-[#E8E2DA] bg-[#FAFAFA]">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[#7A7267] mb-1">
                      Check-in
                    </label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[#7A7267] mb-1">
                      Check-out
                    </label>
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[#7A7267] mb-1">
                      Guests
                    </label>
                    <select
                      value={guestsCount}
                      onChange={(e) => setGuestsCount(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816]"
                    >
                      <option>1 Guest</option>
                      <option>2 Guests</option>
                      <option>3 Guests</option>
                      <option>4 Guests</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button className="w-full py-2 rounded bg-[#191816] text-white text-xs font-semibold hover:bg-stone-800 transition-colors">
                      Update Availability
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Available Rooms List */}
              <div className="p-6 space-y-4 max-h-[520px] overflow-y-auto">
                <div className="flex items-center justify-between text-xs text-[#7A7267]">
                  <span>Showing 3 available room types for your dates (3 nights)</span>
                  <span className="text-emerald-700 font-medium">✓ Instant confirmation available</span>
                </div>

                <div className="space-y-4">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        selectedRoomId === room.id
                          ? 'border-[#B85C3E] ring-1 ring-[#B85C3E] bg-[#FDFBF7]'
                          : 'border-[#E8E2DA] bg-white hover:border-[#B85C3E]/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div
                          className="w-full sm:w-36 h-28 rounded bg-cover bg-center flex-shrink-0"
                          style={{ backgroundImage: `url(${room.image})` }}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-[#191816]">{room.name}</h4>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-[#B85C3E]/10 text-[#B85C3E] font-medium">
                                  {room.badge}
                                </span>
                              </div>
                              <p className="text-xs text-[#7A7267] mt-0.5">
                                {room.size} • {room.bed}
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="text-xs line-through text-[#7A7267] mr-1.5">
                                ₦{room.otaPrice.toLocaleString()}
                              </span>
                              <span className="text-base font-semibold text-[#191816]">
                                ₦{room.price.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-[#7A7267] block">per night</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {room.amenities.map((a, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded bg-[#FAFAFA] border border-[#E8E2DA] text-[#7A7267]"
                              >
                                {a}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[#E8E2DA]/60">
                            <span className="text-[11px] text-emerald-700 font-medium">
                              Direct Price includes Free Breakfast & Late Check-out
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRoomId(room.id);
                              }}
                              className="px-4 py-1.5 rounded text-xs font-semibold bg-[#B85C3E] text-white hover:bg-[#A34F33] transition-colors"
                            >
                              {selectedRoomId === room.id ? 'Selected' : 'Reserve Direct'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Booking Engine Footer */}
              <div className="p-4 bg-[#FAFAFA] border-t border-[#E8E2DA] text-center text-[11px] text-[#7A7267]">
                Secured by Sena Paystack Integration • Instant SMS & WhatsApp Confirmation
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Embed Snippets */}
        {activeTab === 'embed' && (
          <div className="space-y-6 max-w-4xl">
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Embed on External Website</h3>
                <p className="text-xs text-[#7A7267]">
                  Paste this iframe into your WordPress, Squarespace, Webflow, or custom website.
                </p>
              </div>

              <div className="relative">
                <pre className="p-4 rounded border border-[#E8E2DA] bg-[#FAFAFA] font-mono text-xs text-[#191816] overflow-x-auto">
{`<iframe
  src="https://book.sena.ng/stay-connect?embed=true"
  width="100%"
  height="700px"
  frameborder="0"
  style="border:none;border-radius:12px;overflow:hidden;"
></iframe>`}
                </pre>
                <button
                  onClick={copyEmbedSnippet}
                  className="absolute top-3 right-3 px-3 py-1 rounded border border-[#E8E2DA] bg-white text-xs font-medium text-[#191816] hover:bg-[#FAFAFA] flex items-center gap-1.5 shadow-sm"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#7A7267]" />
                      <span>Copy Iframe Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 space-y-4">
              <h3 className="text-base font-semibold text-[#191816]">Floating "Book Now" Button Snippet</h3>
              <p className="text-xs text-[#7A7267]">
                Add a floating bottom-right booking button to any page on your website.
              </p>
              <pre className="p-4 rounded border border-[#E8E2DA] bg-[#FAFAFA] font-mono text-xs text-[#191816] overflow-x-auto">
{`<script src="https://cdn.sena.ng/widget.js" data-property="stay-connect" data-color="#B85C3E" defer></script>`}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Rules & Policy */}
        {activeTab === 'rules' && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Direct Booking Rules</h3>
                <p className="text-xs text-[#7A7267]">Configure requirements for guests booking through your direct channel.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded border border-[#E8E2DA] bg-[#FAFAFA]">
                  <div>
                    <h4 className="text-xs font-semibold text-[#191816]">Instant Confirmation</h4>
                    <p className="text-[11px] text-[#7A7267]">Automatically confirm reservations upon successful card or transfer payment.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={instantBooking}
                    onChange={(e) => setInstantBooking(e.target.checked)}
                    className="w-4 h-4 accent-[#B85C3E] rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1.5">
                    Deposit Requirement
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'full', label: '100% Full Payment', desc: 'Secure full upfront payment' },
                      { id: 'half', label: '50% Initial Deposit', desc: 'Balance paid at check-in' },
                      { id: 'pay_at_property', label: 'Pay at Check-in', desc: 'Card guarantee hold only' },
                    ].map((opt) => (
                      <div
                        key={opt.id}
                        onClick={() => setDepositPolicy(opt.id as any)}
                        className={`p-3 rounded border text-left cursor-pointer transition-colors ${
                          depositPolicy === opt.id
                            ? 'border-[#B85C3E] bg-[#FDFBF7] ring-1 ring-[#B85C3E]'
                            : 'border-[#E8E2DA] bg-white hover:border-[#B85C3E]/50'
                        }`}
                      >
                        <span className="block text-xs font-semibold text-[#191816]">{opt.label}</span>
                        <span className="block text-[10px] text-[#7A7267] mt-0.5">{opt.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#191816] mb-1">
                      Minimum Stay (Nights)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={minNights}
                      onChange={(e) => setMinNights(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#191816] mb-1">
                      Direct Booking Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={directDiscountPercent}
                      onChange={(e) => setDirectDiscountPercent(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={() => {}}
      />
    </div>
  );
}
