import * as React from 'react';
import { notFound } from 'next/navigation';
import { getWebsiteData, getTenantBasePath } from '../../../../lib/website-data';
import { ReviewsClientView } from '../../../../components/public-site/ReviewsClientView';

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getWebsiteData(slug);
  if (!data) return notFound();

  const base = await getTenantBasePath(slug);

  return <ReviewsClientView data={data} basePath={base} />;
}
