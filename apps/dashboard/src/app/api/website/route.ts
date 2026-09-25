import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, properties, propertyMembers, organizationMembers, websiteConfigs, websiteDomains, eq } from '@sena/database';

async function resolvePropertyForUser(userId: string) {
  const pm = await db.query.propertyMembers.findFirst({
    where: eq(propertyMembers.userId, userId),
  });
  if (pm) return pm.propertyId;

  const om = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, userId),
  });
  if (om) {
    const prop = await db.query.properties.findFirst({
      where: eq(properties.organizationId, om.organizationId),
    });
    if (prop) return prop.id;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    let propertyId = (session?.user as any)?.propertyId;

    if (!propertyId && session?.user?.id) {
      propertyId = await resolvePropertyForUser(session.user.id);
    }

    if (!propertyId) {
      const firstProp = await db.query.properties.findFirst();
      if (firstProp) propertyId = firstProp.id;
    }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Save draft or update config
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    let propertyId = (session?.user as any)?.propertyId;

    if (!propertyId && session?.user?.id) {
      propertyId = await resolvePropertyForUser(session.user.id);
    }

    if (!propertyId) {
      const firstProp = await db.query.properties.findFirst();
      if (firstProp) propertyId = firstProp.id;
    }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Publish changes to live website
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    let propertyId = (session?.user as any)?.propertyId;

    if (!propertyId && session?.user?.id) {
      propertyId = await resolvePropertyForUser(session.user.id);
    }

    if (!propertyId) {
      const firstProp = await db.query.properties.findFirst();
      if (firstProp) propertyId = firstProp.id;
    }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
