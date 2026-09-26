import { auth } from '@/auth';
import { db, users, and, eq } from '@sena/database';
import { resolveTenantForRequest } from '@/lib/tenant';

export type Workspace = {
  user: { id: string; name: string; email: string; role: string };
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

export async function resolveServerWorkspace(): Promise<ServerWorkspaceResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { state: 'unauthenticated', workspace: null };

    const tenant = await resolveTenantForRequest(session);
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
