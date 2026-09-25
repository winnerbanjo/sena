import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db, apiKeys, apiRequestLogs, idempotencyKeys } from '@sena/database';
import { eq, and } from 'drizzle-orm';

export interface AuthenticatedApiKey {
  id: string;
  propertyId: string;
  organizationId: string;
  name: string;
  keyType: 'publishable' | 'secret';
  keyPrefix: string;
  displayKey: string;
  scopes: string[];
}

export type RequiredScope =
  | 'availability:read'
  | 'rooms:read'
  | 'holds:create'
  | 'reservations:read'
  | 'reservations:create'
  | 'reservations:cancel'
  | 'payments:create'
  | 'properties:read';

/**
 * Hash raw API key using SHA-256
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

/**
 * Generate a new cryptographically secure API Key pair
 */
export function generateApiKey(
  keyType: 'publishable' | 'secret',
  name: string,
  propertyId: string,
  organizationId: string,
  scopes: string[] = []
) {
  const prefix = keyType === 'publishable' ? 'pk_live_' : 'sk_live_';
  const randomHex = crypto.randomBytes(24).toString('hex');
  const fullKey = `${prefix}${randomHex}`;
  const keyHash = hashApiKey(fullKey);

  const displayKey =
    keyType === 'publishable'
      ? `${prefix}${randomHex.slice(0, 8)}...`
      : `${prefix}••••••••••••${randomHex.slice(-4).toUpperCase()}`;

  return {
    rawKey: fullKey,
    keyType,
    keyPrefix: prefix,
    displayKey,
    keyHash,
    name,
    propertyId,
    organizationId,
    scopes,
  };
}

/**
 * Authenticate incoming API request using Bearer token or x-api-key header.
 * Enforces tenant boundary and scope validation.
 */
export async function authenticateApiRequest(
  req: NextRequest,
  requiredScope?: RequiredScope,
  targetPropertyId?: string
): Promise<
  | { success: true; apiKey: AuthenticatedApiKey }
  | { success: false; response: NextResponse }
> {
  const authHeader = req.headers.get('authorization');
  const xApiKey = req.headers.get('x-api-key');

  let rawKey = '';
  if (authHeader?.startsWith('Bearer ')) {
    rawKey = authHeader.substring(7).trim();
  } else if (xApiKey) {
    rawKey = xApiKey.trim();
  }

  if (!rawKey) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing API key. Please provide a valid key in the Authorization: Bearer <key> or x-api-key header.',
          },
        },
        { status: 401 }
      ),
    };
  }

  const keyHash = hashApiKey(rawKey);

  // Look up key in PostgreSQL
  const [record] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isRevoked, false)))
    .limit(1);

  if (!record) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: {
            code: 'INVALID_API_KEY',
            message: 'The provided API key is invalid or has been revoked.',
          },
        },
        { status: 401 }
      ),
    };
  }

  const authenticatedKey: AuthenticatedApiKey = {
    id: record.id,
    propertyId: record.propertyId,
    organizationId: record.organizationId,
    name: record.name,
    keyType: record.keyType as 'publishable' | 'secret',
    keyPrefix: record.keyPrefix,
    displayKey: record.displayKey,
    scopes: (record.scopes as string[]) || [],
  };

  // 1. Strict Tenant Isolation
  if (targetPropertyId && targetPropertyId !== authenticatedKey.propertyId) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: {
            code: 'CROSS_PROPERTY_FORBIDDEN',
            message: 'Tenant boundary violation: this API key does not have access to the requested property.',
          },
        },
        { status: 403 }
      ),
    };
  }

  // 2. Publishable Key Security Restrictions
  if (authenticatedKey.keyType === 'publishable') {
    const allowedPublicScopes: RequiredScope[] = [
      'properties:read',
      'rooms:read',
      'availability:read',
      'holds:create',
      'reservations:create',
    ];

    if (requiredScope && !allowedPublicScopes.includes(requiredScope)) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: {
              code: 'RESTRICTED_KEY_TYPE',
              message: 'Publishable keys (pk_live_...) cannot access private or administrative endpoints. Use a secret key (sk_live_...) server-side.',
            },
          },
          { status: 403 }
        ),
      };
    }
  }

  // 3. Scope validation for secret keys
  if (requiredScope && authenticatedKey.keyType === 'secret') {
    const hasScope =
      authenticatedKey.scopes.length === 0 || // empty array defaults to full access for that property
      authenticatedKey.scopes.includes(requiredScope) ||
      authenticatedKey.scopes.includes('*');

    if (!hasScope) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: {
              code: 'INSUFFICIENT_SCOPE',
              message: `This API key lacks the required scope: '${requiredScope}'.`,
            },
          },
          { status: 403 }
        ),
      };
    }
  }

  // Update lastUsedAt asynchronously
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, record.id))
    .catch((err) => console.error('Failed to update apiKey lastUsedAt:', err));

  return { success: true, apiKey: authenticatedKey };
}

/**
 * Log API request execution
 */
export async function logApiRequest(
  propertyId: string,
  method: string,
  endpoint: string,
  statusCode: number,
  latencyMs: number,
  apiKey?: AuthenticatedApiKey,
  req?: NextRequest
) {
  try {
    const ip = req?.headers.get('x-forwarded-for') || req?.headers.get('x-real-ip') || 'unknown';
    await db.insert(apiRequestLogs).values({
      propertyId,
      apiKeyId: apiKey?.id,
      keyName: apiKey ? `${apiKey.name} (${apiKey.displayKey})` : 'Public / Unauthenticated',
      method: method.toUpperCase(),
      endpoint,
      statusCode,
      latencyMs,
      ipAddress: ip.split(',')[0].trim().slice(0, 50),
    });
  } catch (err) {
    console.error('Failed to record API request log:', err);
  }
}

/**
 * Handle Idempotency-Key deduplication
 */
export async function checkIdempotency(key: string) {
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);

  if (existing && existing.responsePayload) {
    return {
      isReplay: true,
      statusCode: 200,
      payload: existing.responsePayload,
    };
  }

  return { isReplay: false };
}

export async function saveIdempotency(key: string, action: string, responsePayload: any) {
  try {
    await db.insert(idempotencyKeys).values({
      key,
      action,
      responsePayload,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
  } catch (err) {
    console.error('Failed to save idempotency key:', err);
  }
}
