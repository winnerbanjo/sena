import * as React from 'react';
import { notFound } from 'next/navigation';
import { getWebsiteData } from '../../../lib/website-data';
import { GallerySection } from '../../../components/public-site/GallerySection';

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getWebsiteData(slug);
  if (!data) return notFound();

  return (
    <div className="py-8 bg-[#FAF7F2] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="border-b border-[#E8E2DA] pb-4">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#B85C3E]">
            {data.property.name} Showcase
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#191816] mt-1">
            Photo Gallery
          </h1>
          <p className="text-xs sm:text-sm text-[#7A7267] mt-1">
            Explore our curated spaces, comfortable bedrooms, and tranquil surroundings.
          </p>
        </div>

        <GallerySection data={data} />
      </div>
    </div>
  );
}
