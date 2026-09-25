import * as React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWebsiteData, getTenantBasePath } from '../../../../lib/website-data';
import { Star, ShieldCheck, ArrowRight, MessageSquare } from 'lucide-react';

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getWebsiteData(slug);
  if (!data) return notFound();

  const base = await getTenantBasePath(slug);
  const { property, reviews } = data;
  const items = reviews.items || [];

  return (
    <div className="py-10 sm:py-16 bg-[#FAF7F2] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="border-b border-[#E8E2DA] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#B85C3E]">
              {property.name} Verified Feedback
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#191816]">
              Guest Reviews &amp; Ratings
            </h1>
            <p className="text-xs sm:text-sm text-[#7A7267]">
              Unfiltered feedback from guests who have stayed with us.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E8E2DA] flex items-center gap-3 shadow-2xs">
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
                Based on {reviews.totalCount} reviews
              </span>
            </div>
          </div>
        </div>

        {/* Reviews List */}
        {items.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-dashed border-[#E8E2DA] space-y-2">
            <p className="font-serif text-lg text-[#71382D]">No published reviews yet</p>
            <p className="text-xs text-[#7A7267]">Reviews from verified guests will appear here as stays conclude.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((rev) => (
              <div
                key={rev.id}
                className="p-6 rounded-xl border border-[#E8E2DA] bg-white space-y-3 shadow-2xs"
                style={{ borderRadius: 'var(--theme-radius, 10px)' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <strong className="text-sm font-semibold text-[#191816]">
                      {rev.guestName}
                    </strong>
                    {rev.isVerifiedStay ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#2E6B4F] bg-[#EBF5ED] px-2 py-0.5 rounded-full border border-[#D1EADB]">
                        <ShieldCheck className="w-3 h-3" /> Verified Stay
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-mono text-[#7A7267] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E8E2DA]">
                        {rev.source}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex text-amber-500">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <span className="text-xs text-[#7A7267]">
                      {new Date(rev.submittedAt).toLocaleDateString()}
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
        <div className="p-8 rounded-2xl bg-[#71382D] text-white text-center space-y-3">
          <h2 className="font-serif text-2xl font-normal">Ready to Experience It Yourself?</h2>
          <p className="text-xs text-stone-200 max-w-md mx-auto">
            Book directly on our official website for the guaranteed best available rate.
          </p>
          <div className="pt-2">
            <Link
              href={`${base}/rooms`}
              className="px-6 py-3 rounded text-xs font-semibold text-[#71382D] bg-white hover:bg-stone-100 shadow-md inline-flex items-center gap-1.5"
              style={{ borderRadius: 'var(--theme-radius, 6px)' }}
            >
              <span>Reserve Your Stay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
