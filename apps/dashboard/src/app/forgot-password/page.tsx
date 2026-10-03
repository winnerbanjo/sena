'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { LanguageSelect } from '../../components/language-select';

function ForgotPasswordForm() {
  const t = useTranslations('setup');
  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Unable to process your request. Please try again.');
        setIsLoading(false);
        return;
      }

      setSubmitted(true);
      setIsLoading(false);
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
          <label className="sr-only" htmlFor="forgot-language">{t('chooseLanguage')}</label>
          <LanguageSelect id="forgot-language" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-lg border border-[#E8E2DA] p-6 sm:p-8 shadow-[0_1px_3px_rgba(25,24,22,0.04)]">
            {submitted ? (
              <div className="text-center py-2 space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center mx-auto text-[#059669]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-[#191816]">
                    Check your email
                  </h1>
                  <p className="text-xs text-[#5C564D] mt-2 leading-relaxed">
                    If an account is associated with <strong className="text-[#191816] font-medium">{email}</strong>, we have sent a password reset link.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-1.5 w-full h-10 rounded-md bg-[#B85C3E] hover:bg-[#A34F33] text-white text-xs font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E] focus-visible:ring-offset-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('backToSignIn')}</span>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h1 className="text-xl font-semibold tracking-tight text-[#191816]">
                    {t('forgotTitle')}
                  </h1>
                  <p className="text-xs text-[#5C564D] mt-1.5 leading-relaxed">
                    {t('forgotSubtitle')}
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
                    <label htmlFor="forgot-email" className="block text-xs font-medium text-[#191816] mb-1.5">
                      {t('email')}
                    </label>
                    <input
                      type="email"
                      id="forgot-email"
                      name="email"
                      autoComplete="email"
                      placeholder="name@yourhotel.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-sm text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 rounded-md bg-[#B85C3E] hover:bg-[#A34F33] text-white text-xs font-medium tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E] focus-visible:ring-offset-2 mt-2"
                  >
                    {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isLoading ? t('sendingResetLink') : t('sendResetLink')}</span>
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-[#F0ECE4] text-center text-xs">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 font-medium text-[#5C564D] hover:text-[#191816] transition-colors focus-visible:outline-none focus-visible:underline rounded"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>{t('backToSignIn')}</span>
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

export default function ForgotPasswordPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#FAF8F6]" />}>
      <ForgotPasswordForm />
    </React.Suspense>
  );
}
