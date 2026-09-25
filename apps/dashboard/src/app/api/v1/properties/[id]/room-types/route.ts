import { NextRequest, NextResponse } from 'next/server';
import { db, roomTypes } from '@sena/database';
import { eq, and } from 'drizzle-orm';
import { authenticateApiRequest, logApiRequest } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  const authResult = await authenticateApiRequest(req, 'rooms:read', id);
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const list = await db
      .select({
        id: roomTypes.id,
        name: roomTypes.name,
        description: roomTypes.description,
        capacity: roomTypes.capacity,
        bedType: roomTypes.bedType,
        basePriceMinorUnits: roomTypes.basePriceMinorUnits,
        amenities: roomTypes.amenities,
        images: roomTypes.images,
        totalInventory: roomTypes.totalInventory,
      })
      .from(roomTypes)
      .where(and(eq(roomTypes.propertyId, id), eq(roomTypes.websiteVisibility, true)));

    const formatted = list.map((rt) => ({
      id: rt.id,
      name: rt.name,
      description: rt.description,
      capacity: rt.capacity,
      bed_type: rt.bedType,
      base_price_minor_units: rt.basePriceMinorUnits,
      amenities: rt.amenities || [],
      images: rt.images || [],
      total_inventory: rt.totalInventory,
    }));

    const res = NextResponse.json({
      data: formatted,
    });

    logApiRequest(id, 'GET', `/api/v1/properties/${id}/room-types`, 200, Date.now() - startTime, authResult.apiKey, req);
    return res;
  } catch (error: any) {
    console.error('API Error /v1/properties/[id]/room-types:', error);
    const res = NextResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred while fetching room types.' } },
      { status: 500 }
    );
    logApiRequest(id, 'GET', `/api/v1/properties/${id}/room-types`, 500, Date.now() - startTime, authResult.apiKey, req);
    return res;
  }
}
