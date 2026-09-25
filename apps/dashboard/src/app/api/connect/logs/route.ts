import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, apiRequestLogs, properties, propertyMembers, organizationMembers } from '@sena/database';
import { eq, desc } from 'drizzle-orm';

async function resolveProperty(session: any) {
  let propertyId = (session?.user as any)?.propertyId;
  const userId = session?.user?.id;

  if (!propertyId && userId) {
    const membership = await db.query.propertyMembers.findFirst({
      where: eq(propertyMembers.userId, userId),
    });
    if (membership) {
      propertyId = membership.propertyId;
    } else {
      const orgMembership = await db.query.organizationMembers.findFirst({
        where: eq(organizationMembers.userId, userId),
      });
      if (orgMembership) {
        const orgProp = await db.query.properties.findFirst({
          where: eq(properties.organizationId, orgMembership.organizationId),
        });
        if (orgProp) propertyId = orgProp.id;
      }
    }
  }

  if (!propertyId) {
    const firstProp = await db.query.properties.findFirst();
    if (firstProp) propertyId = firstProp.id;
  }

  return { propertyId };
}

export async function GET(req: NextRequest) {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
