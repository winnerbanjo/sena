'use client';
import Link from 'next/link';
import { Topbar } from '../../components/topbar';
export default function OffersPage() {
  return <div className="flex-1 flex flex-col h-screen overflow-hidden"><Topbar title="Offers" /><main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"><section className="max-w-2xl rounded-lg border border-[#E8E2DA] bg-white p-6 space-y-4"><h2 className="text-2xl font-serif text-[#191816]">Offers — coming soon</h2><p className="text-sm text-[#7A7267]">Promotional codes are not yet applied to reservations. Your current room rates remain in effect.</p><p className="text-sm text-[#7A7267]">You can review and manage your room categories now.</p><Link href="/rooms" className="inline-flex min-h-11 items-center rounded bg-[#71382D] px-4 text-sm text-white">View rooms & categories</Link></section></main></div>;
}
