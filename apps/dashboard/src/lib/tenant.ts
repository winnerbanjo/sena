import type { NextRequest } from 'next/server';
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
  const requestedPropertyId = session?.user?.propertyId;

  if (requestedPropertyId) {
    const [user, membership, property] = await Promise.all([
      database.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.isActive, true)) }),
      database.query.propertyMembers.findFirst({
        where: and(eq(propertyMembers.userId, userId), eq(propertyMembers.propertyId, requestedPropertyId)),
      }),
      database.query.properties.findFirst({ where: eq(properties.id, requestedPropertyId) }),
    ]);
    if (!user || !membership || !property) return null;
    if (membership.permissions?.includes('status:invited') || membership.permissions?.includes('status:revoked')) return null;
    return { propertyId: property.id, property, user, userId, role: membership.role };
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
  // A removed property membership must not silently select a different property.
  const organizationMembership = await database.query.organizationMembers.findFirst({ where: eq(organizationMembers.userId, userId) });
  if (!organizationMembership || !['owner', 'manager'].includes(organizationMembership.role.toLowerCase())) return null;
  const property = await database.query.properties.findFirst({ where: eq(properties.organizationId, organizationMembership.organizationId) });
  return property ? { propertyId: property.id, property, user, userId, role: organizationMembership.role } : null;
}
