import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (rel: string) => readFileSync(join(root, rel), 'utf8');
const json = (rel: string) => JSON.parse(source(rel));

function pass(name: string) {
  console.log(`PASS ${name}`);
}

function run() {
  const sidebar = source('apps/dashboard/src/components/sidebar.tsx');
  const palette = source('apps/dashboard/src/components/command-palette.tsx');
  const appsPage = source('apps/dashboard/src/app/apps/page.tsx');
  const channelsPage = source('apps/dashboard/src/app/channels/page.tsx');
  const nextConfig = source('apps/dashboard/next.config.mjs');
  const panel = source('apps/dashboard/src/components/paystack-connection-panel.tsx');
  const flutterwavePanel = source('apps/dashboard/src/components/flutterwave-connection-panel.tsx');
  const paystackRoute = source('apps/dashboard/src/app/api/apps/paystack/route.ts');
  const topbar = source('apps/dashboard/src/components/topbar.tsx');
  const en = json('apps/dashboard/messages/en.json');
  const fr = json('apps/dashboard/messages/fr.json');
  const ar = json('apps/dashboard/messages/ar.json');
  const sw = json('apps/dashboard/messages/sw.json');
  const yo = json('apps/dashboard/messages/yo.json');
  const ha = json('apps/dashboard/messages/ha.json');
  const ig = json('apps/dashboard/messages/ig.json');

  assert.match(sidebar, /labelKey: 'apps', href: '\/apps'/);
  assert.match(en.navigation.apps, /Connected Apps/);
  assert.doesNotMatch(sidebar, /href: '\/channels'/);
  assert.doesNotMatch(sidebar, /labelKey: 'channels'/);
  pass('TEST 1 Sidebar contains Connected Apps and no separate Apps/Channels items');

  assert.match(appsPage, /t\('title'\)/);
  assert.match(appsPage, /paymentsCategory/);
  assert.match(appsPage, /bookingChannelsCategory/);
  assert.equal(en.apps.title, 'Connected Apps');
  assert.notEqual(en.apps.title, 'Apps');
  pass('TEST 2 /apps loads Connected Apps');

  assert.match(nextConfig, /source: '\/channels'/);
  assert.match(nextConfig, /destination: '\/apps'/);
  assert.match(channelsPage, /redirect\(suffix \? `\/apps\?\$\{suffix\}` : '\/apps'\)/);
  assert.doesNotMatch(channelsPage, /redirect\('\/channels'/);
  pass('TEST 3 /channels redirects to /apps');

  assert.match(appsPage, /fetch\('\/api\/apps\/payments'/);
  assert.match(appsPage, /displayStatus/);
  assert.match(appsPage, /statusConnectedEnabled/);
  assert.match(appsPage, /statusConnectedDisabled/);
  assert.match(appsPage, /statusNotConnected/);
  assert.match(appsPage, /t\('flutterwave'\)/);
  assert.equal(en.apps.flutterwave, 'Flutterwave');
  assert.equal(en.apps.flutterwaveDescription, "Accept online payments directly into your hotel's Flutterwave account.");
  pass('TEST 4 Paystack actual connection state is preserved');

  assert.match(appsPage, /manage=paystack/);
  assert.match(appsPage, /PaystackConnectionPanel/);
  assert.match(panel, /fetch\('\/api\/apps\/paystack'/);
  assert.match(panel, /action: 'payments'/);
  pass('TEST 5 Paystack Manage opens existing management flow');

  assert.match(appsPage, /manage=flutterwave/);
  assert.match(appsPage, /FlutterwaveConnectionPanel/);
  assert.match(flutterwavePanel, /fetch\('\/api\/apps\/flutterwave'/);
  assert.match(flutterwavePanel, /rtl:rotate-180/);
  assert.match(source('apps/dashboard/src/app/api/apps/flutterwave/route.ts'), /ownerOnly/);
  pass('TEST Flutterwave Connect / Manage stays owner-scoped');

  const paystackLib = source('apps/dashboard/src/lib/integrations/paystack.ts');
  assert.match(paystackLib, /if \(!controls\.enabled \|\| !controls\.acceptOnlinePayments\) return 'disabled' as const/);
  assert.match(paystackLib, /return 'connected' as const/);
  assert.match(panel, /const isEnabled = paystack\.enabled !== false && paystack\.acceptOnlinePayments !== false/);
  assert.match(panel, /enabled: !isEnabled/);
  pass('TEST 6 Connected ≠ Enabled remains intact');

  assert.match(appsPage, /t\('bookingCom'\)/);
  assert.match(appsPage, /t\('statusComingSoon'\)/);
  assert.equal(en.apps.bookingCom, 'Booking.com');
  pass('TEST 7 Booking.com shows Coming soon');

  assert.match(appsPage, /t\('airbnb'\)/);
  assert.equal(en.apps.airbnb, 'Airbnb');
  pass('TEST 8 Airbnb shows Coming soon');

  assert.match(appsPage, /t\('expedia'\)/);
  assert.equal(en.apps.expedia, 'Expedia');
  pass('TEST 9 Expedia shows Coming soon');

  assert.doesNotMatch(appsPage, /Syncing|fake|connectedAt|lastSync/i);
  assert.doesNotMatch(appsPage, /booking\.com\/|airbnb\.com|expedia\.com/i);
  const otaCards = ['bookingCom', 'airbnb', 'expedia']
    .map((key) => appsPage.includes(`t('${key}')`))
    .every(Boolean);
  assert.equal(otaCards, true);
  assert.doesNotMatch(appsPage, /actionHref=\{.*booking/i);
  pass('TEST 10 No fake OTA connection state');

  assert.match(paystackRoute, /resolveTenantForRequest/);
  assert.match(paystackRoute, /resolved\.propertyId !== sessionPropertyId/);
  assert.match(source('apps/dashboard/src/lib/integrations/paystack.ts'), /eq\(integrations\.propertyId, propertyId\)/);
  pass('TEST 11 Tenant isolation');

  assert.match(paystackRoute, /ownerOnly/);
  assert.match(paystackRoute, /Only a property owner can manage payment credentials/);
  assert.match(paystackRoute, /canManage: false/);
  assert.match(appsPage, /canManage/);
  pass('TEST 12 Role security');

  assert.equal(en.apps.title, 'Connected Apps');
  assert.equal(en.apps.subtitle, 'Connect the services your property uses with Sena.');
  assert.equal(en.navigation.apps, 'Connected Apps');
  pass('TEST 13 English');

  assert.equal(fr.apps.title, 'Applications connectées');
  assert.equal(fr.navigation.apps, 'Applications connectées');
  assert.equal(fr.apps.paystack, 'Paystack');
  assert.equal(fr.apps.flutterwave, 'Flutterwave');
  pass('TEST 14 French');

  assert.equal(ar.apps.title, 'التطبيقات المتصلة');
  assert.equal(ar.navigation.apps, 'التطبيقات المتصلة');
  assert.match(source('apps/dashboard/src/components/connected-app-card.tsx'), /rtl:rotate-180/);
  assert.match(panel, /rtl:rotate-180/);
  pass('TEST 15 Arabic RTL');

  for (const [locale, catalog] of [
    ['sw', sw],
    ['yo', yo],
    ['ha', ha],
    ['ig', ig],
  ] as const) {
    assert.equal(catalog.apps.paystack, 'Paystack');
    assert.equal(catalog.apps.flutterwave, 'Flutterwave');
    assert.equal(catalog.apps.bookingCom, 'Booking.com');
    assert.equal(catalog.apps.airbnb, 'Airbnb');
    assert.equal(catalog.apps.expedia, 'Expedia');
    assert.notEqual(catalog.apps.title, 'Apps');
    assert.ok(String(catalog.apps.statusComingSoon).length > 2, locale);
  }
  pass('TEST Swahili / Yoruba / Hausa / Igbo catalogs');

  assert.match(appsPage, /grid-cols-1/);
  assert.match(appsPage, /overflow-x-hidden/);
  assert.match(source('apps/dashboard/src/components/connected-app-card.tsx'), /min-h-11/);
  pass('TEST 16 390px mobile');

  assert.match(palette, /router\.push\('\/apps'\)/);
  assert.match(palette, /Connected Apps Apps Channels/);
  assert.doesNotMatch(palette, /router\.push\('\/channels'\)/);
  assert.doesNotMatch(palette, /p-channels/);
  pass('TEST 17 Command palette routes correctly');

  const catalogFetches = appsPage.split("void fetch('/api/apps/payments'").length - 1;
  assert.equal(catalogFetches, 1);
  assert.doesNotMatch(appsPage, /js\.paystack|paystack\.com|api\.booking|api\.airbnb|api\.expedia|flutterwave\.com/i);
  assert.doesNotMatch(appsPage, /fetch\(`\/api\/apps\//);
  pass('TEST 18 No unnecessary external-provider calls on page load');

  assert.match(topbar, /path\.startsWith\('\/apps'\), key: 'apps.title'/);
  assert.equal(en.settings.payOnlineNote.includes('Connected Apps'), true);
  pass('Titles, breadcrumbs, and settings copy point at Connected Apps');
}

run();
console.log('\nConnected Apps consolidation: all source checks passed');
