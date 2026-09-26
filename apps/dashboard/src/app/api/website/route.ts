import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, properties, propertyMembers, organizationMembers, websiteConfigs, websiteDomains, eq } from '@sena/database';

import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const property = await db.query.properties.findFirst({
      where: eq(properties.id, propertyId),
    });

    const config = await db.query.websiteConfigs.findFirst({
      where: eq(websiteConfigs.propertyId, propertyId),
    });

    const domains = await db
      .select()
      .from(websiteDomains)
      .where(eq(websiteDomains.propertyId, propertyId));

    return NextResponse.json({
      property,
      config,
      domains,
    });
  } catch (error: any) {
    console.error('Error fetching website config:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

// Save draft or update config
async function handlePUT(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const body = await req.json();
    const { draftOnly, ...configUpdates } = body;

    const existing = await db.query.websiteConfigs.findFirst({
      where: eq(websiteConfigs.propertyId, propertyId),
    });

    let updated;
    if (draftOnly) {
      // Store in draftConfig column
      if (existing) {
        [updated] = await db
          .update(websiteConfigs)
          .set({
            draftConfig: configUpdates,
            updatedAt: new Date(),
          })
          .where(eq(websiteConfigs.id, existing.id))
          .returning();
      }
    } else {
      // Save directly to main fields
      if (existing) {
        [updated] = await db
          .update(websiteConfigs)
          .set({
            ...configUpdates,
            draftConfig: null, // cleared after direct save
            updatedAt: new Date(),
          })
          .where(eq(websiteConfigs.id, existing.id))
          .returning();
      } else {
        [updated] = await db
          .insert(websiteConfigs)
          .values({
            propertyId,
            ...configUpdates,
          })
          .returning();
      }
    }

    return NextResponse.json({ success: true, config: updated });
  } catch (error: any) {
    console.error('Error saving website config:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

// Publish changes to live website
async function handlePATCH(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const existing = await db.query.websiteConfigs.findFirst({
      where: eq(websiteConfigs.propertyId, propertyId),
    });

    if (!existing) {
      return NextResponse.json({ error: 'No website configuration found to publish' }, { status: 404 });
    }

    // If there is draftConfig, merge and promote to published fields
    const draft = (existing.draftConfig as any) || {};
    const [published] = await db
      .update(websiteConfigs)
      .set({
        ...draft,
        draftConfig: null,
        isPublished: true,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(websiteConfigs.id, existing.id))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Website published successfully!',
      publishedAt: published.publishedAt,
      config: published,
    });
  } catch (error: any) {
    console.error('Error publishing website:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'website');

export const PUT = withMerchant(handlePUT, 'website');

export const PATCH = withMerchant(handlePATCH, 'website');
