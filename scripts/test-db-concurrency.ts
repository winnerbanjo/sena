/** Real-PostgreSQL stress checks for reservation and invoice concurrency. */
import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

const testUrl = process.env.SENA_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:55432/sena_test';
process.env.SENA_TEST_DATABASE_URL = testUrl;
process.env.SENA_PRODUCTION_DATABASE_URL ||= 'postgresql://production-placeholder.invalid/sena_prod';
requireIsolatedTestDatabase();
process.env.AUTH_SECRET ||= 'local-concurrency-test-secret';
process.env.AUTH_TRUST_HOST ||= 'true';
process.env.SENA_TEST_ROUTE_AUTH = '1';
process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'production' : 'test';

const ITERATIONS = Number(process.env.CONCURRENCY_TEST_ITERATIONS || 10);
const CONTENDERS = Number(process.env.CONCURRENCY_TEST_CONTENDERS || 12);
assert.ok(Number.isInteger(ITERATIONS) && ITERATIONS >= 1, 'iteration count must be positive');
assert.ok(Number.isInteger(CONTENDERS) && CONTENDERS >= 2, 'contender count must be at least two');

async function main() {
  const { db, and, eq, sql, organizations, properties, users, propertyMembers, roomTypes, rooms, guests, reservations, inventory, propertyInvoices, payments, activityLogs, idempotencyKeys } = await import('../packages/database/src/index');
  const { ReservationService } = await import('../packages/reservations/src/index');
  const { setMerchantSessionForTests } = await import('../apps/dashboard/src/lib/merchant-route');
  const invoicePaymentRoute = await import('../apps/dashboard/src/app/api/invoices/[id]/payments/route');
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const [org] = await db.insert(organizations).values({ name: `Concurrency ${suffix}`, slug: `conc-${suffix}` }).returning();
  const [property] = await db.insert(properties).values({
    organizationId: org.id, name: `Concurrency ${suffix}`, slug: `conc-prop-${suffix}`,
    code: `CC${suffix.slice(0, 6)}`, address: 'Local test', phone: '000', email: `property-${suffix}@example.invalid`,
  }).returning();
  const [user] = await db.insert(users).values({ fullName: 'Concurrency Tester', email: `user-${suffix}@example.invalid`, isActive: true }).returning();
  await db.insert(propertyMembers).values({ propertyId: property.id, userId: user.id, role: 'owner', permissions: [] });
  const [roomType] = await db.insert(roomTypes).values({ propertyId: property.id, name: `Last room ${suffix}`, bedType: 'Queen', basePriceMinorUnits: 10000, capacity: 2, totalInventory: 1 }).returning();
  const actor = { id: user.id, name: 'Concurrency Tester' };
  const guestFor = (index: number) => ({
    fullName: `Guest ${suffix} ${index}`,
    email: `guest-${suffix}-${index}@example.invalid`,
    phone: `+234800${suffix.slice(0, 6)}${String(index).padStart(3, '0')}`,
  });
  const requestInput = (date: string, index: number) => ({
    propertyId: property.id, roomTypeId: roomType.id, checkInDate: date, checkOutDate: dateAfter(date),
    numGuests: 1, adults: 1, children: 0, source: 'walk_in' as const,
    paymentStatus: 'pay_later' as const, paidAmountMinorUnits: 0, guest: guestFor(index),
  });

  try {
    // Each iteration sends a burst for one available unit. Different dates keep
    // previous successful iterations from affecting the next inventory check.
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const date = `2038-01-${String(iteration + 1).padStart(2, '0')}`;
      const outcomes = await Promise.allSettled(Array.from({ length: CONTENDERS }, (_, index) =>
        ReservationService.create(requestInput(date, iteration * CONTENDERS + index), actor)
      ));
      assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1, `last-room iteration ${iteration + 1}: exactly one booking succeeds`);
      const failures = outcomes.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      assert.equal(failures.length, CONTENDERS - 1);
      assert.ok(failures.every((result) => result.reason instanceof Error && /fully booked|no longer available|unavailable/i.test(result.reason.message)), 'losers must fail cleanly as unavailable');
      const [count] = await db.select({ count: sql<number>`count(*)::int` }).from(reservations).where(and(eq(reservations.propertyId, property.id), eq(reservations.roomTypeId, roomType.id), eq(reservations.checkInDate, date), eq(reservations.status, 'confirmed')));
      assert.equal(count.count, 1, `last-room iteration ${iteration + 1}: one reservation persisted`);
      const nights = await db.select({ date: inventory.date, reserved: inventory.reservedInventory }).from(inventory).where(and(eq(inventory.propertyId, property.id), eq(inventory.roomTypeId, roomType.id), eq(inventory.date, date)));
      assert.equal(nights.length, 1);
      assert.equal(nights[0].reserved, 1, `last-room iteration ${iteration + 1}: inventory is exactly at capacity`);
      assert.ok(nights.every((night) => night.reserved >= 0 && night.reserved <= 1), 'inventory must not be negative or over capacity');
    }
    console.log(`PASS last-room contention: ${ITERATIONS} iterations × ${CONTENDERS} concurrent creates; one winner each, inventory never negative`);

    // Reusing one request key in a burst returns the persisted response payload
    // to each caller and writes one reservation/idempotency record.
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const date = `2038-02-${String(iteration + 1).padStart(2, '0')}`;
      const key = `concurrency-idem-${suffix}-${iteration}`;
      const input = requestInput(date, 10000 + iteration);
      const results = await Promise.all(Array.from({ length: CONTENDERS }, () => ReservationService.create(input, actor, key)));
      assert.equal(new Set(results.map((result) => result.id)).size, 1, `idempotency iteration ${iteration + 1}: identical reservation id`);
      const firstResponse = JSON.parse(JSON.stringify(results[0]));
      for (const result of results.slice(1)) {
        assert.deepEqual(JSON.parse(JSON.stringify(result)), firstResponse, 'idempotent callers must receive identical API response data');
      }
      const rows = await db.select({ id: reservations.id }).from(reservations).where(and(eq(reservations.propertyId, property.id), eq(reservations.checkInDate, date)));
      assert.equal(rows.length, 1, `idempotency iteration ${iteration + 1}: one reservation exists`);
      const keys = await db.select({ key: idempotencyKeys.key }).from(idempotencyKeys).where(eq(idempotencyKeys.key, `reservation:${property.id}:${key}`));
      assert.equal(keys.length, 1);
    }
    console.log(`PASS idempotency: ${ITERATIONS} iterations × ${CONTENDERS} concurrent requests; one row and byte-identical payloads per key`);

    // Exercise the actual invoice payment endpoint and its invoice row lock.
    setMerchantSessionForTests({ user: { id: user.id, name: user.fullName, email: user.email }, expires: new Date(Date.now() + 60_000).toISOString() });
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const [invoice] = await db.insert(propertyInvoices).values({
        propertyId: property.id, organizationId: org.id, invoiceNumber: `CC-${suffix}-${iteration}`,
        status: 'issued', recipientName: 'Concurrent Buyer', issueDate: '2038-03-01', dueDate: '2038-03-10',
        totalAmountMinorUnits: 1000, paidAmountMinorUnits: 0, items: [],
      }).returning();
      const results = await Promise.all([0, 1].map((contender) => postInvoicePayment(invoicePaymentRoute, invoice.id, `pay-${suffix}-${iteration}-${contender}`, 700)));
      assert.equal(results.filter((result) => result.status === 200).length, 1, `invoice iteration ${iteration + 1}: exactly one 700 payment succeeds against balance 1000`);
      assert.equal(results.filter((result) => result.status >= 400 && result.status < 500).length, 1, `losing over-balance payment is rejected cleanly (statuses: ${results.map((result) => result.status).join(', ')})`);
      const [current] = await db.select().from(propertyInvoices).where(eq(propertyInvoices.id, invoice.id));
      assert.ok(current.paidAmountMinorUnits <= current.totalAmountMinorUnits, `invoice iteration ${iteration + 1}: paid amount cannot exceed total`);
      assert.equal(current.paidAmountMinorUnits, 700);
      const paymentRows = await db.select().from(payments).where(eq(payments.invoiceId, invoice.id));
      assert.equal(paymentRows.length, 1);
      assert.equal(paymentRows.reduce((sum, payment) => sum + payment.amountMinorUnits, 0), 700);
    }
    console.log(`PASS invoice payment contention: ${ITERATIONS} iterations × 2 endpoint calls; paid total never exceeds balance`);
  } finally {
    setMerchantSessionForTests(null);
    await db.delete(organizations).where(eq(organizations.id, org.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
}

function dateAfter(date: string) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

async function postInvoicePayment(route: { POST: Function }, invoiceId: string, key: string, amountMinorUnits: number) {
  const url = new URL(`http://localhost/api/invoices/${invoiceId}/payments`);
  const body = { amountMinorUnits, method: 'cash', providerReference: key };
  const headers = new Headers({ 'content-type': 'application/json', 'idempotency-key': key, cookie: 'sena_property_id=' });
  const req = {
    url: url.toString(), method: 'POST', nextUrl: url, headers,
    cookies: { get: () => undefined },
    clone() { return { json: async () => body }; },
    async json() { return body; },
    async formData() { throw new Error('Unexpected multipart request'); },
  };
  const response = await route.POST(req as never, { params: Promise.resolve({ id: invoiceId }) });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

main().catch((error) => {
  console.error('FAIL real-PostgreSQL concurrency suite:', error);
  process.exitCode = 1;
});
