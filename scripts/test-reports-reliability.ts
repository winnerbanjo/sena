import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

delete process.env.PAYSTACK_SECRET_KEY;
delete process.env.PAYSTACK_PUBLIC_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_PASSWORD;
delete process.env.REDIS_URL;
delete process.env.S3_ACCESS_KEY_ID;
delete process.env.S3_SECRET_ACCESS_KEY;

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

async function run() {
  const { classifyLoadFailure, isNetworkFailure, HttpLoadError } = await import('../apps/dashboard/src/lib/page-load');
  const { parseReportRange, reportRangeBounds, stayOverlapsRange } = await import('../apps/dashboard/src/lib/reports');

  assert.equal(classifyLoadFailure(new Error('Failed to fetch'), true), 'offline');
  assert.equal(classifyLoadFailure(new TypeError('Load failed'), true), 'offline');
  assert.equal(classifyLoadFailure(new Error('boom'), false), 'offline');
  assert.equal(classifyLoadFailure(new HttpLoadError(500), true), 'error');
  assert.equal(classifyLoadFailure(new Error('Unable to load this page'), true), 'error');
  assert.equal(isNetworkFailure(new HttpLoadError(503)), false);
  pass('HTTP failures are not classified as operator connection problems');

  const month = reportRangeBounds('month', new Date('2026-09-28T12:00:00'));
  assert.equal(month.startIso, '2026-09-01');
  assert.equal(month.endIso, '2026-09-28');
  assert.equal(month.days, 28);
  assert.equal(parseReportRange('quarter'), 'quarter');
  assert.equal(parseReportRange('nope'), 'month');
  assert.equal(stayOverlapsRange('2026-09-01', '2026-09-03', '2026-09-28', '2026-09-28'), false);
  assert.equal(stayOverlapsRange('2026-09-27', '2026-09-30', '2026-09-28', '2026-09-28'), true);
  pass('Report date range is month-to-date and stay overlap is exclusive of checkout');

  const reportsPage = source('apps/dashboard/src/app/reports/page.tsx');
  const reportsApi = source('apps/dashboard/src/app/api/reports/route.ts');
  const pageLoad = source('apps/dashboard/src/components/page-load-state.tsx');
  const sidebar = source('apps/dashboard/src/components/sidebar.tsx');
  const frontDesk = source('apps/dashboard/src/app/front-desk/page.tsx');
  const overview = source('apps/dashboard/src/app/page.tsx');
  const reservationsApi = source('apps/dashboard/src/app/api/reservations/route.ts');
  const paymentsApi = source('apps/dashboard/src/app/api/payments/route.ts');
  const roomsApi = source('apps/dashboard/src/app/api/rooms/route.ts');
  const vercel = source('apps/dashboard/vercel.json');
  const dialog = source('apps/dashboard/src/components/check-in-room-dialog.tsx');

  assert.match(reportsPage, /\/api\/reports\?range=/);
  assert.doesNotMatch(reportsPage, /fetch\('\/api\/reservations'\)/);
  assert.doesNotMatch(reportsPage, /fetch\('\/api\/payments'\)/);
  assert.doesNotMatch(reportsPage, /fetch\('\/api\/rooms'\)/);
  assert.match(reportsPage, /failureKind/);
  assert.match(reportsPage, /No transactions recorded for this period/);
  pass('Reports loads one reports API and keeps an empty ledger state');

  assert.match(reportsApi, /withMerchant\(handleGET, 'reports'\)/);
  assert.match(reportsApi, /Promise\.all/);
  assert.doesNotMatch(reportsApi, /reservationEvents/);
  assert.doesNotMatch(reportsApi, /getCache|setCache|redis/);
  pass('Reports API is a single tenant-scoped read without timelines or cache');

  assert.match(pageLoad, /You appear to be offline/);
  assert.match(pageLoad, /This is not a problem with your internet connection/);
  assert.doesNotMatch(pageLoad, /Check your connection and try again/);
  pass('Shared load UI blames the connection only when the browser is offline');

  assert.match(sidebar, /prefetch=\{false\}/);
  assert.doesNotMatch(sidebar, /prefetch=\{true\}/);
  pass('Sidebar does not prefetch every merchant route');

  assert.doesNotMatch(frontDesk, /fetch\('\/api\/me'\)/);
  assert.doesNotMatch(dialog, /fetch\('\/api\/me'\)/);
  assert.match(frontDesk, /checkOutPaymentPolicy/);
  pass('Front Desk and check-in use server workspace policy instead of /api/me');

  assert.match(overview, /PageLoadState/);
  assert.doesNotMatch(overview, /Check your connection and try again/);
  pass('Overview uses the same truthful load failure copy');

  assert.match(reservationsApi, /getMerchantRequest/);
  assert.match(paymentsApi, /Promise\.all/);
  assert.match(roomsApi, /Promise\.all/);
  pass('Common operational GETs reuse merchant tenant and run property reads in parallel');

  const parsed = JSON.parse(vercel);
  assert.deepEqual(parsed.regions, ['lhr1']);
  pass('Dashboard functions pin to lhr1 to match London Postgres and Valkey');

  console.log(`\n${passed} checks passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
