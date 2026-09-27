import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { db, integrationWebhookEvents } from '@sena/database';
import { connectPaystack, disconnectPaystack, getPropertyPaystack, safePaystackState, testPaystackConnection, updatePaystackPaymentControls } from '@/lib/integrations/paystack';

const ownerOnly = (role: string) => role.toLowerCase() === 'owner';
const origin = (req: NextRequest) => {
  const configured = process.env.SENA_PUBLIC_APP_ORIGIN?.replace(/\/$/, '');
  if (configured && /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(configured)) return configured;
  return new URL(req.url).origin;
};

async function tenant(req: NextRequest) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; propertyId?: string } | undefined;
  const sessionPropertyId = sessionUser?.propertyId;
  if (!sessionUser?.id || !sessionPropertyId) return { error: NextResponse.json({ error: 'Please sign in again.' }, { status: 401 }) };
  const resolved = await resolveTenantForRequest({ user: { id: sessionUser.id, propertyId: sessionPropertyId } }, req);
  if (!resolved || resolved.propertyId !== sessionPropertyId) return { error: NextResponse.json({ error: 'Please sign in again.' }, { status: 401 }) };
  return { resolved };
}

async function stateFor(propertyId: string, requestOrigin: string) {
  const record = await getPropertyPaystack(propertyId);
  const lastWebhook = record
    ? await db.query.integrationWebhookEvents.findFirst({ where: eq(integrationWebhookEvents.integrationId, record.integration.id), orderBy: [desc(integrationWebhookEvents.receivedAt)] })
    : null;
  return safePaystackState(record, requestOrigin, lastWebhook?.receivedAt || null);
}

export async function GET(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  const state = await stateFor(result.resolved.propertyId, origin(req));
  const canManage = ownerOnly(result.resolved.role);
  if (!canManage) {
    return NextResponse.json({
      canManage: false,
      paystack: {
        status: state.status,
        displayStatus: state.displayStatus,
        mode: 'mode' in state ? state.mode : undefined,
        enabled: 'enabled' in state ? state.enabled : false,
      },
    });
  }
  return NextResponse.json({ canManage: true, paystack: state });
}

export async function POST(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return NextResponse.json({ error: 'Only a property owner can manage payment credentials.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.secretKey !== 'string' || !body.secretKey.trim()) return NextResponse.json({ error: 'Enter your Paystack secret key.' }, { status: 422 });
  try {
    await connectPaystack(result.resolved.propertyId, result.resolved.userId, body.secretKey);
    return NextResponse.json({ paystack: await stateFor(result.resolved.propertyId, origin(req)) }, { status: 201 });
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
    } else if (body.action === 'payments' || body.action === 'toggle_enabled') {
      const patch: Record<string, boolean> = {};
      for (const key of ['enabled', 'acceptOnlinePayments', 'directBooking', 'invoices'] as const) {
        if (typeof body[key] === 'boolean') patch[key] = body[key];
      }
      if (!Object.keys(patch).length) return NextResponse.json({ error: 'Choose a payment setting to update.' }, { status: 422 });
      await updatePaystackPaymentControls(result.resolved.propertyId, result.resolved.userId, patch);
    } else return NextResponse.json({ error: 'Invalid action.' }, { status: 422 });
    return NextResponse.json({ paystack: await stateFor(result.resolved.propertyId, origin(req)) });
  } catch (error: any) {
    const unavailable = error?.message === 'PROVIDER_UNAVAILABLE';
    const disconnected = error?.message === 'PAYSTACK_NOT_CONNECTED';
    return NextResponse.json({ error: disconnected ? 'Connect Paystack before changing these settings.' : unavailable ? 'Paystack is temporarily unavailable. Try again shortly.' : "We couldn't verify this Paystack account." }, { status: disconnected ? 409 : unavailable ? 503 : 422 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return NextResponse.json({ error: 'Only a property owner can manage payment credentials.' }, { status: 403 });
  await disconnectPaystack(result.resolved.propertyId, result.resolved.userId);
  return NextResponse.json({ paystack: { status: 'disconnected', displayStatus: 'disconnected' } });
}
