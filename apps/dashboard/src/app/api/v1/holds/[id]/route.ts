import { NextRequest, NextResponse } from 'next/server';
import { db, bookingHolds, roomTypes, properties } from '@sena/database';
import { eq } from 'drizzle-orm';
import { authenticateApiRequest, logApiRequest } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  try {
    const [hold] = await db
      .select({
        id: bookingHolds.id,
        propertyId: bookingHolds.propertyId,
        roomTypeId: bookingHolds.roomTypeId,
        checkInDate: bookingHolds.checkInDate,
        checkOutDate: bookingHolds.checkOutDate,
        quantity: bookingHolds.quantity,
        status: bookingHolds.status,
        expiresAt: bookingHolds.expiresAt,
        createdAt: bookingHolds.createdAt,
      })
      .from(bookingHolds)
      .where(eq(bookingHolds.id, id))
      .limit(1);

    if (!hold) {
      return NextResponse.json(
        { error: { code: 'HOLD_NOT_FOUND', message: `Hold '${id}' was not found.` } },
        { status: 404 }
      );
    }

    const authResult = await authenticateApiRequest(req, 'holds:create', hold.propertyId);
    if (!authResult.success) {
      return authResult.response;
    }

    const now = Date.now();
    const isExpired = new Date(hold.expiresAt).getTime() <= now || hold.status !== 'active';
    const ttlSeconds = Math.max(0, Math.floor((new Date(hold.expiresAt).getTime() - now) / 1000));

    const res = NextResponse.json({
      data: {
        id: hold.id,
        property_id: hold.propertyId,
        room_type_id: hold.roomTypeId,
        check_in: hold.checkInDate,
        check_out: hold.checkOutDate,
        quantity: hold.quantity,
        status: isExpired && hold.status === 'active' ? 'expired' : hold.status,
        expires_at: hold.expiresAt.toISOString(),
        ttl_seconds: ttlSeconds,
      },
    });

    logApiRequest(hold.propertyId, 'GET', `/api/v1/holds/${id}`, 200, Date.now() - startTime, authResult.apiKey, req);
    return res;
  } catch (error: any) {
    console.error('API Error /v1/holds/[id]:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred while fetching hold.' } },
      { status: 500 }
    );
  }
}
