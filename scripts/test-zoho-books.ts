/**
 * Zoho Books V1 source + unit checks (no production mutation).
 * DB-backed sync tests require local Postgres — reported separately when unavailable.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

function pass(label: string) {
  console.log(`PASS ${label}`);
}

function run() {
  assert.ok(existsSync('apps/dashboard/src/lib/integrations/zoho/books.ts'));
  assert.ok(existsSync('apps/dashboard/src/app/api/apps/zoho_books/manage/route.ts'));
  assert.ok(existsSync('docs/integrations/ZOHO_BOOKS.md'));
  pass('Books module, manage route, and docs exist');

  const books = source('apps/dashboard/src/lib/integrations/zoho/books.ts');
  assert.match(books, /\/books\/v3/);
  assert.match(books, /X-com-zoho-books-organizationid/);
  assert.match(books, /provider: 'zoho_books'/);
  assert.match(books, /syncEnabled: false/);
  assert.match(books, /meta\.syncEnabled === true/);
  assert.match(books, /registerZohoBooksSyncHandlers/);
  assert.match(books, /maybeQueueZohoBooksInvoiceExport/);
  assert.match(books, /maybeQueueZohoBooksPaymentSync/);
  assert.match(books, /setZohoBooksPaymentAccount/);
  assert.doesNotMatch(books, /provider: 'zoho_invoice'/);
  pass('Books API path, org header, Connected≠Enabled, queues');

  const invoice = source('apps/dashboard/src/lib/integrations/zoho/invoice.ts');
  assert.match(invoice, /\/invoice\/v3/);
  assert.match(invoice, /X-com-zoho-invoice-organizationid/);
  assert.match(invoice, /provider: 'zoho_invoice'/);
  assert.match(invoice, /registerZohoSyncHandlers/);
  pass('Zoho Invoice module left intact');

  const start = source('apps/dashboard/src/app/api/apps/oauth/start/route.ts');
  assert.match(start, /case 'zoho_books'/);
  assert.match(start, /ZohoBooks\.contacts\.READ/);
  assert.match(start, /ZohoBooks\.invoices\.CREATE/);
  assert.match(start, /ZohoBooks\.customerpayments\.CREATE/);
  pass('OAuth start scopes for Zoho Books');

  const callback = source('apps/dashboard/src/app/api/apps/oauth/callback/route.ts');
  assert.match(callback, /provider === 'zoho_invoice' \|\| provider === 'zoho_books'/);
  pass('OAuth callback exchanges Zoho Books codes');

  const cron = source('apps/dashboard/src/app/api/cron/connected-apps-sync/route.ts');
  assert.match(cron, /registerZohoBooksSyncHandlers/);
  assert.match(cron, /registerZohoSyncHandlers/);
  pass('Cron registers Invoice and Books handlers');

  const invoicesRoute = source('apps/dashboard/src/app/api/invoices/route.ts');
  assert.match(invoicesRoute, /maybeQueueZohoInvoiceExport/);
  assert.match(invoicesRoute, /maybeQueueZohoBooksInvoiceExport/);
  pass('Invoice create dual-queues Invoice + Books');

  const paymentsRoute = source('apps/dashboard/src/app/api/invoices/[id]/payments/route.ts');
  assert.match(paymentsRoute, /maybeQueueZohoPaymentSync/);
  assert.match(paymentsRoute, /maybeQueueZohoBooksPaymentSync/);
  pass('Manual payment dual-queues Invoice + Books');

  const registry = source('apps/dashboard/src/lib/integrations/platform/registry.ts');
  assert.match(registry, /'zoho_books'[\s\S]*'available'/);
  assert.match(registry, /payment_sync/);
  pass('Catalog marks Zoho Books available with payment_sync');

  const content = source('apps/dashboard/src/lib/integrations/platform/provider-content.ts');
  assert.match(content, /connectCtaKey: 'connectZohoBooks'/);
  assert.doesNotMatch(content.match(/zoho_books:[\s\S]*?quickbooks:/)?.[0] || '', /comingSoonOverviewKey/);
  pass('Provider content is available (not coming-soon stub)');

  const panel = source('apps/dashboard/src/components/connected-app-detail-panel.tsx');
  assert.match(panel, /isZohoAccountingProvider/);
  assert.match(panel, /zohoManagePath/);
  assert.match(panel, /zohoBooksPaymentAccount/);
  assert.match(panel, /provider === 'zoho_invoice'/); // Connected≠Enabled branch
  pass('Detail panel supports Books org/sync/payment account');

  const en = JSON.parse(source('apps/dashboard/messages/en.json'));
  assert.equal(en.apps.connectZohoBooks, 'Connect Zoho Books');
  assert.ok(en.apps.zohoBooksOverview.includes('Zoho Books'));
  assert.ok(en.apps.zohoBooksStep5);
  for (const loc of ['fr', 'ar', 'sw', 'yo', 'ha', 'ig']) {
    const messages = JSON.parse(source(`apps/dashboard/messages/${loc}.json`));
    assert.notEqual(messages.apps.zohoBooksOverview, en.apps.zohoBooksOverview, `${loc} overview translated`);
    assert.equal(messages.apps.zohoBooks, 'Zoho Books');
  }
  
  assert.match(panel, /zohoBooksOrgsEmpty/);
  assert.notEqual(en.apps.zohoBooksOrgsEmpty, en.apps.zohoOrgsEmpty);
  assert.match(en.apps.zohoBooksOrgsEmpty, /Zoho Books/);
  assert.doesNotMatch(en.apps.zohoBooksOrgsEmpty, /Zoho Invoice/);
  pass('Books empty-org copy is provider-aware');

  pass('Localization for Zoho Books education keys');

  console.log('\nZoho Books V1 source checks passed');
}

run();
