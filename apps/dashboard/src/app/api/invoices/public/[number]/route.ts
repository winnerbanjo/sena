import { apiError } from '@/lib/api-error';
import { NextRequest, NextResponse } from 'next/server';
import {
  db,
  propertyInvoices,
  properties,
  reservations,
  eq,
} from '@sena/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    const { number } = await params;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(number)) return NextResponse.json({ error: 'Please ask the property for a fresh invoice link.' }, { status: 404 });

    const invoice = await db.query.propertyInvoices.findFirst({
      where: eq(propertyInvoices.id, number),
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const prop = await db.query.properties.findFirst({
      where: eq(properties.id, invoice.propertyId),
    });

    let reservation = null;
    if (invoice.reservationId) {
      reservation = await db.query.reservations.findFirst({
        where: eq(reservations.id, invoice.reservationId),
      });
    }

    return NextResponse.json({
      invoice,
      property: {
        id: prop?.id,
        name: prop?.name,
        address: prop?.address,
        phone: prop?.phone,
        email: prop?.email,
      },
      reservation: reservation
        ? {
            reference: reservation.reference,
            checkInDate: reservation.checkInDate,
            checkOutDate: reservation.checkOutDate,
            nights: reservation.nights,
          }
        : null,
    });
  } catch (error: any) {
    console.error('[PUBLIC INVOICE GET ERROR]', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}
