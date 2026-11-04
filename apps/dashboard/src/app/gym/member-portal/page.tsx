'use client';

import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../../components/topbar';
import { pageMain, pageStack } from '../../../components/design';
import { useToast } from '../../../components/toast-notification';
import { PageLoadState } from '../../../components/page-load-state';
import {
  QrCode,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  CreditCard,
  User,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { formatNaira } from '@sena/config';

export default function MemberPortalPage() {
  const toast = useToast();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [allMembers, setAllMembers] = React.useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');
  const [bookingClassId, setBookingClassId] = React.useState<string | null>(null);

  const fetchMembersList = React.useCallback(async () => {
    try {
      const res = await fetch('/api/gym/members');
      if (res.ok) {
        const json = await res.json();
        const list = json.members || [];
        setAllMembers(list);
        if (list.length > 0 && !selectedMemberId) {
          setSelectedMemberId(list[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, [selectedMemberId]);

  const fetchPortalData = React.useCallback(async (memberId?: string) => {
    setLoadError(false);
    try {
      const query = memberId ? `?memberId=${memberId}` : '';
      const res = await fetch(`/api/gym/member-portal${query}`);
      if (!res.ok) throw new Error('Failed to load member portal');
      const json = await res.json();
      setData(json);
      if (json.member && !selectedMemberId) {
        setSelectedMemberId(json.member.id);
      }
    } catch (err: any) {
      setLoadError(true);
      toast.error('Portal Error', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMemberId, toast]);

  React.useEffect(() => {
    fetchMembersList();
    fetchPortalData(selectedMemberId);
  }, [fetchMembersList, fetchPortalData, selectedMemberId]);

  const handleBookClass = async (classId: string) => {
    if (!data?.member) return;
    setBookingClassId(classId);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/gym/member-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: data.member.id,
          classId,
          bookingDate: todayStr,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to book class');
      }

      toast.success('Class Booked', 'Your spot has been reserved.');
      fetchPortalData(data.member.id);
    } catch (err: any) {
      toast.error('Booking Error', err.message);
    } finally {
      setBookingClassId(null);
    }
  };

  if (loading || loadError) {
    return (
      <PageLoadState
        title="Member Portal"
        failed={loadError}
        failureKind="error"
        retry={() => fetchPortalData(selectedMemberId)}
      />
    );
  }

  const member = data?.member;
  const subscription = data?.subscription;
  const availableClasses = data?.availableClasses || [];
  const bookings = data?.bookings || [];
  const recentCheckins = data?.recentCheckins || [];

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Member Self-Service Portal" />

      <main className={pageMain + ' space-y-6 max-w-5xl mx-auto w-full p-4 sm:p-6'}>
        {/* Preview Selector Banner for Gym Staff */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#71382D]" />
            <div>
              <h1 className="text-sm font-semibold text-[#191816]">Sena Member Pass & Experience</h1>
              <p className="text-xs text-[#7A7267]">
                Customer-facing digital gym pass, turnstile QR token, plan status, and class bookings.
              </p>
            </div>
          </div>
          {allMembers.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-[#8C8275] whitespace-nowrap">Previewing Member:</span>
              <select
                value={selectedMemberId}
                onChange={(e) => {
                  setSelectedMemberId(e.target.value);
                  fetchPortalData(e.target.value);
                }}
                className="px-3 py-1.5 text-xs rounded-lg border border-[#E8E1D5] bg-white text-[#191816] font-medium focus:outline-none focus:ring-1 focus:ring-[#71382D]"
              >
                {allMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.memberNumber})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!member ? (
          <div className="p-12 text-center rounded-xl border border-[#E8E1D5] bg-white space-y-4">
            <User className="w-10 h-10 text-[#8C8275] mx-auto opacity-50" />
            <h2 className="text-base font-serif font-bold text-[#191816]">No Active Gym Members Yet</h2>
            <p className="text-xs text-[#7A7267] max-w-sm mx-auto">
              Please register your first member in the gym management dashboard to preview their digital pass and member portal.
            </p>
            <Link
              href="/gym/members"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#71382D] text-white text-xs font-medium hover:bg-[#5A2C23]"
            >
              Register First Member
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Digital Membership Pass */}
            <div className="md:col-span-1 space-y-4">
              {/* Digital Card */}
              <div className="relative rounded-2xl bg-gradient-to-br from-[#2D1B18] via-[#43231E] to-[#71382D] text-white p-6 shadow-lg overflow-hidden border border-[#5A2C23]">
                {/* Decorative background circle */}
                <div className="absolute -right-12 -top-12 w-40 h-40 bg-white/5 rounded-full blur-2xl" />

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-[#B85C3E]" />
                    <span className="font-serif tracking-wide text-sm font-bold">SENA POWER GYM</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/10 text-emerald-300 font-semibold border border-white/20">
                    {subscription?.status === 'active' ? 'Active Pass' : 'Expired'}
                  </span>
                </div>

                {/* QR Code Container */}
                <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center my-4 shadow-inner">
                  {/* High visual quality QR simulation */}
                  <div className="w-36 h-36 bg-stone-900 rounded-lg p-2.5 flex items-center justify-center text-white relative">
                    <QrCode className="w-28 h-28 text-white" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded bg-[#71382D] flex items-center justify-center border-2 border-white">
                        <Flame className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-stone-600 mt-2 font-bold tracking-wider">
                    {member.qrCodeToken}
                  </span>
                </div>

                <div className="space-y-1 mt-4">
                  <div className="text-[10px] uppercase tracking-wider text-white/60 font-mono">Member Name</div>
                  <div className="text-base font-serif font-bold text-white">{member.fullName}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-white/60 font-mono block">Member ID</span>
                    <span className="font-mono font-medium">{member.memberNumber}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-white/60 font-mono block">Plan</span>
                    <span className="font-medium truncate block">{subscription?.planName || 'Standard Pass'}</span>
                  </div>
                </div>
              </div>

              {/* Turnstile Scan Tip */}
              <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-[#71382D]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Turnstile QR Access</span>
                </div>
                <p className="text-[#7A7267]">
                  Present this digital QR code to the entrance terminal scanner to unlock the turnstile automatically.
                </p>
              </div>

              {/* Subscription Validity Details */}
              <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#191816]">Subscription Status</h3>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {subscription ? `Valid to ${subscription.endDate}` : 'No plan'}
                  </span>
                </div>

                {subscription && (
                  <div className="space-y-1 text-xs text-[#7A7267]">
                    <div className="flex justify-between">
                      <span>Access Hours:</span>
                      <strong className="text-[#191816]">{subscription.accessHours?.replace('_', ' ')}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Class Credits:</span>
                      <strong className="text-[#191816]">
                        {subscription.maxClassCredits ? `${subscription.maxClassCredits} / month` : 'Unlimited'}
                      </strong>
                    </div>
                  </div>
                )}

                <Link
                  href={`/gym/members?renewMemberId=${member.id}`}
                  className="w-full text-center block py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-medium transition-colors"
                >
                  Renew / Upgrade Plan
                </Link>
              </div>
            </div>

            {/* Right Column: Class Booking & Attendance History */}
            <div className="md:col-span-2 space-y-6">
              {/* Group Classes Schedule */}
              <div className="rounded-xl border border-[#E8E1D5] bg-white shadow-xs overflow-hidden">
                <div className="p-4 border-b border-[#E8E1D5] flex items-center justify-between bg-[#FAF7F2]/60">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#71382D]" />
                    <h2 className="text-sm font-semibold text-[#191816]">Book Group Fitness Classes</h2>
                  </div>
                  <span className="text-xs text-[#7A7267] font-mono">
                    {availableClasses.length} available
                  </span>
                </div>

                <div className="divide-y divide-[#E8E1D5]">
                  {availableClasses.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#7A7267]">
                      No scheduled classes available right now. Check back soon.
                    </div>
                  ) : (
                    availableClasses.map((cls: any) => (
                      <div
                        key={cls.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF7F2]/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <strong className="block text-sm font-medium text-[#191816]">{cls.name}</strong>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#7A7267]">
                            <span className="inline-flex items-center gap-1 font-mono text-[#71382D] font-medium">
                              <Clock className="w-3 h-3" />
                              {cls.startTime} ({cls.durationMinutes}m)
                            </span>
                            {cls.locationRoom && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[#8C8275]" />
                                {cls.locationRoom}
                              </span>
                            )}
                            {cls.trainerName && (
                              <span className="inline-flex items-center gap-1">
                                Trainer: <strong>{cls.trainerName}</strong>
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-[#8C8275]">
                              Max {cls.capacity} athletes
                            </span>
                          </div>
                          {cls.description && (
                            <p className="text-xs text-[#524B43] mt-1">{cls.description}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={bookingClassId === cls.id}
                          onClick={() => handleBookClass(cls.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-medium transition-colors disabled:opacity-50 self-start sm:self-auto cursor-pointer"
                        >
                          {bookingClassId === cls.id ? 'Reserving...' : 'Book Spot'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* My Upcoming Bookings */}
              {bookings.length > 0 && (
                <div className="rounded-xl border border-[#E8E1D5] bg-white shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-[#E8E1D5] bg-[#FAF7F2]/60">
                    <h2 className="text-sm font-semibold text-[#191816]">My Class Reservations</h2>
                  </div>
                  <div className="divide-y divide-[#E8E1D5]">
                    {bookings.map((b: any) => (
                      <div key={b.id} className="p-3.5 flex items-center justify-between text-xs">
                        <div>
                          <strong className="block text-[#191816]">{b.className}</strong>
                          <span className="text-[11px] text-[#8C8275]">
                            {b.bookingDate} · {b.startTime} ({b.durationMinutes} min)
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200">
                          {b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attendance & Turnstile Check-in Log */}
              <div className="rounded-xl border border-[#E8E1D5] bg-white shadow-xs overflow-hidden">
                <div className="p-4 border-b border-[#E8E1D5] flex items-center justify-between bg-[#FAF7F2]/60">
                  <h2 className="text-sm font-semibold text-[#191816]">Recent Workout Entries</h2>
                  <span className="text-xs text-[#8C8275] font-mono">Last 5 visits</span>
                </div>
                <div className="divide-y divide-[#E8E1D5]">
                  {recentCheckins.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#7A7267]">
                      No check-ins logged yet. Scan your digital pass at the entrance terminal.
                    </div>
                  ) : (
                    recentCheckins.map((c: any) => (
                      <div key={c.id} className="p-3.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          {c.accessResult === 'granted' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                          <div>
                            <strong className="block text-[#191816]">
                              {new Date(c.checkInAt).toLocaleDateString([], {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </strong>
                            <span className="text-[11px] font-mono text-[#8C8275]">
                              {new Date(c.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {c.accessPoint?.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            c.accessResult === 'granted'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {c.accessResult === 'granted' ? 'Workout Logged' : 'Denied'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
