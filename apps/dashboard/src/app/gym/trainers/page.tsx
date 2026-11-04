'use client';

import * as React from 'react';
import { Topbar } from '../../../components/topbar';
import { pageMain, pageStack } from '../../../components/design';
import { useToast } from '../../../components/toast-notification';
import { Plus, Phone, Mail, Award, UserCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@sena/ui';
import { PageLoadState } from '../../../components/page-load-state';

export default function GymTrainersPage() {
  const toast = useToast();
  const [trainers, setTrainers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form inputs
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [specializationsText, setSpecializationsText] = React.useState('');
  const [hourlyRate, setHourlyRate] = React.useState('5000');
  const [bio, setBio] = React.useState('');

  const fetchTrainers = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/gym/trainers');
      if (!res.ok) throw new Error('Failed to load trainers');
      const data = await res.json();
      setTrainers(data.trainers || []);
    } catch (err: any) {
      setLoadError(true);
      toast.error('Trainers', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      toast.error('Validation', 'Name and phone are required');
      return;
    }

    setSubmitting(true);
    try {
      const specs = specializationsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/gym/trainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          specializations: specs,
          hourlyRateMinorUnits: (Number(hourlyRate) || 0) * 100,
          bio: bio.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add trainer');

      toast.success('Trainer Added', `${data.trainer.fullName} added to gym staff`);
      setAddOpen(false);
      setFullName('');
      setPhone('');
      setEmail('');
      setSpecializationsText('');
      setBio('');
      fetchTrainers();
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && trainers.length === 0) {
    return <PageLoadState title="Trainers" failed={loadError} failureKind="error" retry={fetchTrainers} />;
  }

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Trainers" />

      <main className={pageMain + ' max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6'}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-serif text-[#71382D]">Trainers & Fitness Instructors</h1>
            <p className="text-xs text-[#7A7267] mt-0.5">
              Personal trainers, class instructors, specializations, and booking rates.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Trainer</span>
          </button>
        </div>

        {/* Trainers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {trainers.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-[#7A7267] bg-white rounded-xl border border-[#E8E1D5]">
              No trainers registered yet. Click &ldquo;Add Trainer&rdquo; to roster your personal training staff.
            </div>
          ) : (
            trainers.map((t) => (
              <div key={t.id} className="p-5 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#FAF4EF] border border-[#E5D4BC] flex items-center justify-center font-serif text-[#71382D] font-bold">
                      {t.fullName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-base font-serif text-[#191816] font-semibold">{t.fullName}</h2>
                      <span className="text-[11px] font-mono text-[#8C8275]">
                        ₦{(t.hourlyRateMinorUnits / 100).toLocaleString()} / session
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {t.status}
                  </span>
                </div>

                {t.bio && <p className="text-xs text-[#7A7267] line-clamp-2">{t.bio}</p>}

                {t.specializations && t.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.specializations.map((spec: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#FAF7F2] text-[#71382D] border border-[#E8E1D5]"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-[#E8E1D5] space-y-1 text-xs text-[#7A7267]">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#8C8275]" />
                    <span className="font-mono">{t.phone}</span>
                  </div>
                  {t.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#8C8275]" />
                      <span>{t.email}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Add Trainer Dialog */}
      {addOpen && (
        <Dialog open={true} onOpenChange={() => setAddOpen(false)}>
          <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif text-[#71382D]">Add Fitness Trainer</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAdd} className="space-y-4 pt-2 text-xs">
              <div>
                <label className="block font-semibold text-[#191816] mb-1">
                  Full Name <span className="text-[#B85C3E]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Adeleke"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">
                    Phone <span className="text-[#B85C3E]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+234..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Hourly Rate (₦)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="5000"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#191816] mb-1">Email</label>
                <input
                  type="email"
                  placeholder="trainer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#191816] mb-1">
                  Specializations (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. HIIT, Bodybuilding, Calisthenics, Boxing"
                  value={specializationsText}
                  onChange={(e) => setSpecializationsText(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#191816] mb-1">Short Bio</label>
                <textarea
                  rows={2}
                  placeholder="Certified strength and conditioning coach with 6+ years experience..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E1D5] text-xs font-medium text-[#191816]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs"
                >
                  {submitting ? 'Saving…' : 'Add Trainer'}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
