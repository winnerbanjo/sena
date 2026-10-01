import { NextRequest, NextResponse } from 'next/server';
import { db, roomTypes, apartments, roomImages, and, asc, eq, isNull } from '@sena/database';
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

    const units = await db
      .select()
      .from(apartments)
      .where(and(eq(apartments.propertyId, id), isNull(apartments.archivedAt), eq(apartments.websiteVisibility, true), eq(apartments.bookingVisibility, true)));
    const photos = units.length
      ? await db.select().from(roomImages).where(eq(roomImages.propertyId, id)).orderBy(asc(roomImages.sortOrder))
      : [];

    const formatted = [
      ...list.map((rt) => ({
        id: rt.id,
        kind: 'room' as const,
        name: rt.name,
        description: rt.description,
        capacity: rt.capacity,
        bed_type: rt.bedType,
        base_price_minor_units: rt.basePriceMinorUnits,
        amenities: rt.amenities || [],
        images: rt.images || [],
        total_inventory: rt.totalInventory,
      })),
      ...units
        .filter((unit) => unit.operationalStatus !== 'blocked' && unit.operationalStatus !== 'maintenance')
        .map((unit) => ({
          id: unit.id,
          kind: 'apartment' as const,
          name: unit.name,
          description: unit.description,
          capacity: unit.maxGuests,
          bed_type: unit.bedConfiguration,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          base_price_minor_units: unit.basePriceMinorUnits,
          amenities: unit.amenities || [],
          images: photos
            .filter((image) => image.apartmentId === unit.id)
            .sort((left, right) => Number(right.isCover) - Number(left.isCover) || left.sortOrder - right.sortOrder)
            .map((image) => image.url),
          total_inventory: 1,
        })),
    ];

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
