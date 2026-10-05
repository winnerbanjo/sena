import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import {
  db,
  reservations,
  guests,
  bookingGroups,
  propertyInvoices,
  reservationEvents,
  eq,
  and,
  inArray,
} from '@sena/database';

export const dynamic = 'force-dynamic';

async function handlePOST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const merchant = getMerchantRequest(req);
    const tenant = merchant?.tenant;
    const propertyId = tenant?.propertyId;
    if (!propertyId) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = merchant?.body || {};
    const newGuestId = String(body.guestId || '').trim();
    const reason = String(body.reason || '').trim();
    const updateBookingGroup = body.updateBookingGroup === true;

    if (!newGuestId) {
      return NextResponse.json({ error: 'Please select a guest to assign to this reservation.' }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: 'A reason for reassigning the guest is required.' }, { status: 400 });
    }

    const [res] = await db
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, id), eq(reservations.propertyId, propertyId)))
      .limit(1);

    if (!res) {
      return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
    }

    if (res.guestId === newGuestId) {
      return NextResponse.json({ error: 'This reservation is already assigned to the selected guest.' }, { status: 400 });
    }

    const [newGuest] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, newGuestId), eq(guests.propertyId, propertyId)))
      .limit(1);

    if (!newGuest) {
      return NextResponse.json({ error: 'Selected guest was not found in your property directory.' }, { status: 404 });
    }

    const [prevGuest] = await db
      .select({ fullName: guests.fullName })
      .from(guests)
      .where(eq(guests.id, res.guestId))
      .limit(1);

    const prevGuestName = prevGuest?.fullName || 'Previous Guest';
    const actorName = tenant.user.fullName || 'Staff';

    const result = await db.transaction(async (tx) => {
      // 1. Update reservation guest
      const [updatedReservation] = await tx
        .update(reservations)
        .set({
          guestId: newGuest.id,
          updatedAt: new Date(),
        })
        .where(eq(reservations.id, res.id))
        .returning();

      // 2. Optionally update booking group guest if part of a group
      if (updateBookingGroup && res.bookingGroupId) {
        await tx
          .update(bookingGroups)
          .set({ guestId: newGuest.id })
          .where(and(eq(bookingGroups.id, res.bookingGroupId), eq(bookingGroups.propertyId, propertyId)));
      }

      // 3. Synchronize open/draft invoices linked to this stay
      await tx
        .update(propertyInvoices)
        .set({
          guestId: newGuest.id,
          recipientName: newGuest.fullName,
          recipientEmail: newGuest.email || null,
          recipientPhone: newGuest.phone || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(propertyInvoices.reservationId, res.id),
            eq(propertyInvoices.propertyId, propertyId),
            inArray(propertyInvoices.status, ['draft', 'issued'])
          )
        );

      // 4. Audit trail entry
      const description = `Guest changed from ${prevGuestName} to ${newGuest.fullName}. Reason: ${reason}. Updated by ${actorName}.`;
      await tx.insert(reservationEvents).values({
        reservationId: res.id,
        actorId: tenant.userId,
        actorName,
        eventType: 'reservation_guest_reassigned',
        description,
        metadata: {
          previousGuest: { id: res.guestId, name: prevGuestName },
          newGuest: { id: newGuest.id, name: newGuest.fullName },
          reason,
          updateBookingGroup,
          actorName,
        },
      });

      return {
        reservation: updatedReservation,
        guest: newGuest,
        message: description,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const POST = withMerchant(handlePOST, 'reservation-reassign');
