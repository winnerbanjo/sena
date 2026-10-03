'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw, CheckCircle2, Mail } from 'lucide-react';
import { LanguageSelect } from '../../components/language-select';

function VerifyEmailForm() {
  const t = useTranslations('setup');
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryEmail = searchParams.get('email') || '';
  const [email, setEmail] = React.useState(queryEmail);
  const [code, setCode] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [resendCooldown, setResendCooldown] = React.useState(60);
  const [resendMessage, setResendMessage] = React.useState('');
  const [isSuccess, setIsSuccess] = React.useState(false);

  React.useEffect(() => {
    if (queryEmail && !email) {
      setEmail(queryEmail);
    }
  }, [queryEmail, email]);

  React.useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!cleanCode || cleanCode.length < 6) {
      setError('Please enter the complete 6-digit confirmation code.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid or expired confirmation code.');
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setIsLoading(false);

      // Attempt automatic sign in if credentials were saved during signup
      try {
        const pendingRaw = sessionStorage.getItem('sena_pending_signup');
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw);
          if (pending.email === cleanEmail && pending.password) {
            const { signIn } = await import('next-auth/react');
            const result = await signIn('credentials', {
              email: cleanEmail,
              password: pending.password,
              redirect: false,
            });
            sessionStorage.removeItem('sena_pending_signup');
            if (result && !result.error) {
              router.push('/onboarding');
              return;
            }
          }
        }
      } catch {}

      // Fallback redirect to login
      setTimeout(() => {
        router.push(`/login?verified=true&email=${encodeURIComponent(cleanEmail)}`);
      }, 1500);
    } catch {
      setError('Network connection error. Please try again.');
      setIsLoading(false);
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return;
    setResendMessage('');
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please provide your email address to receive a code.');
      return;
    }

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        setResendMessage('A new confirmation code has been dispatched.');
        setResendCooldown(60);
      } else {
        setError(data.error || 'Failed to resend code.');
      }
    } catch {
      setError('Network error requesting a new code.');
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
          <label className="sr-only" htmlFor="verify-language">{t('chooseLanguage')}</label>
          <LanguageSelect id="verify-language" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-lg border border-[#E8E2DA] p-6 sm:p-8 shadow-[0_1px_3px_rgba(25,24,22,0.04)]">
            {isSuccess ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center mx-auto text-[#059669]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-[#191816]">
                    Email Verified
                  </h1>
                  <p className="text-xs text-[#5C564D] mt-2 leading-relaxed">
                    Your account has been confirmed. Setting up your workspace…
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#FAF4EF] border border-[#E5D4BC] flex items-center justify-center text-[#71382D] mb-4">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight text-[#191816]">
                    {t('verifyTitle')}
                  </h1>
                  <p className="text-xs text-[#5C564D] mt-1.5 leading-relaxed">
                    {email ? (
                      <>We sent a 6-digit confirmation code to <strong className="text-[#191816] font-medium">{email}</strong>.</>
                    ) : (
                      t('verifySubtitle')
                    )}
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

                {resendMessage && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mb-5 p-3 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-xs leading-relaxed"
                  >
                    {resendMessage}
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4" noValidate>
                  {!queryEmail && (
                    <div>
                      <label htmlFor="verify-email" className="block text-xs font-medium text-[#191816] mb-1.5">
                        {t('email')}
                      </label>
                      <input
                        type="email"
                        id="verify-email"
                        name="email"
                        autoComplete="email"
                        placeholder="name@yourhotel.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-sm text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="verify-code" className="block text-xs font-medium text-[#191816] mb-1.5">
                      {t('verifyCode')}
                    </label>
                    <input
                      type="text"
                      id="verify-code"
                      name="code"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full h-11 px-3 text-center tracking-[0.4em] font-mono text-lg rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 rounded-md bg-[#B85C3E] hover:bg-[#A34F33] text-white text-xs font-medium tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E] focus-visible:ring-offset-2 mt-2"
                  >
                    {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isLoading ? t('verifying') : t('verifyButton')}</span>
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendCooldown > 0}
                      className="text-xs text-[#5C564D] hover:text-[#191816] disabled:text-[#A69E92] inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:underline rounded transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>
                        {resendCooldown > 0
                          ? t('resendIn', { seconds: resendCooldown })
                          : t('resendCode')}
                      </span>
                    </button>
                  </div>
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

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#FAF8F6]" />}>
      <VerifyEmailForm />
    </React.Suspense>
  );
}
