import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, users, eq } from '@sena/database';
import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401, headers: privateHeaders });
    const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!user?.isActive) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401, headers: privateHeaders });
    const tenant = await resolveTenantForRequest(session, req);
    return NextResponse.json({
      user: { id: user.id, name: user.fullName, email: user.email, phone: user.phone, role: tenant?.role || null },
      property: tenant?.property || null,
    }, { headers: privateHeaders });
  } catch (error) {
    console.error('[workspace-boot] account or property resolution failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'We could not load your account. Please try again.' }, { status: 500, headers: privateHeaders });
  }
}
