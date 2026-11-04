'use client';

import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../components/topbar';
import { pageMain, pageStack } from '../../components/design';
import { useToast } from '../../components/toast-notification';
import {
  Users,
  DoorOpen,
  AlertTriangle,
  Calendar,
  Plus,
  QrCode,
  CheckCircle2,
  XCircle,
  TrendingUp,
  CreditCard,
  UserPlus,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import { PageLoadState } from '../../components/page-load-state';
import { formatNaira } from '@sena/config';

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
    // Auto-refresh metrics every 30 seconds for live floor updates
    const interval = setInterval(fetchOverview, 30000);
    return () => clearInterval(interval);
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

  const metrics = data?.metrics || {
    activeMembers: 0,
    inactiveMembers: 0,
    currentlyInside: 0,
    maxCapacity: 100,
    occupancyPercentage: 0,
    todayCheckins: 0,
    todayExits: 0,
    todayDenied: 0,
    expiringSoon: 0,
    expiring30d: 0,
    activeClasses: 0,
    openLeads: 0,
    todayRevenueMinorUnits: 0,
    monthRevenueMinorUnits: 0,
    activeMrrMinorUnits: 0,
    outstandingBalancesMinorUnits: 0,
  };

  const recentActivity = data?.recentActivity || [];
  const expiring = data?.expiringSubscriptions || [];

  const occupancyPct = metrics.occupancyPercentage || 0;
  const isHighOccupancy = occupancyPct >= 85;
  const isModerateOccupancy = occupancyPct >= 70 && occupancyPct < 85;

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Gym Operations Command Center" />

      <main className={pageMain + ' space-y-6 max-w-7xl mx-auto w-full p-4 sm:p-6'}>
        {/* Quick Action & Operations Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-[#E8E1D5] bg-white shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-serif text-[#71382D]">Fitness Command Center</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Live Floor Active
              </span>
            </div>
            <p className="text-xs text-[#7A7267] mt-0.5">
              Real-time floor occupancy, turnstile QR access, subscription renewals, and membership CRM.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/gym/access-terminal"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Launch Access Terminal</span>
            </Link>
            <Link
              href="/gym/members"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E8E1D5] bg-white hover:bg-[#FAF7F2] text-[#191816] text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#71382D]" />
              <span>Register Member</span>
            </Link>
            <Link
              href="/gym/leads"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E8E1D5] bg-white hover:bg-[#FAF7F2] text-[#191816] text-xs font-medium transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#71382D]" />
              <span>Add Lead</span>
            </Link>
          </div>
        </div>

        {/* Operational Alerts Bar (Turnstile denials, Capacity, Outstanding) */}
        {(metrics.todayDenied > 0 || isHighOccupancy || metrics.outstandingBalancesMinorUnits > 0) && (
          <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              {metrics.todayDenied > 0 && (
                <span className="font-medium">
                  <strong>{metrics.todayDenied} access {metrics.todayDenied === 1 ? 'attempt' : 'attempts'} denied</strong> today at the turnstile.
                </span>
              )}
              {isHighOccupancy && (
                <span className="font-medium text-red-700">
                  Floor capacity at {occupancyPct}% ({metrics.currentlyInside} / {metrics.maxCapacity} athletes inside).
                </span>
              )}
              {metrics.outstandingBalancesMinorUnits > 0 && (
                <span>
                  Outstanding unpaid memberships: <strong>{formatNaira(metrics.outstandingBalancesMinorUnits)}</strong>
                </span>
              )}
            </div>
            <Link
              href="/gym/access-terminal"
              className="text-xs font-medium text-[#71382D] hover:underline"
            >
              View Terminal Logs →
            </Link>
          </div>
        )}

        {/* Live Floor Occupancy Hero Widget */}
        <div className="p-5 rounded-xl border border-[#E8E1D5] bg-white shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isHighOccupancy
                    ? 'bg-red-50 text-red-700'
                    : isModerateOccupancy
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#191816]">Live Floor Occupancy</h2>
                <p className="text-xs text-[#7A7267]">
                  Real-time floor traffic based on QR entry scans within active session window (&lt; 3 hrs)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[11px] font-mono text-[#8C8275] uppercase block">Currently On Floor</span>
                <span className="text-2xl font-serif font-bold text-[#191816]">
                  {metrics.currentlyInside}{' '}
                  <span className="text-sm font-sans font-normal text-[#8C8275]">
                    / {metrics.maxCapacity} max
                  </span>
                </span>
              </div>
              <div className="text-right border-l border-[#E8E1D5] pl-6">
                <span className="text-[11px] font-mono text-[#8C8275] uppercase block">Floor Density</span>
                <span
                  className={`text-2xl font-serif font-bold ${
                    isHighOccupancy
                      ? 'text-red-600'
                      : isModerateOccupancy
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {occupancyPct}%
                </span>
              </div>
            </div>
          </div>

          {/* Occupancy Progress Bar */}
          <div className="w-full bg-[#E8E1D5]/40 h-3 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isHighOccupancy
                  ? 'bg-red-500'
                  : isModerateOccupancy
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
              style={{ width: `${occupancyPct}%` }}
            />
          </div>

          {/* Sub-metrics: Entries vs Exits */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#E8E1D5]/60 text-xs">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-[#8C8275] block text-[11px]">Today's Entries</span>
                <span className="font-semibold text-[#191816]">{metrics.todayCheckins} scans</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-stone-500" />
              <div>
                <span className="text-[#8C8275] block text-[11px]">Today's Exits</span>
                <span className="font-semibold text-[#191816]">{metrics.todayExits} checkouts</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <div>
                <span className="text-[#8C8275] block text-[11px]">Denied Entries</span>
                <span className="font-semibold text-[#191816]">{metrics.todayDenied} scans</span>
              </div>
            </div>
          </div>
        </div>

        {/* 8 Operational & Financial KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Active Members */}
          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">Active Members</span>
              <Users className="w-4 h-4 text-[#71382D]" />
            </div>
            <div className="text-2xl font-serif text-[#191816] font-semibold">{metrics.activeMembers}</div>
            <span className="text-[11px] text-[#7A7267]">
              {metrics.inactiveMembers} inactive/expired
            </span>
          </div>

          {/* 2. Today's Collections */}
          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">Today's Revenue</span>
              <CreditCard className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl font-serif text-emerald-700 font-semibold">
              {formatNaira(metrics.todayRevenueMinorUnits)}
            </div>
            <span className="text-[11px] text-[#7A7267]">Collected today</span>
          </div>

          {/* 3. Monthly Revenue MTD */}
          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">MTD Collections</span>
              <TrendingUp className="w-4 h-4 text-[#71382D]" />
            </div>
            <div className="text-2xl font-serif text-[#191816] font-semibold">
              {formatNaira(metrics.monthRevenueMinorUnits)}
            </div>
            <span className="text-[11px] text-[#7A7267]">Current month total</span>
          </div>

          {/* 4. Active MRR Run-rate */}
          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">Active MRR</span>
              <Flame className="w-4 h-4 text-[#B85C3E]" />
            </div>
            <div className="text-2xl font-serif text-[#B85C3E] font-semibold">
              {formatNaira(metrics.activeMrrMinorUnits)}
            </div>
            <span className="text-[11px] text-[#7A7267]">Monthly run-rate</span>
          </div>

          {/* 5. Renewals Due in 7 Days */}
          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">Renewals Due (7d)</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-serif text-amber-700 font-semibold">{metrics.expiringSoon}</div>
            <span className="text-[11px] text-[#7A7267]">
              {metrics.expiring30d} expiring in 30 days
            </span>
          </div>

          {/* 6. CRM Lead Pipeline */}
          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">Open Leads</span>
              <UserPlus className="w-4 h-4 text-[#71382D]" />
            </div>
            <div className="text-2xl font-serif text-[#191816] font-semibold">{metrics.openLeads}</div>
            <Link href="/gym/leads" className="text-[11px] text-[#71382D] hover:underline font-medium block">
              Manage pipeline →
            </Link>
          </div>

          {/* 7. Active Classes */}
          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">Active Classes</span>
              <Calendar className="w-4 h-4 text-[#71382D]" />
            </div>
            <div className="text-2xl font-serif text-[#191816] font-semibold">{metrics.activeClasses}</div>
            <Link href="/gym/classes" className="text-[11px] text-[#71382D] hover:underline font-medium block">
              View schedule →
            </Link>
          </div>

          {/* 8. Outstanding Balances */}
          <div className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#8C8275]">
              <span className="text-[11px] font-mono uppercase tracking-wider">Unpaid Balances</span>
              <CreditCard className="w-4 h-4 text-stone-500" />
            </div>
            <div className="text-2xl font-serif text-stone-700 font-semibold">
              {formatNaira(metrics.outstandingBalancesMinorUnits)}
            </div>
            <span className="text-[11px] text-[#7A7267]">Pending member balance</span>
          </div>
        </div>

        {/* 2 Column Operations Layout: Live Access Stream & Expiry Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Check-in Feed */}
          <div className="rounded-xl border border-[#E8E1D5] bg-white shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E8E1D5] flex items-center justify-between bg-[#FAF7F2]/60">
              <div className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-[#71382D]" />
                <h2 className="text-sm font-semibold text-[#191816]">Access Terminal Live Stream</h2>
              </div>
              <Link href="/gym/access-terminal" className="text-xs text-[#71382D] hover:underline font-medium">
                Open Full Terminal →
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
                        <span className="text-[11px] font-mono text-[#8C8275]">
                          {log.memberNumber} · {log.accessPoint?.replace('_', ' ')}
                        </span>
                        {log.denialReason && (
                          <p className="text-[10px] text-red-700 font-medium">{log.denialReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-mono text-[#8C8275] block">
                        {new Date(log.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {log.checkOutAt && (
                        <span className="text-[10px] font-mono text-stone-500">
                          Exited {new Date(log.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Memberships Due for Renewal Radar */}
          <div className="rounded-xl border border-[#E8E1D5] bg-white shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E8E1D5] flex items-center justify-between bg-[#FAF7F2]/60">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-[#191816]">Expiry Radar (Next 7 Days)</h2>
              </div>
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
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200">
                        Expires {sub.endDate}
                      </span>
                      <Link
                        href={`/gym/members?renewMemberId=${sub.memberId}`}
                        className="px-2.5 py-1 rounded text-xs bg-[#71382D] hover:bg-[#5A2C23] text-white font-medium transition-colors cursor-pointer"
                      >
                        Renew
                      </Link>
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
