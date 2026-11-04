'use client';

import * as React from 'react';
import { Topbar } from '../../../components/topbar';
import { pageMain, pageStack } from '../../../components/design';
import { useToast } from '../../../components/toast-notification';
import { Plus, Calendar, Clock, MapPin, User, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@sena/ui';
import { PageLoadState } from '../../../components/page-load-state';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function GymClassesPage() {
  const toast = useToast();
  const [classes, setClasses] = React.useState<any[]>([]);
  const [trainers, setTrainers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form inputs
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [trainerId, setTrainerId] = React.useState('');
  const [dayOfWeek, setDayOfWeek] = React.useState('1');
  const [startTime, setStartTime] = React.useState('07:00');
  const [durationMinutes, setDurationMinutes] = React.useState('60');
  const [capacity, setCapacity] = React.useState('20');
  const [locationRoom, setLocationRoom] = React.useState('Studio A');

  const fetchClasses = React.useCallback(async () => {
    setLoadError(false);
    try {
      const [resCls, resTrn] = await Promise.all([
        fetch('/api/gym/classes'),
        fetch('/api/gym/trainers'),
      ]);
      if (!resCls.ok) throw new Error('Failed to load classes');
      const dataCls = await resCls.json();
      setClasses(dataCls.classes || []);

      if (resTrn.ok) {
        const dataTrn = await resTrn.json();
        setTrainers(dataTrn.trainers || []);
      }
    } catch (err: any) {
      setLoadError(true);
      toast.error('Classes', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Validation', 'Class name is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/gym/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          trainerId: trainerId || null,
          dayOfWeek: Number(dayOfWeek),
          startTime,
          durationMinutes: Number(durationMinutes) || 60,
          capacity: Number(capacity) || 20,
          locationRoom: locationRoom.trim() || 'Studio A',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create class');

      toast.success('Class Scheduled', `${data.class.name} scheduled for ${DAYS[data.class.dayOfWeek]}`);
      setCreateOpen(false);
      setName('');
      setDescription('');
      fetchClasses();
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && classes.length === 0) {
    return <PageLoadState title="Classes & Schedule" failed={loadError} failureKind="error" retry={fetchClasses} />;
  }

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Classes & Schedule" />

      <main className={pageMain + ' max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6'}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-serif text-[#71382D]">Fitness Classes & Weekly Timetable</h1>
            <p className="text-xs text-[#7A7267] mt-0.5">
              Yoga, Spinning, HIIT, Boxing, and Strength training group sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule New Class</span>
          </button>
        </div>

        {/* Timetable Schedule Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-[#7A7267] bg-white rounded-xl border border-[#E8E1D5]">
              No scheduled classes yet. Click &ldquo;Schedule New Class&rdquo; to add your weekly group sessions.
            </div>
          ) : (
            classes.map((c) => (
              <div key={c.id} className="p-5 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#B85C3E] font-semibold bg-[#FAF4EF] px-2 py-0.5 rounded border border-[#E5D4BC]">
                      {DAYS[c.dayOfWeek]}s
                    </span>
                    <h2 className="text-base font-serif text-[#191816] font-semibold mt-1.5">{c.name}</h2>
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#71382D]">{c.startTime}</span>
                </div>

                {c.description && <p className="text-xs text-[#7A7267] line-clamp-2">{c.description}</p>}

                <div className="pt-3 border-t border-[#E8E1D5] space-y-1.5 text-xs text-[#555]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#8C8275]" />
                    <span>{c.durationMinutes} minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#8C8275]" />
                    <span>{c.locationRoom || 'Main Studio'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-[#8C8275]" />
                    <span>Trainer: {c.trainerName || 'Assigned Instructor'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[#8C8275]" />
                    <span>Capacity: {c.capacity} members</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Schedule Class Dialog */}
      {createOpen && (
        <Dialog open={true} onOpenChange={() => setCreateOpen(false)}>
          <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif text-[#71382D]">Schedule Fitness Class</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4 pt-2 text-xs">
              <div>
                <label className="block font-semibold text-[#191816] mb-1">
                  Class Name <span className="text-[#B85C3E]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HIIT Strength Bootcamp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Day of Week</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] bg-white focus:outline-none focus:border-[#71382D]"
                  >
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min="15"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
              </div>

              {trainers.length > 0 && (
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Lead Trainer</label>
                  <select
                    value={trainerId}
                    onChange={(e) => setTrainerId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] bg-white focus:outline-none focus:border-[#71382D]"
                  >
                    <option value="">Select Trainer</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#191816] mb-1">Room / Studio</label>
                <input
                  type="text"
                  placeholder="e.g. Studio A, Yoga Room"
                  value={locationRoom}
                  onChange={(e) => setLocationRoom(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E1D5] text-xs font-medium text-[#191816]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs"
                >
                  {submitting ? 'Saving…' : 'Schedule Class'}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
