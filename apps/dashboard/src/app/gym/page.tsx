'use client';

import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../components/topbar';
import { pageMain, pageStack } from '../../components/design';
import { useToast } from '../../components/toast-notification';
import { Users, DoorOpen, AlertTriangle, Calendar, Plus, QrCode, CheckCircle2, XCircle } from 'lucide-react';
import { PageLoadState } from '../../components/page-load-state';

export default function GymDashboardPage() {
  const toast = useToast();
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [data, setData] = React.useState<any>(null);

  const fetchOverview = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/gym/overview');
      if (!res.ok) throw new Error('Failed to load gym metrics');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setLoadError(true);
      toast.error('Gym Data', err.message || 'Could not load gym overview');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if (loading || loadError) {
    return (
      <PageLoadState
        title="Gym Operations"
        failed={loadError}
        failureKind="error"
        retry={fetchOverview}
      />
    );
  }

  const metrics = data?.metrics || { activeMembers: 0, todayCheckins: 0, expiringSoon: 0, activeClasses: 0 };
  const recentActivity = data?.recentActivity || [];
  const expiring = data?.expiringSubscriptions || [];

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Gym Operations" />

      <main className={pageMain + ' space-y-6 max-w-7xl mx-auto w-full p-4 sm:p-6'}>
        {/* Quick Action Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-[#E8E1D5] bg-white shadow-xs">
          <div>
            <h1 className="text-xl font-serif text-[#71382D]">Fitness Center Command Center</h1>
            <p className="text-xs text-[#7A7267] mt-0.5">
              Live floor capacity, QR access terminal check-ins, and membership renewals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/gym/access-terminal"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-medium shadow-xs transition-colors"
            >
              <QrCode className="w-4 h-4" />
              <span>Launch Access Terminal</span>
            </Link>
            <Link
              href="/gym/members"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E8E1D5] bg-white hover:bg-[#FAF7F2] text-[#191816] text-xs font-medium transition-colors"
            >
              <Plus className="w-4 h-4 text-[#71382D]" />
              <span>Register Member</span>
            </Link>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">Active Members</span>
              <Users className="w-4 h-4 text-[#71382D]" />
            </div>
            <div className="text-2xl font-serif text-[#191816] font-semibold">{metrics.activeMembers}</div>
            <span className="text-[11px] text-[#7A7267]">In good standing</span>
          </div>

          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">Check-ins Today</span>
              <DoorOpen className="w-4 h-4 text-[#2E6B4F]" />
            </div>
            <div className="text-2xl font-serif text-[#191816] font-semibold">{metrics.todayCheckins}</div>
            <span className="text-[11px] text-[#7A7267]">Cleared floor entries</span>
          </div>

          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">Expiring in 7 Days</span>
              <AlertTriangle className="w-4 h-4 text-[#B85C3E]" />
            </div>
            <div className="text-2xl font-serif text-[#B85C3E] font-semibold">{metrics.expiringSoon}</div>
            <span className="text-[11px] text-[#7A7267]">Need renewal prompt</span>
          </div>

          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">Active Classes</span>
              <Calendar className="w-4 h-4 text-[#71382D]" />
            </div>
            <div className="text-2xl font-serif text-[#191816] font-semibold">{metrics.activeClasses}</div>
            <span className="text-[11px] text-[#7A7267]">Weekly schedule</span>
          </div>
        </div>

        {/* 2 Column Operations Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Check-in Feed */}
          <div className="rounded-xl border border-[#E8E1D5] bg-white shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E8E1D5] flex items-center justify-between bg-[#FAF7F2]/60">
              <h2 className="text-sm font-semibold text-[#191816]">Recent Access Terminal Activity</h2>
              <Link href="/gym/access-terminal" className="text-xs text-[#71382D] hover:underline font-medium">
                Open Terminal →
              </Link>
            </div>
            <div className="divide-y divide-[#E8E1D5]">
              {recentActivity.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#7A7267]">
                  No check-ins logged today yet. Launch the access terminal to begin scanning QR passes.
                </div>
              ) : (
                recentActivity.map((log: any) => (
                  <div key={log.id} className="p-3.5 flex items-center justify-between hover:bg-[#FAF7F2]/40 transition-colors">
                    <div className="flex items-center gap-3">
                      {log.accessResult === 'granted' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      )}
                      <div>
                        <strong className="block text-xs font-semibold text-[#191816]">{log.memberName}</strong>
                        <span className="text-[11px] font-mono text-[#8C8275]">{log.memberNumber} · {log.accessPoint}</span>
                        {log.denialReason && (
                          <p className="text-[10px] text-red-700 font-medium">{log.denialReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-end">
                      <span className="text-[11px] font-mono text-[#8C8275]">
                        {new Date(log.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Members Expiring Soon */}
          <div className="rounded-xl border border-[#E8E1D5] bg-white shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E8E1D5] flex items-center justify-between bg-[#FAF7F2]/60">
              <h2 className="text-sm font-semibold text-[#191816]">Memberships Due for Renewal</h2>
              <Link href="/gym/members" className="text-xs text-[#71382D] hover:underline font-medium">
                View All Members →
              </Link>
            </div>
            <div className="divide-y divide-[#E8E1D5]">
              {expiring.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#7A7267]">
                  No memberships expiring within the next 7 days.
                </div>
              ) : (
                expiring.map((sub: any) => (
                  <div key={sub.id} className="p-3.5 flex items-center justify-between hover:bg-[#FAF7F2]/40 transition-colors">
                    <div>
                      <strong className="block text-xs font-semibold text-[#191816]">{sub.memberName}</strong>
                      <span className="text-[11px] text-[#8C8275]">{sub.memberPhone}</span>
                    </div>
                    <div className="text-end">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200">
                        Expires {sub.endDate}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
