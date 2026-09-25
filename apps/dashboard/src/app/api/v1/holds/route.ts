import { NextRequest, NextResponse } from 'next/server';
import { createHold } from '@sena/inventory';
import { authenticateApiRequest, logApiRequest } from '../../../../lib/api-auth';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400 }
      );
    }

    const propertyId = body.property_id || body.propertyId;
    const roomTypeId = body.room_type_id || body.roomTypeId;
    const checkIn = body.check_in || body.checkInDate;
    const checkOut = body.check_out || body.checkOutDate;
    const quantity = Number(body.quantity || 1);
    const guest = body.guest || {};

    if (!propertyId || !roomTypeId || !checkIn || !checkOut) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: "Missing required fields: 'property_id', 'room_type_id', 'check_in', 'check_out'.",
          },
        },
        { status: 400 }
      );
    }

    // Authenticate API key & verify property boundary
    const authResult = await authenticateApiRequest(req, 'holds:create', propertyId);
    if (!authResult.success) {
      return authResult.response;
    }

    // Atomically create 10-minute hold in authoritative inventory
    const holdResult = await createHold(
      propertyId,
      roomTypeId,
      checkIn,
      checkOut,
      quantity,
      { name: guest.name, email: guest.email }
    );

    const ttlSeconds = Math.max(0, Math.floor((new Date(holdResult.expiresAt).getTime() - Date.now()) / 1000));

    const res = NextResponse.json(
      {
        data: {
          id: holdResult.holdId,
          property_id: propertyId,
          room_type_id: roomTypeId,
          check_in: checkIn,
          check_out: checkOut,
          quantity,
          status: 'active',
          expires_at: holdResult.expiresAt.toISOString(),
          ttl_seconds: ttlSeconds,
        },
      },
      { status: 201 }
    );

    logApiRequest(propertyId, 'POST', '/api/v1/holds', 201, Date.now() - startTime, authResult.apiKey, req);
    return res;
  } catch (error: any) {
    console.error('API Error /v1/holds:', error);
    const isConflict = error.message?.includes('not available') || error.message?.includes('capacity');
    const statusCode = isConflict ? 409 : 500;
    const errorCode = isConflict ? 'ROOM_UNAVAILABLE' : 'INTERNAL_SERVER_ERROR';

    return NextResponse.json(
      { error: { code: errorCode, message: error.message || 'Failed to create inventory hold.' } },
      { status: statusCode }
    );
  }
}
