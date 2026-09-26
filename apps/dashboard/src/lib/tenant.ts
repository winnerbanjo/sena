import type { NextRequest } from 'next/server';
import { db, users, properties, propertyMembers, organizationMembers, eq, and } from '@sena/database';

export interface ResolvedTenant {
  propertyId: string;
  property: typeof properties.$inferSelect;
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
  const user = await database.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.isActive, true)) });
  if (!user) return null;

  const requestedPropertyId = session?.user?.propertyId;
  const membership = await database.query.propertyMembers.findFirst({
    where: requestedPropertyId
      ? and(eq(propertyMembers.userId, userId), eq(propertyMembers.propertyId, requestedPropertyId))
      : eq(propertyMembers.userId, userId),
  });
  if (membership) {
    if (membership.permissions?.includes('status:invited') || membership.permissions?.includes('status:revoked')) return null;
    const property = await database.query.properties.findFirst({ where: eq(properties.id, membership.propertyId) });
    return property ? { propertyId: property.id, property, userId, role: membership.role } : null;
  }
  // A removed property membership must not silently select a different property.
  if (requestedPropertyId) return null;
  const organizationMembership = await database.query.organizationMembers.findFirst({ where: eq(organizationMembers.userId, userId) });
  if (!organizationMembership || !['owner', 'manager'].includes(organizationMembership.role.toLowerCase())) return null;
  const property = await database.query.properties.findFirst({ where: eq(properties.organizationId, organizationMembership.organizationId) });
  return property ? { propertyId: property.id, property, userId, role: organizationMembership.role } : null;
}
