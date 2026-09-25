import { NextRequest, NextResponse } from 'next/server';
import { db, properties, websiteConfigs } from '@sena/database';
import { eq } from 'drizzle-orm';
import { authenticateApiRequest, logApiRequest } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  // Authenticate API Key (optional or authenticated)
  const authResult = await authenticateApiRequest(req, 'properties:read', id);
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const [property] = await db
      .select({
        id: properties.id,
        name: properties.name,
        slug: properties.slug,
        code: properties.code,
        propertyType: properties.propertyType,
        country: properties.country,
        address: properties.address,
        phone: properties.phone,
        email: properties.email,
        timezone: properties.timezone,
        currency: properties.currency,
        checkInTime: properties.checkInTime,
        checkOutTime: properties.checkOutTime,
      })
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);

    if (!property) {
      const res = NextResponse.json(
        { error: { code: 'PROPERTY_NOT_FOUND', message: `Property '${id}' was not found.` } },
        { status: 404 }
      );
      logApiRequest(id, 'GET', `/api/v1/properties/${id}`, 404, Date.now() - startTime, authResult.apiKey, req);
      return res;
    }

    // Include public website branding configuration
    const [config] = await db
      .select({
        brandColors: websiteConfigs.brandColors,
        typography: websiteConfigs.typography,
        logoUrl: websiteConfigs.logoUrl,
        heroHeadline: websiteConfigs.heroHeadline,
      })
      .from(websiteConfigs)
      .where(eq(websiteConfigs.propertyId, id))
      .limit(1);

    const res = NextResponse.json({
      data: {
        ...property,
        branding: config
          ? {
              colors: config.brandColors,
              typography: config.typography,
              logo_url: config.logoUrl,
              tagline: config.heroHeadline,
            }
          : null,
      },
    });

    logApiRequest(id, 'GET', `/api/v1/properties/${id}`, 200, Date.now() - startTime, authResult.apiKey, req);
    return res;
  } catch (error: any) {
    console.error('API Error /v1/properties/[id]:', error);
    const res = NextResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred while fetching property details.' } },
      { status: 500 }
    );
    logApiRequest(id, 'GET', `/api/v1/properties/${id}`, 500, Date.now() - startTime, authResult.apiKey, req);
    return res;
  }
}
