import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { connectPaystack, disconnectPaystack, getPropertyPaystack, safePaystackState, testPaystackConnection } from '@/lib/integrations/paystack';

const ownerOnly = (role: string) => role.toLowerCase() === 'owner';
const origin = (req: NextRequest) => new URL(req.url).origin;

async function tenant(req: NextRequest) {
  const resolved = await resolveTenantForRequest(await auth(), req);
  if (!resolved) return { error: NextResponse.json({ error: 'Please sign in again.' }, { status: 401 }) };
  return { resolved };
}

export async function GET(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ paystack: safePaystackState(await getPropertyPaystack(result.resolved.propertyId), origin(req)) });
}

export async function POST(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return NextResponse.json({ error: 'Only a property owner can manage payment credentials.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.secretKey !== 'string' || !body.secretKey.trim()) return NextResponse.json({ error: 'Enter your Paystack secret key.' }, { status: 422 });
  try {
    await connectPaystack(result.resolved.propertyId, result.resolved.userId, body.secretKey);
    return NextResponse.json({ paystack: safePaystackState(await getPropertyPaystack(result.resolved.propertyId), origin(req)) }, { status: 201 });
  } catch (error: any) {
    const unavailable = error?.message === 'PROVIDER_UNAVAILABLE';
    return NextResponse.json({ error: unavailable ? 'Paystack is temporarily unavailable. Try again shortly.' : "We couldn't connect this Paystack account. Check your secret key and try again." }, { status: unavailable ? 503 : 422 });
  }
}

export async function PATCH(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return NextResponse.json({ error: 'Only a property owner can manage payment credentials.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === 'test') {
      await testPaystackConnection(result.resolved.propertyId);
    } else if (body.action === 'replace' && typeof body.secretKey === 'string' && body.secretKey.trim()) {
      await connectPaystack(result.resolved.propertyId, result.resolved.userId, body.secretKey, true);
    } else return NextResponse.json({ error: 'Invalid action.' }, { status: 422 });
    return NextResponse.json({ paystack: safePaystackState(await getPropertyPaystack(result.resolved.propertyId), origin(req)) });
  } catch (error: any) {
    const unavailable = error?.message === 'PROVIDER_UNAVAILABLE';
    return NextResponse.json({ error: unavailable ? 'Paystack is temporarily unavailable. Try again shortly.' : "We couldn't verify this Paystack account." }, { status: unavailable ? 503 : 422 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return NextResponse.json({ error: 'Only a property owner can manage payment credentials.' }, { status: 403 });
  await disconnectPaystack(result.resolved.propertyId, result.resolved.userId);
  return NextResponse.json({ paystack: { status: 'disconnected' } });
}
