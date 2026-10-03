'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { LanguageSelect } from '../../components/language-select';

function ResetPasswordForm() {
  const t = useTranslations('setup');
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  const isInvalidLink = !token || !email;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setError('');

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password. Please try again.');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setIsLoading(false);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
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
          <label className="sr-only" htmlFor="reset-language">{t('chooseLanguage')}</label>
          <LanguageSelect id="reset-language" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-lg border border-[#E8E2DA] p-6 sm:p-8 shadow-[0_1px_3px_rgba(25,24,22,0.04)]">
            {isInvalidLink ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#FAF4EF] border border-[#E5D4BC] flex items-center justify-center mx-auto text-[#71382D]">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-[#191816]">
                    Invalid or Expired Link
                  </h1>
                  <p className="text-xs text-[#5C564D] mt-2 leading-relaxed">
                    This password reset link is missing required parameters or has expired.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/forgot-password"
                    className="inline-flex items-center justify-center w-full h-10 rounded-md bg-[#B85C3E] hover:bg-[#A34F33] text-white text-xs font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E] focus-visible:ring-offset-2"
                  >
                    Request a new reset link
                  </Link>
                </div>
              </div>
            ) : success ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center mx-auto text-[#059669]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-[#191816]">
                    Password Updated
                  </h1>
                  <p className="text-xs text-[#5C564D] mt-2 leading-relaxed">
                    Your password has been securely reset. Redirecting to sign in…
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center w-full h-10 rounded-md bg-[#B85C3E] hover:bg-[#A34F33] text-white text-xs font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E] focus-visible:ring-offset-2"
                  >
                    {t('signIn')}
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h1 className="text-xl font-semibold tracking-tight text-[#191816]">
                    {t('resetTitle')}
                  </h1>
                  <p className="text-xs text-[#5C564D] mt-1.5 leading-relaxed">
                    {t('resetSubtitle')}
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

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="reset-new-password" className="block text-xs font-medium text-[#191816] mb-1.5">
                      {t('newPassword')}
                    </label>
                    <div className="relative">
                      <input
                        id="reset-new-password"
                        name="newPassword"
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

                  <div>
                    <label htmlFor="reset-confirm-password" className="block text-xs font-medium text-[#191816] mb-1.5">
                      {t('confirmPassword')}
                    </label>
                    <input
                      id="reset-confirm-password"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-sm text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 rounded-md bg-[#B85C3E] hover:bg-[#A34F33] text-white text-xs font-medium tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E] focus-visible:ring-offset-2 mt-2"
                  >
                    {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isLoading ? t('updatingPassword') : t('updatePassword')}</span>
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-[#F0ECE4] text-center text-xs">
                  <Link
                    href="/login"
                    className="font-medium text-[#5C564D] hover:text-[#191816] transition-colors focus-visible:outline-none focus-visible:underline rounded"
                  >
                    {t('backToSignIn')}
                  </Link>
                </div>
              </>
            )}
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

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#FAF8F6]" />}>
      <ResetPasswordForm />
    </React.Suspense>
  );
}
