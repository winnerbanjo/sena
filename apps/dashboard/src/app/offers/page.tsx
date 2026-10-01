'use client';
import { pageMain } from '../../components/design';
import Link from 'next/link';
import { Topbar } from '../../components/topbar';
import { useTranslations } from 'next-intl';
export default function OffersPage() {
  const t = useTranslations('offers');
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title={t('title')} />
      <main className={pageMain}>
        <section className="max-w-2xl rounded-lg border border-[#E8E2DA] bg-white p-6 space-y-4">
          <h2 className="text-2xl font-serif text-[#191816]">{t('heading')}</h2>
          <p className="text-sm text-[#7A7267]">{t('body')}</p>
          <Link href="/rooms" className="inline-flex min-h-11 items-center rounded bg-[#71382D] px-4 text-sm text-white">{t('viewRooms')}</Link>
        </section>
      </main>
    </div>
  );
}
