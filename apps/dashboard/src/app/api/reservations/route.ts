import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { badCursorResponse, cursorIsMalformed, cursorTimestamp, cursorUuid, decodeCursor, encodeCursor, escapeLikePattern, parsePageLimit } from '@/lib/pagination';
import { eq, desc, or, ilike, gte, lte, inArray, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, reservations, guests, rooms, roomTypes, apartments, properties, reservationNotes, transferProofs } from '@sena/database';
import { ReservationService } from '@sena/reservations';
import { sendBookingConfirmationEmail, sendSenaEmail } from '@sena/email';
import { formatNaira } from '@sena/config';
import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const merchant = getMerchantRequest(req);
    const tenant = merchant?.tenant;
    const propertyId = tenant?.propertyId;

    if (!propertyId || !tenant) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const { searchParams } = new URL(req.url);
    const limit = parsePageLimit(searchParams.get('limit'));
    const rawCursor = searchParams.get('cursor');
    const cursor = decodeCursor(rawCursor);
    if (cursorIsMalformed(rawCursor, cursor)) {
      return NextResponse.json(badCursorResponse(), { status: 400 });
    }
    const cursorCreatedAt = cursorTimestamp(cursor?.createdAt);
    const cursorId = cursorUuid(cursor?.id);
    if (rawCursor && (!cursorCreatedAt || !cursorId)) {
      return NextResponse.json(badCursorResponse(), { status: 400 });
    }

    const statusParam = searchParams.get('status');
    const statuses = (statusParam || '')
      .split(',')
      .map((status) => status.trim())
      .filter((status) => status && status !== 'all');
    const allowedStatuses = new Set(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']);
    if (statuses.some((status) => !allowedStatuses.has(status))) {
      return NextResponse.json({ error: 'Unknown reservation status' }, { status: 400 });
    }

    const search = (searchParams.get('search') || '').trim().slice(0, 100);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const isDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
    if ((from && !isDate(from)) || (to && !isDate(to))) {
      return NextResponse.json({ error: 'Dates must be YYYY-MM-DD' }, { status: 400 });
    }

    const conditions = [eq(reservations.propertyId, propertyId)];
    if (statuses.length) conditions.push(inArray(reservations.status, statuses));
    if (isDate(from)) conditions.push(gte(reservations.checkInDate, from));
    if (isDate(to)) conditions.push(lte(reservations.checkInDate, to));
    if (search) {
      const pattern = `%${escapeLikePattern(search)}%`;
      conditions.push(or(
        ilike(reservations.reference, pattern),
        ilike(guests.fullName, pattern),
        ilike(rooms.roomNumber, pattern)
      )!);
    }
    if (cursorCreatedAt && cursorId) {
      conditions.push(sql`(${reservations.createdAt}, ${reservations.id}) < (${cursorCreatedAt}::timestamptz, ${cursorId}::uuid)`);
    }

    const rows = await db
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
        cursorCreatedAt: sql<string>`to_char(${reservations.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
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
        noteCount: sql<number>`(select count(*)::int from ${reservationNotes} where ${reservationNotes.reservationId} = ${reservations.id})`,
        pendingTransferProof: sql<boolean>`exists (select 1 from ${transferProofs} where ${transferProofs.reservationId} = ${reservations.id} and ${transferProofs.propertyId} = ${propertyId} and ${transferProofs.status} = 'pending')`,
      })
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .leftJoin(rooms, eq(reservations.roomId, rooms.id))
      .leftJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
      .leftJoin(apartments, eq(reservations.apartmentId, apartments.id))
      .where(sql.join(conditions, sql` and `))
      .orderBy(desc(reservations.createdAt), desc(reservations.id))
      .limit(limit + 1);

    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor = rows.length > limit && last
      ? encodeCursor({ createdAt: last.cursorCreatedAt, id: last.id })
      : null;
    const responseItems = items.map(({ cursorCreatedAt: _cursorCreatedAt, ...item }) => item);

    return NextResponse.json({ items: responseItems, nextCursor });
  } catch (error: any) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const merchant = getMerchantRequest(req);
    const session: any = merchant?.session || (await auth());
    const tenant = merchant?.tenant || (await resolveTenantForRequest(session, req));
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found for user session' }, { status: 400 });
    }

    const body: any = merchant?.body || (await req.json());

    const reservation = await ReservationService.create(
      {
        propertyId,
        guestId: body.guestId,
        guest: body.guest,
        roomTypeId: body.roomTypeId,
        apartmentId: body.apartmentId,
        roomId: body.roomId || undefined,
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
        numGuests: body.numGuests ? Number(body.numGuests) : 1,
        adults: body.adults ? Number(body.adults) : 1,
        children: body.children ? Number(body.children) : 0,
        source: body.source || 'direct',
        paymentStatus: 'pay_later',
        paidAmountMinorUnits: 0,
        customTotalAmountMinorUnits: body.customTotalAmountMinorUnits != null ? Number(body.customTotalAmountMinorUnits) : undefined,
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

    const [rt] = body.roomTypeId
      ? await db.select({ name: roomTypes.name }).from(roomTypes).where(eq(roomTypes.id, body.roomTypeId)).limit(1)
      : body.apartmentId
        ? await db.select({ name: apartments.name }).from(apartments).where(eq(apartments.id, body.apartmentId)).limit(1)
        : [undefined];

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

    void import('@/lib/integrations/google/calendar')
      .then(({ maybeQueueGoogleReservationSync }) =>
        maybeQueueGoogleReservationSync(propertyId, reservation.id)
      )
      .catch(() => null);

    return NextResponse.json({ success: true, reservation });
  } catch (error: any) {
    console.error('Error creating reservation:', {
      error: error?.message || error,
      stack: error?.stack,
    });
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'reservations');

export const POST = withMerchant(handlePOST, 'reservations');
