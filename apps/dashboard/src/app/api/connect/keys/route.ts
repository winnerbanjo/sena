import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, apiKeys, properties, propertyMembers, organizationMembers } from '@sena/database';
import { eq, and, desc } from 'drizzle-orm';
import { generateApiKey } from '../../../../lib/api-auth';

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
      return NextResponse.json({ keys: [] });
    }

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyType: apiKeys.keyType,
        keyPrefix: apiKeys.keyPrefix,
        displayKey: apiKeys.displayKey,
        scopes: apiKeys.scopes,
        isRevoked: apiKeys.isRevoked,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.propertyId, propertyId))
      .orderBy(desc(apiKeys.createdAt));

    return NextResponse.json({ keys });
  } catch (error: any) {
    console.error('Error fetching API keys:', error);
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
    const name = (body.name || 'Default Key').trim();
    const keyType = body.keyType === 'secret' ? 'secret' : 'publishable';
    const scopes = Array.isArray(body.scopes) ? body.scopes : [];

    const keyData = generateApiKey(keyType, name, propertyId, organizationId, scopes);

    const [inserted] = await db
      .insert(apiKeys)
      .values({
        propertyId,
        organizationId,
        name: keyData.name,
        keyType: keyData.keyType,
        keyPrefix: keyData.keyPrefix,
        displayKey: keyData.displayKey,
        keyHash: keyData.keyHash,
        scopes: keyData.scopes,
      })
      .returning();

    // Return rawKey ONCE to the user
    return NextResponse.json({
      key: {
        id: inserted.id,
        name: inserted.name,
        keyType: inserted.keyType,
        displayKey: inserted.displayKey,
        scopes: inserted.scopes,
        createdAt: inserted.createdAt,
        rawKey: keyData.rawKey,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating API key:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handleDELETE(req: NextRequest) {
  try {
    const session = await auth();
    const { propertyId } = await resolveProperty(session);
    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get('id');

    if (!keyId || !propertyId) {
      return NextResponse.json({ error: 'Missing key ID' }, { status: 400 });
    }

    await db
      .update(apiKeys)
      .set({ isRevoked: true })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.propertyId, propertyId)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error revoking API key:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'connect');

export const POST = withMerchant(handlePOST, 'connect');

export const DELETE = withMerchant(handleDELETE, 'connect');
