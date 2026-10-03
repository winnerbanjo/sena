import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  reservations,
  guests,
  rooms,
  roomTypes,
  apartments,
  properties,
  transferProofs,
  eq,
  and,
  desc,
  ne,
  or,
  isNull,
  lte,
  gte,
} from '@sena/database';
import { resolveTenantForRequest } from '@/lib/tenant';
import { getMerchantRequest } from '@/lib/merchant-route';
import { mapReservationItem } from '@/components/reservation-room';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

function getLocalDateString(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

function addDaysToIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    let tenant = getMerchantRequest(req)?.tenant;

    if (!tenant) {
      tenant = (await resolveTenantForRequest(session, req)) || undefined;
    }

    if (!tenant?.propertyId) {
      return NextResponse.json({ error: 'Property not found or unauthorized' }, { status: 401 });
    }

    const propertyId = tenant.propertyId;
    const propertyTimezone = tenant.property.timezone || 'Africa/Lagos';
    const todayIso = getLocalDateString(new Date(), propertyTimezone);

    // 7-day velocity window (-3 days to +3 days from operational today)
    const windowStartIso = addDaysToIso(todayIso, -3);
    const windowEndIso = addDaysToIso(todayIso, 3);

    // Bounded queries:
    // 1. Fetch only relevant reservations:
    //    - Staying today OR arriving today OR departing today OR overlapping the 7-day window OR currently in house
    //    - Exclude cancelled stays
    const [
      resRows,
      roomRows,
      apartmentRows,
      pendingProofRows,
    ] = await Promise.all([
      db
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
        .where(
          and(
            eq(reservations.propertyId, propertyId),
            ne(reservations.status, 'cancelled'),
            or(
              // Active stay or relevant to today's operations
              eq(reservations.status, 'checked_in'),
              eq(reservations.checkInDate, todayIso),
              eq(reservations.checkOutDate, todayIso),
              // Or overlaps 7-day velocity window
              and(
                lte(reservations.checkInDate, windowEndIso),
                gte(reservations.checkOutDate, windowStartIso)
              )
            )
          )
        )
        .orderBy(desc(reservations.createdAt)),

      // 2. Fetch rooms for property
      db
        .select({
          id: rooms.id,
          roomNumber: rooms.roomNumber,
          roomTypeId: rooms.roomTypeId,
          floor: rooms.floor,
          operationalStatus: rooms.operationalStatus,
          housekeepingStatus: rooms.housekeepingStatus,
          notes: rooms.notes,
          roomTypeName: roomTypes.name,
        })
        .from(rooms)
        .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
        .where(eq(rooms.propertyId, propertyId))
        .orderBy(rooms.roomNumber),

      // 3. Fetch active (non-archived) apartments
      db
        .select({
          id: apartments.id,
          name: apartments.name,
          apartmentType: apartments.apartmentType,
          operationalStatus: apartments.operationalStatus,
          housekeepingStatus: apartments.housekeepingStatus,
          bedrooms: apartments.bedrooms,
          maxGuests: apartments.maxGuests,
        })
        .from(apartments)
        .where(and(eq(apartments.propertyId, propertyId), isNull(apartments.archivedAt))),

      // 4. Fetch pending transfer proofs for this property
      db
        .select({
          id: transferProofs.id,
          reservationId: transferProofs.reservationId,
          amountMinorUnits: transferProofs.amountMinorUnits,
          status: transferProofs.status,
          submittedAt: transferProofs.submittedAt,
        })
        .from(transferProofs)
        .where(
          and(
            eq(transferProofs.propertyId, propertyId),
            eq(transferProofs.status, 'pending')
          )
        ),
    ]);

    const pendingProofResIds = new Set(
      pendingProofRows.map((r) => r.reservationId).filter(Boolean) as string[]
    );

    // Map reservation rows to standard UI items
    const allItems = resRows.map((r) => {
      const item = mapReservationItem({
        ...r,
        source: r.source as any,
        status: r.status as any,
        paymentStatus: r.paymentStatus as any,
        guestName: r.guestName || undefined,
        guestEmail: r.guestEmail || undefined,
        guestPhone: r.guestPhone || undefined,
        roomNumber: r.roomNumber || undefined,
        roomTypeName: r.roomTypeName || undefined,
        apartmentName: r.apartmentName || undefined,
      });
      item.pendingTransferProof = pendingProofResIds.has(item.id);
      return item;
    });

    // -------------------------------------------------------------
    // DATA TRUTH CALCULATIONS
    // -------------------------------------------------------------

    // 1. ARRIVALS:
    // Scheduled for today (checkInDate === today in property timezone).
    // Future stays (checkInDate > today) must NEVER count as today's arrivals!
    const arrivalsScheduledToday = allItems.filter(
      (r) => r.checkInDate === todayIso && ['confirmed', 'checked_in'].includes(r.status)
    );
    const arrivalsPending = arrivalsScheduledToday.filter((r) => r.status === 'confirmed');
    const arrivalsCheckedIn = arrivalsScheduledToday.filter((r) => r.status === 'checked_in');

    // 2. DEPARTURES:
    // Stays scheduled to depart on today's operational date (checkOutDate === today).
    // Distinguish between pending departure (still in house) and already checked out.
    const departuresScheduledToday = allItems.filter(
      (r) => r.checkOutDate === todayIso && ['checked_in', 'checked_out'].includes(r.status)
    );
    const departuresPending = departuresScheduledToday.filter((r) => r.status === 'checked_in');
    const departuresCompleted = departuresScheduledToday.filter((r) => r.status === 'checked_out');

    // Overdue departures: stays still marked 'checked_in' whose checkout date is before today
    const overdueDepartures = allItems.filter(
      (r) => r.status === 'checked_in' && r.checkOutDate < todayIso
    );

    // 3. IN HOUSE:
    // All active checked-in stays currently holding accommodation in the property:
    // On-schedule stays (checkOutDate >= todayIso) plus overdue departures (checkOutDate < todayIso).
    const inHouseOnSchedule = allItems.filter(
      (r) => r.status === 'checked_in' && r.checkInDate <= todayIso && r.checkOutDate >= todayIso
    );
    const inHouseTotalStays = [...inHouseOnSchedule, ...overdueDepartures];

    // 4. OCCUPANCY (Audited Denominator & Numerator):
    // Clearly distinguish configured inventory, out-of-service, active bookable, occupied
    const totalConfiguredRooms = roomRows.length;
    const totalConfiguredApartments = apartmentRows.length;
    const totalConfiguredInventory = totalConfiguredRooms + totalConfiguredApartments;

    const outOfServiceRooms = roomRows.filter(
      (r) => r.operationalStatus === 'maintenance' || r.operationalStatus === 'blocked'
    ).length;
    const outOfServiceApartments = apartmentRows.filter(
      (a) => a.operationalStatus === 'maintenance' || a.operationalStatus === 'blocked'
    ).length;
    const outOfServiceInventory = outOfServiceRooms + outOfServiceApartments;

    // The audited bookable inventory excludes out-of-order/maintenance units
    const activeBookableInventory = Math.max(0, totalConfiguredInventory - outOfServiceInventory);

    // Occupied count: units physically occupied by active stays
    const occupiedRooms = roomRows.filter((r) => r.operationalStatus === 'occupied').length;
    const occupiedApartments = apartmentRows.filter((a) => a.operationalStatus === 'occupied').length;
    const occupiedInventory = occupiedRooms + occupiedApartments;

    const occupancyRate =
      activeBookableInventory > 0
        ? Math.min(100, Math.round((occupiedInventory / activeBookableInventory) * 100))
        : 0;

    // 5. HOUSEKEEPING READINESS:
    // Uses actual operational accommodation inventory (rooms + apartments).
    const cleanRooms = roomRows.filter((r) =>
      ['clean', 'inspected'].includes(r.housekeepingStatus)
    );
    const cleanApartments = apartmentRows.filter((a) =>
      ['clean', 'inspected'].includes(a.housekeepingStatus)
    );
    const dirtyRooms = roomRows.filter((r) => r.housekeepingStatus === 'dirty');
    const dirtyApartments = apartmentRows.filter((a) => a.housekeepingStatus === 'dirty');
    const cleaningRooms = roomRows.filter((r) => r.housekeepingStatus === 'cleaning');
    const cleaningApartments = apartmentRows.filter((a) => a.housekeepingStatus === 'cleaning');

    // Ready = Clean & Available
    const readyRooms = cleanRooms.filter((r) => r.operationalStatus === 'available');
    const readyApartments = cleanApartments.filter((a) => a.operationalStatus === 'available');
    const totalReady = readyRooms.length + readyApartments.length;
    const totalDirty = dirtyRooms.length + dirtyApartments.length;
    const totalCleaning = cleaningRooms.length + cleaningApartments.length;

    const readinessRate =
      activeBookableInventory > 0
        ? Math.min(100, Math.round((totalReady / activeBookableInventory) * 100))
        : 0;

    // 6. OUTSTANDING PAYMENTS (Operational Front Desk Definition):
    // Uncollected balances on active front desk stays (today's arrivals + in-house stays + overdue)
    // needing staff collection at the desk before checkout.
    const activeFrontDeskStays = [
      ...arrivalsPending,
      ...inHouseTotalStays,
    ].filter((item, index, self) => self.findIndex((i) => i.id === item.id) === index);

    const staysWithUncollectedBalance = activeFrontDeskStays.filter((r) => {
      const balance = Math.max(0, (r.totalAmountMinorUnits || 0) - (r.paidAmountMinorUnits || 0));
      return balance > 0;
    });

    const totalUncollectedMinorUnits = staysWithUncollectedBalance.reduce((sum, r) => {
      return sum + Math.max(0, (r.totalAmountMinorUnits || 0) - (r.paidAmountMinorUnits || 0));
    }, 0);

    // 7. ATTENTION REQUIRED:
    // Stays or accommodation exceptions requiring immediate front desk action today
    const unassignedArrivals = arrivalsPending.filter((r) => !r.roomId && !r.apartmentId);
    const dirtyRoomsWithArrivals = roomRows.filter((r) => {
      if (r.housekeepingStatus !== 'dirty') return false;
      return arrivalsPending.some((a) => a.roomId === r.id);
    });

    // 8. 7-DAY BOOKING VELOCITY:
    // Strictly computed for the 7 dates (-3 to +3 days from today)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const velocityDays = [];

    for (let offset = -3; offset <= 3; offset++) {
      const iso = addDaysToIso(todayIso, offset);
      const d = new Date(iso + 'T12:00:00Z');
      const isToday = offset === 0;

      const overlapping = allItems.filter(
        (r) =>
          iso >= r.checkInDate &&
          (iso < r.checkOutDate || (isToday && r.status === 'checked_in')) &&
          ['confirmed', 'checked_in', 'checked_out'].includes(r.status)
      );
      const arrivalsOnDay = allItems.filter((r) => r.checkInDate === iso).length;
      const departuresOnDay = allItems.filter((r) => r.checkOutDate === iso).length;
      const dayYieldMinorUnits = overlapping.reduce(
        (sum, r) => sum + Math.round((r.totalAmountMinorUnits || 0) / Math.max(1, r.nights || 1)),
        0
      );

      const dayOcc =
        activeBookableInventory > 0
          ? Math.min(100, Math.round((overlapping.length / activeBookableInventory) * 100))
          : 0;

      velocityDays.push({
        iso,
        day: dayNames[d.getUTCDay()],
        dayName: fullDayNames[d.getUTCDay()],
        dateNum: String(d.getUTCDate()),
        fullDate: `${fullDayNames[d.getUTCDay()]}, ${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}${isToday ? ' (Today)' : ''}`,
        occupancy: dayOcc,
        roomsBooked: overlapping.length,
        totalRooms: activeBookableInventory,
        revenueMinorUnits: dayYieldMinorUnits,
        arrivals: arrivalsOnDay,
        departures: departuresOnDay,
        isToday,
      });
    }

    // Consolidated response
    return NextResponse.json({
      property: {
        id: tenant.property.id,
        name: tenant.property.name,
        slug: tenant.property.slug || '',
        address: tenant.property.address || '',
        timezone: propertyTimezone,
        currency: tenant.property.currency || 'NGN',
        checkInTime: tenant.property.checkInTime || '14:00',
        checkOutTime: tenant.property.checkOutTime || '11:00',
      },
      todayIso,
      vitals: {
        arrivals: {
          total: arrivalsScheduledToday.length,
          pending: arrivalsPending.length,
          checkedIn: arrivalsCheckedIn.length,
          items: arrivalsScheduledToday,
        },
        departures: {
          total: departuresScheduledToday.length,
          pending: departuresPending.length,
          completed: departuresCompleted.length,
          overdue: overdueDepartures.length,
          items: departuresScheduledToday,
          overdueItems: overdueDepartures,
        },
        inHouse: {
          total: inHouseTotalStays.length,
          onSchedule: inHouseOnSchedule.length,
          overdue: overdueDepartures.length,
          items: inHouseTotalStays,
        },
        inventory: {
          totalConfigured: totalConfiguredInventory,
          totalRooms: totalConfiguredRooms,
          totalApartments: totalConfiguredApartments,
          outOfService: outOfServiceInventory,
          outOfServiceRooms,
          outOfServiceApartments,
          bookableInventory: activeBookableInventory,
          occupiedCount: occupiedInventory,
          occupancyRate,
        },
        housekeeping: {
          readyCount: totalReady,
          readyRooms: readyRooms.length,
          readyApartments: readyApartments.length,
          dirtyCount: totalDirty,
          cleaningCount: totalCleaning,
          readinessRate,
        },
        deskFinancials: {
          uncollectedMinorUnits: totalUncollectedMinorUnits,
          unpaidStaysCount: staysWithUncollectedBalance.length,
          pendingProofsCount: pendingProofRows.length,
          items: staysWithUncollectedBalance,
        },
        attention: {
          pendingArrivalsCount: arrivalsPending.length,
          unassignedArrivalsCount: unassignedArrivals.length,
          unassignedArrivals,
          pendingDeparturesCount: departuresPending.length,
          overdueDeparturesCount: overdueDepartures.length,
          dirtyRoomsWithArrivalsCount: dirtyRoomsWithArrivals.length,
          unpaidStaysCount: staysWithUncollectedBalance.length,
          pendingProofsCount: pendingProofRows.length,
        },
      },
      sevenDayVelocity: {
        windowStartIso,
        windowEndIso,
        days: velocityDays,
      },
      rooms: roomRows,
      apartments: apartmentRows,
    });
  } catch (error: any) {
    console.error('Error in /api/overview:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch overview data' },
      { status: 500 }
    );
  }
}
