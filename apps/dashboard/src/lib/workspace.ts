import { auth } from '@/auth';
import { db, users, properties, propertyMembers, and, eq } from '@sena/database';
import { resolveTenantForRequest } from '@/lib/tenant';

export type Workspace = {
  user: { id: string; name: string; email: string; role: string; locale: string };
  property: {
    id: string;
    slug?: string;
    name: string;
    address: string;
    timezone: string;
    currency: string;
    checkInTime: string;
    checkOutTime: string;
  };
};

export type ServerWorkspaceResult =
  | { state: 'ready'; workspace: Workspace }
  | { state: 'unauthenticated'; workspace: null }
  | { state: 'no_property'; workspace: null }
  | { state: 'server_error'; workspace: null };

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function resolveWorkspaceTenant(session: { user?: { id?: string; propertyId?: string } }) {
  const userId = session.user?.id;
  const propertyId = session.user?.propertyId;
  if (!userId || !propertyId) return resolveTenantForRequest(session);

  const [row] = await db
    .select({ user: users, property: properties, role: propertyMembers.role, permissions: propertyMembers.permissions })
    .from(users)
    .innerJoin(propertyMembers, and(eq(propertyMembers.userId, users.id), eq(propertyMembers.propertyId, propertyId)))
    .innerJoin(properties, eq(properties.id, propertyMembers.propertyId))
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1);
  if (!row || row.permissions?.includes('status:invited') || row.permissions?.includes('status:revoked')) return null;
  return { propertyId: row.property.id, property: row.property, user: row.user, userId: row.user.id, role: row.role };
}

export async function resolveServerWorkspace(): Promise<ServerWorkspaceResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { state: 'unauthenticated', workspace: null };

    let tenant;
    try {
      tenant = await resolveWorkspaceTenant(session);
    } catch (firstError) {
      // One short retry absorbs a cold or recycled database connection without
      // turning a valid login into a false "property unavailable" screen.
      await delay(150);
      try {
        tenant = await resolveWorkspaceTenant(session);
      } catch {
        throw firstError;
      }
    }
    if (!tenant) {
      const activeUser = await db.query.users.findFirst({
        where: and(eq(users.id, session.user.id), eq(users.isActive, true)),
        columns: { id: true },
      });
      return activeUser
        ? { state: 'no_property', workspace: null }
        : { state: 'unauthenticated', workspace: null };
    }

    return {
      state: 'ready',
      workspace: {
        user: {
          id: tenant.user.id,
          name: tenant.user.fullName,
          email: tenant.user.email,
          role: tenant.role,
          locale: tenant.user.locale || 'en',
        },
        property: {
          id: tenant.property.id,
          slug: tenant.property.slug || undefined,
          name: tenant.property.name,
          address: tenant.property.address,
          timezone: tenant.property.timezone,
          currency: tenant.property.currency,
          checkInTime: tenant.property.checkInTime,
          checkOutTime: tenant.property.checkOutTime,
        },
      },
    };
  } catch (error) {
    console.error('[workspace-boot] server workspace resolution failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return { state: 'server_error', workspace: null };
  }
}
