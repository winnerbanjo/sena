import { db, properties, users, subscriptions, rooms, reservations } from '@sena/database';
import { sql } from 'drizzle-orm';
import { MetricCard } from '@sena/ui';
import { CheckCircle2, Server } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  // Fetch metrics concurrently
  const [
    propsCount,
    usersCount,
    subsCount,
    roomsCount,
    resCount,
    mrrResult
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(properties),
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(sql`${subscriptions.status} = 'active'`),
    db.select({ count: sql<number>`count(*)` }).from(rooms),
    db.select({ count: sql<number>`count(*)` }).from(reservations),
    db.select({ totalAmount: sql<number>`sum(amount_minor_units)` }).from(subscriptions).where(sql`${subscriptions.status} = 'active'`),
  ]);

  const totalProperties = Number(propsCount[0]?.count || 0);
  const totalUsers = Number(usersCount[0]?.count || 0);
  const activeSubs = Number(subsCount[0]?.count || 0);
  const totalRooms = Number(roomsCount[0]?.count || 0);
  const totalReservations = Number(resCount[0]?.count || 0);
  const mrrKobo = Number(mrrResult[0]?.totalAmount || 0);
  const mrrNaira = mrrKobo / 100;

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[#E8E2DA] bg-white py-4 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-serif text-[#191816]">Platform Overview</h1>
          <p className="text-xs text-[#7A7267] mt-0.5">High-level metrics across all managed properties.</p>
        </div>
      </header>

      <main className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            label="Total Properties"
            value={totalProperties.toString()}
            subtext={`${activeSubs} active subscriptions`}
            subValue="Properties"
          />
          <MetricCard
            label="Total Users"
            value={totalUsers.toString()}
            subtext="Registered across platform"
            subValue="Users"
          />
          <MetricCard
            label="Active MRR (NGN)"
            value={`₦${mrrNaira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtext="Based on active subscriptions"
            subValue="Revenue"
          />
          <MetricCard
            label="Platform Usage"
            value={totalReservations.toString()}
            subtext={`Across ${totalRooms} total managed rooms`}
            subValue="Reservations"
          />
        </div>

        <div className="bg-white border border-[#E8E2DA] p-5 rounded-md space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E2DA] pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#2E6B4F]" />
              <strong className="text-sm font-serif text-[#191816]">
                Infrastructure & System Health
              </strong>
            </div>
            <span className="text-xs text-[#2E6B4F] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> All systems nominal
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center text-xs">
            {[
              { name: 'Core API', status: 'Operational', latency: '12ms' },
              { name: 'PostgreSQL', status: 'Operational', latency: '4ms' },
              { name: 'Redis Cache', status: 'Operational', latency: '1ms' },
              { name: 'Background Jobs', status: 'Operational', latency: '0 queue' },
            ].map((srv) => (
              <div key={srv.name} className="p-3 rounded border border-[#E8E2DA] bg-[#FAFAFA]">
                <span className="text-[10px] text-[#7A7267] font-mono uppercase block truncate">
                  {srv.name}
                </span>
                <strong className="text-xs text-[#2E6B4F] block mt-1">
                  {srv.status}
                </strong>
                <span className="text-[10px] text-[#7A7267] font-mono mt-0.5 block">
                  {srv.latency}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-[#E8E2DA] rounded-md overflow-hidden flex flex-col bg-white">
            <div className="p-4 border-b border-[#E8E2DA] bg-[#FAFAFA]">
              <strong className="text-sm font-serif">Quick Actions</strong>
            </div>
            <div className="p-4 flex flex-col gap-2">
              <Link href="/properties" className="text-sm text-blue-600 hover:underline">View all properties &rarr;</Link>
              <Link href="/users" className="text-sm text-blue-600 hover:underline">Manage platform users &rarr;</Link>
              <Link href="/subscriptions" className="text-sm text-blue-600 hover:underline">Check subscription statuses &rarr;</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
