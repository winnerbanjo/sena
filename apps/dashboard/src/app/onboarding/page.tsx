'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@sena/ui';
import {
  ArrowRight,
  Banknote,
  Bed,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Edit2,
  Globe,
  AtSign,
  Layers,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { RoomItem } from '../../components/mock-data';

interface CountryOption {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  phoneCode: string;
}

const COUNTRIES: CountryOption[] = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', currencySymbol: '₦', phoneCode: '+234' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', currency: 'GHS', currencySymbol: 'GH₵', phoneCode: '+233' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'KES', currencySymbol: 'KSh', phoneCode: '+254' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', currency: 'RWF', currencySymbol: 'RWF', phoneCode: '+250' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', currencySymbol: 'R', phoneCode: '+27' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', currencySymbol: '£', phoneCode: '+44' },
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', currencySymbol: '$', phoneCode: '+1' },
];

const NIGERIAN_BANKS = [
  'Guaranty Trust Bank (GTBank)',
  'Zenith Bank',
  'Access Bank',
  'First Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Kuda Microfinance Bank',
  'Moniepoint MFB',
  'OPay',
  'Stanbic IBTC Bank',
  'Sterling Bank',
  'Fidelity Bank',
  'Wema Bank (ALAT)',
  'Standard Chartered',
  'Other Commercial Bank',
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);

  // Step 1: Property Profile & Socials
  const [selectedCountry, setSelectedCountry] = React.useState<CountryOption>(COUNTRIES[0]);
  const [propName, setPropName] = React.useState('Stay Connect Lekki');
  const [propType, setPropType] = React.useState('hotel');
  const [city, setCity] = React.useState('Lekki Phase 1, Lagos');
  const [address, setAddress] = React.useState('14 Admiralty Way');
  const [whatsappPhone, setWhatsappPhone] = React.useState('+234 802 345 6789');
  const [instagram, setInstagram] = React.useState('@stayconnectlekki');
  const [websiteUrl, setWebsiteUrl] = React.useState('');

  // Step 2: Room Classes & Pricing
  const [roomTypeName, setRoomTypeName] = React.useState('Deluxe Room');
  const [bedType, setBedType] = React.useState('1 Queen Bed');
  const [price, setPrice] = React.useState('85000');
  const [numRooms, setNumRooms] = React.useState('8');
  const [floorNumber, setFloorNumber] = React.useState('1');

  // Step 3: Smart Room Numbering Generator
  const [roomsList, setRoomsList] = React.useState<string[]>([
    '101', '102', '103', '104', '105', '106', '107', '108'
  ]);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editingRoomVal, setEditingRoomVal] = React.useState('');
  const [startNumber, setStartNumber] = React.useState('101');

  // Step 4: Direct Bank Transfer Details
  const [bankName, setBankName] = React.useState(NIGERIAN_BANKS[0]);
  const [accountNumber, setAccountNumber] = React.useState('0123456789');
  const [accountName, setAccountName] = React.useState('STAY CONNECT LEKKI HOSPITALITY LTD');
  const [transferInstructions, setTransferInstructions] = React.useState(
    'Please use your booking reference as payment narration and send transfer receipt via WhatsApp.'
  );

  // Load from draft if available
  React.useEffect(() => {
    try {
      const draft = localStorage.getItem('sena_onboarding_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.propName) {
          setPropName(parsed.propName);
          setAccountName(`${parsed.propName.toUpperCase()} LTD`);
        }
        if (parsed.propType) setPropType(parsed.propType);
        if (parsed.phone) setWhatsappPhone(parsed.phone);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Update account name automatically when property name changes if default
  function handlePropNameChange(val: string) {
    setPropName(val);
    setAccountName(`${val.toUpperCase()} HOSPITALITY LTD`);
    const cleanHandle = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    setInstagram(`@${cleanHandle}`);
  }

  // Regenerate rooms automatically when numRooms or startNumber changes
  function generateRooms(count: number, startNumStr: string) {
    const start = parseInt(startNumStr, 10) || 101;
    const generated: string[] = [];
    for (let i = 0; i < count; i++) {
      generated.push(String(start + i));
    }
    setRoomsList(generated);
  }

  function handleNumRoomsChange(countStr: string) {
    setNumRooms(countStr);
    const count = parseInt(countStr, 10) || 1;
    generateRooms(count, startNumber);
  }

  function handleStartNumberChange(startStr: string) {
    setStartNumber(startStr);
    const count = parseInt(numRooms, 10) || 1;
    generateRooms(count, startStr);
  }

  function handleAddCustomRoom() {
    const lastNum = roomsList[roomsList.length - 1];
    const nextNum = lastNum && !isNaN(Number(lastNum)) ? String(Number(lastNum) + 1) : `10${roomsList.length + 1}`;
    setRoomsList((prev) => [...prev, nextNum]);
    setNumRooms(String(roomsList.length + 1));
  }

  function handleRemoveRoom(idx: number) {
    setRoomsList((prev) => prev.filter((_, i) => i !== idx));
    setNumRooms(String(Math.max(1, roomsList.length - 1)));
  }

  function saveEditedRoom(idx: number) {
    if (editingRoomVal.trim()) {
      setRoomsList((prev) => {
        const copy = [...prev];
        copy[idx] = editingRoomVal.trim();
        return copy;
      });
    }
    setEditingIndex(null);
  }

  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Final Launch & Save to PostgreSQL
  async function handleComplete() {
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: propName,
          propertyType: propType,
          country: selectedCountry.name,
          currency: selectedCountry.currency,
          address: `${address}, ${city}`,
          phone: whatsappPhone,
          email: 'stay@sena.ng',
          roomTypeName,
          bedType,
          priceMinorUnits: Number(price) * 100,
          numRooms: Number(numRooms),
          floorNumber,
          roomsList,
          bankDetails: {
            bankName,
            accountNumber,
            accountName,
            instructions: transferInstructions,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to complete onboarding');
      }

      localStorage.setItem('sena_onboarding_completed', 'true');
      localStorage.setItem('sena_property_name', propName);
      router.push('/onboarding/plans');
    } catch (e: any) {
      console.error('Failed to persist onboarding to PostgreSQL:', e);
      setErrorMsg(e.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between p-4 sm:p-8 lg:p-12">
      {/* Brand Header */}
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between pb-6 border-b border-[#E8E2DA]">
        <Link href="/" className="flex items-center">
          <Image
            src="/assets/sena-logo.png"
            alt="Sena"
            width={110}
            height={36}
            priority
            className="h-7 sm:h-8 w-auto object-contain"
          />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-[#7A7267]">
            Step {step} of 5
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= step ? 'bg-[#B85C3E]' : 'bg-[#E8E2DA]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Wizard Form Card */}
      <div className="max-w-2xl mx-auto w-full bg-white border border-[#E8E2DA] p-6 sm:p-10 rounded-lg my-8 space-y-6 shadow-sm">
        {/* STEP 1: PROPERTY PROFILE, COUNTRY & SOCIALS */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block mb-1">
                Step 1 · Identity & Socials
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif text-[#191816]">
                Tell us about your property
              </h2>
              <p className="text-xs text-[#7A7267] mt-1">
                We'll configure your local currency, WhatsApp communication, and guest reservations.
              </p>
            </div>

            <div className="space-y-4 pt-1 text-xs">
              {/* Country Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#191816]">
                  Operating Country & Currency <span className="text-[#B85C3E]">*</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setSelectedCountry(c)}
                      className={`p-2.5 rounded border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        selectedCountry.code === c.code
                          ? 'border-[#B85C3E] bg-[#FAF9F7] ring-1 ring-[#B85C3E]'
                          : 'border-[#E8E2DA] bg-white hover:border-[#7A7267]'
                      }`}
                    >
                      <span className="text-lg">{c.flag}</span>
                      <div className="truncate">
                        <span className="font-medium text-[#191816] block truncate text-xs">
                          {c.name}
                        </span>
                        <span className="text-[10px] text-[#7A7267] font-mono">
                          {c.currencySymbol} {c.currency}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Property Name & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-[#191816]">
                    Property Name <span className="text-[#B85C3E]">*</span>
                  </Label>
                  <Input
                    value={propName}
                    onChange={(e) => handlePropNameChange(e.target.value)}
                    placeholder="e.g. The Still House"
                    required
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#191816]">Property Type</Label>
                  <select
                    value={propType}
                    onChange={(e) => setPropType(e.target.value)}
                    className="flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  >
                    <option value="hotel">Boutique Hotel</option>
                    <option value="serviced_apartment">Serviced Apartment</option>
                    <option value="resort">Resort & Spa</option>
                    <option value="villa">Luxury Villa</option>
                  </select>
                </div>
              </div>

              {/* City and Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#191816]">City / Area</Label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-[#7A7267] absolute left-3 top-3" />
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Victoria Island, Lagos"
                      className="pl-9 h-10 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#191816]">Physical Address</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street name & building number"
                    className="h-10 text-xs"
                  />
                </div>
              </div>

              {/* Socials & Guest WhatsApp */}
              <div className="pt-2 border-t border-[#E8E2DA] space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7267] block">
                  Guest Contact & Social Media
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#191816]">
                      Front Desk WhatsApp <span className="text-[#B85C3E]">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#2E6B4F] absolute left-3 top-3" />
                      <Input
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        placeholder="+234 800 000 0000"
                        className="pl-9 h-10 text-xs font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#191816]">Instagram Handle</Label>
                    <div className="relative">
                      <AtSign className="w-4 h-4 text-[#B85C3E] absolute left-3 top-3" />
                      <Input
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        placeholder="@yourproperty"
                        className="pl-9 h-10 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ROOM CLASS & PRICING */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block mb-1">
                Step 2 · Room Classes
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif text-[#191816]">
                Configure your primary room tier
              </h2>
              <p className="text-xs text-[#7A7267] mt-1">
                Set up your primary room category, standard nightly rate, and bed setup. You can add more room tiers anytime.
              </p>
            </div>

            <div className="space-y-4 pt-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#191816]">
                    Category Name <span className="text-[#B85C3E]">*</span>
                  </Label>
                  <Input
                    value={roomTypeName}
                    onChange={(e) => setRoomTypeName(e.target.value)}
                    placeholder="e.g. Deluxe Room, Executive Suite"
                    required
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#191816]">Bed Layout</Label>
                  <select
                    value={bedType}
                    onChange={(e) => setBedType(e.target.value)}
                    className="flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  >
                    <option value="1 Queen Bed">1 Queen Bed</option>
                    <option value="1 King Bed">1 King Bed</option>
                    <option value="2 Queen Beds">2 Queen Beds (Double)</option>
                    <option value="Studio Layout">Studio Layout</option>
                    <option value="Penthouse Multi-Bed">Penthouse Master</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#191816]">
                    Standard Nightly Rate ({selectedCountry.currencySymbol}) <span className="text-[#B85C3E]">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-[#7A7267] font-serif font-bold text-xs">
                      {selectedCountry.currencySymbol}
                    </span>
                    <Input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="pl-8 h-10 text-xs font-mono font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#191816]">
                    Total Rooms in this Tier
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={numRooms}
                    onChange={(e) => handleNumRoomsChange(e.target.value)}
                    className="h-10 text-xs font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#191816]">Located on Floor</Label>
                  <select
                    value={floorNumber}
                    onChange={(e) => setFloorNumber(e.target.value)}
                    className="flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  >
                    <option value="1">Floor 1</option>
                    <option value="2">Floor 2</option>
                    <option value="3">Floor 3</option>
                    <option value="4">Floor 4</option>
                    <option value="G">Ground Floor</option>
                    <option value="PH">Penthouse</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DETAILED ROOM NUMBER GENERATOR */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block mb-1">
                Step 3 · Smart Inventory Generator
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif text-[#191816]">
                Sena generated your room numbers
              </h2>
              <p className="text-xs text-[#7A7267] mt-1">
                Review, rename, or customize your individual room numbers below. You can click any room tag to edit its number.
              </p>
            </div>

            {/* Quick Generator Controls */}
            <div className="p-3.5 bg-[#FAF9F7] rounded-md border border-[#E8E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#7A7267]">Starting Room #:</span>
                <input
                  type="text"
                  value={startNumber}
                  onChange={(e) => handleStartNumberChange(e.target.value)}
                  className="w-20 px-2 py-1 border border-[#E8E2DA] rounded bg-white text-xs font-mono font-bold text-center"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[#7A7267]">{roomsList.length} rooms generated</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleAddCustomRoom}
                  className="text-xs h-7 px-2.5 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Room</span>
                </Button>
              </div>
            </div>

            {/* Interactive Room Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto p-1">
              {roomsList.map((roomNum, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded border border-[#E8E2DA] bg-white hover:border-[#B85C3E]/60 transition-all flex flex-col justify-between space-y-2 group relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#7A7267]">
                      Floor {floorNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRoom(idx)}
                      title="Remove room"
                      className="text-[#7A7267] hover:text-[#B85C3E] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {editingIndex === idx ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={editingRoomVal}
                        onChange={(e) => setEditingRoomVal(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditedRoom(idx)}
                        onBlur={() => saveEditedRoom(idx)}
                        className="w-full text-sm font-serif font-bold text-[#191816] border-b border-[#B85C3E] focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setEditingIndex(idx);
                        setEditingRoomVal(roomNum);
                      }}
                      className="cursor-pointer flex items-center justify-between"
                      title="Click to rename"
                    >
                      <strong className="text-base font-serif text-[#191816] group-hover:text-[#B85C3E] transition-colors">
                        Room {roomNum}
                      </strong>
                      <Edit2 className="w-3 h-3 text-[#7A7267] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}

                  <span className="text-[10px] text-[#7A7267] block truncate">
                    {roomTypeName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: DIRECT BANK TRANSFER DETAILS (NO PAYSTACK REQUIRED) */}
        {step === 4 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block mb-1">
                Step 4 · Direct Bank Transfers
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif text-[#191816]">
                Set up direct bank payouts
              </h2>
              <p className="text-xs text-[#7A7267] mt-1">
                Receive guest payments directly into your property's bank account with zero platform commissions.
              </p>
            </div>

            <div className="p-4 bg-[#FAF9F7] rounded-md border border-[#E8E2DA] flex items-center gap-3">
              <Banknote className="w-5 h-5 text-[#2E6B4F] flex-shrink-0" />
              <div className="text-xs">
                <strong className="font-serif text-[#191816] block">
                  Direct Bank Settlement
                </strong>
                <span className="text-[#7A7267]">
                  Guests booking online will transfer directly to this official account and send proof to your front desk.
                </span>
              </div>
            </div>

            <div className="space-y-4 pt-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#191816]">
                    Settlement Bank <span className="text-[#B85C3E]">*</span>
                  </Label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                  >
                    {NIGERIAN_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-[#191816]">
                    10-digit Account Number <span className="text-[#B85C3E]">*</span>
                  </Label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-[#7A7267] absolute left-3 top-3" />
                    <Input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="0123456789"
                      maxLength={10}
                      className="pl-9 h-10 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-[#191816]">
                    Account Name (Beneficiary) <span className="text-[#B85C3E]">*</span>
                  </Label>
                  <span className="text-[10px] font-mono text-[#2E6B4F] flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Verified Business Account
                  </span>
                </div>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. STAY CONNECT LEKKI LTD"
                  className="h-10 text-xs font-mono uppercase"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#191816]">
                  Transfer Instructions for Guests
                </Label>
                <textarea
                  rows={2}
                  value={transferInstructions}
                  onChange={(e) => setTransferInstructions(e.target.value)}
                  className="w-full rounded border border-[#E8E2DA] bg-white p-2.5 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & GO LIVE */}
        {step === 5 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block mb-1">
                Step 5 · Ready for Launch
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif text-[#191816]">
                Review your property setup
              </h2>
              <p className="text-xs text-[#7A7267] mt-1">
                Your direct guest booking engine, room inventory, and bank transfers are ready to operate.
              </p>
            </div>

            {/* Launch Summary Card */}
            <div className="bg-[#FAF9F7] rounded-md border border-[#E8E2DA] p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-[#E8E2DA] pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{selectedCountry.flag}</span>
                  <div>
                    <h3 className="font-serif text-base font-normal text-[#191816]">
                      {propName}
                    </h3>
                    <span className="text-[11px] text-[#7A7267] block">
                      {city} · {selectedCountry.name}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#EBF5ED] text-[#2E6B4F] font-medium border border-[#C6E4CC] text-[11px]">
                  Setup Verified
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white rounded border border-[#E8E2DA]">
                  <span className="text-[10px] uppercase text-[#7A7267] block">Inventory</span>
                  <strong className="text-sm font-serif text-[#191816]">
                    {roomsList.length} Rooms
                  </strong>
                  <span className="text-[10px] text-[#7A7267] block truncate">
                    {roomTypeName}
                  </span>
                </div>

                <div className="p-3 bg-white rounded border border-[#E8E2DA]">
                  <span className="text-[10px] uppercase text-[#7A7267] block">Nightly Rate</span>
                  <strong className="text-sm font-serif text-[#B85C3E]">
                    {selectedCountry.currencySymbol}{Number(price).toLocaleString()}
                  </strong>
                  <span className="text-[10px] text-[#7A7267] block">{bedType}</span>
                </div>

                <div className="p-3 bg-white rounded border border-[#E8E2DA] sm:col-span-1 col-span-2">
                  <span className="text-[10px] uppercase text-[#7A7267] block">Bank Transfers</span>
                  <strong className="text-xs font-serif text-[#191816] block truncate">
                    {bankName}
                  </strong>
                  <span className="text-[10px] text-[#7A7267] font-mono block">
                    {accountNumber}
                  </span>
                </div>
              </div>

              {/* Guest Website info */}
              <div className="p-3 bg-white rounded border border-[#E8E2DA] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#B85C3E]" />
                  <div>
                    <span className="font-medium text-[#191816] block">
                      Guest Booking Engine Website
                    </span>
                    <span className="text-[10px] text-[#7A7267] font-mono">
                      https://book.sena.ng/{propName.toLowerCase().replace(/[^a-z0-9]/g, '')}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#7A7267] bg-[#FAFAFA] px-2 py-0.5 rounded border border-[#E8E2DA]">
                  Default Theme: Sena One
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Navigation Controls */}
        <div className="pt-6 border-t border-[#E8E2DA] flex items-center justify-between">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => s - 1)}
              className="text-xs"
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              className="text-xs flex items-center gap-1"
            >
              <span>Continue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              {errorMsg && <p className="text-[11px] text-red-600 font-medium">{errorMsg}</p>}
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={handleComplete}
                className="text-xs flex items-center gap-1.5 bg-[#2E6B4F] hover:bg-[#255740] disabled:opacity-50"
              >
                <span>{saving ? 'Persisting to PostgreSQL...' : 'Launch Sena Operating System'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-[#7A7267]">
        Sena Hospitality Operating System · Clean, efficient hotel onboarding
      </div>
    </div>
  );
}
