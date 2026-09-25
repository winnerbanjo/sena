import * as React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWebsiteData } from '../../../lib/website-data';
import { Highlights } from '../../../components/public-site/Highlights';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default async function AboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getWebsiteData(slug);
  if (!data) return notFound();

  const { property, config } = data;

  return (
    <div className="py-10 sm:py-16 bg-[#FAF7F2] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="space-y-2 border-b border-[#E8E2DA] pb-6 text-center">
          <span className="text-[11px] font-mono tracking-widest uppercase text-[#B85C3E]">
            Our Story &amp; Philosophy
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif text-[#191816]">
            Welcome to {property.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#7A7267] max-w-xl mx-auto">
            {config.welcomeEyebrow || 'Hospitality, Simplified'}
          </p>
        </div>

        {/* Narrative & Photo */}
        <div className="bg-white rounded-2xl border border-[#E8E2DA] p-6 sm:p-10 space-y-6 shadow-2xs">
          <h2 className="font-serif text-2xl text-[#191816]">
            {config.welcomeTitle || 'Quiet Comfort, Thoughtfully Delivered'}
          </h2>

          <div className="prose prose-stone text-xs sm:text-sm text-[#5C564D] leading-relaxed space-y-4">
            <p>{config.aboutStory || config.welcomeBody}</p>
            <p>
              We believe great hospitality begins with the essentials: seamless check-in, pristine cleanliness,
              whisper-quiet air conditioning, and 24/7 power backup so you never have to think twice about basic comforts.
            </p>
          </div>

          {config.aboutImageUrl && (
            <div className="pt-2 rounded-xl overflow-hidden aspect-[16/9]">
              <img
                src={config.aboutImageUrl}
                alt={property.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Highlights */}
        <Highlights data={data} />

        {/* CTA */}
        <div className="text-center pt-4">
          <Link
            href={`/${slug}/rooms`}
            className="px-6 py-3 rounded text-xs font-semibold text-white bg-[#71382D] hover:bg-[#5A2C23] shadow-xs inline-flex items-center gap-2"
            style={{ borderRadius: 'var(--theme-radius, 6px)' }}
          >
            <span>Explore Our Residences</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
