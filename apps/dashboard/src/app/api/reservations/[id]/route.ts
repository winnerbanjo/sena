import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { noteCountsByReservation } from '@/lib/reservation-notes';
import { NextRequest, NextResponse } from 'next/server';
import { updateStay } from '@sena/reservations';
import { and, desc, eq } from 'drizzle-orm';
import { db, reservations, guests, rooms, roomTypes, apartments, reservationEvents, transferProofs } from '@sena/database';

async function handleGET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const merchant = getMerchantRequest(req);
    const propertyId = merchant?.tenant.propertyId;
    if (!propertyId || !merchant) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }
    const { id } = await context.params;

    const [reservation] = await db
      .select({
        id: reservations.id,
        reference: reservations.reference,
        status: reservations.status,
        paymentStatus: reservations.paymentStatus,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
        nights: reservations.nights,
        numGuests: reservations.numGuests,
        source: reservations.source,
        totalAmountMinorUnits: reservations.totalAmountMinorUnits,
        paidAmountMinorUnits: reservations.paidAmountMinorUnits,
        createdAt: reservations.createdAt,
        guestId: reservations.guestId,
        guestName: guests.fullName,
        guestEmail: guests.email,
        guestPhone: guests.phone,
        roomId: reservations.roomId,
        roomNumber: rooms.roomNumber,
        bookingGroupId: reservations.bookingGroupId,
        roomTypeId: reservations.roomTypeId,
        roomTypeName: roomTypes.name,
        apartmentId: reservations.apartmentId,
        apartmentName: apartments.name,
      })
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .leftJoin(rooms, eq(reservations.roomId, rooms.id))
      .leftJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
      .leftJoin(apartments, eq(reservations.apartmentId, apartments.id))
      .where(and(eq(reservations.id, id), eq(reservations.propertyId, propertyId)))
      .limit(1);

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    const [events, pendingProofs, noteCounts] = await Promise.all([
      db
        .select()
        .from(reservationEvents)
        .where(eq(reservationEvents.reservationId, reservation.id))
        .orderBy(desc(reservationEvents.createdAt)),
      db
        .select({ id: transferProofs.id })
        .from(transferProofs)
        .where(and(
          eq(transferProofs.reservationId, reservation.id),
          eq(transferProofs.propertyId, propertyId),
          eq(transferProofs.status, 'pending')
        ))
        .limit(1),
      noteCountsByReservation(propertyId, [reservation.id]),
    ]);

    const timezone = merchant.tenant.property.timezone;
    const timeline = events.map((event) => ({
      time: new Date(event.createdAt).toLocaleString('en-GB', { timeZone: timezone, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      text: event.description,
      actor: event.actorName || 'System',
    }));

    return NextResponse.json({
      reservation: {
        ...reservation,
        noteCount: noteCounts.get(reservation.id) || 0,
        pendingTransferProof: pendingProofs.length > 0,
        timeline,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const merchant = getMerchantRequest(req);
    const propertyId = merchant?.tenant.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    const { id } = await context.params;
    const body = merchant?.body || {};
    const preview = body.preview === true;
    const result = await updateStay(
      id,
      propertyId,
      {
        checkInDate: String(body.checkInDate || ''),
        checkOutDate: String(body.checkOutDate || ''),
        numGuests: Number(body.numGuests || 1),
        roomId: typeof body.roomId === 'string' ? body.roomId : body.roomId === null ? null : undefined,
        accommodationType: (body.accommodationType === 'room' || body.accommodationType === 'apartment') ? body.accommodationType : undefined,
        roomTypeId: typeof body.roomTypeId === 'string' ? body.roomTypeId : body.roomTypeId === null ? null : undefined,
        apartmentId: typeof body.apartmentId === 'string' ? body.apartmentId : body.apartmentId === null ? null : undefined,
        extensionAmountMinorUnits: body.extensionAmountMinorUnits == null ? null : Number(body.extensionAmountMinorUnits),
        adjustmentAmountMinorUnits: body.adjustmentAmountMinorUnits == null ? null : Number(body.adjustmentAmountMinorUnits),
        customTotalAmountMinorUnits: body.customTotalAmountMinorUnits == null ? null : Number(body.customTotalAmountMinorUnits),
        discountAmountMinorUnits: body.discountAmountMinorUnits == null ? null : Number(body.discountAmountMinorUnits),
        extensionReason: typeof body.extensionReason === 'string' ? body.extensionReason : null,
      },
      {
        id: merchant?.session?.user?.id || '',
        name: merchant?.tenant.user.fullName || 'Front Desk Staff',
      },
      preview,
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');
export const PATCH = withMerchant(handlePATCH, 'reservations');
