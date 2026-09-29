import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PROVIDER_LOGO_SRC, providerLogoSrc, providerCopyKeys } from '../apps/dashboard/src/lib/integrations/platform/provider-branding';
import { listProviderContent, getProviderContent } from '../apps/dashboard/src/lib/integrations/platform/provider-content';

const LOCALE_FILES = ['fr', 'ar', 'sw', 'yo', 'ha', 'ig'] as const;
/** Keys that intentionally match English (official brand names and placeholders). */
const I18N_SAME_AS_EN = new Set([
  'paystack',
  'flutterwave',
  'stripe',
  'googleCalendar',
  'zohoInvoice',
  'zohoBooks',
  'whatsapp',
  'channex',
  'quickbooks',
  'xero',
  'gmail',
  'outlookMail',
  'outlookCalendar',
  'brevo',
  'bookingCom',
  'airbnb',
  'expedia',
  'senaSourceLabel',
  'flowArrow',
  'providerTargetLabel',
  'activityGeneric',
  'webhook',
  'crmCategory',
  'connectPaystack',
  'connectFlutterwave',
  'connectGoogleCalendar',
  'connectZohoInvoice',
  'connectWhatsApp',
]);

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

const enApps = JSON.parse(readFileSync('apps/dashboard/messages/en.json', 'utf8')).apps as Record<string, string>;
for (const loc of LOCALE_FILES) {
  const apps = JSON.parse(readFileSync(`apps/dashboard/messages/${loc}.json`, 'utf8')).apps as Record<string, string>;
  const fallbacks = Object.keys(enApps).filter((key) => apps[key] === enApps[key] && !I18N_SAME_AS_EN.has(key));
  assert.equal(fallbacks.length, 0, `${loc} still has English fallbacks: ${fallbacks.slice(0, 5).join(', ')}`);
}

console.log(`PASS connected-apps logos + provider content (${EXPECTED.length})`);
console.log('PASS connected-apps apps.* locale overlays (fr, ar, sw, yo, ha, ig)');
