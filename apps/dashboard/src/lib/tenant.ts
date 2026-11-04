import { NextResponse, type NextRequest } from 'next/server';
import { db, users, properties, propertyMembers, organizationMembers, eq, and } from '@sena/database';

export interface ResolvedTenant {
  propertyId: string;
  property: typeof properties.$inferSelect;
  user: typeof users.$inferSelect;
  userId: string;
  role: string;
}

/** Resolve identity only from a verified session, and recheck access on every request. */
export async function resolveTenantForRequest(
  session: { user?: { id?: string; propertyId?: string } } | null,
  _req?: NextRequest,
  database = db,
): Promise<ResolvedTenant | null> {
  const userId = session?.user?.id;
  if (!userId) return null;
  const cookiePropertyId = _req?.cookies?.get('sena_property_id')?.value;
  const requestedPropertyId = cookiePropertyId || session?.user?.propertyId;

  if (requestedPropertyId) {
    const [user, membership, property] = await Promise.all([
      database.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.isActive, true)) }),
      database.query.propertyMembers.findFirst({
        where: and(eq(propertyMembers.userId, userId), eq(propertyMembers.propertyId, requestedPropertyId)),
      }),
      database.query.properties.findFirst({ where: eq(properties.id, requestedPropertyId) }),
    ]);
    if (!user || !property) return null;
    if (membership) {
      if (membership.permissions?.includes('status:invited') || membership.permissions?.includes('status:revoked')) return null;
      return { propertyId: property.id, property, user, userId, role: membership.role };
    }
    // Organization ownership check
    if (property.organizationId) {
      const orgMember = await database.query.organizationMembers.findFirst({
        where: and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, property.organizationId)),
      });
      if (orgMember && ['owner', 'manager'].includes(orgMember.role.toLowerCase())) {
        return { propertyId: property.id, property, user, userId, role: orgMember.role };
      }
    }
    return null;
  }

  const [user, membership] = await Promise.all([
    database.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.isActive, true)) }),
    database.query.propertyMembers.findFirst({
      where: eq(propertyMembers.userId, userId),
    }),
  ]);
  if (!user) return null;
  if (membership) {
    if (membership.permissions?.includes('status:invited') || membership.permissions?.includes('status:revoked')) return null;
    const property = await database.query.properties.findFirst({ where: eq(properties.id, membership.propertyId) });
    return property ? { propertyId: property.id, property, user, userId, role: membership.role } : null;
  }
  const organizationMembership = await database.query.organizationMembers.findFirst({ where: eq(organizationMembers.userId, userId) });
  if (!organizationMembership || !['owner', 'manager'].includes(organizationMembership.role.toLowerCase())) return null;
  const property = await database.query.properties.findFirst({ where: eq(properties.organizationId, organizationMembership.organizationId) });
  return property ? { propertyId: property.id, property, user, userId, role: organizationMembership.role } : null;
}

export function assertIndustry(
  tenant: ResolvedTenant,
  allowedIndustries: ('hotel' | 'gym' | 'restaurant')[]
): NextResponse | null {
  const industry = (tenant.property.industry || 'hotel') as 'hotel' | 'gym' | 'restaurant';
  if (!allowedIndustries.includes(industry)) {
    return NextResponse.json(
      { error: `Forbidden: Property industry '${industry}' is not permitted to access this module (${allowedIndustries.join(', ')}).` },
      { status: 403 }
    );
  }
  return null;
}
