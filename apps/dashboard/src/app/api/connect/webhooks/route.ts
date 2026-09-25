import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, webhookEndpoints, webhookDeliveries, properties, propertyMembers, organizationMembers } from '@sena/database';
import { eq, and, desc } from 'drizzle-orm';

async function resolveProperty(session: any) {
  let propertyId = (session?.user as any)?.propertyId;
  const userId = session?.user?.id;

  let organizationId = (session?.user as any)?.organizationId;

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
        organizationId = orgMembership.organizationId;
        const orgProp = await db.query.properties.findFirst({
          where: eq(properties.organizationId, orgMembership.organizationId),
        });
        if (orgProp) propertyId = orgProp.id;
      }
    }
  }

  if (!propertyId) {
    const firstProp = await db.query.properties.findFirst();
    if (firstProp) {
      propertyId = firstProp.id;
      organizationId = firstProp.organizationId;
    }
  }

  if (propertyId && !organizationId) {
    const prop = await db.query.properties.findFirst({
      where: eq(properties.id, propertyId),
    });
    if (prop) organizationId = prop.organizationId;
  }

  return { propertyId, organizationId };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const { propertyId } = await resolveProperty(session);

    if (!propertyId) {
      return NextResponse.json({ webhooks: [], deliveries: [] });
    }

    const endpoints = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.propertyId, propertyId))
      .orderBy(desc(webhookEndpoints.createdAt));

    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.propertyId, propertyId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(30);

    return NextResponse.json({ webhooks: endpoints, deliveries });
  } catch (error: any) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const { propertyId, organizationId } = await resolveProperty(session);

    if (!propertyId || !organizationId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const url = (body.url || '').trim();
    const description = (body.description || '').trim();
    const events = Array.isArray(body.events) && body.events.length > 0 ? body.events : ['*'];

    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Valid HTTP/HTTPS webhook URL required' }, { status: 400 });
    }

    const signingSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const [inserted] = await db
      .insert(webhookEndpoints)
      .values({
        propertyId,
        organizationId,
        url,
        description,
        events,
        signingSecret,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ webhook: inserted }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const { propertyId } = await resolveProperty(session);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || !propertyId) {
      return NextResponse.json({ error: 'Missing endpoint ID' }, { status: 400 });
    }

    await db
      .delete(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.propertyId, propertyId)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
