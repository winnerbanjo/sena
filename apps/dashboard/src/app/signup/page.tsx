'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('+234 ');
  const [propertyName, setPropertyName] = React.useState('');
  const [propertyType, setPropertyType] = React.useState('boutique_hotel');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [agreedToTerms, setAgreedToTerms] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fullName || !email || !propertyName || !password) {
      setError('Please provide your name, email, property name, and password.');
      return;
    }

    if (password.length < 8) {
      setError('Password should be at least 8 characters for security.');
      return;
    }

    if (!agreedToTerms) {
      setError('Please review and accept our Terms of Service to continue.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim(),
          propertyName: propertyName.trim(),
          propertyCategory: propertyType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Unable to register property. Please verify your details.');
        setIsLoading(false);
        return;
      }

      // Persist draft context for onboarding wizard
      try {
        localStorage.setItem(
          'sena_auth_user',
          JSON.stringify({
            id: data.data?.user?.id,
            email: data.data?.user?.email,
            name: fullName,
            phone,
            role: 'owner',
            organizationId: data.data?.organization?.id,
            property: propertyName,
            propertyType,
          })
        );
        localStorage.setItem(
          'sena_onboarding_draft',
          JSON.stringify({
            userId: data.data?.user?.id,
            organizationId: data.data?.organization?.id,
            propName: propertyName,
            propType: propertyType,
            email,
            phone,
          })
        );
      } catch (err) {
        console.error(err);
      }

      // Automatically sign in the new user session
      try {
        const { signIn } = await import('next-auth/react');
        await signIn('credentials', {
          email: email.trim().toLowerCase(),
          password,
          redirect: false,
        });
      } catch (err) {
        console.warn('Sign-in after registration warning:', err);
      }

      setIsLoading(false);
      // Route immediately into onboarding wizard
      router.push('/onboarding');
    } catch (err: any) {
      console.error('Signup error:', err);
      setError('Registration failed. Please check your network and try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#191816] flex flex-col justify-between">
      {/* Top Bar */}
      <header className="px-6 sm:px-12 pt-8 pb-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="https://sena.ng" className="opacity-90 hover:opacity-100 transition-opacity">
          <Image
            src="/assets/sena-logo.png"
            alt="Sena"
            width={96}
            height={32}
            priority
            className="h-6 sm:h-7 w-auto object-contain"
          />
        </Link>

        <div className="flex items-center gap-3 text-xs text-[#7A7267]">
          <span>Already managing on Sena?</span>
          <Link
            href="/login"
            className="text-[#71382D] hover:text-[#B85C3E] font-medium transition-colors"
          >
            Sign in &rarr;
          </Link>
        </div>
      </header>

      {/* Main Content: Asymmetrical Human Composition */}
      <main className="flex-1 flex items-center justify-center px-6 sm:px-12 py-10">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Atmospheric Hospitality Editorial */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between space-y-8">
            <div className="space-y-4">
              <span className="text-[11px] font-mono tracking-widest text-[#B85C3E] uppercase">
                New Property
              </span>
              <h2 className="text-3xl font-serif font-normal text-[#71382D] leading-tight">
                Give your property the operating foundation it deserves.
              </h2>
              <p className="text-sm text-[#7A7267] leading-relaxed">
                Connect your room inventory, launch your zero-commission booking engine, and coordinate your front desk team from one quiet workspace.
              </p>
            </div>

            <div className="relative rounded-lg overflow-hidden border border-[#E8E1D5] shadow-sm aspect-[4/3] bg-[#EAE3D9]">
              <Image
                src="/assets/room.jpg"
                alt="Boutique hotel guest suite"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 400px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-end p-4">
                <span className="text-[11px] text-white/90 tracking-wide font-mono">
                  3-Day Free Trial &middot; Cancel Anytime
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-[#8C8275] border-t border-[#E8E1D5] pt-4">
              <div className="flex items-center gap-2">
                <span className="text-[#2E6B4F]">&bull;</span>
                <span>Zero commission on direct reservations</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#2E6B4F]">&bull;</span>
                <span>Direct Paystack & bank transfer settlement</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#2E6B4F]">&bull;</span>
                <span>Includes dedicated booking engine for your Instagram & web</span>
              </div>
            </div>
          </div>

          {/* Right: The Property Registration Form */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#E8E1D5] p-8 sm:p-10 shadow-[0_4px_24px_rgba(25,24,22,0.03)]">
            <div className="mb-6">
              <h1 className="text-2xl font-serif font-normal text-[#191816]">
                Begin your 3-day trial
              </h1>
              <p className="text-xs text-[#7A7267] mt-1.5">
                Set up your property in minutes. No credit card required to start.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-md bg-[#FAF4EF] border border-[#E5D4BC] text-[#71382D] text-xs leading-relaxed">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    placeholder="Ada James"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF7F2]/40 text-[#191816] text-xs focus:bg-white focus:outline-none focus:border-[#71382D] transition-all placeholder:text-[#A69E92]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1.5">
                    Work Email
                  </label>
                  <input
                    type="email"
                    placeholder="ada@yourhotel.ng"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF7F2]/40 text-[#191816] text-xs focus:bg-white focus:outline-none focus:border-[#71382D] transition-all placeholder:text-[#A69E92]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1.5">
                    Property Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. The Still House"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF7F2]/40 text-[#191816] text-xs focus:bg-white focus:outline-none focus:border-[#71382D] transition-all placeholder:text-[#A69E92]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1.5">
                    Property Style
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF7F2]/40 text-[#191816] text-xs focus:bg-white focus:outline-none focus:border-[#71382D] transition-all"
                  >
                    <option value="boutique_hotel">Boutique Hotel</option>
                    <option value="serviced_apartments">Serviced Apartments</option>
                    <option value="luxury_resort">Resort or Villa</option>
                    <option value="bed_and_breakfast">Guest House / B&amp;B</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1.5">
                  Phone (WhatsApp for reservation notices)
                </label>
                <input
                  type="tel"
                  placeholder="+234 803 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF7F2]/40 text-[#191816] text-xs focus:bg-white focus:outline-none focus:border-[#71382D] transition-all placeholder:text-[#A69E92]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1.5">
                  Create Password (8+ characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-10 px-3.5 pr-11 rounded-md border border-[#E8E1D5] bg-[#FAF7F2]/40 text-[#191816] text-xs focus:bg-white focus:outline-none focus:border-[#71382D] transition-all placeholder:text-[#A69E92]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-xs text-[#8C8275] hover:text-[#191816]"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#7A7267] leading-relaxed">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 rounded border-[#E8E1D5] text-[#71382D] focus:ring-[#71382D]"
                  />
                  <span>
                    I agree to Sena&apos;s{' '}
                    <Link href="https://sena.ng/terms" target="_blank" className="text-[#71382D] underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="https://sena.ng/privacy" target="_blank" className="text-[#71382D] underline">
                      Privacy Policy
                    </Link>
                    . All property data is securely hosted and encrypted.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-md bg-[#B85C3E] hover:bg-[#A34E32] text-white text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              >
                {isLoading ? 'Creating Property Profile...' : 'Begin 3-Day Free Trial &rarr;'}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 sm:px-12 py-6 text-center text-xs text-[#8C8275] border-t border-[#EAE3D9]">
        <div className="flex items-center justify-center gap-6">
          <Link href="https://sena.ng" className="hover:text-[#191816] transition-colors">sena.ng</Link>
          <span>&middot;</span>
          <Link href="https://sena.ng/privacy" className="hover:text-[#191816] transition-colors">Privacy</Link>
          <span>&middot;</span>
          <Link href="https://sena.ng/terms" className="hover:text-[#191816] transition-colors">Terms of Service</Link>
          <span>&middot;</span>
          <span>&copy; 2026 Sena Operating System</span>
        </div>
      </footer>
    </div>
  );
}
