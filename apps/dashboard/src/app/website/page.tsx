'use client';

import * as React from 'react';
import { Topbar } from '../../components/topbar';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { Badge, Button } from '@sena/ui';
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  Smartphone,
  Monitor,
  Eye,
  Settings,
  Image as ImageIcon,
  MapPin,
  ShieldCheck,
  HelpCircle,
  Save,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Plus
} from 'lucide-react';
import Link from 'next/link';

export default function WebsitePage() {
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [previewDevice, setPreviewDevice] = React.useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = React.useState<'preview' | 'sections' | 'domain' | 'seo'>('preview');
  const [copied, setCopied] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  // Form states
  const [heroHeadline, setHeroHeadline] = React.useState('A Tranquil Sanctuary in the Heart of Lekki');
  const [heroTagline, setHeroTagline] = React.useState('Serene serviced suites designed for luxury, long stays, and effortless living in Lagos.');
  const [welcomeBio, setWelcomeBio] = React.useState('Welcome to Stay Connect Lekki, where warm hospitality meets understated luxury. Located minutes from Lekki Phase 1, each residence offers 24/7 power, superfast fiber Wi-Fi, and personalized concierge services.');
  const [accentColor, setAccentColor] = React.useState('#B85C3E');
  const [customDomain, setCustomDomain] = React.useState('stayconnectlekki.com');

  const copyUrl = () => {
    navigator.clipboard?.writeText('https://stayconnectlekki.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title="Hotel Website"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-white">
        {/* Header with status and quick links */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
                Property Website & CMS
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live & Published
              </span>
            </div>
            <p className="text-xs text-[#7A7267] mt-1">
              Your high-speed direct booking showcase at{' '}
              <a
                href="http://localhost:3002"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#B85C3E] hover:underline font-mono font-medium"
              >
                stayconnectlekki.com
              </a>{' '}
              (or{' '}
              <span className="font-mono text-[#191816]">sena.ng/stay-connect</span>)
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              onClick={copyUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816] hover:bg-[#FAFAFA] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#7A7267]" />
                  <span>Copy Link</span>
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
              <span>Visit Live Website</span>
            </a>

            <Button onClick={handleSave} className="flex items-center gap-1.5 text-xs">
              <Save className="w-3.5 h-3.5" />
              <span>{saveSuccess ? 'Saved!' : 'Save & Publish'}</span>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E2DA] gap-2">
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap">
            {[
              { id: 'preview', label: 'Live Preview' },
              { id: 'sections', label: 'Page Content & Sections' },
              { id: 'domain', label: 'Custom Domain & SSL' },
              { id: 'seo', label: 'SEO & Social Cards' },
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
                onClick={() => setPreviewDevice('desktop')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                  previewDevice === 'desktop'
                    ? 'bg-white shadow-sm text-[#191816] font-medium'
                    : 'text-[#7A7267] hover:text-[#191816]'
                }`}
                title="Desktop View"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="text-[11px]">Desktop</span>
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                  previewDevice === 'mobile'
                    ? 'bg-white shadow-sm text-[#191816] font-medium'
                    : 'text-[#7A7267] hover:text-[#191816]'
                }`}
                title="Mobile View"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="text-[11px]">Mobile</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Live Interactive Preview */}
        {activeTab === 'preview' && (
          <div className="flex justify-center bg-[#F9F7F5] p-6 rounded-lg border border-[#E8E2DA]">
            <div
              className={`bg-white rounded-xl shadow-lg border border-[#E8E2DA] overflow-hidden transition-all duration-300 ${
                previewDevice === 'desktop' ? 'w-full max-w-4xl' : 'w-[375px]'
              }`}
            >
              {/* Browser Address Bar Simulator */}
              <div className="bg-[#F0ECE6] px-4 py-2 border-b border-[#E8E2DA] flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 bg-white px-3 py-1 rounded text-[11px] text-[#7A7267] flex items-center justify-between border border-[#E8E2DA]/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span className="text-[#191816] font-mono">https://stayconnectlekki.com</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded">SSL Secure</span>
                </div>
              </div>

              {/* Website Mock Content */}
              <div className="overflow-y-auto max-h-[620px] divide-y divide-[#E8E2DA]">
                {/* Hero Header */}
                <div className="relative bg-stone-900 text-white p-8 md:p-12 text-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-40"
                    style={{
                      backgroundImage:
                        'url("https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80")',
                    }}
                  />
                  <div className="relative z-20 max-w-2xl mx-auto space-y-4">
                    <span className="inline-block px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-semibold bg-white/20 backdrop-blur-sm border border-white/20">
                      Stay Connect Lekki
                    </span>
                    <h1 className="text-2xl md:text-4xl font-serif font-light leading-tight">
                      {heroHeadline}
                    </h1>
                    <p className="text-xs md:text-sm text-stone-200 font-light leading-relaxed">
                      {heroTagline}
                    </p>
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      <Link
                        href="/booking-preview"
                        className="px-5 py-2.5 rounded text-xs font-semibold bg-[#B85C3E] text-white hover:bg-[#A34F33] transition-colors shadow-sm inline-flex items-center gap-1.5"
                      >
                        <span>Reserve a Suite</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <button className="px-4 py-2.5 rounded text-xs font-medium bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white transition-colors">
                        Explore Rooms
                      </button>
                    </div>
                  </div>
                </div>

                {/* About & Highlights */}
                <div className="p-8 space-y-6 bg-white">
                  <div className="max-w-xl mx-auto text-center space-y-2">
                    <span className="text-[10px] uppercase tracking-widest text-[#B85C3E] font-semibold">
                      Hospitality, Simplified
                    </span>
                    <h2 className="text-xl font-serif text-[#191816]">The Sanctuary Experience</h2>
                    <p className="text-xs text-[#7A7267] leading-relaxed">
                      {welcomeBio}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    {[
                      { title: '24/7 Clean Power', desc: 'Uninterrupted electricity guarantee' },
                      { title: 'Gigabit Fiber', desc: 'High-speed dedicated Wi-Fi' },
                      { title: 'Prime Lekki Phase 1', desc: '5 mins to restaurants & arts' },
                      { title: 'Direct Guest Perk', desc: 'Best rate + complimentary breakfast' },
                    ].map((feat, i) => (
                      <div key={i} className="p-3.5 rounded border border-[#E8E2DA] bg-[#FAFAFA] text-center space-y-1">
                        <CheckCircle2 className="w-4 h-4 text-[#B85C3E] mx-auto" />
                        <h4 className="text-xs font-semibold text-[#191816]">{feat.title}</h4>
                        <p className="text-[10px] text-[#7A7267]">{feat.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Room Showcase Preview */}
                <div className="p-8 bg-[#FAFAFA] space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-serif text-[#191816]">Featured Residences</h3>
                      <p className="text-xs text-[#7A7267]">Each residence thoughtfully curated with premium king bedding and kitchenettes.</p>
                    </div>
                    <Link href="/rooms" className="text-xs font-medium text-[#B85C3E] hover:underline flex items-center gap-1">
                      <span>View all 26 rooms</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { name: 'Executive Penthouse', price: '₦120,000', size: '65 sqm', guests: '2 Guests' },
                      { name: 'Deluxe Suite', price: '₦85,000', size: '42 sqm', guests: '2 Guests' },
                      { name: 'Studio Residence', price: '₦65,000', size: '32 sqm', guests: '1-2 Guests' },
                    ].map((room, i) => (
                      <div key={i} className="bg-white rounded border border-[#E8E2DA] overflow-hidden group">
                        <div className="h-32 bg-stone-200 relative flex items-center justify-center text-xs text-stone-500">
                          <ImageIcon className="w-6 h-6 text-stone-400" />
                          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm">
                            {room.size}
                          </span>
                        </div>
                        <div className="p-3.5 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-xs font-semibold text-[#191816]">{room.name}</h4>
                              <p className="text-[10px] text-[#7A7267]">{room.guests}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-semibold text-[#191816]">{room.price}</span>
                              <span className="text-[10px] text-[#7A7267] block">/night</span>
                            </div>
                          </div>
                          <Link
                            href="/booking-preview"
                            className="w-full mt-2 block text-center py-1.5 rounded text-[11px] font-medium border border-[#E8E2DA] text-[#191816] hover:bg-[#FAFAFA] transition-colors"
                          >
                            Book Room
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Preview */}
                <div className="p-6 bg-stone-900 text-stone-400 text-center text-xs space-y-2">
                  <p className="text-white font-serif text-sm">Stay Connect Lekki</p>
                  <p className="text-[11px]">Plot 14, Admiralty Way, Lekki Phase 1, Lagos, Nigeria</p>
                  <p className="text-[10px] text-stone-500">Powered by Sena Hospitality OS</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Sections & Content */}
        {activeTab === 'sections' && (
          <div className="space-y-6 max-w-4xl">
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Hero Section</h3>
                <p className="text-xs text-[#7A7267]">The first impression your guests see when opening your website.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Main Headline
                  </label>
                  <input
                    type="text"
                    value={heroHeadline}
                    onChange={(e) => setHeroHeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Sub-tagline
                  </label>
                  <input
                    type="text"
                    value={heroTagline}
                    onChange={(e) => setHeroTagline(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Welcome Story & Property Biography
                  </label>
                  <textarea
                    rows={4}
                    value={welcomeBio}
                    onChange={(e) => setWelcomeBio(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>
              </div>
            </div>

            {/* Sections Toggle */}
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 space-y-4">
              <h3 className="text-base font-semibold text-[#191816]">Enabled Sections</h3>
              <div className="divide-y divide-[#E8E2DA]">
                {[
                  { name: 'Room & Suite Showcase', desc: 'Display all available rooms with real-time pricing and photos', active: true },
                  { name: 'Amenities & Inclusions', desc: 'Wi-Fi speeds, power redundancy, breakfast details, and concierge services', active: true },
                  { name: 'Neighborhood & Location Guide', desc: 'Interactive map and local dining recommendations in Lekki', active: true },
                  { name: 'Guest Reviews & Ratings', desc: 'Verified guest testimonials and satisfaction ratings', active: true },
                  { name: 'House Policies & FAQs', desc: 'Check-in rules, cancellation windows, and parking guidelines', active: true },
                  { name: 'Direct WhatsApp Concierge', desc: 'One-tap chat for corporate inquiries and special requests', active: true },
                ].map((sec, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-[#191816]">{sec.name}</h4>
                      <p className="text-[11px] text-[#7A7267]">{sec.desc}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Custom Domain & SSL */}
        {activeTab === 'domain' && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Custom Domain</h3>
                <p className="text-xs text-[#7A7267]">Connect your hotel’s primary domain name for seamless branding.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Domain Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      placeholder="e.g. stayconnectlekki.com"
                      className="flex-1 px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                    />
                    <Button onClick={handleSave} className="text-xs">
                      Verify DNS
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded border border-[#E8E2DA] bg-[#FAFAFA] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#191816]">DNS Configuration:</span>
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      CNAME Record Validated
                    </span>
                  </div>
                  <div className="font-mono text-[11px] bg-white p-2.5 rounded border border-[#E8E2DA] text-[#191816] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#7A7267]">Type:</span> <span>CNAME</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7A7267]">Host:</span> <span>@ / www</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7A7267]">Target:</span> <span>cname.sena.ng</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 space-y-3">
              <h3 className="text-base font-semibold text-[#191816]">Free Sena Subdomain</h3>
              <p className="text-xs text-[#7A7267]">Always accessible as an instant fallback:</p>
              <div className="flex items-center justify-between p-3 rounded border border-[#E8E2DA] bg-[#FAFAFA] text-xs">
                <span className="font-mono text-[#191816]">https://sena.ng/stay-connect</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  Always Active
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: SEO & Social */}
        {activeTab === 'seo' && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Search Engine Optimization (SEO)</h3>
                <p className="text-xs text-[#7A7267]">How your hotel appears on Google searches and social media shares.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Meta Title (Max 60 characters)
                  </label>
                  <input
                    type="text"
                    defaultValue="Stay Connect Lekki — Luxury Serviced Apartments & Suites"
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Meta Description (Max 160 characters)
                  </label>
                  <textarea
                    rows={3}
                    defaultValue="Experience tranquil luxury at Stay Connect Lekki. Book direct for 24/7 power, high-speed fiber Wi-Fi, premium bedding, and complimentary breakfast in Lagos."
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>

                {/* Google Search Result Preview */}
                <div className="p-4 rounded border border-[#E8E2DA] bg-[#FAFAFA] space-y-1">
                  <span className="text-[10px] text-[#7A7267] uppercase tracking-wider block font-semibold">
                    Google Search Preview
                  </span>
                  <div className="space-y-1 pt-1">
                    <span className="text-xs text-[#1a0dab] font-medium hover:underline cursor-pointer block truncate">
                      Stay Connect Lekki — Luxury Serviced Apartments & Suites
                    </span>
                    <span className="text-[11px] text-[#006621] block">https://stayconnectlekki.com</span>
                    <p className="text-[11px] text-[#545454] leading-relaxed">
                      Experience tranquil luxury at Stay Connect Lekki. Book direct for 24/7 power, high-speed fiber Wi-Fi, premium bedding, and complimentary breakfast in Lagos.
                    </p>
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
