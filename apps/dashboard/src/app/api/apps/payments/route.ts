import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { db, integrationWebhookEvents } from '@sena/database';
import { getPropertyPaystack, safePaystackState } from '@/lib/integrations/paystack';
import { ensureFlutterwaveSchema, getPropertyFlutterwave, safeFlutterwaveState } from '@/lib/integrations/flutterwave';
import { getPreferredOnlineProvider, listEnabledOnlineProviders, setPreferredOnlineProvider } from '@/lib/online-provider';

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

async function catalogFor(propertyId: string, requestOrigin: string, canManage: boolean) {
  await ensureFlutterwaveSchema();
  const paystackRecord = await getPropertyPaystack(propertyId);
  const flutterwaveRecord = await getPropertyFlutterwave(propertyId);
  const lastPaystackWebhook = paystackRecord
    ? await db.query.integrationWebhookEvents.findFirst({ where: eq(integrationWebhookEvents.integrationId, paystackRecord.integration.id), orderBy: [desc(integrationWebhookEvents.receivedAt)] })
    : null;
  const lastFlutterwaveWebhook = flutterwaveRecord
    ? await db.query.integrationWebhookEvents.findFirst({ where: eq(integrationWebhookEvents.integrationId, flutterwaveRecord.integration.id), orderBy: [desc(integrationWebhookEvents.receivedAt)] })
    : null;
  const paystack = safePaystackState(paystackRecord, requestOrigin, lastPaystackWebhook?.receivedAt || null);
  const flutterwave = safeFlutterwaveState(flutterwaveRecord, requestOrigin, lastFlutterwaveWebhook?.receivedAt || null);
  const preferredOnlineProvider = await getPreferredOnlineProvider(propertyId);
  const enabledProviders = Array.from(new Set([
    ...(await listEnabledOnlineProviders(propertyId, 'direct_booking')),
    ...(await listEnabledOnlineProviders(propertyId, 'invoice')),
  ]));
  if (!canManage) {
    return {
      canManage: false,
      preferredOnlineProvider,
      enabledProviders,
      paystack: {
        status: paystack.status,
        displayStatus: paystack.displayStatus,
        mode: 'mode' in paystack ? paystack.mode : undefined,
        enabled: 'enabled' in paystack ? paystack.enabled : false,
      },
      flutterwave: {
        status: flutterwave.status,
        displayStatus: flutterwave.displayStatus,
        mode: 'mode' in flutterwave ? flutterwave.mode : undefined,
        enabled: 'enabled' in flutterwave ? flutterwave.enabled : false,
      },
    };
  }
  return { canManage: true, preferredOnlineProvider, enabledProviders, paystack, flutterwave };
}

export async function GET(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  return NextResponse.json(await catalogFor(result.resolved.propertyId, origin(req), ownerOnly(result.resolved.role)));
}

export async function PATCH(req: NextRequest) {
  const result = await tenant(req); if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) return NextResponse.json({ error: 'Only a property owner can manage payment credentials.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.action !== 'preferred_provider') return NextResponse.json({ error: 'Invalid action.' }, { status: 422 });
  const preferred = body.preferredOnlineProvider === 'paystack' || body.preferredOnlineProvider === 'flutterwave'
    ? body.preferredOnlineProvider
    : body.preferredOnlineProvider === null
      ? null
      : undefined;
  if (preferred === undefined) return NextResponse.json({ error: 'Choose Paystack or Flutterwave.' }, { status: 422 });
  try {
    await setPreferredOnlineProvider(result.resolved.propertyId, result.resolved.userId, preferred);
    return NextResponse.json(await catalogFor(result.resolved.propertyId, origin(req), true));
  } catch (error: any) {
    const notEnabled = error?.message === 'PROVIDER_NOT_ENABLED';
    return NextResponse.json({ error: notEnabled ? 'Connect and enable that provider before making it preferred.' : 'Preferred provider could not be updated.' }, { status: 422 });
  }
}
