import * as React from 'react';
import { notFound } from 'next/navigation';
import { getWebsiteData } from '../../lib/website-data';
import { Hero } from '../../components/public-site/Hero';
import { BookingBar } from '../../components/public-site/BookingBar';
import { PropertyIntro } from '../../components/public-site/PropertyIntro';
import { FeaturedRooms } from '../../components/public-site/FeaturedRooms';
import { Highlights } from '../../components/public-site/Highlights';
import { GallerySection } from '../../components/public-site/GallerySection';
import { AmenitiesSection } from '../../components/public-site/AmenitiesSection';
import { ReviewsSection } from '../../components/public-site/ReviewsSection';
import { LocationSection } from '../../components/public-site/LocationSection';

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getWebsiteData(slug);

  if (!data) {
    return notFound();
  }

  const { config } = data;
  const sec = config.enabledSections || {};

  return (
    <div className="flex flex-col w-full">
      {sec.hero !== false && <Hero data={data} />}
      {sec.booking !== false && <BookingBar data={data} />}
      {sec.intro !== false && <PropertyIntro data={data} />}
      {sec.rooms !== false && <FeaturedRooms data={data} />}
      {sec.highlights !== false && <Highlights data={data} />}
      {sec.gallery !== false && <GallerySection data={data} />}
      {sec.amenities !== false && <AmenitiesSection data={data} />}
      {sec.reviews !== false && <ReviewsSection data={data} />}
      {sec.location !== false && <LocationSection data={data} />}
    </div>
  );
}
