'use client';

import * as React from 'react';
import { Topbar } from '../../components/topbar';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { Badge, Button } from '@sena/ui';
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  Mail,
  Phone,
  Clock,
  MoreVertical,
  CheckCircle2,
  Lock,
  X,
  Shield,
  KeyRound,
  RotateCw,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface StaffMember {
  id: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  role: 'Owner' | 'General Manager' | 'Front Desk Lead' | 'Housekeeping Supervisor' | 'Room Attendant' | 'Finance';
  department: 'Management' | 'Front Office' | 'Housekeeping' | 'Accounting';
  shiftStatus: 'on_duty' | 'off_duty';
  lastActive: string;
}

export default function StaffPage() {
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [staff, setStaff] = React.useState<StaffMember[]>([]);
  const [deptFilter, setDeptFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewTab, setViewTab] = React.useState<'roster' | 'permissions'>('roster');
  const [loading, setLoading] = React.useState(true);
  const [submittingInvite, setSubmittingInvite] = React.useState(false);
  const [resendingId, setResendingId] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = React.useState(false);
  const [inviteName, setInviteName] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [invitePhone, setInvitePhone] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<StaffMember['role']>('Front Desk Lead');

  const fetchStaff = React.useCallback(async () => {
    try {
      const res = await fetch('/api/staff');
      if (res.ok) {
        const data = await res.json();
        if (data.staff && data.staff.length > 0) {
          setStaff(data.staff);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to fetch staff:', e);
    } finally {
      setLoading(false);
    }

    // Fallback to localStorage or default logged in user
    try {
      const saved = localStorage.getItem('sena_property_staff');
      if (saved) {
        setStaff(JSON.parse(saved));
        return;
      }
    } catch {}

    let currentUserName = 'Property Owner';
    let currentUserEmail = 'owner@sena.ng';
    try {
      const authUserStr = localStorage.getItem('sena_auth_user');
      if (authUserStr) {
        const parsed = JSON.parse(authUserStr);
        if (parsed.fullName) currentUserName = parsed.fullName;
        if (parsed.email) currentUserEmail = parsed.email;
      }
    } catch {}

    const defaultOwner: StaffMember = {
      id: 'staff-owner',
      name: currentUserName,
      email: currentUserEmail,
      phone: '—',
      role: 'Owner',
      department: 'Management',
      shiftStatus: 'on_duty',
      lastActive: 'Active now',
    };
    setStaff([defaultOwner]);
  }, []);

  React.useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const saveStaff = (newStaff: StaffMember[]) => {
    setStaff(newStaff);
    try {
      localStorage.setItem('sena_property_staff', JSON.stringify(newStaff));
    } catch (e) {
      console.error('Failed to save staff:', e);
    }
  };

  const filteredStaff = staff.filter((s) => {
    if (deptFilter !== 'all' && s.department !== deptFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const onDutyCount = staff.filter((s) => s.shiftStatus === 'on_duty').length;

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return;

    let dept: StaffMember['department'] = 'Front Office';
    if (inviteRole === 'General Manager') dept = 'Management';
    if (inviteRole === 'Housekeeping Supervisor' || inviteRole === 'Room Attendant') dept = 'Housekeeping';
    if (inviteRole === 'Finance') dept = 'Accounting';

    setSubmittingInvite(true);
    setBanner({ text: `Sending official invitation email to ${inviteEmail}...`, type: 'info' });

    try {
      const res = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim().toLowerCase(),
          phone: invitePhone ? invitePhone.trim() : '—',
          role: inviteRole,
          department: dept,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setBanner({
          text: `Invitation email successfully dispatched to ${inviteEmail}. An access link was delivered to their inbox.`,
          type: 'success',
        });

        if (data.member) {
          const updated = [data.member, ...staff.filter((m) => m.email.toLowerCase() !== inviteEmail.toLowerCase())];
          saveStaff(updated);
        }

        setInviteModalOpen(false);
        setInviteName('');
        setInviteEmail('');
        setInvitePhone('');
      } else {
        setBanner({
          text: data.error || 'Failed to dispatch staff invitation email.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setBanner({ text: err.message || 'Network error while dispatching invite', type: 'error' });
    } finally {
      setSubmittingInvite(false);
      setTimeout(() => setBanner(null), 8000);
    }
  };

  const handleResendInvite = async (member: StaffMember) => {
    setResendingId(member.id);
    setBanner({ text: `Re-dispatching invitation email to ${member.email}...`, type: 'info' });

    try {
      const res = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: member.name,
          email: member.email,
          phone: member.phone,
          role: member.role,
          department: member.department,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBanner({
          text: `Invitation email re-sent successfully to ${member.email}!`,
          type: 'success',
        });
      } else {
        setBanner({
          text: data.error || 'Failed to resend invitation email',
          type: 'error',
        });
      }
    } catch (e: any) {
      setBanner({ text: e.message || 'Network error resending invite', type: 'error' });
    } finally {
      setResendingId(null);
      setTimeout(() => setBanner(null), 8000);
    }
  };

  const toggleDutyStatus = (id: string) => {
    const updated = staff.map((s) => {
      if (s.id !== id) return s;
      return {
        ...s,
        shiftStatus: (s.shiftStatus === 'on_duty' ? 'off_duty' : 'on_duty') as StaffMember['shiftStatus'],
      };
    });
    saveStaff(updated);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title="Staff & Permissions"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              Team &amp; Staff Roster
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Manage team access, role-based permissions, and active operational shifts.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Button
              onClick={() => setInviteModalOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-[#71382D] hover:bg-[#5A2C23] text-white"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Staff Member</span>
            </Button>
          </div>
        </div>

        {/* Status / Alert Banner */}
        {banner && (
          <div
            className={`p-3.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-3 ${
              banner.type === 'success'
                ? 'bg-[#EFF7F2] border-[#C6E4CC] text-[#2E6B4F]'
                : banner.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {banner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{banner.text}</span>
            </div>
            <button
              onClick={() => setBanner(null)}
              className="text-xs opacity-60 hover:opacity-100 font-bold"
            >
              &times;
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[10px] sm:text-[11px] text-[#7A7267] uppercase font-semibold">Total Staff</span>
            <div className="text-xl sm:text-2xl font-serif text-[#191816] mt-1">{staff.length}</div>
            <p className="text-[10px] sm:text-[11px] text-[#7A7267] mt-1">Active team</p>
          </div>

          <div className="p-3 sm:p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[10px] sm:text-[11px] text-[#7A7267] uppercase font-semibold">On Duty Now</span>
            <div className="text-xl sm:text-2xl font-serif text-[#191816] mt-1">{onDutyCount}</div>
            <p className="text-[10px] sm:text-[11px] text-emerald-700 mt-1 font-medium">On property</p>
          </div>

          <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Front Desk Team</span>
            <div className="text-2xl font-serif text-[#191816] mt-1">
              {staff.filter((s) => s.department === 'Front Office').length}
            </div>
            <p className="text-[11px] text-[#7A7267] mt-1">Check-in &amp; Guest arrivals</p>
          </div>

          <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Housekeeping</span>
            <div className="text-2xl font-serif text-[#191816] mt-1">
              {staff.filter((s) => s.department === 'Housekeeping').length}
            </div>
            <p className="text-[11px] text-[#7A7267] mt-1">Room turnovers &amp; inspections</p>
          </div>
        </div>

        {/* Tabs switcher */}
        <div className="flex items-center gap-6 border-b border-[#E8E2DA]">
          <button
            onClick={() => setViewTab('roster')}
            className={`py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              viewTab === 'roster'
                ? 'border-[#B85C3E] text-[#B85C3E] font-semibold'
                : 'border-transparent text-[#7A7267] hover:text-[#191816]'
            }`}
          >
            Staff Directory ({staff.length})
          </button>
          <button
            onClick={() => setViewTab('permissions')}
            className={`py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              viewTab === 'permissions'
                ? 'border-[#B85C3E] text-[#B85C3E] font-semibold'
                : 'border-transparent text-[#7A7267] hover:text-[#191816]'
            }`}
          >
            Role Permissions Matrix
          </button>
        </div>

        {viewTab === 'roster' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FAF7F2] p-3 rounded-lg border border-[#E8E2DA]">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {(['all', 'Management', 'Front Office', 'Housekeeping', 'Accounting'] as const).map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setDeptFilter(dept)}
                    className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                      deptFilter === dept
                        ? 'bg-white text-[#191816] shadow-xs border border-[#E8E2DA]'
                        : 'text-[#7A7267] hover:text-[#191816]'
                    }`}
                  >
                    {dept === 'all' ? 'All Departments' : dept}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7267]" />
                <input
                  type="text"
                  placeholder="Search staff by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E8E2DA] rounded text-xs text-[#191816] placeholder:text-[#7A7267] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                />
              </div>
            </div>

            {/* Staff Table */}
            <div className="border border-[#E8E2DA] rounded-lg overflow-x-auto bg-white">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] text-[#7A7267] uppercase font-mono tracking-wider border-b border-[#E8E2DA]">
                    <th className="py-2.5 px-4 font-medium">Member</th>
                    <th className="py-2.5 px-4 font-medium">Role &amp; Department</th>
                    <th className="py-2.5 px-4 font-medium">Contact</th>
                    <th className="py-2.5 px-4 font-medium">Shift Status</th>
                    <th className="py-2.5 px-4 font-medium">Last Active</th>
                    <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2DA]">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#7A7267]">
                        {searchQuery
                          ? 'No staff members match your search criteria'
                          : 'No team members invited yet'}
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((member) => {
                      const initials = member.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);

                      const isInvited = member.lastActive.includes('Invited');

                      return (
                        <tr key={member.id} className="hover:bg-[#FAFAFA]/70">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-full bg-[#E5D4BC] text-[#71382D] flex items-center justify-center font-medium text-xs flex-shrink-0">
                                {initials}
                              </span>
                              <div>
                                <span className="font-semibold text-[#191816] block">{member.name}</span>
                                <span className="text-[11px] text-[#7A7267]">{member.email}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-medium text-[#191816] block">{member.role}</span>
                            <span className="text-[11px] text-[#7A7267]">{member.department}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] text-[#191816]">{member.phone}</span>
                          </td>

                          <td className="py-3 px-4">
                            <button
                              onClick={() => toggleDutyStatus(member.id)}
                              className="cursor-pointer"
                              title="Click to toggle shift status"
                            >
                              {member.shiftStatus === 'on_duty' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  On Duty
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                                  Off Duty
                                </span>
                              )}
                            </button>
                          </td>

                          <td className="py-3 px-4 text-[#7A7267] text-[11px]">
                            {isInvited ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                <Mail className="w-3 h-3 text-amber-600" />
                                {member.lastActive}
                              </span>
                            ) : (
                              member.lastActive
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {isInvited && (
                                <button
                                  type="button"
                                  disabled={resendingId === member.id}
                                  onClick={() => handleResendInvite(member)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-[#71382D] hover:underline disabled:opacity-50"
                                >
                                  {resendingId === member.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RotateCw className="w-3 h-3" />
                                  )}
                                  <span>Resend Invite</span>
                                </button>
                              )}

                              <button
                                onClick={() => toggleDutyStatus(member.id)}
                                className="text-xs font-medium text-[#B85C3E] hover:underline"
                              >
                                {member.shiftStatus === 'on_duty' ? 'Clock Out' : 'Clock In'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewTab === 'permissions' && (
          <div className="space-y-4">
            <div className="bg-[#FAF7F2] p-4 rounded-lg border border-[#E8E2DA] text-xs text-[#7A7267] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#71382D] flex-shrink-0" />
              <span>
                Role-based access control (RBAC) enforces strict operational separation across departments.
              </span>
            </div>

            <div className="border border-[#E8E2DA] rounded-lg overflow-x-auto bg-white">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] text-[#7A7267] uppercase font-mono tracking-wider border-b border-[#E8E2DA]">
                    <th className="py-2.5 px-4 font-medium">Permission Module</th>
                    <th className="py-2.5 px-4 font-medium text-center">Owner / GM</th>
                    <th className="py-2.5 px-4 font-medium text-center">Front Desk</th>
                    <th className="py-2.5 px-4 font-medium text-center">Housekeeping</th>
                    <th className="py-2.5 px-4 font-medium text-center">Accounting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2DA]">
                  {[
                    { mod: 'Reservations & Check-in / Out', gm: true, front: true, hk: false, acc: false },
                    { mod: 'Guest Directory & Profiles', gm: true, front: true, hk: false, acc: false },
                    { mod: 'Housekeeping Turnovers & Clean Status', gm: true, front: true, hk: true, acc: false },
                    { mod: 'Room Rates & Yield Management', gm: true, front: false, hk: false, acc: false },
                    { mod: 'Payment Invoicing & Folios', gm: true, front: true, hk: false, acc: true },
                    { mod: 'Revenue & Financial Reports', gm: true, front: false, hk: false, acc: true },
                    { mod: 'Website CMS & Brand Settings', gm: true, front: false, hk: false, acc: false },
                    { mod: 'Staff Management & Team Invites', gm: true, front: false, hk: false, acc: false },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#FAFAFA]/70">
                      <td className="py-3 px-4 font-medium text-[#191816]">{row.mod}</td>
                      <td className="py-3 px-4 text-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.front ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /> : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.hk ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /> : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.acc ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /> : <span className="text-stone-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Invite Staff Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E8E2DA] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#E8E2DA] flex items-center justify-between">
              <h3 className="text-base font-serif font-normal text-[#191816]">
                Invite Team Member
              </h3>
              <button
                disabled={submittingInvite}
                onClick={() => setInviteModalOpen(false)}
                className="text-[#7A7267] hover:text-[#191816]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={submittingInvite}
                  placeholder="e.g. Samuel Adeleke"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  disabled={submittingInvite}
                  placeholder="samuel@stayconnect.ng"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                />
                <p className="text-[10px] text-[#7A7267] mt-1">
                  An official invitation link will be delivered directly from notifications@sena.ng.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  disabled={submittingInvite}
                  placeholder="+234 800 000 0000"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1">
                  Assigned Role
                </label>
                <select
                  disabled={submittingInvite}
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                >
                  <option value="Front Desk Lead">Front Desk Lead</option>
                  <option value="Housekeeping Supervisor">Housekeeping Supervisor</option>
                  <option value="Room Attendant">Room Attendant</option>
                  <option value="Finance">Finance &amp; Accounting</option>
                  <option value="General Manager">General Manager</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8E2DA]">
                <button
                  type="button"
                  disabled={submittingInvite}
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 rounded border border-[#E8E2DA] bg-white text-xs font-medium text-[#191816] hover:bg-[#FAFAFA]"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={submittingInvite}
                  className="text-xs bg-[#71382D] hover:bg-[#5A2C23] text-white flex items-center gap-1.5"
                >
                  {submittingInvite ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Invitation...</span>
                    </>
                  ) : (
                    <span>Send Invitation</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <NewReservationDialog
        open={newResOpen}
        onOpenChange={setNewResOpen}
        onCreateReservation={() => {}}
      />
    </div>
  );
}
