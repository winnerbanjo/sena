import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, payments, reservations, guests } from '@sena/database';
import { PaymentService } from '@sena/payments';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    let propertyId = (session?.user as any)?.propertyId;

    if (!propertyId) {
      const firstProp = await db.query.properties.findFirst();
      if (firstProp) propertyId = firstProp.id;
    }

    if (!propertyId) {
      return NextResponse.json({ payments: [] });
    }

    const paymentList = await db
      .select({
        id: payments.id,
        amountMinorUnits: payments.amountMinorUnits,
        currency: payments.currency,
        provider: payments.provider,
        providerReference: payments.providerReference,
        method: payments.method,
        status: payments.status,
        notes: payments.notes,
        createdAt: payments.createdAt,
        reservationId: payments.reservationId,
        reservationReference: reservations.reference,
        guestName: guests.fullName,
        guestEmail: guests.email,
      })
      .from(payments)
      .leftJoin(reservations, eq(payments.reservationId, reservations.id))
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .where(eq(payments.propertyId, propertyId))
      .orderBy(desc(payments.createdAt));

    return NextResponse.json({ payments: paymentList });
  } catch (error: any) {
    console.error('Payments API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      `pay_${body.reservationId}_${Date.now()}`;

    const actor = {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Staff Member',
    };

    const payment = await PaymentService.recordPayment(
      {
        reservationId: body.reservationId,
        amountMinorUnits: Number(body.amountMinorUnits),
        provider: body.provider || 'manual',
        providerReference: body.providerReference || `MAN-${Date.now()}`,
        method: body.method || 'cash',
        notes: body.notes,
      },
      idempotencyKey,
      actor
    );

    return NextResponse.json({ success: true, payment });
  } catch (error: any) {
    console.error('Record payment error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
