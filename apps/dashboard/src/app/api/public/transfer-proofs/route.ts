import { apiError } from '@/lib/api-error';
import { NextRequest, NextResponse } from 'next/server';
import { db, guests, properties, reservations, and, eq } from '@sena/database';
import { PaymentService } from '@sena/payments';
import { uploadMediaToSpaces } from '@sena/integrations';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let propertyId = '';
    let reservationReference = '';
    let guestEmail = '';
    let amountMinorUnits = 0;
    let payerName = '';
    let transferReference = '';
    let proofUrl = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      propertyId = String(form.get('propertyId') || '');
      reservationReference = String(form.get('reservationReference') || '');
      guestEmail = String(form.get('guestEmail') || '').toLowerCase().trim();
      amountMinorUnits = Math.round(Number(form.get('amountMinorUnits') || 0));
      payerName = String(form.get('payerName') || '');
      transferReference = String(form.get('transferReference') || '');
      const file = form.get('file');
      if (file instanceof File) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024) {
          return NextResponse.json({ error: 'Upload a JPG, PNG, WebP, or PDF smaller than 10 MB.' }, { status: 422 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const extension = file.name.split('.').pop() || 'jpg';
        const uploaded = await uploadMediaToSpaces({
          key: `transfer-proofs/${propertyId}/${reservationReference}-${Date.now()}.${extension}`,
          body: buffer,
          contentType: file.type || 'image/jpeg',
          acl: 'private',
        });
        proofUrl = uploaded.url;
      }
    } else {
      const body = await req.json();
      propertyId = String(body.propertyId || '');
      reservationReference = String(body.reservationReference || '');
      guestEmail = String(body.guestEmail || '').toLowerCase().trim();
      amountMinorUnits = Number(body.amountMinorUnits);
      payerName = String(body.payerName || '');
      transferReference = String(body.transferReference || '');
      proofUrl = String(body.proofUrl || '');
    }

    if (!propertyId || !reservationReference || !guestEmail) {
      return NextResponse.json({ error: 'Enter the reservation reference and guest email.' }, { status: 400 });
    }

    const accounts = await PaymentService.listPublicBankAccounts(propertyId);
    if (accounts.length === 0) {
      return NextResponse.json({ error: 'Bank transfer is not available.' }, { status: 400 });
    }

    const [reservation] = await db
      .select()
      .from(reservations)
      .where(and(eq(reservations.propertyId, propertyId), eq(reservations.reference, reservationReference)))
      .limit(1);
    if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    const guest = await db.query.guests.findFirst({ where: eq(guests.id, reservation.guestId) });
    if (!guest || guest.email.toLowerCase() !== guestEmail) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }
    if (!proofUrl) return NextResponse.json({ error: 'Upload proof of transfer.' }, { status: 400 });

    const proof = await PaymentService.submitTransferProof(
      {
        propertyId,
        reservationId: reservation.id,
        amountMinorUnits,
        payerName: payerName || guest.fullName,
        transferReference,
        proofUrl,
      },
      { id: '', name: guest.fullName }
    );

    return NextResponse.json({
      success: true,
      status: proof.status,
      message: 'Proof received. The hotel will verify this transfer before marking the stay paid.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}
