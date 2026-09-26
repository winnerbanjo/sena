import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, webhookEndpoints, webhookDeliveries, properties, propertyMembers, organizationMembers } from '@sena/database';
import { eq, and, desc } from 'drizzle-orm';

import { resolveTenantForRequest } from '@/lib/tenant';

async function resolveProperty(session: any, req?: NextRequest) {
  const tenant = await resolveTenantForRequest(session, req);
  if (!tenant) return { propertyId: null, organizationId: null };
  return {
    propertyId: tenant.propertyId,
    organizationId: tenant.property.organizationId,
  };
}

async function handleGET(req: NextRequest) {
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
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
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
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handleDELETE(req: NextRequest) {
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
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'connect');

export const POST = withMerchant(handlePOST, 'connect');

export const DELETE = withMerchant(handleDELETE, 'connect');
