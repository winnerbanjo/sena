'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { LanguageSelect } from '../../components/language-select';

function LoginForm() {
  const t = useTranslations('setup');
  const searchParams = useSearchParams();
  const propertySlug = (searchParams.get('property') || '').trim().toLowerCase();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setError('');

    if (!email || !password) {
      setError(t('missingCredentials'));
      return;
    }

    setIsLoading(true);

    try {
      const { signIn } = await import('next-auth/react');
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        ...(propertySlug ? { property: propertySlug } : {}),
        redirect: false,
      });

      if (res?.error) {
        setError(t('badCredentials'));
        setIsLoading(false);
        return;
      }

      try {
        localStorage.setItem(
          'sena_auth_user',
          JSON.stringify({
            email,
            name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            fullName: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            role: 'Property Manager',
          })
        );
      } catch (err) {
        console.error(err);
      }

      setIsLoading(false);
      window.location.assign(propertySlug ? '/apps?manage=flutterwave' : '/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(t('loginUnavailable'));
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
          <label className="sr-only" htmlFor="login-language">{t('chooseLanguage')}</label>
          <LanguageSelect id="login-language" />
        </div>
      </header>

      {/* Main Form Surface */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-lg border border-[#E8E2DA] p-6 sm:p-8 shadow-[0_1px_3px_rgba(25,24,22,0.04)]">
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-[#191816]">
                {t('loginTitle')}
              </h1>
              <p className="text-xs text-[#5C564D] mt-1.5 leading-relaxed">
                {t('loginSubtitle')}
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
                <label htmlFor="login-email" className="block text-xs font-medium text-[#191816] mb-1.5">
                  {t('email')}
                </label>
                <input
                  type="email"
                  id="login-email"
                  name="email"
                  autoComplete="email"
                  placeholder="name@yourhotel.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-sm text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-medium text-[#191816]">
                    {t('password')}
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-[#5C564D] hover:text-[#B85C3E] transition-colors focus-visible:outline-none focus-visible:underline rounded"
                  >
                    {t('forgotPassword')}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-10 px-3 pe-10 rounded-md border border-[#E8E2DA] bg-[#FAF8F6]/30 text-sm text-[#191816] placeholder:text-[#A69E92] focus:bg-white focus:outline-none focus:border-[#B85C3E] focus:ring-1 focus:ring-[#B85C3E] transition-colors"
                    required
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

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#5C564D]">
                  <input
                    type="checkbox"
                    id="login-remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-[#E8E2DA] text-[#B85C3E] focus:ring-[#B85C3E] h-3.5 w-3.5"
                  />
                  <span>{t('keepSignedIn')}</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-md bg-[#B85C3E] hover:bg-[#A34F33] text-white text-xs font-medium tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C3E] focus-visible:ring-offset-2"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isLoading ? t('signingIn') : t('signIn')}</span>
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-[#F0ECE4] text-center text-xs text-[#5C564D]">
              <span>{t('newHere')}{' '}</span>
              <Link
                href="/signup"
                className="font-medium text-[#B85C3E] hover:text-[#A34F33] transition-colors focus-visible:outline-none focus-visible:underline rounded"
              >
                {t('createAccount')}
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

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#FAF8F6]" />}>
      <LoginForm />
    </React.Suspense>
  );
}
