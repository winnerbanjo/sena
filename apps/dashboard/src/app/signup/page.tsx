'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@sena/ui';
import { ArrowRight, Building2, Check, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('+234 ');
  const [propertyName, setPropertyName] = React.useState('');
  const [propertyType, setPropertyType] = React.useState('hotel');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [agreedToTerms, setAgreedToTerms] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fullName || !email || !propertyName || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);

    // Persist new user state and initialize onboarding data
    setTimeout(() => {
      try {
        localStorage.setItem(
          'sena_auth_user',
          JSON.stringify({
            email,
            name: fullName,
            phone,
            role: 'Owner / General Manager',
            property: propertyName,
            propertyType,
          })
        );
        localStorage.setItem(
          'sena_onboarding_draft',
          JSON.stringify({
            propName: propertyName,
            propType: propertyType,
            email,
            phone,
          })
        );
      } catch (err) {
        console.error(err);
      }
      setIsLoading(false);
      // Route immediately into the guided onboarding wizard!
      router.push('/onboarding');
    }, 600);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between p-4 sm:p-8 lg:p-12">
      {/* Top Header */}
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
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

        <div className="flex items-center gap-2 text-xs text-[#7A7267]">
          <span>Already have an account?</span>
          <Link
            href="/login"
            className="font-medium text-[#B85C3E] hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-lg mx-auto w-full my-8">
        <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block">
              Start Free Trial · No Credit Card Required
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#191816]">
              Create your Sena Account
            </h1>
            <p className="text-xs text-[#7A7267]">
              Join independent boutique hotels, serviced apartments, and luxury villas across Nigeria.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded bg-[#FBEBE8] border border-[#F0BCB0] text-[#71382D] text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#191816]">
                  Full Name <span className="text-[#B85C3E]">*</span>
                </Label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#7A7267] absolute left-3 top-2.5" />
                  <Input
                    placeholder="Amara Okafor"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9 h-10 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#191816]">
                  Work Email <span className="text-[#B85C3E]">*</span>
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#7A7267] absolute left-3 top-2.5" />
                  <Input
                    type="email"
                    placeholder="amara@hotel.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10 text-xs"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#191816]">Phone Number</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#7A7267] absolute left-3 top-2.5" />
                  <Input
                    placeholder="+234 802 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9 h-10 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#191816]">
                  Property Name <span className="text-[#B85C3E]">*</span>
                </Label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#7A7267] absolute left-3 top-2.5" />
                  <Input
                    placeholder="e.g. The Haven Lekki"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className="pl-9 h-10 text-xs"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#191816]">Property Category</Label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full h-10 rounded border border-[#E8E2DA] bg-white px-3 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                >
                  <option value="hotel">Boutique Hotel</option>
                  <option value="serviced_apartment">Serviced Apartment</option>
                  <option value="resort">Resort & Spa</option>
                  <option value="villa">Luxury Private Villa</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#191816]">
                  Password <span className="text-[#B85C3E]">*</span>
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#7A7267] absolute left-3 top-2.5" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9 h-10 text-xs"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#7A7267] hover:text-[#191816]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2 cursor-pointer text-xs text-[#7A7267]">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  required
                  className="mt-0.5 rounded border-[#E8E2DA] text-[#B85C3E] focus:ring-[#B85C3E]"
                />
                <span>
                  I agree to Sena's Terms of Service and Privacy Policy. All customer data remains securely hosted and encrypted.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !agreedToTerms}
              className="w-full h-10 text-xs font-medium flex items-center justify-center gap-1.5 mt-2"
            >
              {isLoading ? 'Creating account...' : 'Create Account & Start Onboarding'}
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          {/* Social Proof */}
          <div className="pt-4 border-t border-[#E8E2DA] flex items-center justify-center gap-6 text-[11px] text-[#7A7267]">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#2E6B4F]" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#2E6B4F]" />
              <span>No credit card needed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#2E6B4F]" />
              <span>Direct Paystack support</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto w-full pt-6 border-t border-[#E8E2DA] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#7A7267] gap-2">
        <span>© 2026 Sena Hospitality Technologies. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hover:text-[#191816]">Log in</Link>
          <Link href="/" className="hover:text-[#191816]">Dashboard Overview</Link>
          <span>Support & Helpdesk</span>
        </div>
      </div>
    </div>
  );
}
