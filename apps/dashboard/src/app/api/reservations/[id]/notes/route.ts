import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { addReservationNote, listReservationNotes, normalizeReservationNote } from '@/lib/reservation-notes';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Internal reservation notes are append-only.
 * Editing and deleting are not supported, so history cannot be silently erased.
 * These notes are staff-only and are not included on guest, invoice, or receipt payloads.
 */

async function handleGET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const merchant = getMerchantRequest(req);
    const { id } = await params;
    if (!merchant) return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    const notes = await listReservationNotes(merchant.tenant.propertyId, id);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error('[reservation-notes]', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const merchant = getMerchantRequest(req);
    const { id } = await params;
    if (!merchant) return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    const body = getMerchantRequest(req)?.body ?? {};
    const parsed = normalizeReservationNote(body.body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 });
    const note = await addReservationNote({
      propertyId: merchant.tenant.propertyId,
      reservationId: id,
      authorUserId: merchant.tenant.userId,
      authorName: merchant.tenant.user.fullName,
      body: parsed.body,
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('[reservation-notes]', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');
export const POST = withMerchant(handlePOST, 'reservations');
