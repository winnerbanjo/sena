import { NextRequest, NextResponse } from 'next/server';
import { db, properties, roomTypes, eq } from '@sena/database';
import { checkAvailability } from '@sena/inventory';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propIdParam = searchParams.get('propertyId');
    const checkIn = searchParams.get('checkIn') || new Date().toISOString().split('T')[0];
    
    // Default checkOut to 2 days later if not specified
    const defaultCheckOut = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
    const checkOut = searchParams.get('checkOut') || defaultCheckOut;

    // Resolve property
    let property;
    if (propIdParam) {
      property = await db.query.properties.findFirst({
        where: eq(properties.id, propIdParam),
      });
    }
    if (!property) {
      property = await db.query.properties.findFirst();
    }

    if (!property) {
      return NextResponse.json({ property: null, roomTypes: [] });
    }

    // Fetch room types for this property
    const types = await db
      .select()
      .from(roomTypes)
      .where(eq(roomTypes.propertyId, property.id));

    // Calculate real availability for each room type
    const availableTypes = await Promise.all(
      types.map(async (rt) => {
        const avail = await checkAvailability(property.id, rt.id, checkIn, checkOut);
        return {
          id: rt.id,
          name: rt.name,
          bedType: rt.bedType || 'King bed',
          capacity: rt.capacity || 2,
          pricePerNight: rt.basePriceMinorUnits,
          remaining: avail.minAvailable,
          isAvailable: avail.isAvailable,
          description: rt.description || 'Thoughtfully appointed room with premium finishes.',
          amenities: (rt.amenities as string[]) || ['Fast Wi-Fi', 'En-suite bath', 'Breakfast included'],
        };
      })
    );

    return NextResponse.json({
      property: {
        id: property.id,
        name: property.name,
        code: property.code,
        currency: property.currency,
        address: property.address,
      },
      roomTypes: availableTypes,
    });
  } catch (error: any) {
    console.error('Error fetching booking room types:', error);
    return NextResponse.json({ error: error.message || 'Failed to load rooms' }, { status: 500 });
  }
}
