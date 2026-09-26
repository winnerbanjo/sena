import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import { resolveTenantForRequest } from '../apps/dashboard/src/lib/tenant';

const property = { id: 'property-a', organizationId: 'org-a', name: 'QA A' };
function fakeDatabase(options: { active?: boolean; membership?: any; organization?: any } = {}) {
  let calls = 0;
  const db = { query: {
    users: { findFirst: async () => { calls++; return { id: 'user-a', isActive: options.active !== false }; } },
    propertyMembers: { findFirst: async () => { calls++; return options.membership; } },
    organizationMembers: { findFirst: async () => { calls++; return options.organization; } },
    properties: { findFirst: async () => { calls++; return property; } },
  } };
  return { db: db as any, calls: () => calls };
}

test('unauthenticated caller cannot select identity through headers or query', async () => {
  const fake = fakeDatabase();
  assert.equal(await resolveTenantForRequest(null, { headers: new Headers({ 'x-user-email': 'owner@example.com', 'x-property-id': 'property-a' }), nextUrl: new URL('https://example.com?email=owner@example.com') } as any, fake.db), null);
  assert.equal(fake.calls(), 0);
});
test('removed membership cannot reuse stale session property or role', async () => {
  const fake = fakeDatabase({ organization: { role: 'owner', organizationId: 'org-a' } });
  assert.equal(await resolveTenantForRequest({ user: { id: 'user-a', propertyId: 'property-a' } }, undefined, fake.db), null);
});
test('pending invitation does not grant access', async () => {
  const fake = fakeDatabase({ membership: { propertyId: 'property-a', role: 'owner', permissions: ['status:invited'] } });
  assert.equal(await resolveTenantForRequest({ user: { id: 'user-a' } }, undefined, fake.db), null);
});
test('current membership role is authoritative', async () => {
  const fake = fakeDatabase({ membership: { propertyId: 'property-a', role: 'Housekeeping', permissions: ['status:active'] } });
  const result = await resolveTenantForRequest({ user: { id: 'user-a', propertyId: 'property-a' } }, undefined, fake.db);
  assert.equal(result?.role, 'Housekeeping');
  assert.equal(result?.propertyId, 'property-a');
});
test('missing test URL blocks release suite before database access', () => assert.throws(() => requireIsolatedTestDatabase({}), /SAFETY BLOCK/));
test('remote and customer database URLs are rejected', () => {
  for (const url of ['postgres://user:pass@db.example.com/sena_test', 'postgres://user:pass@localhost/sena']) assert.throws(() => requireIsolatedTestDatabase({ SENA_TEST_DATABASE_URL: url }), /SAFETY BLOCK/);
});
test('live payment and delivery credentials block synthetic tests', () => {
  for (const extra of [{ PAYSTACK_SECRET_KEY: 'sk_live_test' }, { RESEND_API_KEY: 'test' }]) assert.throws(() => requireIsolatedTestDatabase({ SENA_TEST_DATABASE_URL: 'postgres://localhost/sena_test', ...extra }), /SAFETY BLOCK/);
});
test('isolated local database is explicitly selected', () => {
  const env = { SENA_TEST_DATABASE_URL: 'postgres://localhost/sena_test_craft', DATABASE_URL: 'postgres://production/sena' };
  requireIsolatedTestDatabase(env);
  assert.equal(env.DATABASE_URL, env.SENA_TEST_DATABASE_URL);
});

import { PaymentService } from '../packages/payments/src/index';
import { ReservationService } from '../packages/reservations/src/index';
import { apiError } from '../apps/dashboard/src/lib/api-error';
test('payment rejects nonpositive, fractional, nonfinite and unsafe amounts before DB access', async () => {
  for (const amount of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(PaymentService.recordPayment({ reservationId: 'none', amountMinorUnits: amount, method: 'cash', provider: 'manual' }), /valid payment amount/);
});
test('empty webhook secret and malformed signatures fail closed', () => {
  assert.equal(PaymentService.verifyWebhookSignature('abc', '{}', ''), false);
  assert.equal(PaymentService.verifyWebhookSignature('abc', '{}', 'secret'), false);
});
test('reversed reservation dates and zero guests fail before DB access', async () => {
  await assert.rejects(ReservationService.create({ checkInDate: '2026-12-31', checkOutDate: '2026-12-30', numGuests: 1 } as any), /Check-out/);
  await assert.rejects(ReservationService.create({ numGuests: 0 } as any), /number of guests/);
});
test('database exception details are not returned to customers', () => {
  assert.equal(apiError(new Error('password authentication failed for user postgres at private-host')), 'We could not complete this request. Check your information and try again.');
  assert.match(apiError(new Error('Room is no longer available for date: 2026-09-26')), /Choose another room/);
});

import { isValidCalendarDate, calculateNights, getDatesBetween } from '../packages/config/src/index';
test('calendar dates reject overflow and respect leap years and year boundaries', () => {
  assert.equal(isValidCalendarDate('2027-02-29'), false);
  assert.equal(isValidCalendarDate('2028-02-29'), true);
  assert.equal(isValidCalendarDate('2026-04-31'), false);
  assert.throws(() => calculateNights('2026-02-30', '2026-03-03'));
  assert.throws(() => calculateNights('2026-03-03', '2026-03-03'));
  assert.equal(calculateNights('2026-12-31', '2027-01-02'), 2);
  assert.deepEqual(getDatesBetween('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29']);
});
