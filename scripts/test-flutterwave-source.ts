import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (rel: string) => readFileSync(join(root, rel), 'utf8');

function pass(name: string) {
  console.log(`PASS ${name}`);
}

function run() {
  const flutterwave = source('apps/dashboard/src/lib/integrations/flutterwave.ts');
  const payments = source('apps/dashboard/src/lib/flutterwave-payments.ts');
  const webhook = source('apps/dashboard/src/app/api/webhooks/flutterwave/[token]/route.ts');
  const checkout = source('apps/dashboard/src/app/api/checkout/route.ts');
  const invoiceCheckout = source('apps/dashboard/src/app/api/invoices/public/[number]/checkout/route.ts');
  const confirm = source('apps/dashboard/src/app/api/payments/public/confirm/route.ts');
  const resolver = source('apps/dashboard/src/lib/online-provider.ts');
  const sw = source('apps/dashboard/public/sw.js');

  assert.match(flutterwave, /verif-hash|verifyFlutterwaveWebhookHash/);
  assert.doesNotMatch(webhook, /x-paystack-signature/);
  assert.match(webhook, /verif-hash/);
  assert.match(webhook, /webhookTokenHash/);
  assert.doesNotMatch(webhook, /searchParams.*propertyId|query.*propertyId/);
  pass('webhook authenticity uses official Flutterwave hash and Sena token tenant resolution');

  assert.match(payments, /api\.flutterwave\.com\/v3\/payments/);
  assert.match(payments, /flutterwaveMajorAmount/);
  assert.match(payments, /AMOUNT_MISMATCH/);
  assert.match(payments, /CURRENCY_MISMATCH/);
  assert.match(payments, /provider: 'flutterwave'/);
  assert.doesNotMatch(payments, /create table|flutterwave_payments|flutterwave_ledger/i);
  pass('initialization verifies amount/currency and settles the existing ledger');

  assert.match(confirm, /SENA_/);
  assert.doesNotMatch(confirm, /body\.amount|body\.propertyId/);
  assert.match(confirm, /verifyPropertyFlutterwaveTransaction/);
  pass('callback confirm never trusts browser amount or propertyId');

  assert.match(checkout, /resolveOnlinePaymentProvider/);
  assert.match(invoiceCheckout, /resolveOnlinePaymentProvider/);
  assert.match(resolver, /return 'paystack'/);
  assert.match(resolver, /preferred === 'flutterwave'/);
  pass('provider selection is deterministic and defaults to Paystack when both are enabled');

  assert.match(flutterwave, /FLWSECK_TEST-/);
  assert.match(flutterwave, /encryptIntegrationSecret/);
  assert.match(flutterwave, /maskSecret/);
  assert.doesNotMatch(source('apps/dashboard/src/app/api/apps/flutterwave/route.ts'), /secretKey: record|encryptedValue/);
  pass('credentials are encrypted, masked, and not returned by GET handlers');

  assert.match(sw, /BYPASS_PATH_PREFIXES = \['\/api\/'/);
  assert.match(sw, /\/api\/webhooks/);
  assert.match(sw, /\/api\/payments/);
  pass('PWA does not cache payment or webhook APIs');

  assert.doesNotMatch(source('apps/dashboard/src/lib/integrations/paystack.ts'), /flutterwave/);
  pass('Paystack integration module remains Paystack-specific');
}

run();
console.log('\nFlutterwave architecture source checks passed');
