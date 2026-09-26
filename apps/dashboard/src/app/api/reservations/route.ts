import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { eq, desc, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, reservations, guests, rooms, roomTypes, properties, reservationEvents , propertyMembers, organizationMembers } from '@sena/database';
import { ReservationService } from '@sena/reservations';
import { sendBookingConfirmationEmail, sendSenaEmail } from '@sena/email';
import { formatNaira } from '@sena/config';
import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ reservations: [] });
    }

    const resList = await db
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
        roomTypeId: reservations.roomTypeId,
        roomTypeName: roomTypes.name,
      })
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .leftJoin(rooms, eq(reservations.roomId, rooms.id))
      .leftJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
      .where(eq(reservations.propertyId, propertyId))
      .orderBy(desc(reservations.createdAt));

    const allEvents = resList.length ? await db.select().from(reservationEvents).where(inArray(reservationEvents.reservationId, resList.map(reservation => reservation.id))).orderBy(desc(reservationEvents.createdAt)) : [];
    const eventsByReservation = new Map<string, Array<{ time: string; text: string; actor: string }>>();
    for (const event of allEvents) {
      const events = eventsByReservation.get(event.reservationId) || [];
      events.push({ time: new Date(event.createdAt).toLocaleString('en-GB', { timeZone: tenant!.property.timezone, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), text: event.description, actor: event.actorName || 'System' });
      eventsByReservation.set(event.reservationId, events);
    }
    const reservationsWithTimeline = resList.map(reservation => ({ ...reservation, timeline: eventsByReservation.get(reservation.id) || [] }));

    return NextResponse.json({ reservations: reservationsWithTimeline });
  } catch (error: any) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await auth();

    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found for user session' }, { status: 400 });
    }

    const body = await req.json();

    const reservation = await ReservationService.create(
      {
        propertyId,
        guestId: body.guestId,
        guest: body.guest,
        roomTypeId: body.roomTypeId,
        roomId: body.roomId || undefined,
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
        numGuests: body.numGuests || 1,
        adults: body.adults || 1,
        children: body.children || 0,
        source: body.source || 'direct',
        paymentStatus: body.paymentStatus || 'pay_later',
        paidAmountMinorUnits: body.paidAmountMinorUnits || 0,
        specialRequests: body.specialRequests,
      },
      {
        id: session?.user?.id || '',
        name: session?.user?.name || 'Hotel Staff',
      },
      req.headers.get('idempotency-key') || undefined
    );

    // Fetch property details for email
    const [prop] = await db
      .select({
        name: properties.name,
        email: properties.email,
        phone: properties.phone,
        address: properties.address,
        organizationId: properties.organizationId,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    const [rt] = await db
      .select({ name: roomTypes.name })
      .from(roomTypes)
      .where(eq(roomTypes.id, body.roomTypeId))
      .limit(1);

    // Send transactional booking confirmation email to guest
    if (body.guest?.email) {
      try {
        await sendBookingConfirmationEmail({
          guestEmail: body.guest.email,
          guestName: body.guest.fullName,
          reference: reservation.reference,
          propertyName: prop?.name || 'Your Property',
          roomType: rt?.name || 'Selected Room',
          checkInDate: body.checkInDate,
          checkOutDate: body.checkOutDate,
          nights: reservation.nights,
          totalAmountFormatted: formatNaira(reservation.totalAmountMinorUnits),
          propertyAddress: prop?.address,
          propertyPhone: prop?.phone,
        });
      } catch (emailErr) {
        console.warn('Booking confirmation email sending skipped or failed:', emailErr);
      }
    }

    // Send direct booking alert (0% commission) to hotelier
    if (prop?.email && (body.source === 'direct' || !body.source)) {
      try {
        await sendSenaEmail(
          'operations.direct_booking_alert',
          {
            recipientName: 'General Manager',
            propertyName: prop.name,
            reference: reservation.reference,
            guestName: body.guest?.fullName || 'Guest',
            roomType: rt?.name || 'Selected Room',
            checkInDate: body.checkInDate,
            checkOutDate: body.checkOutDate,
            nights: reservation.nights,
            totalAmountFormatted: formatNaira(reservation.totalAmountMinorUnits),
          },
          {
            to: prop.email,
            organizationId: prop.organizationId,
            propertyId,
            idempotencyKey: `direct_alert_${reservation.reference}`,
            relatedEntity: 'reservation',
            relatedId: reservation.reference,
          }
        );
      } catch (alertErr) {
        console.warn('Direct booking alert email skipped or failed:', alertErr);
      }
    }

    return NextResponse.json({ success: true, reservation });
  } catch (error: any) {
    console.error('Error creating reservation:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');

export const POST = withMerchant(handlePOST, 'reservations');
