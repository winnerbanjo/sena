import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, properties, propertyMembers, organizationMembers, websiteDomains, eq } from '@sena/database';

const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'admin',
  'api',
  'mail',
  'support',
  'help',
  'status',
  'blog',
  'static',
  'assets',
  'cdn',
  'booking',
  'book',
  'preview',
]);

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

export async function POST(req: NextRequest) {
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
    const rawSlug = String(body.slug || '').trim().toLowerCase();

    // Validate format: only lowercase a-z, 0-9, and single hyphens
    const cleanSlug = rawSlug.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (!cleanSlug || cleanSlug.length < 3 || cleanSlug.length > 50) {
      return NextResponse.json(
        { error: 'Slug must be between 3 and 50 lowercase alphanumeric characters.' },
        { status: 400 }
      );
    }

    if (RESERVED_SLUGS.has(cleanSlug)) {
      return NextResponse.json(
        { error: `The name "${cleanSlug}" is reserved by Sena system architecture. Please choose another.` },
        { status: 400 }
      );
    }

    // Check if slug taken by another property
    const existing = await db.query.properties.findFirst({
      where: eq(properties.slug, cleanSlug),
    });

    if (existing && existing.id !== propertyId) {
      return NextResponse.json(
        { error: `The subdomain "${cleanSlug}.sena.ng" is already taken. Please pick another name.` },
        { status: 409 }
      );
    }

    // Update property slug
    await db
      .update(properties)
      .set({ slug: cleanSlug, updatedAt: new Date() })
      .where(eq(properties.id, propertyId));

    // Update or insert website_domains entry
    const newDomain = `${cleanSlug}.sena.ng`;
    const existingSubdomain = await db.query.websiteDomains.findFirst({
      where: eq(websiteDomains.propertyId, propertyId),
    });

    if (existingSubdomain) {
      await db
        .update(websiteDomains)
        .set({ domain: newDomain })
        .where(eq(websiteDomains.id, existingSubdomain.id));
    } else {
      await db.insert(websiteDomains).values({
        propertyId,
        domain: newDomain,
        type: 'sena_subdomain',
        status: 'active',
        isPrimary: true,
      });
    }

    return NextResponse.json({
      success: true,
      slug: cleanSlug,
      subdomain: newDomain,
    });
  } catch (error: any) {
    console.error('Error updating property slug:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
