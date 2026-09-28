import { eq } from 'drizzle-orm';
import { db, integrationAuditLogs, properties } from '@sena/database';
import { assertPaystackPayable, getPropertyPaystack } from './integrations/paystack';
import { assertFlutterwavePayable, ensureFlutterwaveSchema, getPropertyFlutterwave } from './integrations/flutterwave';
import { decryptIntegrationSecret } from './integrations/crypto';

export type OnlineProviderId = 'paystack' | 'flutterwave';
export type OnlinePaymentSource = 'invoice' | 'direct_booking' | 'api_booking';

async function paystackEnabled(propertyId: string, source: OnlinePaymentSource) {
  try {
    const record = await getPropertyPaystack(propertyId);
    if (!record?.credential || record.integration.status !== 'connected') return false;
    assertPaystackPayable(record.integration, source);
    decryptIntegrationSecret(record.credential.encryptedValue);
    return true;
  } catch {
    return false;
  }
}

async function flutterwaveEnabled(propertyId: string, source: OnlinePaymentSource) {
  try {
    const record = await getPropertyFlutterwave(propertyId);
    if (!record?.credential || record.integration.status !== 'connected') return false;
    assertFlutterwavePayable(record.integration, source);
    decryptIntegrationSecret(record.credential.encryptedValue);
    return true;
  } catch {
    return false;
  }
}

export async function listEnabledOnlineProviders(propertyId: string, source: OnlinePaymentSource): Promise<OnlineProviderId[]> {
  const enabled: OnlineProviderId[] = [];
  if (await paystackEnabled(propertyId, source)) enabled.push('paystack');
  if (await flutterwaveEnabled(propertyId, source)) enabled.push('flutterwave');
  return enabled;
}

/**
 * Deterministic provider selection.
 * - Only connected + enabled providers for the payment surface may be used.
 * - If only one is enabled, use it.
 * - If both are enabled, use the property preferred provider when it is enabled.
 * - If preferred is null and both are enabled, keep Paystack so existing properties do not switch.
 */
export async function resolveOnlinePaymentProvider(propertyId: string, source: OnlinePaymentSource): Promise<OnlineProviderId | null> {
  await ensureFlutterwaveSchema();
  const enabled = await listEnabledOnlineProviders(propertyId, source);
  if (enabled.length === 0) return null;
  if (enabled.length === 1) return enabled[0];
  const property = await db.query.properties.findFirst({ where: eq(properties.id, propertyId) });
  const preferred = property?.preferredOnlineProvider;
  if (preferred === 'flutterwave' && enabled.includes('flutterwave')) return 'flutterwave';
  if (preferred === 'paystack' && enabled.includes('paystack')) return 'paystack';
  return 'paystack';
}

export async function onlinePaymentAvailable(propertyId: string, source: OnlinePaymentSource) {
  return (await resolveOnlinePaymentProvider(propertyId, source)) !== null;
}

export async function getPreferredOnlineProvider(propertyId: string) {
  const property = await db.query.properties.findFirst({ where: eq(properties.id, propertyId) });
  const preferred = property?.preferredOnlineProvider;
  if (preferred === 'paystack' || preferred === 'flutterwave') return preferred;
  return null;
}

export async function setPreferredOnlineProvider(propertyId: string, actorUserId: string, preferred: OnlineProviderId | null) {
  if (preferred !== null && preferred !== 'paystack' && preferred !== 'flutterwave') throw new Error('INVALID_PROVIDER');
  if (preferred) {
    const enabled = await listEnabledOnlineProviders(propertyId, 'direct_booking');
    const invoiceEnabled = await listEnabledOnlineProviders(propertyId, 'invoice');
    const selectable = new Set([...enabled, ...invoiceEnabled]);
    if (!selectable.has(preferred)) throw new Error('PROVIDER_NOT_ENABLED');
  }
  await db.transaction(async (tx) => {
    await tx.update(properties).set({ preferredOnlineProvider: preferred, updatedAt: new Date() }).where(eq(properties.id, propertyId));
    await tx.insert(integrationAuditLogs).values({
      propertyId,
      actorUserId,
      action: 'payments.preferred_provider_changed',
      details: { preferred: preferred || 'auto' },
    });
  });
  return preferred;
}
