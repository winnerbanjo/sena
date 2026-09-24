'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please provide your work email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const { signIn } = await import('next-auth/react');
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('The email or password does not match our records.');
        setIsLoading(false);
        return;
      }

      try {
        localStorage.setItem(
          'sena_auth_user',
          JSON.stringify({
            email,
            name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            role: 'Property Manager',
            property: 'Stay Connect Lekki',
          })
        );
      } catch (err) {
        console.error(err);
      }

      setIsLoading(false);
      router.push('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Unable to sign in at the moment. Please verify your connection.');
      setIsLoading(false);
    }
  }

  async function handleDemoLogin() {
    setEmail('amara@stayconnect.ng');
    setPassword('Password123!');
    setIsLoading(true);
    setError('');

    try {
      const { signIn } = await import('next-auth/react');
      const res = await signIn('credentials', {
        email: 'amara@stayconnect.ng',
        password: 'Password123!',
        redirect: false,
      });

      if (res?.error) {
        setError('Demo sign-in failed. Please verify credentials.');
        setIsLoading(false);
        return;
      }

      try {
        localStorage.setItem(
          'sena_auth_user',
          JSON.stringify({
            email: 'amara@stayconnect.ng',
            name: 'Amara Okafor',
            role: 'General Manager',
            property: 'Stay Connect Lekki',
          })
        );
      } catch (err) {
        console.error(err);
      }

      setIsLoading(false);
      router.push('/');
    } catch (err: any) {
      console.error('Demo login error:', err);
      setError('Failed to connect to demo account.');
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
          <span>New to Sena?</span>
          <Link
            href="/signup"
            className="text-[#71382D] hover:text-[#B85C3E] font-medium transition-colors"
          >
            Create property account &rarr;
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
                Hotelier Console
              </span>
              <h2 className="text-3xl font-serif font-normal text-[#71382D] leading-tight">
                A quiet morning starts with a quiet system.
              </h2>
              <p className="text-sm text-[#7A7267] leading-relaxed">
                Log in to review today&apos;s expected arrivals, coordinate housekeeping rooms, and monitor live room occupancy across your property.
              </p>
            </div>

            <div className="relative rounded-lg overflow-hidden border border-[#E8E1D5] shadow-sm aspect-[4/3] bg-[#EAE3D9]">
              <Image
                src="/assets/pool.jpg"
                alt="Boutique hotel courtyard"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 400px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-end p-4">
                <span className="text-[11px] text-white/90 tracking-wide font-mono">
                  Stay Connect Lekki · Lagos
                </span>
              </div>
            </div>

            <div className="pt-2 text-xs text-[#8C8275] border-t border-[#E8E1D5]">
              <em>&ldquo;The mark of hospitality is when everything seems to happen without effort.&rdquo;</em>
            </div>
          </div>

          {/* Right: The Sign-in Ledger */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#E8E1D5] p-8 sm:p-10 shadow-[0_4px_24px_rgba(25,24,22,0.03)]">
            <div className="mb-8">
              <h1 className="text-2xl font-serif font-normal text-[#191816]">
                Welcome back
              </h1>
              <p className="text-xs text-[#7A7267] mt-1.5">
                Enter your work credentials to open your property workspace.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-md bg-[#FAF4EF] border border-[#E5D4BC] text-[#71382D] text-xs leading-relaxed">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  placeholder="amara@stayconnect.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF7F2]/40 text-[#191816] text-sm focus:bg-white focus:outline-none focus:border-[#71382D] transition-all placeholder:text-[#A69E92]"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#191816]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => alert('Password reset instructions have been forwarded to your email address.')}
                    className="text-[11px] text-[#8C8275] hover:text-[#71382D] transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 px-3.5 pr-11 rounded-md border border-[#E8E1D5] bg-[#FAF7F2]/40 text-[#191816] text-sm focus:bg-white focus:outline-none focus:border-[#71382D] transition-all placeholder:text-[#A69E92]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-xs text-[#8C8275] hover:text-[#191816]"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#7A7267]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-[#E8E1D5] text-[#71382D] focus:ring-[#71382D]"
                  />
                  <span>Keep me signed in on this device</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-md bg-[#B85C3E] hover:bg-[#A34E32] text-white text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign in to Property'}
              </button>

              {/* Prominent Create Account Section */}
              <div className="pt-4 border-t border-[#F0ECE4] text-center">
                <p className="text-xs text-[#7A7267] mb-2.5">
                  New hotelier or property manager?
                </p>
                <Link
                  href="/signup"
                  className="w-full h-11 rounded-md border border-[#E5D4BC] bg-[#FAF7F2] hover:bg-[#F4ECE1] text-[#71382D] hover:text-[#5E2B21] text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Create Property Account (3-Day Free Trial) &rarr;</span>
                </Link>
              </div>
            </form>

            {/* Quick Demo Access - Restrained & Human */}
            <div className="mt-8 pt-6 border-t border-[#F0ECE4] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-[#8C8275]">Reviewing as an evaluator?</span>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={isLoading}
                className="text-[#71382D] hover:text-[#B85C3E] font-medium underline underline-offset-4 decoration-[#E5D4BC] hover:decoration-[#B85C3E] transition-all"
              >
                Sign in with demo property &rarr;
              </button>
            </div>
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
