import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { PaymentService } from '@sena/payments';
import { db, guests, operationalNotifications, reservations, eq } from '@sena/database';
import { sendPaymentReceiptEmail } from '@sena/email';

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await resolveTenantForRequest(await auth(), req);
    if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const { id } = await params;
    const session = await auth();
    const actor = {
      id: session?.user?.id || '',
      name: session?.user?.name || 'Staff Member',
    };
    const payment = await PaymentService.verifyTransferProof(id, tenant.propertyId, actor);
    await db.insert(operationalNotifications).values({
      propertyId: tenant.propertyId,
      dedupeKey: `transfer:${payment.id}`,
      kind: 'payment',
      title: 'Bank transfer verified',
      body: 'A guest transfer proof was verified and recorded.',
      href: '/payments',
    }).onConflictDoNothing();
    try {
      if (payment.reservationId && payment.providerReference) {
        const reservation = await db.query.reservations.findFirst({
          where: eq(reservations.id, payment.reservationId),
        });
        const guest = reservation
          ? await db.query.guests.findFirst({ where: eq(guests.id, reservation.guestId) })
          : null;
        if (guest?.email && reservation) {
          await sendPaymentReceiptEmail({
            guestEmail: guest.email,
            guestName: guest.fullName,
            reference: reservation.reference,
            paymentReference: payment.providerReference,
            propertyName: tenant.property.name,
            amountFormatted: `${payment.currency} ${(payment.amountMinorUnits / 100).toFixed(2)}`,
            paymentMethod: 'bank_transfer',
            paidAt: new Date().toLocaleString('en-NG'),
          });
        }
      }
    } catch (emailErr) {
      console.warn('[TRANSFER RECEIPT EMAIL]', emailErr);
    }
    return NextResponse.json({ success: true, payment });
  } catch (error: any) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'payments');
