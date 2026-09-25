'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Star,
  ShieldCheck,
  ArrowRight,
  MessageSquare,
  PenLine,
  X,
  CheckCircle2,
  Sparkles,
  Filter,
} from 'lucide-react';
import type { WebsiteData } from '../../lib/website-data';

interface ReviewItem {
  id: string;
  guestName: string;
  rating: number;
  title?: string | null;
  body: string;
  source: string;
  isVerifiedStay: boolean;
  submittedAt: string | Date;
  response?: string | null;
}

const RATING_SENTIMENTS: Record<number, string> = {
  5: 'Exceptional — exceeded expectations',
  4: 'Very Good — highly recommended',
  3: 'Good — pleasant stay',
  2: 'Fair — room for improvement',
  1: 'Poor — needs attention',
};

export function ReviewsClientView({
  data,
  basePath,
}: {
  data: WebsiteData;
  basePath: string;
}) {
  const searchParams = useSearchParams();
  const shouldOpenWrite = searchParams?.get('write') === 'true';

  const { property, reviews } = data;
  const initialItems: ReviewItem[] = (reviews.items || []).map((r) => ({
    id: r.id,
    guestName: r.guestName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    source: r.source,
    isVerifiedStay: Boolean(r.isVerifiedStay),
    submittedAt: r.submittedAt,
    response: r.response,
  }));

  const [items, setItems] = React.useState<ReviewItem[]>(initialItems);
  const [filter, setFilter] = React.useState<'all' | 'verified' | '5star' | '4star'>('all');
  const [modalOpen, setModalOpen] = React.useState<boolean>(shouldOpenWrite);

  // Form state
  const [rating, setRating] = React.useState<number>(5);
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);
  const [guestName, setGuestName] = React.useState<string>('');
  const [bookingReference, setBookingReference] = React.useState<string>('');
  const [title, setTitle] = React.useState<string>('');
  const [body, setBody] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Reset form
  const handleOpenModal = () => {
    setRating(5);
    setHoverRating(null);
    setGuestName('');
    setBookingReference('');
    setTitle('');
    setBody('');
    setErrorMessage(null);
    setSubmitSuccess(false);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSubmitSuccess(false);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !body.trim()) {
      setErrorMessage('Please provide your name and review message.');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: property.slug,
          guestName: guestName.trim(),
          rating,
          title: title.trim() || undefined,
          body: body.trim(),
          bookingReference: bookingReference.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.review) {
        const newRev = resData.review;
        const mappedNew: ReviewItem = {
          id: newRev.id,
          guestName: newRev.guestName,
          rating: newRev.rating,
          title: newRev.title,
          body: newRev.body,
          source: newRev.source,
          isVerifiedStay: Boolean(newRev.isVerifiedStay),
          submittedAt: newRev.submittedAt,
          response: null,
        };
        setItems((prev) => [mappedNew, ...prev]);
        setSubmitSuccess(true);
      } else {
        setErrorMessage(resData.error || 'Failed to submit review. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error submitting review.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter((rev) => {
    if (filter === 'verified') return rev.isVerifiedStay;
    if (filter === '5star') return rev.rating === 5;
    if (filter === '4star') return rev.rating === 4;
    return true;
  });

  const activeRating = hoverRating || rating;

  return (
    <div className="py-10 sm:py-16 bg-[#FAF7F2] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header & Rating Summary */}
        <div className="border-b border-[#E8E2DA] pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#B85C3E] block">
              {property.name} Verified Feedback
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#191816]">
              Guest Reviews &amp; Ratings
            </h1>
            <p className="text-xs sm:text-sm text-[#7A7267] max-w-xl">
              Authentic feedback from guests who have stayed with us. Share your own experience to guide fellow travelers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="p-4 rounded-xl bg-white border border-[#E8E2DA] flex items-center gap-3.5 shadow-2xs">
              <span className="text-3xl font-serif font-bold text-[#71382D]">
                {reviews.averageRating}
              </span>
              <div>
                <div className="flex text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <span className="text-xs text-[#7A7267] block mt-0.5">
                  Based on {items.length} {items.length === 1 ? 'review' : 'reviews'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenModal}
              className="px-5 py-3 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              style={{
                borderRadius: 'var(--theme-radius, 8px)',
                backgroundColor: 'var(--theme-primary, #71382D)',
              }}
            >
              <PenLine className="w-4 h-4" />
              <span>Write a Review</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-[#7A7267] font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            {[
              { id: 'all', label: `All (${items.length})` },
              { id: 'verified', label: `Verified Stays (${items.filter((i) => i.isVerifiedStay).length})` },
              { id: '5star', label: `5 Stars (${items.filter((i) => i.rating === 5).length})` },
              { id: '4star', label: `4 Stars (${items.filter((i) => i.rating === 4).length})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === f.id
                    ? 'bg-[#71382D] text-white shadow-2xs'
                    : 'bg-white text-[#7A7267] border border-[#E8E2DA] hover:text-[#191816]'
                }`}
                style={{
                  backgroundColor: filter === f.id ? 'var(--theme-primary, #71382D)' : undefined,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="text-xs font-mono text-[#8C8275]">
            Showing {filteredItems.length} of {items.length} reviews
          </span>
        </div>

        {/* Reviews List */}
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-[#E8E2DA] space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#FAF7F2] text-[#71382D] mx-auto flex items-center justify-center border border-[#E8DACB]">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="font-serif text-lg text-[#191816]">No reviews matching this filter</p>
            <p className="text-xs text-[#7A7267] max-w-sm mx-auto">
              Be the first to share your thoughts on your stay at {property.name}.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenModal}
                className="px-4 py-2 rounded-lg bg-[#71382D] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>Write the First Review</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((rev) => (
              <div
                key={rev.id}
                className="p-6 rounded-xl border border-[#E8E2DA] bg-white space-y-3 shadow-2xs hover:shadow-xs transition-shadow"
                style={{ borderRadius: 'var(--theme-radius, 10px)' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FAF0E6] text-[#71382D] border border-[#E8DACB] flex items-center justify-center font-serif text-xs font-semibold">
                      {rev.guestName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <strong className="text-sm font-semibold text-[#191816] block">
                        {rev.guestName}
                      </strong>
                    </div>
                    {rev.isVerifiedStay ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#2E6B4F] bg-[#EBF5ED] px-2 py-0.5 rounded-full border border-[#D1EADB]">
                        <ShieldCheck className="w-3 h-3" /> Verified Stay
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-mono text-[#7A7267] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E8E2DA]">
                        {rev.source === 'direct_stay' ? 'Direct Stay' : rev.source}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex text-amber-500">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <span className="text-xs text-[#7A7267] font-mono">
                      {new Date(rev.submittedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {rev.title && (
                  <h3 className="font-serif text-base font-semibold text-[#191816]">
                    &ldquo;{rev.title}&rdquo;
                  </h3>
                )}

                <p className="text-xs sm:text-sm text-[#5C564D] leading-relaxed italic">
                  &ldquo;{rev.body}&rdquo;
                </p>

                {rev.response && (
                  <div className="mt-3 p-3.5 rounded-lg bg-[#FAF7F2] border border-[#E8E2DA] text-xs space-y-1">
                    <span className="font-medium text-[#71382D] block flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Response from {property.name}:</span>
                    </span>
                    <p className="text-[#5C564D] italic pl-5">{rev.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CTA to Book */}
        <div className="p-8 sm:p-10 rounded-2xl bg-[#71382D] text-white text-center space-y-3 shadow-md"
             style={{ backgroundColor: 'var(--theme-primary, #71382D)' }}>
          <h2 className="font-serif text-2xl sm:text-3xl font-normal">Ready to Experience It Yourself?</h2>
          <p className="text-xs sm:text-sm text-stone-200 max-w-md mx-auto">
            Book directly on our official website for the guaranteed best available rate and priority privileges.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href={`${basePath}/rooms`}
              className="px-6 py-3 rounded text-xs font-semibold text-[#71382D] bg-white hover:bg-stone-100 shadow-md inline-flex items-center gap-1.5 transition-all"
              style={{ borderRadius: 'var(--theme-radius, 6px)' }}
            >
              <span>Reserve Your Stay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={handleOpenModal}
              className="px-5 py-3 rounded text-xs font-semibold text-white border border-white/40 hover:bg-white/10 transition-colors inline-flex items-center gap-1.5"
              style={{ borderRadius: 'var(--theme-radius, 6px)' }}
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Leave a Review</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Write Review Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl border border-[#E8E2DA] max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto"
            style={{ borderRadius: 'var(--theme-radius, 16px)' }}
          >
            {submitSuccess ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif text-2xl text-[#191816]">Thank You For Your Review!</h3>
                  <p className="text-xs text-[#7A7267] max-w-sm mx-auto leading-relaxed">
                    Your feedback for <strong className="text-[#191816]">{property.name}</strong> has been received and added to our guest showcase.
                  </p>
                </div>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-2.5 rounded-lg bg-[#71382D] text-white text-xs font-semibold hover:bg-[#5A2C23] transition-colors"
                  >
                    View on Page
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-[#E8E2DA] pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-xl text-[#191816]">
                      Leave a Guest Review
                    </h3>
                    <p className="text-xs text-[#7A7267] mt-0.5">
                      Share your experience at {property.name}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="p-1 rounded-md text-[#7A7267] hover:text-[#191816] hover:bg-[#FAF7F2] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
                  {errorMessage && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      {errorMessage}
                    </div>
                  )}

                  {/* Interactive Star Rating */}
                  <div className="space-y-1.5 text-center p-4 rounded-xl bg-[#FAF7F2] border border-[#E8DACB]">
                    <label className="block text-xs font-semibold text-[#191816]">
                      Your Rating *
                    </label>
                    <div className="flex items-center justify-center gap-2 py-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          className="p-1 hover:scale-125 transition-transform cursor-pointer"
                        >
                          <Star
                            className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                              star <= activeRating
                                ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                                : 'text-stone-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] font-medium text-[#71382D] h-4">
                      {RATING_SENTIMENTS[activeRating]}
                    </p>
                  </div>

                  {/* Guest Name */}
                  <div>
                    <label className="block font-medium text-[#191816] mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      placeholder="e.g. Dr. Adebayo Oladipo"
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D] bg-white text-xs"
                    />
                  </div>

                  {/* Optional Booking Reference */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-medium text-[#191816]">
                        Booking Reference (Optional)
                      </label>
                      <span className="text-[10px] text-emerald-700 font-mono flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Gives Verified Stay Badge
                      </span>
                    </div>
                    <input
                      type="text"
                      value={bookingReference}
                      placeholder="e.g. SEN-EQ6DK3"
                      onChange={(e) => setBookingReference(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DA] font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[#71382D] bg-white text-xs"
                    />
                    <p className="text-[10px] text-[#A39B90] mt-1">
                      Found in your booking confirmation email or folio.
                    </p>
                  </div>

                  {/* Review Title */}
                  <div>
                    <label className="block font-medium text-[#191816] mb-1">
                      Review Title / Headline
                    </label>
                    <input
                      type="text"
                      value={title}
                      placeholder="e.g. Exceptional comfort, whisper-quiet AC and lovely staff"
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D] bg-white text-xs"
                    />
                  </div>

                  {/* Review Body */}
                  <div>
                    <label className="block font-medium text-[#191816] mb-1">
                      Your Feedback / Review *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={body}
                      placeholder="Share details of your experience: room comfort, quietness, Wi-Fi speed, breakfast, service..."
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D] bg-white text-xs leading-relaxed"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-[#E8E2DA]">
                    <button
                      type="submit"
                      disabled={submitting || !guestName.trim() || !body.trim()}
                      className="flex-1 py-3 px-4 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      style={{ backgroundColor: 'var(--theme-primary, #71382D)' }}
                    >
                      {submitting ? 'Submitting Review...' : 'Submit Guest Review'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-3 rounded-lg border border-[#E8E2DA] text-xs text-[#7A7267] hover:bg-[#FAF7F2] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
