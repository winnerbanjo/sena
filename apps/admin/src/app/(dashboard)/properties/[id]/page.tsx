import { db, properties, rooms, reservations } from '@sena/database';
import { eq, sql, count } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { MetricCard, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Badge } from '@sena/ui';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const [property] = await db.select().from(properties).where(eq(properties.id, id));
  if (!property) return notFound();

  const [roomsCount] = await db.select({ count: count() as any }).from(rooms).where(eq(rooms.propertyId, id));
  const [resCount] = await db.select({ count: count() as any }).from(reservations).where(eq(reservations.propertyId, id));
  
  const recentReservations = await db.select()
    .from(reservations)
    .where(eq(reservations.propertyId, id))
    .orderBy(sql`${reservations.createdAt} desc`)
    .limit(5);

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[#E8E2DA] bg-white py-4 px-6">
        <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
          <Link href="/properties" className="hover:underline">Properties</Link> / <span>{property.id}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-serif text-[#191816] flex items-center gap-3">
              {property.name}
              <Badge variant="default">{property.code}</Badge>
            </h1>
            <p className="text-sm text-gray-600 mt-1">{property.address}, {property.country}</p>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard label="Total Rooms" value={String(roomsCount?.count || 0)} />
          <MetricCard label="Total Reservations" value={String(resCount?.count || 0)} />
          <MetricCard label="Type" value={property.propertyType} className="capitalize" />
        </div>

        <div className="bg-white border border-[#E8E2DA] rounded-md overflow-hidden">
          <div className="p-4 border-b border-[#E8E2DA] bg-[#FAFAFA]">
            <h3 className="font-serif text-sm font-medium">Recent Reservations</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Amount (₦)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentReservations.map((res) => (
                <TableRow key={res.id}>
                  <TableCell className="font-mono text-xs">{res.reference}</TableCell>
                  <TableCell><Badge variant="default">{res.status}</Badge></TableCell>
                  <TableCell className="text-sm">{res.checkInDate}</TableCell>
                  <TableCell className="text-sm">{res.checkOutDate}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {(res.totalAmountMinorUnits / 100).toLocaleString('en-NG')}
                  </TableCell>
                </TableRow>
              ))}
              {recentReservations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-gray-500 text-sm">
                    No reservations found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
