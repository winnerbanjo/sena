'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@sena/ui';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please provide your work email and password.');
      return;
    }

    setIsLoading(true);

    // Simulate secure authentication & store session state
    setTimeout(() => {
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
    }, 600);
  }

  function handleDemoLogin() {
    setEmail('amara.okafor@stayconnect.ng');
    setPassword('••••••••••••');
    setIsLoading(true);
    setTimeout(() => {
      try {
        localStorage.setItem(
          'sena_auth_user',
          JSON.stringify({
            email: 'amara.okafor@stayconnect.ng',
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
    }, 400);
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
          <span>Don't have an account?</span>
          <Link
            href="/signup"
            className="font-medium text-[#B85C3E] hover:underline"
          >
            Sign up
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-md mx-auto w-full my-8">
        <div className="bg-white border border-[#E8E2DA] rounded-lg p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#B85C3E] block">
              Hotelier Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#191816]">
              Sign in to Sena
            </h1>
            <p className="text-xs text-[#7A7267]">
              Manage reservations, rooms, payments, and guest arrivals.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded bg-[#FBEBE8] border border-[#F0BCB0] text-[#71382D] text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#191816]">Work Email</Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#7A7267] absolute left-3 top-2.5" />
                <Input
                  type="email"
                  placeholder="name@yourhotel.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-10 text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-[#191816]">Password</Label>
                <button
                  type="button"
                  onClick={() => alert('Password reset link sent to your work email.')}
                  className="text-[11px] text-[#7A7267] hover:text-[#B85C3E] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#7A7267] absolute left-3 top-2.5" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-9 h-10 text-xs"
                  required
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

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#7A7267]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#E8E2DA] text-[#B85C3E] focus:ring-[#B85C3E]"
                />
                <span>Remember me for 30 days</span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 text-xs font-medium flex items-center justify-center gap-1.5"
            >
              {isLoading ? 'Signing in...' : 'Sign in to Operating System'}
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          {/* Quick Demo Button */}
          <div className="pt-4 border-t border-[#E8E2DA] space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7267] block text-center">
              Quick Preview Access
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="w-full h-9 text-xs flex items-center justify-center gap-1.5 bg-[#FAF9F7] hover:bg-[#F2EFE9] border-[#E8E2DA]"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#2E6B4F]" />
              <span>Demo Login as Hotel General Manager</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto w-full pt-6 border-t border-[#E8E2DA] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#7A7267] gap-2">
        <span>© 2026 Sena Hospitality Technologies. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <Link href="/onboarding" className="hover:text-[#191816]">Onboarding Wizard</Link>
          <a href="https://sena.ng/privacy/" target="_blank" rel="noopener noreferrer" className="hover:text-[#191816]">Privacy Policy</a>
          <a href="https://sena.ng/terms/" target="_blank" rel="noopener noreferrer" className="hover:text-[#191816]">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
