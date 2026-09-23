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
  KeyRound
} from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Owner' | 'General Manager' | 'Front Desk Lead' | 'Housekeeping Supervisor' | 'Room Attendant' | 'Finance';
  department: 'Management' | 'Front Office' | 'Housekeeping' | 'Accounting';
  shiftStatus: 'on_duty' | 'off_duty';
  lastActive: string;
}

const INITIAL_STAFF: StaffMember[] = [
  {
    id: 'staff-1',
    name: 'Amara Okafor',
    email: 'amara@stayconnect.ng',
    phone: '+234 803 123 4567',
    role: 'General Manager',
    department: 'Management',
    shiftStatus: 'on_duty',
    lastActive: 'Just now',
  },
  {
    id: 'staff-2',
    name: 'Babatunde Adeleke',
    email: 'babatunde@stayconnect.ng',
    phone: '+234 812 345 6789',
    role: 'Front Desk Lead',
    department: 'Front Office',
    shiftStatus: 'on_duty',
    lastActive: '5m ago',
  },
  {
    id: 'staff-3',
    name: 'Chioma Eze',
    email: 'chioma@stayconnect.ng',
    phone: '+234 809 987 6543',
    role: 'Housekeeping Supervisor',
    department: 'Housekeeping',
    shiftStatus: 'on_duty',
    lastActive: '12m ago',
  },
  {
    id: 'staff-4',
    name: 'Femi Alabi',
    email: 'femi@stayconnect.ng',
    phone: '+234 802 234 5678',
    role: 'Front Desk Lead',
    department: 'Front Office',
    shiftStatus: 'off_duty',
    lastActive: 'Yesterday, 11:30 PM',
  },
  {
    id: 'staff-5',
    name: 'Blessing Nwosu',
    email: 'blessing@stayconnect.ng',
    phone: '+234 814 555 1234',
    role: 'Room Attendant',
    department: 'Housekeeping',
    shiftStatus: 'on_duty',
    lastActive: '2m ago',
  },
  {
    id: 'staff-6',
    name: 'Ibrahim Musa',
    email: 'ibrahim@stayconnect.ng',
    phone: '+234 805 777 8899',
    role: 'Finance',
    department: 'Accounting',
    shiftStatus: 'off_duty',
    lastActive: '4h ago',
  },
];

export default function StaffPage() {
  const [newResOpen, setNewResOpen] = React.useState(false);
  const [staff, setStaff] = React.useState<StaffMember[]>(INITIAL_STAFF);
  const [deptFilter, setDeptFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewTab, setViewTab] = React.useState<'roster' | 'permissions'>('roster');

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = React.useState(false);
  const [inviteName, setInviteName] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [invitePhone, setInvitePhone] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<StaffMember['role']>('Front Desk Lead');

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

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return;

    let dept: StaffMember['department'] = 'Front Office';
    if (inviteRole === 'General Manager') dept = 'Management';
    if (inviteRole === 'Housekeeping Supervisor' || inviteRole === 'Room Attendant') dept = 'Housekeeping';
    if (inviteRole === 'Finance') dept = 'Accounting';

    const newMember: StaffMember = {
      id: `staff-${Date.now()}`,
      name: inviteName,
      email: inviteEmail,
      phone: invitePhone || '+234 800 000 0000',
      role: inviteRole,
      department: dept,
      shiftStatus: 'on_duty',
      lastActive: 'Invited just now',
    };

    setStaff([newMember, ...staff]);
    setInviteModalOpen(false);
    setInviteName('');
    setInviteEmail('');
    setInvitePhone('');
  };

  const toggleDutyStatus = (id: string) => {
    setStaff((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          shiftStatus: s.shiftStatus === 'on_duty' ? 'off_duty' : 'on_duty',
        };
      })
    );
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar
        title="Staff & Permissions"
        onOpenNewReservation={() => setNewResOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-8 space-y-6 bg-white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-2xl font-serif font-normal text-[#191816]">
              Team & Staff Roster
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Manage team access, role-based permissions, and active operational shifts.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => setInviteModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Staff Member</span>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Total Staff</span>
            <div className="text-2xl font-serif text-[#191816] mt-1">{staff.length}</div>
            <p className="text-[11px] text-[#7A7267] mt-1">Active team accounts</p>
          </div>

          <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[11px] text-[#7A7267] uppercase font-semibold">On Duty Now</span>
            <div className="text-2xl font-serif text-[#191816] mt-1">{onDutyCount}</div>
            <p className="text-[11px] text-emerald-700 mt-1 font-medium">Active on property</p>
          </div>

          <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Front Desk Team</span>
            <div className="text-2xl font-serif text-[#191816] mt-1">
              {staff.filter((s) => s.department === 'Front Office').length}
            </div>
            <p className="text-[11px] text-[#7A7267] mt-1">Check-in & Guest arrivals</p>
          </div>

          <div className="p-4 rounded-lg border border-[#E8E2DA] bg-white">
            <span className="text-[11px] text-[#7A7267] uppercase font-semibold">Housekeeping</span>
            <div className="text-2xl font-serif text-[#191816] mt-1">
              {staff.filter((s) => s.department === 'Housekeeping').length}
            </div>
            <p className="text-[11px] text-[#7A7267] mt-1">Room turnovers & inspections</p>
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
            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {[
                  { id: 'all', label: 'All Departments' },
                  { id: 'Management', label: 'Management' },
                  { id: 'Front Office', label: 'Front Office' },
                  { id: 'Housekeeping', label: 'Housekeeping' },
                  { id: 'Accounting', label: 'Accounting' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDeptFilter(tab.id)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      deptFilter === tab.id
                        ? 'bg-[#191816] text-white'
                        : 'bg-[#FAFAFA] border border-[#E8E2DA] text-[#7A7267] hover:text-[#191816]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#7A7267]" />
                <input
                  type="text"
                  placeholder="Search staff name or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816] w-64 focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                />
              </div>
            </div>

            {/* Staff Table */}
            <div className="border border-[#E8E2DA] rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E8E2DA] text-[#7A7267] uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Role & Department</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Shift Status</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2DA]">
                  {filteredStaff.map((member) => {
                    const initials = member.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase();

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
                          {member.lastActive}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => toggleDutyStatus(member.id)}
                            className="text-xs font-medium text-[#B85C3E] hover:underline"
                          >
                            {member.shiftStatus === 'on_duty' ? 'Clock Out' : 'Clock In'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewTab === 'permissions' && (
          <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-hidden max-w-4xl">
            <div className="p-4 border-b border-[#E8E2DA] bg-[#FAFAFA]">
              <h3 className="text-sm font-semibold text-[#191816]">Access Control Matrix</h3>
              <p className="text-xs text-[#7A7267]">Granular role permissions enforcing operational security.</p>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFAFA] border-b border-[#E8E2DA] text-[#7A7267] uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Platform Module</th>
                  <th className="py-3 px-4 text-center">Owner / GM</th>
                  <th className="py-3 px-4 text-center">Front Desk Lead</th>
                  <th className="py-3 px-4 text-center">Housekeeper</th>
                  <th className="py-3 px-4 text-center">Accountant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2DA]">
                {[
                  { module: 'Reservations & Calendar', gm: true, front: true, hk: false, acc: true },
                  { module: 'Guest Check-in & Key Issuance', gm: true, front: true, hk: false, acc: false },
                  { module: 'Housekeeping Turnover Board', gm: true, front: true, hk: true, acc: false },
                  { module: 'Take Room In / Out of Service', gm: true, front: true, hk: true, acc: false },
                  { module: 'Payment Collection & POS', gm: true, front: true, hk: false, acc: true },
                  { module: 'Direct Website & CMS Editor', gm: true, front: false, hk: false, acc: false },
                  { module: 'Financial & Tax Reports', gm: true, front: false, hk: false, acc: true },
                  { module: 'Staff Management & Invites', gm: true, front: false, hk: false, acc: false },
                  { module: 'Property Settings & Payouts', gm: true, front: false, hk: false, acc: false },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-[#FAFAFA]/70">
                    <td className="py-3 px-4 font-medium text-[#191816]">{row.module}</td>
                    <td className="py-3 px-4 text-center">
                      {row.gm ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /> : <span className="text-stone-300">—</span>}
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
                  placeholder="samuel@stayconnect.ng"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
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
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                >
                  <option value="Front Desk Lead">Front Desk Lead</option>
                  <option value="Housekeeping Supervisor">Housekeeping Supervisor</option>
                  <option value="Room Attendant">Room Attendant</option>
                  <option value="Finance">Finance & Accounting</option>
                  <option value="General Manager">General Manager</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8E2DA]">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 rounded border border-[#E8E2DA] bg-white text-xs font-medium text-[#191816] hover:bg-[#FAFAFA]"
                >
                  Cancel
                </button>
                <Button type="submit" className="text-xs">
                  Send Invitation
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
