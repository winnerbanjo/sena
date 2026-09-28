import { apiError } from '@/lib/api-error';
import { folioBalance, settlementLabel } from '@/lib/financial-status';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, operationalNotifications, payments, reservations, guests, transferProofs } from '@sena/database';
import { PaymentService } from '@sena/payments';
import { sendPaymentReceiptEmail } from '@sena/email';
import { and, desc, eq, ne } from 'drizzle-orm';

import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const propertyId = getMerchantRequest(req)?.tenant.propertyId;

    if (!propertyId) {
      return NextResponse.json({ payments: [], receivables: [], transferProofs: [] });
    }

    const reservationId = req.nextUrl.searchParams.get('reservationId');

    const [paymentList, reservationRows, proofs] = await Promise.all([
      db
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
        .where(
          reservationId
            ? and(eq(payments.propertyId, propertyId), eq(payments.reservationId, reservationId))
            : eq(payments.propertyId, propertyId)
        )
        .orderBy(desc(payments.createdAt)),
      db
        .select({
          id: reservations.id,
          reference: reservations.reference,
          status: reservations.status,
          checkOutDate: reservations.checkOutDate,
          totalAmountMinorUnits: reservations.totalAmountMinorUnits,
          paidAmountMinorUnits: reservations.paidAmountMinorUnits,
          guestName: guests.fullName,
        })
        .from(reservations)
        .leftJoin(guests, eq(reservations.guestId, guests.id))
        .where(and(eq(reservations.propertyId, propertyId), ne(reservations.status, 'cancelled'))),
      db
        .select({
          id: transferProofs.id,
          amountMinorUnits: transferProofs.amountMinorUnits,
          currency: transferProofs.currency,
          payerName: transferProofs.payerName,
          transferReference: transferProofs.transferReference,
          proofUrl: transferProofs.proofUrl,
          status: transferProofs.status,
          submittedAt: transferProofs.submittedAt,
          reservationId: transferProofs.reservationId,
          invoiceId: transferProofs.invoiceId,
          reservationReference: reservations.reference,
          guestName: guests.fullName,
        })
        .from(transferProofs)
        .leftJoin(reservations, eq(transferProofs.reservationId, reservations.id))
        .leftJoin(guests, eq(reservations.guestId, guests.id))
        .where(eq(transferProofs.propertyId, propertyId))
        .orderBy(desc(transferProofs.submittedAt)),
    ]);

    const receivables = reservationRows
      .map((row) => {
        const outstanding = folioBalance(row.totalAmountMinorUnits, row.paidAmountMinorUnits);
        return {
          ...row,
          outstandingMinorUnits: outstanding,
          settlement: settlementLabel(row.status, row.totalAmountMinorUnits, row.paidAmountMinorUnits),
        };
      })
      .filter((row) => row.outstandingMinorUnits > 0)
      .sort((a, b) => b.outstandingMinorUnits - a.outstandingMinorUnits);

    return NextResponse.json({ payments: paymentList, receivables, transferProofs: proofs });
  } catch (error: any) {
    console.error('Payments API error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant?.propertyId || !body.reservationId) {
      return NextResponse.json({ error: 'Choose a reservation at this property.' }, { status: 400 });
    }
    const reservation = await db.query.reservations.findFirst({ where: eq(reservations.id, body.reservationId) });
    if (!reservation || reservation.propertyId !== tenant.propertyId) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }
    const allowedMethods = ['cash', 'pos', 'bank_transfer'];
    if (!allowedMethods.includes(body.method)) {
      return NextResponse.json({ error: 'Choose cash, POS, or bank transfer.' }, { status: 400 });
    }

    const idempotencyKey = req.headers.get('idempotency-key') || undefined;

    const actor = {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Staff Member',
    };

    const payment = await PaymentService.recordPayment(
      {
        reservationId: body.reservationId,
        amountMinorUnits: Number(body.amountMinorUnits),
        provider: 'manual',
        providerReference: body.providerReference || `MAN-${Date.now()}`,
        method: body.method || 'cash',
        notes: body.notes,
      },
      idempotencyKey,
      actor
    );

    await db.insert(operationalNotifications).values({
      propertyId: tenant.propertyId,
      dedupeKey: `manual:${payment.id}`,
      kind: 'payment',
      title: 'Payment received',
      body: 'A front-desk payment was recorded.',
      href: '/payments',
    }).onConflictDoNothing();

    try {
      const guest = await db.query.guests.findFirst({ where: eq(guests.id, reservation.guestId) });
      if (guest?.email && payment.providerReference) {
        await sendPaymentReceiptEmail({
          guestEmail: guest.email,
          guestName: guest.fullName,
          reference: reservation.reference,
          paymentReference: payment.providerReference,
          propertyName: tenant.property.name,
          amountFormatted: `${payment.currency} ${(payment.amountMinorUnits / 100).toFixed(2)}`,
          paymentMethod: payment.method,
          paidAt: new Date().toLocaleString('en-NG'),
        });
      }
    } catch (emailErr) {
      console.warn('[PAYMENT RECEIPT EMAIL]', emailErr);
    }

    return NextResponse.json({ success: true, payment });
  } catch (error: any) {
    console.error('Record payment error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'payments');

export const POST = withMerchant(handlePOST, 'payments');
