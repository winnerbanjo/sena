import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';

export const ownerOnly = (role: string) => role.toLowerCase() === 'owner';

export function publicAppOrigin(req: NextRequest) {
  const configured = process.env.SENA_PUBLIC_APP_ORIGIN?.replace(/\/$/, '');
  if (configured && /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(configured)) return configured;
  return new URL(req.url).origin;
}

export async function resolveAppsTenant(req: NextRequest) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; propertyId?: string } | undefined;
  const sessionPropertyId = sessionUser?.propertyId;
  if (!sessionUser?.id || !sessionPropertyId) {
    return { error: NextResponse.json({ error: 'Please sign in again.' }, { status: 401 }) };
  }
  const resolved = await resolveTenantForRequest({ user: { id: sessionUser.id, propertyId: sessionPropertyId } }, req);
  if (!resolved || resolved.propertyId !== sessionPropertyId) {
    return { error: NextResponse.json({ error: 'Please sign in again.' }, { status: 401 }) };
  }
  return { resolved };
}

export function jsonNoStore(data: unknown, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
