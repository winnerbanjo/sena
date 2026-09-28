import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

delete process.env.PAYSTACK_SECRET_KEY;
delete process.env.PAYSTACK_PUBLIC_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_PASSWORD;

process.env.SENA_TEST_DATABASE_URL = process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@localhost:55432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL = process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

let passed = 0;
function pass(name: string) {
  passed++;
  console.log(`PASS ${name}`);
}

function source(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

function flatten(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

async function run() {
  const {
    APP_LOCALES,
    DEFAULT_LOCALE,
    parseLocale,
    localeDir,
    isAppLocale,
    I18N_LIBRARY,
  } = await import('../apps/dashboard/src/i18n/config');
  const { deepMergeMessages, loadLocaleMessages, lookupMessage, loadEnglishMessages } = await import(
    '../apps/dashboard/src/i18n/messages'
  );

  assert.equal(I18N_LIBRARY, 'next-intl');
  assert.deepEqual([...APP_LOCALES], ['en', 'fr', 'ar', 'sw', 'yo', 'ha', 'ig']);
  assert.equal(DEFAULT_LOCALE, 'en');
  pass('TEST 37 library is next-intl with the seven staff locales and English fallback');

  assert.equal(parseLocale(undefined), 'en');
  assert.equal(parseLocale('fr-FR'), 'en');
  assert.equal(parseLocale('yo'), 'yo');
  assert.equal(isAppLocale('ar'), true);
  assert.equal(isAppLocale('zh'), false);
  assert.equal(localeDir('ar'), 'rtl');
  assert.equal(localeDir('en'), 'ltr');
  pass('TEST 38 invalid locales fall back to English; Arabic is RTL');

  const english = JSON.parse(source('apps/dashboard/messages/en.json'));
  const namespaces = [
    'common', 'navigation', 'overview', 'reservations', 'calendar', 'frontDesk', 'rooms', 'housekeeping',
    'guests', 'website', 'reviews', 'directBooking', 'payments', 'invoices', 'offers', 'channels',
    'analytics', 'reports', 'staff', 'apps', 'billing', 'settings', 'setup', 'errors', 'statuses',
  ];
  for (const ns of namespaces) assert.equal(typeof english[ns], 'object', `missing namespace ${ns}`);
  const englishKeys = flatten(english);
  assert.ok(englishKeys.length > 180, `expected a full catalog, got ${englishKeys.length} keys`);
  pass('TEST 39 all required namespaces exist in the English catalog');

  assert.equal(english.frontDesk.paidColumn, 'Paid');
  assert.match(english.frontDesk.notPaidColumn, /^Not Paid \{amount\} due$/);
  assert.match(english.frontDesk.partiallyPaidColumn, /^Partially Paid \{amount\} due$/);
  assert.equal(english.frontDesk.pendingVerificationColumn, 'Pending Verification');
  assert.equal(english.frontDesk.continueWithoutPayment, 'Continue without payment');
  assert.equal(english.frontDesk.continueWithoutPaymentQuestion, 'Continue without payment?');
  pass('TEST 40 Front Desk certified settlement copy is localized from the English catalog');

  for (const locale of APP_LOCALES) {
    if (locale === 'en') continue;
      const overlay = JSON.parse(source(`apps/dashboard/messages/${locale}.json`));
      const missing = englishKeys.filter((key) => lookupMessage(overlay as typeof english, key) === undefined);
    assert.equal(missing.length, 0, `${locale} missing ${missing.slice(0, 8).join(', ')}`);
    assert.equal(overlay.common.appName, 'Sena');
    assert.equal(overlay.common.currencyNgn, 'NGN');
  }
  pass('TEST 41 every locale covers the English key set and keeps Sena/NGN untranslated');

  const mergedMissing = deepMergeMessages(english, { frontDesk: { title: 'Réception' } });
  assert.equal(mergedMissing.frontDesk.title, 'Réception');
  assert.equal(mergedMissing.frontDesk.checkIn, english.frontDesk.checkIn);
  const fallback = lookupMessage(english, 'does.not.exist');
  assert.equal(fallback, undefined);
  assert.doesNotMatch(source('apps/dashboard/src/i18n/provider.tsx'), /error\.message/);
  pass('TEST 42 missing keys merge to English and never render message IDs');

  const french = await loadLocaleMessages('fr');
  assert.equal(french.navigation.frontDesk, 'Réception');
  assert.equal((await loadEnglishMessages()).navigation.frontDesk, 'Front Desk');
  assert.equal(english.navigation.frontDesk, 'Front Desk');
  const arabic = await loadLocaleMessages('ar');
  assert.match(arabic.frontDesk.title, /الاستقبال/);
  const yoruba = await loadLocaleMessages('yo');
  assert.match(yoruba.common.tagline, /ìtẹ́wọ́gbà/);
  pass('TEST 43 French, Arabic, and Yoruba catalogs load with native orthography');

  const ugcBanned = /guest names|property names|room numbers|custom categories/i;
  assert.match(source('docs/I18N.md'), ugcBanned);
  assert.doesNotMatch(JSON.stringify(english), /Stay Connect Solutions/);
  pass('TEST 44 documentation forbids translating user-generated content');

  const layout = source('apps/dashboard/src/app/layout.tsx');
  assert.match(layout, /dir=\{dir\}/);
  assert.match(layout, /lang=\{isPublicSite \? 'en'/);
  assert.doesNotMatch(layout, /\/\[locale\]/);
  assert.match(source('apps/dashboard/src/middleware.ts'), /'front-desk'/);
  assert.doesNotMatch(source('apps/dashboard/src/middleware.ts'), /\/en\/front-desk/);
  pass('TEST 45 staff URLs stay unprefixed; html lang/dir are set without locale segments');

  const meRoute = source('apps/dashboard/src/app/api/me/route.ts');
  assert.match(meRoute, /locale/);
  assert.match(meRoute, /isAppLocale/);
  assert.match(meRoute, /eq\(users\.id, session\.user\.id\)/);
  assert.doesNotMatch(meRoute, /Accept-Language/);
  assert.match(source('apps/dashboard/src/i18n/provider.tsx'), /hasUnsavedWork/);
  pass('TEST 46 language persists on the authenticated user only, never from browser language');

  const {
    db,
    users,
    organizations,
    properties,
    propertyMembers,
    eq,
  } = await import('../packages/database/src/index');

  await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locale varchar(16) NOT NULL DEFAULT 'en'`);

  const runId = crypto.randomUUID().slice(0, 8);
  const [userA] = await db.insert(users).values({
    fullName: 'Locale A',
    email: `locale-a-${runId}@example.invalid`,
    passwordHash: 'x',
    isActive: true,
  }).returning();
  const [userB] = await db.insert(users).values({
    fullName: 'Locale B',
    email: `locale-b-${runId}@example.invalid`,
    passwordHash: 'x',
    isActive: true,
    locale: 'fr',
  }).returning();
  const loadedA = await db.query.users.findFirst({ where: eq(users.id, userA.id) });
  const loadedB = await db.query.users.findFirst({ where: eq(users.id, userB.id) });
  assert.equal(parseLocale(loadedA?.locale), 'en');
  assert.equal(parseLocale(loadedB?.locale), 'fr');

  const [org] = await db.insert(organizations).values({ name: 'Locale QA', slug: `loc-${runId}` }).returning();
  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: 'Stay Locale Hotel',
    slug: `loc-p-${runId}`,
    code: `LC-${runId}`,
    address: 'Lagos',
    phone: '',
    email: `loc-${runId}@example.invalid`,
    timezone: 'Africa/Lagos',
    currency: 'NGN',
  }).returning();
  await db.insert(propertyMembers).values([
    { propertyId: property.id, userId: userA.id, role: 'manager' },
    { propertyId: property.id, userId: userB.id, role: 'front_desk' },
  ]);
  const afterSwitch = await db.update(users).set({ locale: 'ar' }).where(eq(users.id, userA.id)).returning();
  const sibling = await db.query.users.findFirst({ where: eq(users.id, userB.id) });
  assert.equal(afterSwitch[0].locale, 'ar');
  assert.equal(sibling?.locale, 'fr');
  const unchangedProperty = await db.query.properties.findFirst({ where: eq(properties.id, property.id) });
  assert.equal(unchangedProperty?.currency, 'NGN');
  assert.equal(unchangedProperty?.timezone, 'Africa/Lagos');
  pass('TEST 47 locale is per user, defaults to English, and never changes property currency or timezone');

  const englishBytes = statSync(resolve(process.cwd(), 'apps/dashboard/messages/en.json')).size;
  const allBytes = APP_LOCALES.reduce((sum, locale) => sum + statSync(resolve(process.cwd(), `apps/dashboard/messages/${locale}.json`)).size, 0);
  assert.ok(englishBytes < 40_000, `English catalog too large: ${englishBytes}`);
  assert.ok(allBytes < 280_000, `all locale files too large to keep in git reasonably: ${allBytes}`);
  const loader = source('apps/dashboard/src/i18n/messages.ts');
  assert.match(loader, /fr: \(\) => import/);
  assert.match(loader, /ar: \(\) => import/);
  pass('TEST 48 locale catalogs are split per language so English does not ship every translation');

  const sidebar = source('apps/dashboard/src/components/sidebar.tsx');
  assert.match(sidebar, /LanguageMenu/);
  assert.doesNotMatch(sidebar, /flag|🇳🇬|🇫🇷|🇸🇦/i);
  assert.match(sidebar, /start-0/);
  assert.match(source('apps/dashboard/src/app/globals.css'), /ltr-isolate/);
  assert.match(source('apps/dashboard/src/components/occupancy-chart.tsx'), /dir="ltr"/);
  pass('TEST 49 RTL uses logical CSS, isolates charts/codes, and does not use flags');

  const publicLayout = source('apps/dashboard/src/app/layout.tsx');
  assert.match(publicLayout, /isPublicSite \? DEFAULT_LOCALE/);
  assert.doesNotMatch(source('apps/dashboard/src/app/site/[slug]/page.tsx'), /useTranslations/);
  pass('TEST 50 public hotel websites stay on English and are not auto-translated');

  console.log(`\nLanguage & Region V1: ${passed} checks passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
