'use client';

import * as React from 'react';
import { StickyNote } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface ReservationNoteItem {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
}

export function NoteCount({ count, className }: { count?: number; className?: string }) {
  const t = useTranslations('reservations');
  if (!count) return null;
  return (
    <span className={className || 'inline-flex items-center gap-1 text-[11px] text-[#7A7267]'} title={t('internalNotes')}>
      <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{count}</span>
    </span>
  );
}

export function ReservationNotes({
  reservationId,
  onChanged,
}: {
  reservationId: string;
  onChanged?: () => void;
}) {
  const t = useTranslations('reservations');
  const [notes, setNotes] = React.useState<ReservationNoteItem[]>([]);
  const [body, setBody] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/reservations/${reservationId}/notes`)
      .then((response) => (response.ok ? response.json() : { notes: [] }))
      .then((data) => {
        if (!cancelled) setNotes(Array.isArray(data.notes) ? data.notes : []);
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      });
    return () => { cancelled = true; };
  }, [reservationId]);

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/reservations/${reservationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'The note could not be saved.');
      setNotes((current) => [...current, data.note]);
      setBody('');
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The note could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded border border-[#E8E2DA] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#191816]">{t('internalNotes')}</h3>
      <p className="mt-1 text-xs text-[#7A7267]">{t('internalOnly')}</p>
      <ol className="mt-3 space-y-3">
        {notes.length === 0 ? <li className="text-xs text-[#7A7267]">{t('noteEmpty')}</li> : null}
        {notes.map((note) => (
          <li key={note.id} className="border-t border-[#E8E2DA] pt-3 text-sm">
            <p className="whitespace-pre-wrap break-words text-[#191816]">{note.body}</p>
            <p className="mt-1 text-xs text-[#7A7267]">
              {note.authorName}
              <span aria-hidden="true"> · </span>
              <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time>
            </p>
          </li>
        ))}
      </ol>
      <form onSubmit={addNote} className="mt-4 space-y-2">
        <label className="block text-xs text-[#5c564e]" htmlFor={`note-${reservationId}`}>
          {t('addNote')}
          <textarea
            id={`note-${reservationId}`}
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t('notePlaceholder')}
            className="mt-1 w-full min-h-20 rounded border border-[#E8E2DA] px-3 py-2 text-sm text-[#191816]"
          />
        </label>
        {error ? <p role="alert" className="text-xs text-[#9E382A]">{error}</p> : null}
        <button type="submit" disabled={saving} className="min-h-11 rounded bg-[#191816] px-3 text-sm text-white">
          {t('addNote')}
        </button>
      </form>
    </section>
  );
}
