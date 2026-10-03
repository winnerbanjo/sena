import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  users,
  properties,
  propertyMembers,
  organizationMembers,
  eq,
  and,
} from '@sena/database';
import { membershipIsUsable } from '@/lib/membership-access';
import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 });
    }

    const userId = session.user.id;
    const currentTenant = await resolveTenantForRequest(session, req);
    const currentPropertyId = currentTenant?.propertyId || (session.user as any)?.propertyId;

    // 1. Direct property memberships
    const memberRows = await db
      .select({
        propertyId: propertyMembers.propertyId,
        role: propertyMembers.role,
        permissions: propertyMembers.permissions,
        propertyName: properties.name,
        propertySlug: properties.slug,
        address: properties.address,
        timezone: properties.timezone,
        currency: properties.currency,
      })
      .from(propertyMembers)
      .innerJoin(properties, eq(propertyMembers.propertyId, properties.id))
      .where(eq(propertyMembers.userId, userId));

    const usableMembers = memberRows.filter((r) => membershipIsUsable(r.permissions));

    // 2. Organization-level property access (for owners/managers)
    const orgRows = await db
      .select({
        propertyId: properties.id,
        role: organizationMembers.role,
        propertyName: properties.name,
        propertySlug: properties.slug,
        address: properties.address,
        timezone: properties.timezone,
        currency: properties.currency,
      })
      .from(organizationMembers)
      .innerJoin(properties, eq(properties.organizationId, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, userId));

    // Deduplicate properties by propertyId
    const propMap = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string | null;
        address: string | null;
        timezone: string;
        currency: string;
        role: string;
        isCurrent: boolean;
      }
    >();

    for (const row of usableMembers) {
      propMap.set(row.propertyId, {
        id: row.propertyId,
        name: row.propertyName,
        slug: row.propertySlug,
        address: row.address,
        timezone: row.timezone,
        currency: row.currency,
        role: row.role,
        isCurrent: row.propertyId === currentPropertyId,
      });
    }

    for (const row of orgRows) {
      if (!propMap.has(row.propertyId)) {
        propMap.set(row.propertyId, {
          id: row.propertyId,
          name: row.propertyName,
          slug: row.propertySlug,
          address: row.address,
          timezone: row.timezone,
          currency: row.currency,
          role: row.role,
          isCurrent: row.propertyId === currentPropertyId,
        });
      }
    }

    const availableProperties = Array.from(propMap.values());

    return NextResponse.json({
      properties: availableProperties,
      currentPropertyId: currentPropertyId || availableProperties[0]?.id || null,
    });
  } catch (error: any) {
    console.error('Error fetching user properties:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetPropertyId = body.propertyId;

    if (!targetPropertyId || typeof targetPropertyId !== 'string') {
      return NextResponse.json({ error: 'Property ID is required.' }, { status: 400 });
    }

    const userId = session.user.id;

    // Verify authorized access
    const directMember = await db.query.propertyMembers.findFirst({
      where: and(
        eq(propertyMembers.userId, userId),
        eq(propertyMembers.propertyId, targetPropertyId)
      ),
    });

    const isDirectUsable = directMember && membershipIsUsable(directMember.permissions);

    let isAuthorized = isDirectUsable;
    if (!isAuthorized) {
      // Check organization membership
      const targetProp = await db.query.properties.findFirst({
        where: eq(properties.id, targetPropertyId),
      });
      if (targetProp?.organizationId) {
        const orgMember = await db.query.organizationMembers.findFirst({
          where: and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, targetProp.organizationId)
          ),
        });
        if (orgMember && ['owner', 'manager'].includes(orgMember.role.toLowerCase())) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'You do not have access to this property.' },
        { status: 403 }
      );
    }

    const res = NextResponse.json({ ok: true, propertyId: targetPropertyId });
    // Set cookie for active property switch
    res.cookies.set('sena_property_id', targetPropertyId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });

    return res;
  } catch (error: any) {
    console.error('Error switching property:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to switch property' },
      { status: 500 }
    );
  }
}
