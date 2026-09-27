import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, properties, reservations } from '@sena/database';

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference') || '';
  const slug = req.nextUrl.searchParams.get('slug') || '';
  if (!/^SEN-[A-Z0-9]{4,12}$/.test(reference) || !/^[a-z0-9-]{2,80}$/.test(slug)) {
    return NextResponse.json({ error: 'This booking is unavailable.' }, { status: 404 });
  }

  const property = await db.query.properties.findFirst({ where: eq(properties.slug, slug) });
  if (!property) return NextResponse.json({ error: 'This booking is unavailable.' }, { status: 404 });

  const reservation = await db.query.reservations.findFirst({
    where: and(eq(reservations.reference, reference), eq(reservations.propertyId, property.id)),
  });
  if (!reservation) return NextResponse.json({ error: 'This booking is unavailable.' }, { status: 404 });

  const outstanding = Math.max(0, reservation.totalAmountMinorUnits - reservation.paidAmountMinorUnits);
  return NextResponse.json({
    reference: reservation.reference,
    propertyName: property.name,
    paymentStatus: reservation.paymentStatus,
    totalAmountMinorUnits: reservation.totalAmountMinorUnits,
    paidAmountMinorUnits: reservation.paidAmountMinorUnits,
    outstandingMinorUnits: outstanding,
    currency: property.currency,
  });
}
