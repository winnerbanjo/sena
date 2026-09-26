import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, apiRequestLogs, properties, propertyMembers, organizationMembers } from '@sena/database';
import { eq, desc } from 'drizzle-orm';

import { resolveTenantForRequest } from '@/lib/tenant';

async function resolveProperty(session: any, req?: NextRequest) {
  const tenant = await resolveTenantForRequest(session, req);
  return { propertyId: tenant?.propertyId || null };
}

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const { propertyId } = await resolveProperty(session);

    if (!propertyId) {
      return NextResponse.json({ logs: [] });
    }

    const logs = await db
      .select()
      .from(apiRequestLogs)
      .where(eq(apiRequestLogs.propertyId, propertyId))
      .orderBy(desc(apiRequestLogs.createdAt))
      .limit(50);

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Error fetching API logs:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'connect');
