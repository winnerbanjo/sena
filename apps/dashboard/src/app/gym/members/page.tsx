'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Topbar } from '../../../components/topbar';
import { pageMain, pageStack } from '../../../components/design';
import { useToast } from '../../../components/toast-notification';
import { Plus, Search, Users, QrCode, Phone, Mail, RefreshCw, Smartphone } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@sena/ui';
import { PageLoadState } from '../../../components/page-load-state';

export default function GymMembersPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [members, setMembers] = React.useState<any[]>([]);
  const [plans, setPlans] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form inputs
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [emergencyName, setEmergencyName] = React.useState('');
  const [emergencyPhone, setEmergencyPhone] = React.useState('');
  const [selectedPlanId, setSelectedPlanId] = React.useState('');
  const [leadIdToConvert, setLeadIdToConvert] = React.useState<string | null>(null);

  React.useEffect(() => {
    const convertName = searchParams?.get('convertName');
    const convertPhone = searchParams?.get('convertPhone');
    const convertEmail = searchParams?.get('convertEmail');
    const leadId = searchParams?.get('leadId');

    if (convertName || convertPhone) {
      if (convertName) setFullName(convertName);
      if (convertPhone) setPhone(convertPhone);
      if (convertEmail) setEmail(convertEmail);
      if (leadId) setLeadIdToConvert(leadId);
      setRegisterOpen(true);
    }
  }, [searchParams]);

  const fetchMembers = React.useCallback(async () => {
    setLoadError(false);
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : '';
      const [resMembers, resPlans] = await Promise.all([
        fetch(`/api/gym/members${q}`),
        fetch('/api/gym/plans'),
      ]);
      if (!resMembers.ok) throw new Error('Could not load gym members');
      const dataMembers = await resMembers.json();
      setMembers(dataMembers.members || []);

      if (resPlans.ok) {
        const dataPlans = await resPlans.json();
        setPlans(dataPlans.plans || []);
        if (dataPlans.plans?.length > 0 && !selectedPlanId) {
          setSelectedPlanId(dataPlans.plans[0].id);
        }
      }
    } catch (err: any) {
      setLoadError(true);
      toast.error('Members', err.message || 'Error loading members');
    } finally {
      setLoading(false);
    }
  }, [search, selectedPlanId, toast]);

  React.useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      toast.error('Required Details', 'Please provide full name and phone number');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/gym/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          emergencyContactName: emergencyName.trim() || null,
          emergencyContactPhone: emergencyPhone.trim() || null,
          planId: selectedPlanId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register member');

      toast.success('Registration Complete', `${data.member.fullName} registered as ${data.member.memberNumber}`);

      if (leadIdToConvert) {
        try {
          await fetch('/api/gym/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: leadIdToConvert,
              status: 'converted',
              convertedMemberId: data.member.id,
            }),
          });
          setLeadIdToConvert(null);
        } catch {
          // ignore lead status update error
        }
      }

      setRegisterOpen(false);
      setFullName('');
      setPhone('');
      setEmail('');
      setEmergencyName('');
      setEmergencyPhone('');
      fetchMembers();
    } catch (err: any) {
      toast.error('Registration Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = members.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    return true;
  });

  if (loading && members.length === 0) {
    return <PageLoadState title="Gym Members" failed={loadError} failureKind="error" retry={fetchMembers} />;
  }

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Gym Members" />

      <main className={pageMain + ' max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6'}>
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-serif text-[#71382D]">Member Directory</h1>
            <p className="text-xs text-[#7A7267] mt-0.5">
              Manage member passes, subscription states, and digital QR codes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Member</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white border border-[#E8E1D5] rounded-xl shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8C8275]" />
            <input
              type="text"
              placeholder="Search by name, ID, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-[#FAF9F7] border border-[#E8E1D5] rounded-lg focus:outline-none focus:border-[#71382D]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] font-mono uppercase text-[#8C8275]">Status:</span>
            {['all', 'active', 'inactive', 'suspended'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                  statusFilter === st
                    ? 'bg-[#71382D] text-white'
                    : 'bg-[#FAF7F2] text-[#7A7267] hover:text-[#191816] border border-[#E8E1D5]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Roster Table */}
        <div className="bg-white border border-[#E8E1D5] rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[#E8E1D5] bg-[#FAF7F2]/60 text-[11px] font-mono uppercase tracking-wider text-[#8C8275]">
                  <th className="py-3 px-5 font-medium">Member & ID</th>
                  <th className="py-3 px-5 font-medium">Contact</th>
                  <th className="py-3 px-5 font-medium">Active Subscription</th>
                  <th className="py-3 px-5 font-medium">Access Pass</th>
                  <th className="py-3 px-5 font-medium text-center">Status</th>
                  <th className="py-3 px-5 font-medium text-end">Portal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D5] text-xs">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-xs text-[#7A7267]">
                      No members match the current search or filters. Click &ldquo;Register New Member&rdquo; to add your first client.
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-[#FAF7F2]/40 transition-colors">
                      <td className="py-4 px-5">
                        <strong className="block text-sm text-[#191816] font-semibold">{m.fullName}</strong>
                        <span className="text-[11px] font-mono text-[#71382D] font-medium">{m.memberNumber}</span>
                      </td>
                      <td className="py-4 px-5 text-[#7A7267]">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Phone className="w-3.5 h-3.5 text-[#8C8275]" />
                          <span>{m.phone}</span>
                        </div>
                        {m.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[#8C8275] mt-0.5">
                            <Mail className="w-3.5 h-3.5" />
                            <span>{m.email}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        {m.latestSubscription ? (
                          <div>
                            <span className="font-medium text-[#191816] block">{m.latestSubscription.planName}</span>
                            <span className="text-[11px] font-mono text-[#8C8275]">
                              Valid until {m.latestSubscription.endDate}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            No Active Plan
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 font-mono">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#71382D] bg-[#FAF4EF] px-2 py-1 rounded border border-[#E5D4BC] w-fit">
                          <QrCode className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[130px]">{m.qrCodeToken}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-medium capitalize ${
                            m.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : m.status === 'suspended'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-stone-100 text-stone-600 border border-stone-200'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-end">
                        <Link
                          href={`/gym/member-portal?memberId=${m.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs border border-[#E8E1D5] bg-white hover:bg-[#FAF7F2] text-[#71382D] font-medium transition-colors"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Pass</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Registration Dialog */}
      {registerOpen && (
        <Dialog open={true} onOpenChange={() => setRegisterOpen(false)}>
          <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif text-[#71382D]">Register Member</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleRegister} className="space-y-4 pt-2 text-xs">
              <div>
                <label className="block font-semibold text-[#191816] mb-1">
                  Full Name <span className="text-[#B85C3E]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chukwudi Okafor"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#191816] mb-1">
                  Phone Number <span className="text-[#B85C3E]">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +234 801 234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#191816] mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. member@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              {plans.length > 0 && (
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Initial Membership Plan</label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] bg-white focus:outline-none focus:border-[#71382D]"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₦{p.priceMinorUnits / 100} / {p.durationMonths} mo)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Emergency Contact</label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Emergency Phone</label>
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <button
                  type="button"
                  onClick={() => setRegisterOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E1D5] text-xs font-medium text-[#191816]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs"
                >
                  {submitting ? 'Registering…' : 'Complete Registration'}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
