'use client';

import * as React from 'react';
import { Star, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SubmitReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [slug, setSlug] = React.useState('');
  const [token, setToken] = React.useState<string | null>(null);

  const [rating, setRating] = React.useState(5);
  const [guestName, setGuestName] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    Promise.all([params, searchParams]).then(([p, sp]) => {
      setSlug(p.slug);
      if (sp.token) setToken(sp.token);
    });
  }, [params, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName || !body) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          token,
          guestName,
          rating,
          title,
          body,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to submit review');
      }
    } catch {
      alert('Network error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="py-20 bg-[#FAF7F2] min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-emerald-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-2xl text-[#191816]">Thank You For Your Review</h2>
          <p className="text-xs text-[#7A7267] leading-relaxed">
            Your feedback has been received and verified. It helps other travelers make confident booking choices.
          </p>
          <div className="pt-2">
            <Link
              href={`/${slug}`}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded bg-[#71382D] text-white text-xs font-semibold"
            >
              <span>Return to Hotel Website</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-20 bg-[#FAF7F2] min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-[#E8E2DA] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="space-y-1 text-center">
          {token ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#2E6B4F] bg-[#EBF5ED] px-2.5 py-0.5 rounded-full border border-[#D1EADB] mb-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Stay Review
            </span>
          ) : (
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#B85C3E]">
              Guest Impressions
            </span>
          )}
          <h1 className="text-2xl font-serif text-[#191816]">How Was Your Stay?</h1>
          <p className="text-xs text-[#7A7267]">
            Please share your honest experience to guide fellow travelers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Star Rating Selector */}
          <div>
            <label className="block text-[#191816] font-medium mb-1.5 text-center">
              Your Overall Rating
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= rating ? 'text-amber-400 fill-amber-400' : 'text-stone-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[#191816] font-medium mb-1">Your Name *</label>
            <input
              type="text"
              required
              value={guestName}
              placeholder="e.g. Adeola Balogun"
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
            />
          </div>

          <div>
            <label className="block text-[#191816] font-medium mb-1">Review Headline (Optional)</label>
            <input
              type="text"
              value={title}
              placeholder="e.g. Quiet, serene retreat with superfast Wi-Fi"
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
            />
          </div>

          <div>
            <label className="block text-[#191816] font-medium mb-1">Your Review *</label>
            <textarea
              rows={4}
              required
              value={body}
              placeholder="Tell other travelers about the room quality, cleanliness, power reliability, and hospitality..."
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded text-white text-xs font-semibold bg-[#71382D] hover:bg-[#5A2C23] shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{submitting ? 'Submitting...' : 'Post Guest Review'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
