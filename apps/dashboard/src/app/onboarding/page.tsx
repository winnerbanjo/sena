'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Input, Label } from '@sena/ui';
import { ArrowRight, Check, ChevronRight, Globe, Layers, ShieldCheck } from 'lucide-react';

export default function OnboardingPage() {
  const [step, setStep] = React.useState(1);

  // Form State
  const [propName, setPropName] = React.useState('Stay Connect Lekki');
  const [propType, setPropType] = React.useState('hotel');
  const [address, setAddress] = React.useState('Admiralty Way, Lekki Phase 1, Lagos');
  const [phone, setPhone] = React.useState('+234 802 345 6789');
  const [email, setEmail] = React.useState('contact@stayconnect.com');

  const [roomTypeName, setRoomTypeName] = React.useState('Executive Room');
  const [priceNaira, setPriceNaira] = React.useState('120000');
  const [numRooms, setNumRooms] = React.useState('12');

  const [selectedTheme, setSelectedTheme] = React.useState('sena_one');

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between p-6 sm:p-12">
      {/* Brand header */}
      <div className="max-w-xl mx-auto w-full flex items-center justify-between pb-6 border-b border-[#E8E2DA]">
        <Link href="/" className="flex items-center">
          <Image
            src="/assets/sena-logo.png"
            alt="Sena"
            width={100}
            height={32}
            priority
            className="h-7 w-auto object-contain"
          />
        </Link>
        <span className="text-xs font-mono text-[#7A7267]">
          Step {step} of 5
        </span>
      </div>

      {/* Wizard Content */}
      <div className="max-w-xl mx-auto w-full bg-white border border-[#E8E2DA] p-8 rounded-md my-8 space-y-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block mb-1">
                Step 1 · Property Profile
              </span>
              <h2 className="text-2xl font-serif text-[#191816]">
                Welcome to Sena.
              </h2>
              <p className="text-xs text-[#7A7267] mt-1">
                Let's get your hotel or serviced apartment ready for operations.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <Label>Property Name</Label>
                <Input
                  value={propName}
                  onChange={(e) => setPropName(e.target.value)}
                  placeholder="e.g. The Still House"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Property Type</Label>
                  <select
                    value={propType}
                    onChange={(e) => setPropType(e.target.value)}
                    className="flex h-10 w-full rounded border border-[#E8E2DA] bg-white px-3 py-2 text-xs text-[#191816]"
                  >
                    <option value="hotel">Boutique Hotel</option>
                    <option value="serviced_apartment">Serviced Apartment</option>
                    <option value="resort">Resort</option>
                  </select>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Input value="Africa/Lagos (GMT+1)" disabled className="bg-[#FAFAFA]" />
                </div>
              </div>
              <div>
                <Label>Physical Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Front Desk Phone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Contact Email</Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block mb-1">
                Step 2 · Room Categories
              </span>
              <h2 className="text-2xl font-serif text-[#191816]">
                Configure First Room Type
              </h2>
              <p className="text-xs text-[#7A7267] mt-1">
                Define your primary room category, standard nightly rate, and bed layout.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <Label>Room Category Name</Label>
                <Input
                  value={roomTypeName}
                  onChange={(e) => setRoomTypeName(e.target.value)}
                  placeholder="e.g. Executive King Suite"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Standard Nightly Rate (₦)</Label>
                  <Input
                    type="number"
                    value={priceNaira}
                    onChange={(e) => setPriceNaira(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Number of Rooms</Label>
                  <Input
                    type="number"
                    value={numRooms}
                    onChange={(e) => setNumRooms(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block mb-1">
                Step 3 · Physical Rooms
              </span>
              <h2 className="text-2xl font-serif text-[#191816]">
                Generated Room Numbers
              </h2>
              <p className="text-xs text-[#7A7267] mt-1">
                Sena will automatically generate rooms for {roomTypeName}. You can rename room numbers anytime.
              </p>
            </div>

            <div className="p-4 bg-[#FAFAFA] rounded border border-[#E8E2DA] grid grid-cols-4 gap-2 text-center text-xs">
              {Array.from({ length: Number(numRooms) || 6 }).map((_, idx) => (
                <div key={idx} className="p-2 rounded bg-white border border-[#E8E2DA]">
                  <strong className="text-sm font-serif text-[#191816]">
                    20{idx + 1}
                  </strong>
                  <span className="text-[10px] text-[#7A7267] block">Executive</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block mb-1">
                Step 4 · Payments
              </span>
              <h2 className="text-2xl font-serif text-[#191816]">
                Connect Paystack
              </h2>
              <p className="text-xs text-[#7A7267] mt-1">
                Accept online payments directly to your business account with zero Sena commission.
              </p>
            </div>

            <div className="p-6 rounded border border-[#E8E2DA] bg-[#FAFAFA] space-y-4 text-center">
              <ShieldCheck className="w-10 h-10 mx-auto text-[#2E6B4F]" />
              <div>
                <strong className="text-base font-serif text-[#191816] block">
                  Paystack Integration
                </strong>
                <p className="text-xs text-[#7A7267] mt-1">
                  Connect your Paystack merchant keys to enable direct guest payments.
                </p>
              </div>
              <Button variant="secondary" className="w-full">
                Connect Paystack Account ↗
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block mb-1">
                Step 5 · Hotel Website
              </span>
              <h2 className="text-2xl font-serif text-[#191816]">
                Choose Website Theme
              </h2>
              <p className="text-xs text-[#7A7267] mt-1">
                Select your initial front door website. All themes connect directly to live availability.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { id: 'sena_one', name: 'Sena One', desc: 'Editorial & tranquil' },
                { id: 'sena_two', name: 'Sena Two', desc: 'Warm boutique luxury' },
                { id: 'sena_three', name: 'Sena Three', desc: 'Crisp contemporary' },
              ].map((theme) => (
                <div
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`p-3 rounded border text-left cursor-pointer transition-all ${
                    selectedTheme === theme.id
                      ? 'border-[#B85C3E] bg-[#FAFAFA] ring-1 ring-[#B85C3E]'
                      : 'border-[#E8E2DA] bg-white hover:border-[#7A7267]'
                  }`}
                >
                  <strong className="text-xs font-serif text-[#191816] block">
                    {theme.name}
                  </strong>
                  <span className="text-[10px] text-[#7A7267] mt-1 block">
                    {theme.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="pt-6 border-t border-[#E8E2DA] flex items-center justify-between">
          {step > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </Button>
          ) : (
            <span />
          )}

          {step < 5 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              Continue <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Link href="/">
              <Button size="sm">
                Open Sena <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="text-center text-xs text-[#7A7267]">
        Target setup time: under 15 minutes · sena hospitality operating system
      </div>
    </div>
  );
}
