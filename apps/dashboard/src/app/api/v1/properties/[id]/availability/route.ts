import { NextRequest, NextResponse } from 'next/server';
import { db, roomTypes, properties } from '@sena/database';
import { eq, and } from 'drizzle-orm';
import { checkAvailability } from '@sena/inventory';
import { calculateNights } from '@sena/config';
import { authenticateApiRequest, logApiRequest } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;
  const { searchParams } = new URL(req.url);

  const checkIn = searchParams.get('check_in') || searchParams.get('checkIn');
  const checkOut = searchParams.get('check_out') || searchParams.get('checkOut');
  const guestsParam = searchParams.get('guests');
  const guests = guestsParam ? parseInt(guestsParam, 10) : undefined;

  const authResult = await authenticateApiRequest(req, 'availability:read', id);
  if (!authResult.success) {
    return authResult.response;
  }

  // 1. Validate Date Parameters
  if (!checkIn || !checkOut) {
    const res = NextResponse.json(
      {
        error: {
          code: 'MISSING_DATE_PARAMETERS',
          message: "Both 'check_in' and 'check_out' query parameters are required in YYYY-MM-DD format.",
        },
      },
      { status: 400 }
    );
    logApiRequest(id, 'GET', `/api/v1/properties/${id}/availability`, 400, Date.now() - startTime, authResult.apiKey, req);
    return res;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(checkIn) || !dateRegex.test(checkOut)) {
    const res = NextResponse.json(
      {
        error: {
          code: 'INVALID_DATE_FORMAT',
          message: "Dates must strictly match the ISO 'YYYY-MM-DD' format.",
        },
      },
      { status: 400 }
    );
    logApiRequest(id, 'GET', `/api/v1/properties/${id}/availability`, 400, Date.now() - startTime, authResult.apiKey, req);
    return res;
  }

  const nights = calculateNights(checkIn, checkOut);
  if (nights <= 0) {
    const res = NextResponse.json(
      {
        error: {
          code: 'INVALID_DATE_RANGE',
          message: "Check-out date must be strictly after check-in date.",
        },
      },
      { status: 400 }
    );
    logApiRequest(id, 'GET', `/api/v1/properties/${id}/availability`, 400, Date.now() - startTime, authResult.apiKey, req);
    return res;
  }

  if (nights > 60) {
    const res = NextResponse.json(
      {
        error: {
          code: 'DATE_RANGE_TOO_LONG',
          message: 'Maximum stay duration for direct availability queries is 60 nights.',
        },
      },
      { status: 400 }
    );
    logApiRequest(id, 'GET', `/api/v1/properties/${id}/availability`, 400, Date.now() - startTime, authResult.apiKey, req);
    return res;
  }

  if (guests !== undefined && (isNaN(guests) || guests <= 0)) {
    const res = NextResponse.json(
      {
        error: {
          code: 'INVALID_GUESTS_COUNT',
          message: "The 'guests' parameter must be a positive integer greater than zero.",
        },
      },
      { status: 400 }
    );
    logApiRequest(id, 'GET', `/api/v1/properties/${id}/availability`, 400, Date.now() - startTime, authResult.apiKey, req);
    return res;
  }

  try {
    // 2. Fetch Property Currency
    const [prop] = await db
      .select({ currency: properties.currency })
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);

    const currency = prop?.currency || 'NGN';

    // 3. Fetch all active room types for this property
    const rts = await db
      .select({
        id: roomTypes.id,
        name: roomTypes.name,
        description: roomTypes.description,
        capacity: roomTypes.capacity,
        bedType: roomTypes.bedType,
        basePriceMinorUnits: roomTypes.basePriceMinorUnits,
        amenities: roomTypes.amenities,
        images: roomTypes.images,
      })
      .from(roomTypes)
      .where(and(eq(roomTypes.propertyId, id), eq(roomTypes.bookingVisibility, true)));

    // 4. Query authoritative availability for each room type
    const results = await Promise.all(
      rts.map(async (rt) => {
        // Filter out if room capacity cannot accommodate requested guests
        if (guests && rt.capacity < guests) {
          return null;
        }

        const avail = await checkAvailability(id, rt.id, checkIn, checkOut);
        const nightlyPrice = rt.basePriceMinorUnits;
        const totalAmount = nightlyPrice * nights;

        return {
          room_type_id: rt.id,
          name: rt.name,
          description: rt.description,
          capacity: rt.capacity,
          bed_type: rt.bedType,
          is_available: avail.isAvailable,
          available_quantity: Math.max(0, avail.minAvailable),
          nightly_price_minor_units: nightlyPrice,
          total_amount_minor_units: totalAmount,
          currency,
          nights,
          amenities: rt.amenities || [],
          images: rt.images || [],
        };
      })
    );

    const filtered = results.filter(Boolean);

    const res = NextResponse.json({
      data: {
        property_id: id,
        check_in: checkIn,
        check_out: checkOut,
        nights,
        room_types: filtered,
      },
    });

    logApiRequest(id, 'GET', `/api/v1/properties/${id}/availability`, 200, Date.now() - startTime, authResult.apiKey, req);
    return res;
  } catch (error: any) {
    console.error('API Error /v1/properties/[id]/availability:', error);
    const res = NextResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred while calculating availability.' } },
      { status: 500 }
    );
    logApiRequest(id, 'GET', `/api/v1/properties/${id}/availability`, 500, Date.now() - startTime, authResult.apiKey, req);
    return res;
  }
}
