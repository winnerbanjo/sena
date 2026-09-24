import { NextRequest, NextResponse } from 'next/server';
import { db, reservations, properties, guests, roomTypes, eq } from '@sena/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get('ref');

    if (!ref) {
      return NextResponse.json({ error: 'Reservation reference is required' }, { status: 400 });
    }

    const resRecord = await db
      .select({
        id: reservations.id,
        reference: reservations.reference,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
        nights: reservations.nights,
        numGuests: reservations.numGuests,
        status: reservations.status,
        paymentStatus: reservations.paymentStatus,
        totalAmountMinorUnits: reservations.totalAmountMinorUnits,
        propertyName: properties.name,
        roomTypeName: roomTypes.name,
        guestName: guests.fullName,
        guestEmail: guests.email,
      })
      .from(reservations)
      .innerJoin(properties, eq(reservations.propertyId, properties.id))
      .innerJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
      .innerJoin(guests, eq(reservations.guestId, guests.id))
      .where(eq(reservations.reference, ref.toUpperCase().trim()))
      .limit(1);

    if (resRecord.length === 0) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    return NextResponse.json({ reservation: resRecord[0] });
  } catch (error: any) {
    console.error('Reservation lookup error:', error);
    return NextResponse.json({ error: error.message || 'Lookup failed' }, { status: 500 });
  }
}
