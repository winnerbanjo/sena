'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Loader2, CheckCircle2, UserCheck } from 'lucide-react';
import { LanguageSelect } from '../../components/language-select';

function SignupForm() {
  const t = useTranslations('setup');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Detect staff invite parameters
  const inviteEmail = searchParams.get('email') || '';
  const inviteRole = searchParams.get('role') || '';
  const inviteProperty = searchParams.get('property') || '';
  const inviteToken = searchParams.get('token') || '';
  const isStaffInvite = Boolean(inviteEmail && (inviteRole || inviteProperty));

  // Staff invite form state
  const [staffName, setStaffName] = React.useState('');
  const [staffPassword, setStaffPassword] = React.useState('');
  const [staffConfirmPassword, setStaffConfirmPassword] = React.useState('');
  const [staffShowPassword, setStaffShowPassword] = React.useState(false);
  const [staffSubmitting, setStaffSubmitting] = React.useState(false);
  const [staffError, setStaffError] = React.useState('');
  const [staffSuccess, setStaffSuccess] = React.useState(false);

  // Standard user signup state
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [agreeTerms, setAgreeTerms] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // Handle staff invite password setup
  async function handleStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (staffSubmitting) return;
    setStaffError('');

    if (!staffPassword || staffPassword.length < 8) {
      setStaffError('Please choose a password with at least 8 characters.');
      return;
    }

    if (staffPassword !== staffConfirmPassword) {
      setStaffError('Passwords do not match. Please verify.');
      return;
    }

    setStaffSubmitting(true);

    try {
      const res = await fetch('/api/staff/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          fullName: staffName.trim() || undefined,
          password: staffPassword,
          token: inviteToken,
          propertyName: inviteProperty,
          role: inviteRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStaffError(data.error || 'Failed to activate invitation. Please try again.');
        setStaffSubmitting(false);
        return;
      }

      setStaffSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch {
      setStaffError('Network connection error. Please try again.');
      setStaffSubmitting(false);
    }
  }

  // Standard signup submission
  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setError('');

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      setError('Please provide your name, email, and password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!agreeTerms) {
      setError('Please accept the Terms of Service to continue.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Unable to create account. Please try again.');
        setIsLoading(false);
        return;
      }

      // Store temporary pending credentials in session for seamless verification login
      try {
        sessionStorage.setItem(
          'sena_pending_signup',
          JSON.stringify({ email: cleanEmail, password })
        );
      } catch {}

      router.push(`/verify-email?email=${encodeURIComponent(cleanEmail)}`);
    } catch {
      setError('Network connection error. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F6] text-[#191816] flex flex-col justify-between selection:bg-[#B85C3E]/15">
      {/* Top Header */}
      <header className="px-6 py-6 max-w-7xl mx-auto w-full flex items-center justify-between">
        <Link href="/" className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E] rounded">
          <Image
            src="/assets/sena-logo.png"
            alt="Sena"
            width={92}
            height={28}
            priority
            className="h-6 w-auto object-contain"
          />
        </Link>

        <div className="flex items-center gap-3">
          <label className="sr-only" htmlFor="signup-language">{t('chooseLanguage')}</label>
          <LanguageSelect id="signup-language" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-lg border border-[#E8E2DA] p-6 sm:p-8 shadow-[0_1px_3px_rgba(25,24,22,0.04)]">
            {isStaffInvite ? (
              /* Staff Invite Acceptance Form */
              staffSuccess ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center mx-auto text-[#059669]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-semibold text-[#191816]">
                    Welcome to {inviteProperty || 'the team'}
                  </h2>
                  <p className="text-xs text-[#5C564D] leading-relaxed">
                    Your account is configured. Redirecting you to sign in…
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF4EF] text-[#71382D] border border-[#E5D4BC] text-[11px] font-medium mb-3">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Staff Team Invitation</span>
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight text-[#191816]">
                      Join {inviteProperty || 'Your Hotel Team'}
                    </h1>
                    <p className="text-xs text-[#5C564D] mt-1.5 leading-relaxed">
                      Set your password to access your role-based operations console.
                    </p>
                  </div>

                  {staffError && (
                    <div
                      role="alert"
                      aria-live="polite"
                      className="mb-5 p-3 rounded-md bg-[#FAF4EF] border border-[#E5D4BC] text-[#71382D] text-xs leading-relaxed"
                    >
                      {staffError}
                    </div>
                  )}

                  <div className="p-3 mb-4 bg-[#FAF8F6] border border-[#E8E2DA] rounded-md space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#7A7267]">Assigned Role</span>
                      <span className="font-medium text-[#71382D] bg-white px-2 py-0.5 rounded border border-[#E8E2DA]">
                        {inviteRole || 'Staff Member'}
                      </span>
                    </div>
                    {inviteProperty && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#7A7267]">Property</span>
                        <span className="font-medium text-[#191816]">{inviteProperty}</span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleStaffSubmit} className="space-y-4" noValidate>
                    <div>
                      <label htmlFor="staff-email" className="block text-xs font-medium text-[#191816] mb-1.5">
                        {t('email')}
                      </label>
                      <input
                        type="email"
                        id="staff-email"
                        value={inviteEmail}
                        disabled
                        className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-[#FAF8F6] text-sm text-[#7A7267] cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label htmlFor="staff-name" className="block text-xs font-medium text-[#191816] mb-1.5">
                        {t('fullName')}
                      </label>
                      <input
                        type="text"
                        id="staff-name"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-sm text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                      />
                    </div>

                    <div>
                      <label htmlFor="staff-password" className="block text-xs font-medium text-[#191816] mb-1.5">
                        {t('password')}
                      </label>
                      <div className="relative">
                        <input
                          id="staff-password"
                          type={staffShowPassword ? 'text' : 'password'}
                          value={staffPassword}
                          onChange={(e) => setStaffPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          required
                          minLength={8}
                          className="w-full h-10 px-3 pe-10 rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-sm text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setStaffShowPassword(!staffShowPassword)}
                          aria-label={staffShowPassword ? t('hide') : t('show')}
                          aria-pressed={staffShowPassword}
                          className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 text-[#7A7267] hover:text-[#191816] transition-colors rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B85C3E]"
                        >
                          {staffShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="staff-confirm-password" className="block text-xs font-medium text-[#191816] mb-1.5">
                        {t('confirmPassword')}
                      </label>
                      <input
                        id="staff-confirm-password"
                        type={staffShowPassword ? 'text' : 'password'}
                        value={staffConfirmPassword}
                        onChange={(e) => setStaffConfirmPassword(e.target.value)}
                        placeholder="Re-enter chosen password"
                        required
                        minLength={8}
                        className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-sm text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={staffSubmitting}
                      className="w-full h-10 rounded-md bg-[#B85C3E] hover:bg-[#A34F33] text-white text-xs font-medium tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E] focus-visible:ring-offset-2 mt-2"
                    >
                      {staffSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{staffSubmitting ? 'Activating Account…' : 'Set Password & Access Console'}</span>
                    </button>
                  </form>
                </>
              )
            ) : (
              /* Standard Self-Service Registration Form */
              <>
                <div className="mb-6">
                  <h1 className="text-xl font-semibold tracking-tight text-[#191816]">
                    {t('signupTitle')}
                  </h1>
                  <p className="text-xs text-[#5C564D] mt-1.5 leading-relaxed">
                    {t('signupSubtitle')}
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="mb-5 p-3 rounded-md bg-[#FAF4EF] border border-[#E5D4BC] text-[#71382D] text-xs leading-relaxed"
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleSignupSubmit} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="signup-name" className="block text-xs font-medium text-[#191816] mb-1.5">
                      {t('fullName')}
                    </label>
                    <input
                      type="text"
                      id="signup-name"
                      name="fullName"
                      autoComplete="name"
                      placeholder="Winner Oyebanjo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-sm text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="signup-email" className="block text-xs font-medium text-[#191816] mb-1.5">
                      {t('email')}
                    </label>
                    <input
                      type="email"
                      id="signup-email"
                      name="email"
                      autoComplete="email"
                      placeholder="winner@grandhotel.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-sm text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="signup-password" className="block text-xs font-medium text-[#191816] mb-1.5">
                      {t('password')}
                    </label>
                    <div className="relative">
                      <input
                        id="signup-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="w-full h-10 px-3 pe-10 rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-sm text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? t('hide') : t('show')}
                        aria-pressed={showPassword}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 text-[#7A7267] hover:text-[#191816] transition-colors rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B85C3E]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-0.5">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#5C564D] leading-relaxed">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        className="rounded border-[#E8E2DA] text-[#B85C3E] focus:ring-[#B85C3E] h-3.5 w-3.5 mt-0.5"
                      />
                      <span>
                        I agree to the{' '}
                        <Link href="https://sena.ng/terms" target="_blank" className="text-[#B85C3E] hover:underline focus-visible:outline-none rounded">
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link href="https://sena.ng/privacy" target="_blank" className="text-[#B85C3E] hover:underline focus-visible:outline-none rounded">
                          Privacy Policy
                        </Link>
                        .
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 rounded-md bg-[#B85C3E] hover:bg-[#A34F33] text-white text-xs font-medium tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E] focus-visible:ring-offset-2 mt-2"
                  >
                    {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isLoading ? 'Creating account…' : t('createAccount')}</span>
                  </button>
                </form>
              </>
            )}

            <div className="mt-6 pt-5 border-t border-[#F0ECE4] text-center text-xs text-[#5C564D]">
              <span>{t('alreadyHaveAccount')}{' '}</span>
              <Link
                href="/login"
                className="font-medium text-[#B85C3E] hover:text-[#A34F33] transition-colors focus-visible:outline-none focus-visible:underline rounded"
              >
                {t('signIn')}
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-[#7A7267]">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="https://sena.ng" className="hover:text-[#191816] transition-colors focus-visible:underline rounded">sena.ng</Link>
          <span aria-hidden="true">&middot;</span>
          <Link href="https://sena.ng/privacy" className="hover:text-[#191816] transition-colors focus-visible:underline rounded">Privacy</Link>
          <span aria-hidden="true">&middot;</span>
          <Link href="https://sena.ng/terms" className="hover:text-[#191816] transition-colors focus-visible:underline rounded">Terms of Service</Link>
          <span aria-hidden="true">&middot;</span>
          <span>&copy; 2026 Sena Operating System</span>
        </div>
      </footer>
    </div>
  );
}

export default function SignupPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#FAF8F6]" />}>
      <SignupForm />
    </React.Suspense>
  );
}
