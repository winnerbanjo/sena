import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { db, integrationWebhookEvents } from '@sena/database';
import {
  connectFlutterwave,
  disconnectFlutterwave,
  getPropertyFlutterwave,
  rotateFlutterwaveWebhookSecret,
  safeFlutterwaveState,
  testFlutterwaveConnection,
  updateFlutterwavePaymentControls,
} from '@/lib/integrations/flutterwave';

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

async function stateFor(propertyId: string, requestOrigin: string, webhookSecretOnce?: string) {
  const record = await getPropertyFlutterwave(propertyId);
  const lastWebhook = record
    ? await db.query.integrationWebhookEvents.findFirst({ where: eq(integrationWebhookEvents.integrationId, record.integration.id), orderBy: [desc(integrationWebhookEvents.receivedAt)] })
    : null;
  return safeFlutterwaveState(record, requestOrigin, lastWebhook?.receivedAt || null, webhookSecretOnce);
}

export async function GET(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  const state = await stateFor(result.resolved.propertyId, origin(req));
  const canManage = ownerOnly(result.resolved.role);
  if (!canManage) {
    return NextResponse.json({
      canManage: false,
      flutterwave: {
        status: state.status,
        displayStatus: state.displayStatus,
        mode: 'mode' in state ? state.mode : undefined,
        enabled: 'enabled' in state ? state.enabled : false,
      },
    });
  }
  return NextResponse.json({ canManage: true, flutterwave: state });
}

export async function POST(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return NextResponse.json({ error: 'Only a property owner can manage payment credentials.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.secretKey !== 'string' || !body.secretKey.trim()) return NextResponse.json({ error: 'Enter your Flutterwave secret key.' }, { status: 422 });
  try {
    const connected = await connectFlutterwave(result.resolved.propertyId, result.resolved.userId, body.secretKey);
    return NextResponse.json({ flutterwave: await stateFor(result.resolved.propertyId, origin(req), connected.webhookSecret) }, { status: 201 });
  } catch (error: any) {
    return connectionError(error, "Connection failed. Check your Flutterwave secret key and try again.");
  }
}

export async function PATCH(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return NextResponse.json({ error: 'Only a property owner can manage payment credentials.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    let webhookSecretOnce: string | undefined;
    if (body.action === 'test') {
      await testFlutterwaveConnection(result.resolved.propertyId);
    } else if (body.action === 'replace' && typeof body.secretKey === 'string' && body.secretKey.trim()) {
      await connectFlutterwave(result.resolved.propertyId, result.resolved.userId, body.secretKey, true);
    } else if (body.action === 'rotate_webhook_secret') {
      webhookSecretOnce = await rotateFlutterwaveWebhookSecret(result.resolved.propertyId, result.resolved.userId);
    } else if (body.action === 'payments' || body.action === 'toggle_enabled') {
      const patch: Record<string, boolean> = {};
      for (const key of ['enabled', 'acceptOnlinePayments', 'directBooking', 'invoices'] as const) {
        if (typeof body[key] === 'boolean') patch[key] = body[key];
      }
      if (!Object.keys(patch).length) return NextResponse.json({ error: 'Choose a payment setting to update.' }, { status: 422 });
      await updateFlutterwavePaymentControls(result.resolved.propertyId, result.resolved.userId, patch);
    } else return NextResponse.json({ error: 'Invalid action.' }, { status: 422 });
    return NextResponse.json({ flutterwave: await stateFor(result.resolved.propertyId, origin(req), webhookSecretOnce) });
  } catch (error: any) {
    if (error?.message === 'FLUTTERWAVE_NOT_CONNECTED') return NextResponse.json({ error: 'Connect Flutterwave before changing these settings.', code: 'FLUTTERWAVE_NOT_CONNECTED' }, { status: 409 });
    return connectionError(error, "We couldn't verify this Flutterwave account.");
  }
}

function connectionError(error: { message?: string }, fallback: string) {
  const code = error?.message;
  if (code === 'PROVIDER_UNAVAILABLE') return NextResponse.json({ error: 'Flutterwave is temporarily unavailable. Try again shortly.', code }, { status: 503 });
  if (code === 'ENCRYPTION_UNAVAILABLE') return NextResponse.json({ error: 'Payment credential storage is unavailable.', code }, { status: 503 });
  if (code === 'CREDENTIAL_UNREADABLE') return NextResponse.json({ error: 'The stored Flutterwave connection could not be read. Reconnect Flutterwave to replace it.', code }, { status: 409 });
  if (code === 'INVALID_CREDENTIAL') return NextResponse.json({ error: "Connection failed. Check your Flutterwave secret key and try again.", code }, { status: 422 });
  return NextResponse.json({ error: fallback, code: 'CONNECTION_FAILED' }, { status: 422 });
}

export async function DELETE(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return NextResponse.json({ error: 'Only a property owner can manage payment credentials.' }, { status: 403 });
  await disconnectFlutterwave(result.resolved.propertyId, result.resolved.userId);
  return NextResponse.json({ flutterwave: { status: 'disconnected', displayStatus: 'disconnected' } });
}
