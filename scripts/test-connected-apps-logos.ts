import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PROVIDER_LOGO_SRC, providerLogoSrc, providerCopyKeys } from '../apps/dashboard/src/lib/integrations/platform/provider-branding';
import { listProviderContent, getProviderContent } from '../apps/dashboard/src/lib/integrations/platform/provider-content';

const EXPECTED = [
  'paystack',
  'flutterwave',
  'stripe',
  'zoho_invoice',
  'zoho_books',
  'quickbooks',
  'xero',
  'google_calendar',
  'outlook_calendar',
  'whatsapp',
  'gmail',
  'outlook_mail',
  'brevo',
  'channex',
  'booking_com',
  'airbnb',
  'expedia',
];

for (const provider of EXPECTED) {
  const content = getProviderContent(provider);
  assert.ok(content, `missing content for ${provider}`);
  const src = providerLogoSrc(provider);
  assert.ok(src, `missing logo mapping for ${provider}`);
  assert.ok(existsSync(`apps/dashboard/public${src}`), `missing logo file for ${provider}: ${src}`);
  assert.ok(providerCopyKeys(provider), `missing copy keys for ${provider}`);
  assert.ok(content.overviewKey, `missing overview for ${provider}`);
  assert.ok(content.benefitKeys.length >= 1, `missing benefits for ${provider}`);
  assert.ok(content.goodToKnowKey, `missing goodToKnow for ${provider}`);
}

assert.equal(listProviderContent().length, EXPECTED.length);
assert.equal(Object.keys(PROVIDER_LOGO_SRC).length, EXPECTED.length);
console.log(`PASS connected-apps logos + provider content (${EXPECTED.length})`);
