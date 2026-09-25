import * as React from 'react';
import { notFound } from 'next/navigation';
import { getWebsiteData } from '../../lib/website-data';
import { ThemeProvider } from '../../lib/theme-provider';
import { Header } from '../../components/public-site/Header';
import { Footer } from '../../components/public-site/Footer';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getWebsiteData(slug);
  if (!data) return { title: 'Hotel Website — Sena' };

  return {
    title: data.config.seoTitle || `${data.property.name} | Direct Stays`,
    description: data.config.seoDescription || `Book directly with ${data.property.name}.`,
    openGraph: {
      title: data.config.seoTitle || data.property.name,
      description: data.config.seoDescription || undefined,
      images: data.config.seoOgImage ? [{ url: data.config.seoOgImage }] : undefined,
    },
  };
}

export default async function TenantSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getWebsiteData(slug);

  if (!data) {
    return notFound();
  }

  return (
    <ThemeProvider config={data.config}>
      <div className="flex flex-col min-h-screen justify-between bg-white">
        <Header data={data} />
        <main className="flex-1">{children}</main>
        <Footer data={data} />
      </div>
    </ThemeProvider>
  );
}
