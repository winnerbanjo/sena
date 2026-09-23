'use client';

import * as React from 'react';
import { Topbar } from '../../components/topbar';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { Badge, Button } from '@sena/ui';
import {
  Settings as SettingsIcon,
  Building,
  Clock,
  CreditCard,
  Bell,
  Palette,
  ShieldCheck,
  Save,
  CheckCircle2,
  Check,
  AlertCircle
} from 'lucide-react';

export default function SettingsPage() {
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'general' | 'policies' | 'payments' | 'notifications'>('general');
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  // Form states
  const [propertyName, setPropertyName] = React.useState('Stay Connect Lekki');
  const [propertyType, setPropertyType] = React.useState('Serviced Apartment Hotel');
  const [tagline, setTagline] = React.useState('hospitality, simplified.');
  const [contactEmail, setContactEmail] = React.useState('concierge@stayconnect.ng');
  const [contactPhone, setContactPhone] = React.useState('+234 803 123 4567');
  const [address, setAddress] = React.useState('Plot 14, Admiralty Way, Lekki Phase 1');
  const [city, setCity] = React.useState('Lagos');

  // Policy states
  const [checkInTime, setCheckInTime] = React.useState('14:00');
  const [checkOutTime, setCheckOutTime] = React.useState('11:00');
  const [cancellationPolicy, setCancellationPolicy] = React.useState('moderate');
  const [securityDeposit, setSecurityDeposit] = React.useState('50000');

  // Notifications
  const [whatsappGuestAlerts, setWhatsappGuestAlerts] = React.useState(true);
  const [emailBookingDigest, setEmailBookingDigest] = React.useState(true);
  const [smsHousekeepingAlerts, setSmsHousekeepingAlerts] = React.useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title="Settings"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              Property Settings
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Configure property profile, operating policies, payout accounts, and automation.
            </p>
          </div>

          <Button onClick={handleSave} className="flex items-center gap-1.5 self-start sm:self-auto text-xs">
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Saved Changes</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-4 sm:gap-6 border-b border-[#E8E2DA] overflow-x-auto whitespace-nowrap">
          {[
            { id: 'general', label: 'General & Profile', icon: Building },
            { id: 'policies', label: 'Policies & Check-in Times', icon: Clock },
            { id: 'payments', label: 'Payments & Settlement Bank', icon: CreditCard },
            { id: 'notifications', label: 'Guest & Staff Notifications', icon: Bell },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2.5 text-xs font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-[#B85C3E] text-[#B85C3E] font-semibold'
                    : 'border-transparent text-[#7A7267] hover:text-[#191816]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
          {/* Tab 1: General */}
          {activeTab === 'general' && (
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-4 sm:p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Property Profile</h3>
                <p className="text-xs text-[#7A7267]">Basic identifiers used across guest booking confirmation & receipts.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Property Name
                  </label>
                  <input
                    type="text"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Property Type
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  >
                    <option value="Serviced Apartment Hotel">Serviced Apartment Hotel</option>
                    <option value="Boutique Hotel">Boutique Hotel</option>
                    <option value="Luxury Villa">Luxury Villa</option>
                    <option value="Business Hotel">Business Hotel</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1">
                  Physical Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    defaultValue="Nigeria"
                    disabled
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] bg-[#FAFAFA] text-xs text-[#7A7267]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Timezone
                  </label>
                  <input
                    type="text"
                    defaultValue="Africa/Lagos (GMT+1)"
                    disabled
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] bg-[#FAFAFA] text-xs text-[#7A7267]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Policies */}
          {activeTab === 'policies' && (
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-4 sm:p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Check-in & Check-out Timing</h3>
                <p className="text-xs text-[#7A7267]">Standard operational turnover schedule.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Check-in Time (From)
                  </label>
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Check-out Time (Until)
                  </label>
                  <input
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1.5">
                  Cancellation Policy
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'flexible', title: 'Flexible', desc: 'Full refund up to 24h prior to arrival' },
                    { id: 'moderate', title: 'Moderate', desc: 'Full refund up to 48h prior to arrival' },
                    { id: 'strict', title: 'Strict', desc: 'Non-refundable within 7 days of arrival' },
                  ].map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setCancellationPolicy(p.id)}
                      className={`p-3 rounded border text-left cursor-pointer transition-colors ${
                        cancellationPolicy === p.id
                          ? 'border-[#B85C3E] bg-[#FDFBF7] ring-1 ring-[#B85C3E]'
                          : 'border-[#E8E2DA] bg-white hover:border-[#B85C3E]/50'
                      }`}
                    >
                      <span className="block text-xs font-semibold text-[#191816]">{p.title}</span>
                      <span className="block text-[10px] text-[#7A7267] mt-0.5">{p.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1">
                  Caution / Security Deposit (₦)
                </label>
                <input
                  type="number"
                  value={securityDeposit}
                  onChange={(e) => setSecurityDeposit(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                />
                <span className="text-[11px] text-[#7A7267] mt-0.5 block">Refundable at checkout inspection.</span>
              </div>
            </div>
          )}

          {/* Tab 3: Payments */}
          {activeTab === 'payments' && (
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Settlement Account & Payouts</h3>
                <p className="text-xs text-[#7A7267]">Where direct guest payments and online deposits are wired daily.</p>
              </div>

              <div className="p-4 rounded-lg border border-[#E8E2DA] bg-[#FAFAFA] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#191816]">Paystack Merchant Subaccount</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                    Connected & Verified
                  </span>
                </div>

                <div className="font-mono text-xs bg-white p-3 rounded border border-[#E8E2DA] text-[#191816] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#7A7267]">Bank Name:</span>
                    <span>Guaranty Trust Bank (GTBank)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A7267]">Account Number:</span>
                    <span>0123456789</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A7267]">Account Name:</span>
                    <span>STAY CONNECT APARTMENTS LTD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A7267]">Payout Frequency:</span>
                    <span>Automated Daily (T+1 at 06:00 WAT)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Notifications */}
          {activeTab === 'notifications' && (
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Automated Guest & Staff Notifications</h3>
                <p className="text-xs text-[#7A7267]">Zero-manual-touch hospitality messaging.</p>
              </div>

              <div className="divide-y divide-[#E8E2DA]">
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-[#191816]">Guest WhatsApp Confirmation</h4>
                    <p className="text-[11px] text-[#7A7267]">Send immediate WhatsApp greeting with booking ref, directions, and Wi-Fi code.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={whatsappGuestAlerts}
                    onChange={(e) => setWhatsappGuestAlerts(e.target.checked)}
                    className="w-4 h-4 accent-[#B85C3E] rounded cursor-pointer"
                  />
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-[#191816]">Housekeeping Turnover SMS</h4>
                    <p className="text-[11px] text-[#7A7267]">Notify housekeeping supervisor automatically whenever a guest checks out.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={smsHousekeepingAlerts}
                    onChange={(e) => setSmsHousekeepingAlerts(e.target.checked)}
                    className="w-4 h-4 accent-[#B85C3E] rounded cursor-pointer"
                  />
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-[#191816]">Daily General Manager Digest</h4>
                    <p className="text-[11px] text-[#7A7267]">Morning 7:00 AM email summarizing today's arrivals, departures, and occupancy.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailBookingDigest}
                    onChange={(e) => setEmailBookingDigest(e.target.checked)}
                    className="w-4 h-4 accent-[#B85C3E] rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </form>
      </main>

      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={() => {}}
      />
    </div>
  );
}
