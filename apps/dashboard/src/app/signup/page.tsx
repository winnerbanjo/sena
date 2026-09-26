'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, ShieldCheck, ArrowLeft, RefreshCw, KeyRound, CheckCircle2, UserCheck, Lock } from 'lucide-react';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Detect staff invite parameters
  const inviteEmail = searchParams.get('email') || '';
  const inviteRole = searchParams.get('role') || '';
  const inviteProperty = searchParams.get('property') || '';
  const isStaffInvite = Boolean(inviteEmail && (inviteRole || inviteProperty));

  // Staff invite form state
  const [staffName, setStaffName] = React.useState('');
  const [staffPassword, setStaffPassword] = React.useState('');
  const [staffConfirmPassword, setStaffConfirmPassword] = React.useState('');
  const [staffShowPassword, setStaffShowPassword] = React.useState(false);
  const [staffSubmitting, setStaffSubmitting] = React.useState(false);
  const [staffError, setStaffError] = React.useState('');
  const [staffSuccess, setStaffSuccess] = React.useState(false);

  // Standard hotel owner registration state
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState(inviteEmail || '');
  const [phone, setPhone] = React.useState('+234 ');
  const [propertyName, setPropertyName] = React.useState(inviteProperty || '');
  const [propertyType, setPropertyType] = React.useState('boutique_hotel');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [agreedToTerms, setAgreedToTerms] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [stage, setStage] = React.useState<'form' | 'otp'>('form');
  const [otpCode, setOtpCode] = React.useState('');
  const [otpLoading, setOtpLoading] = React.useState(false);
  const [otpError, setOtpError] = React.useState('');
  const [resendCooldown, setResendCooldown] = React.useState(60);
  const [resendMessage, setResendMessage] = React.useState('');

  React.useEffect(() => {
    let timer: any;
    if (stage === 'otp' && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [stage, resendCooldown]);

  // Handle staff invite password setup
  async function handleStaffInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          token: searchParams.get('token'),
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

      router.push('/login');
    } catch (err: any) {
      setStaffError(err.message || 'Connection error. Please try again.');
      setStaffSubmitting(false);
    }
  }

  // Standard hotel owner registration
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
            email: email.trim().toLowerCase(),
            name: fullName,
            phone,
            propName: propertyName.trim(),
            propType: propertyType,
          })
        );
        localStorage.setItem('sena_property_name', propertyName.trim());
      } catch {}

      setStage('otp');
      setResendCooldown(60);
    } catch {
      setError('Network connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError('');

    if (!otpCode || otpCode.trim().length < 6) {
      setOtpError('Please enter the complete 6-digit confirmation code.');
      return;
    }

    setOtpLoading(true);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: otpCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setOtpError(data.error || 'Invalid or expired confirmation code.');
        setOtpLoading(false);
        return;
      }

      const { signIn } = await import('next-auth/react');
      const login = await signIn('credentials', { email: email.trim().toLowerCase(), password, redirect: false });
      router.push(login?.error ? '/login' : '/onboarding');
    } catch {
      setOtpError('Network connection error verifying OTP.');
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setResendMessage('');
    setOtpError('');

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (res.ok) {
        setResendMessage('A new confirmation code has been dispatched.');
        setResendCooldown(60);
      } else {
        setOtpError(data.error || 'Failed to resend code.');
      }
    } catch {
      setOtpError('Network error requesting a new code.');
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col font-sans text-[#191816]">
      {/* Header */}
      <header className="px-6 sm:px-12 py-5 flex items-center justify-between border-b border-[#EAE3D9]">
        <Link href="https://sena.ng" className="flex items-center gap-2">
          <Image
            src="/assets/sena-logo.png"
            alt="Sena"
            width={104}
            height={32}
            priority
            className="h-7 w-auto object-contain"
          />
        </Link>
        <Link
          href="/login"
          className="text-xs font-medium text-[#71382D] hover:underline flex items-center gap-1"
        >
          <span>Already have an account?</span>
          <span className="font-semibold underline">Sign In</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-white border border-[#EAE3D9] rounded-xl shadow-xs overflow-hidden">
          
          {/* STAFF INVITATION ACCEPTANCE VIEW */}
          {isStaffInvite ? (
            <div className="p-6 sm:p-8">
              {staffSuccess ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center mx-auto text-[#059669]">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-serif text-[#191816]">Welcome to {inviteProperty}!</h2>
                  <p className="text-xs text-[#7A7267] max-w-xs mx-auto">
                    Your password has been configured and your role as <strong>{inviteRole}</strong> is active. Redirecting to your console...
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FAF2EB] text-[#71382D] border border-[#F0D5C3] text-[11px] font-semibold mb-3">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Staff Team Invitation</span>
                    </div>
                    <h1 className="font-serif text-2xl font-normal text-[#191816]">
                      Join {inviteProperty || 'Your Hotel Team'}
                    </h1>
                    <p className="text-xs text-[#7A7267] mt-1.5 leading-relaxed">
                      You have been invited by property management. Set your account password to access your role-based operations console.
                    </p>
                  </div>

                  {staffError && (
                    <div className="mb-4 p-3 rounded-lg bg-[#FBEBE8] border border-[#F0BCB0] text-[#71382D] text-xs">
                      {staffError}
                    </div>
                  )}

                  <form onSubmit={handleStaffInviteSubmit} className="space-y-4 text-xs">
                    {/* Role & Property summary card */}
                    <div className="p-3 bg-[#FAF9F6] border border-[#E8E2DA] rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[#7A7267]">Assigned Role</span>
                        <span className="font-semibold text-[#71382D] bg-white px-2 py-0.5 rounded border border-[#E8E2DA]">
                          {inviteRole || 'Staff Member'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#7A7267]">Property</span>
                        <span className="font-medium text-[#191816]">{inviteProperty || 'Hospitality Group'}</span>
                      </div>
                    </div>

                    {/* Email (Readonly) */}
                    <div>
                      <label className="block font-medium text-[#191816] mb-1">
                        Invited Email Address
                      </label>
                      <input
                        type="email"
                        value={inviteEmail}
                        disabled
                        className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-[#F7F5F2] text-[#7A7267] cursor-not-allowed font-medium text-xs"
                      />
                    </div>

                    {/* Full Name */}
                    <div>
                      <label className="block font-medium text-[#191816] mb-1">
                        Your Full Name <span className="text-[#71382D]">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Winner Oyebanjo"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-white text-[#191816] placeholder:text-[#A89F91] focus:outline-none focus:ring-1 focus:ring-[#71382D] text-xs"
                      />
                    </div>

                    {/* Choose Password */}
                    <div>
                      <label className="block font-medium text-[#191816] mb-1">
                        Choose Password <span className="text-[#71382D]">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={staffShowPassword ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
                          value={staffPassword}
                          onChange={(e) => setStaffPassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-white text-[#191816] placeholder:text-[#A89F91] focus:outline-none focus:ring-1 focus:ring-[#71382D] text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setStaffShowPassword(!staffShowPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#7A7267] hover:text-[#191816]"
                        >
                          {staffShowPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block font-medium text-[#191816] mb-1">
                        Confirm Password <span className="text-[#71382D]">*</span>
                      </label>
                      <input
                        type={staffShowPassword ? 'text' : 'password'}
                        placeholder="Re-enter chosen password"
                        value={staffConfirmPassword}
                        onChange={(e) => setStaffConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        className="w-full h-10 px-3 rounded-md border border-[#E8E2DA] bg-white text-[#191816] placeholder:text-[#A89F91] focus:outline-none focus:ring-1 focus:ring-[#71382D] text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={staffSubmitting}
                      className="w-full h-11 rounded-md bg-[#71382D] hover:bg-[#5D2E25] text-white text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 mt-5 disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{staffSubmitting ? 'Activating Account...' : 'Set Password & Access Console →'}</span>
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            /* STANDARD HOTEL REGISTRATION VIEW */
            <div className="p-6 sm:p-8">
              {stage === 'otp' ? (
                <>
                  <div className="mb-6">
                    <button
                      onClick={() => setStage('form')}
                      className="inline-flex items-center gap-1.5 text-xs text-[#7A7267] hover:text-[#191816] mb-4 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to details</span>
                    </button>
                    <div className="w-10 h-10 rounded-full bg-[#FAF2EB] border border-[#F0D5C3] flex items-center justify-center text-[#71382D] mb-3">
                      <Mail className="w-5 h-5" />
                    </div>
                    <h1 className="font-serif text-2xl font-normal text-[#191816]">Check your inbox</h1>
                    <p className="text-xs text-[#7A7267] mt-1.5 leading-relaxed">
                      We dispatched a 6-digit confirmation code to <strong>{email}</strong>.
                    </p>
                  </div>

                  {otpError && (
                    <div className="mb-4 p-3 rounded-lg bg-[#FBEBE8] border border-[#F0BCB0] text-[#71382D] text-xs">
                      {otpError}
                    </div>
                  )}

                  {resendMessage && (
                    <div className="mb-4 p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-xs">
                      {resendMessage}
                    </div>
                  )}

                  <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-medium text-[#191816] mb-1">
                        6-Digit Confirmation Code
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        required
                        className="w-full h-11 px-3 text-center tracking-[0.5em] text-lg font-mono rounded-md border border-[#E8E2DA] bg-white text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={otpLoading}
                      className="w-full h-11 rounded-md bg-[#71382D] hover:bg-[#5D2E25] text-white text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {otpLoading ? 'Verifying Code...' : 'Verify & Continue Setup →'}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendCooldown > 0}
                        className="text-xs text-[#7A7267] hover:text-[#191816] disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>
                          {resendCooldown > 0
                            ? `Resend code in ${resendCooldown}s`
                            : 'Resend code'}
                        </span>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <h1 className="font-serif text-2xl font-normal text-[#191816]">
                      Create your Sena account
                    </h1>
                    <p className="text-xs text-[#7A7267] mt-1.5">
                      Start your 3-day free trial. No credit card required.
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-[#FBEBE8] border border-[#F0BCB0] text-[#71382D] text-xs">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block font-medium text-[#191816] mb-1">
                        Full Name <span className="text-[#71382D]">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Winner Oyebanjo"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="w-full h-9 px-3 rounded-md border border-[#E8E2DA] bg-white text-[#191816] placeholder:text-[#A89F91] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#191816] mb-1">
                        Work Email <span className="text-[#71382D]">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="winner@grandhotel.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full h-9 px-3 rounded-md border border-[#E8E2DA] bg-white text-[#191816] placeholder:text-[#A89F91] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#191816] mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full h-9 px-3 rounded-md border border-[#E8E2DA] bg-white text-[#191816] placeholder:text-[#A89F91] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#191816] mb-1">
                        Property Name <span className="text-[#71382D]">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Grand Sena Suites"
                        value={propertyName}
                        onChange={(e) => setPropertyName(e.target.value)}
                        required
                        className="w-full h-9 px-3 rounded-md border border-[#E8E2DA] bg-white text-[#191816] placeholder:text-[#A89F91] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#191816] mb-1">
                        Property Type
                      </label>
                      <select
                        value={propertyType}
                        onChange={(e) => setPropertyType(e.target.value)}
                        className="w-full h-9 px-3 rounded-md border border-[#E8E2DA] bg-white text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                      >
                        <option value="boutique_hotel">Boutique Hotel</option>
                        <option value="serviced_apartments">Serviced Apartments</option>
                        <option value="luxury_resort">Luxury Resort</option>
                        <option value="city_hotel">City Hotel</option>
                        <option value="shortlet_collection">Shortlet Collection</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[#191816] mb-1">
                        Password <span className="text-[#71382D]">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full h-9 px-3 rounded-md border border-[#E8E2DA] bg-white text-[#191816] placeholder:text-[#A89F91] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#7A7267] hover:text-[#191816]"
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreedToTerms}
                          onChange={(e) => setAgreedToTerms(e.target.checked)}
                          className="mt-0.5 rounded border-[#E8E2DA] text-[#71382D] focus:ring-[#71382D]"
                        />
                        <span className="text-[11px] text-[#7A7267] leading-relaxed">
                          I agree to the{' '}
                          <Link href="https://sena.ng/terms" target="_blank" className="text-[#71382D] underline">
                            Terms of Service
                          </Link>{' '}
                          and{' '}
                          <Link href="https://sena.ng/privacy" target="_blank" className="text-[#71382D] underline">
                            Privacy Policy
                          </Link>
                          .
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-11 rounded-md bg-[#71382D] hover:bg-[#5D2E25] text-white text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      {isLoading ? 'Creating Property Profile...' : 'Begin 3-Day Free Trial →'}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 sm:px-12 py-5 text-center text-xs text-[#8C8275] border-t border-[#EAE3D9]">
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

export default function SignupPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center text-xs text-[#7A7267]">Loading Sena Console...</div>}>
      <SignupContent />
    </React.Suspense>
  );
}
