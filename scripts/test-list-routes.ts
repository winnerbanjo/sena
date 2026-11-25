/**
 * Route-level tests for the paginated and operational list endpoints.
 *
 * These call the real route handlers, so auth boundary, tenant resolution,
 * permission checks and reference-tenant checks all run. Only the auth()
 * lookup is replaced, through the explicit test seam in merchant-route.ts.
 *
 *   SENA_BENCH_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/sena_bench \
 *     TSX_TSCONFIG_PATH=apps/dashboard/tsconfig.json \
 *     pnpm exec tsx scripts/test-list-routes.ts
 */
import assert from 'node:assert/strict';
import postgres from 'postgres';

const url = process.env.SENA_BENCH_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Set SENA_BENCH_DATABASE_URL (or DATABASE_URL) to a disposable database.');
  process.exit(1);
}

process.env.DATABASE_URL = url;
process.env.SENA_TEST_ROUTE_AUTH = '1';
process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'production' : 'test';
process.env.AUTH_SECRET ||= 'route-test-secret-not-used-outside-tests';
process.env.AUTH_TRUST_HOST ||= 'true';

const sql = postgres(url, { max: 1, onnotice: () => {} });

const ORG = '00000000-0000-4000-8000-0000000000c0';
const USER_A = '00000000-0000-4000-8000-0000000000a1';
const USER_B = '00000000-0000-4000-8000-0000000000b1';
const USER_HK = '00000000-0000-4000-8000-0000000000e1';
const PROP_A = '20000000-0000-4000-8000-0000000000a1';
const PROP_B = '20000000-0000-4000-8000-0000000000b1';
const PROP_OPS = '20000000-0000-4000-8000-0000000000c1';
const PROP_REST = '20000000-0000-4000-8000-0000000000d1';
const RT_A = '21000000-0000-4000-8000-0000000000a1';
const RT_B = '21000000-0000-4000-8000-0000000000b1';
const RT_OPS = '21000000-0000-4000-8000-0000000000c1';
const RT_REST = '21000000-0000-4000-8000-0000000000d1';
const GUEST_A = '22000000-0000-4000-8000-0000000000a1';
const GUEST_B = '22000000-0000-4000-8000-0000000000b1';
const GUEST_OPS = '22000000-0000-4000-8000-0000000000c1';
const GUEST_REST = '22000000-0000-4000-8000-0000000000d1';
const RES_A = '23000000-0000-4000-8000-0000000000a1';
const RES_B = '23000000-0000-4000-8000-0000000000b1';
const INV_A = '24000000-0000-4000-8000-0000000000a1';
const INV_B = '24000000-0000-4000-8000-0000000000b1';
const PAY_A = '25000000-0000-4000-8000-0000000000a1';
const PAY_B = '25000000-0000-4000-8000-0000000000b1';

function uuid(base: string, index: number) {
  return `${base}-${String(index).padStart(12, '0')}`;
}

function pass(message: string) {
  console.log(`  ✔ ${message}`);
}

async function reset() {
  await sql`delete from users where id in (${USER_A}::uuid, ${USER_B}::uuid, ${USER_HK}::uuid)`;
  await sql`delete from organizations where id = ${ORG}::uuid`;
}

async function seed() {
  await reset();
  await sql`
    insert into organizations (id, name, slug)
    values (${ORG}::uuid, 'Route Test Group', 'route-test-group')
  `;
  await sql`
    insert into users (id, email, full_name, is_active)
    values
      (${USER_A}::uuid, 'route-a@example.test', 'Route Owner A', true),
      (${USER_B}::uuid, 'route-b@example.test', 'Route Owner B', true),
      (${USER_HK}::uuid, 'route-hk@example.test', 'Route Housekeeper', true)
  `;
  await sql`
    insert into properties (id, organization_id, name, slug, code, industry, property_type, address, phone, email)
    values
      (${PROP_A}::uuid, ${ORG}::uuid, 'Route Property A', 'route-a', 'RTA', 'hotel', 'hotel', '1 Test Way', '08000000001', 'a@example.test'),
      (${PROP_B}::uuid, ${ORG}::uuid, 'Route Property B', 'route-b', 'RTB', 'hotel', 'hotel', '2 Test Way', '08000000002', 'b@example.test'),
      (${PROP_OPS}::uuid, ${ORG}::uuid, 'Route Operational', 'route-ops', 'RTO', 'hotel', 'hotel', '3 Test Way', '08000000003', 'ops@example.test'),
      (${PROP_REST}::uuid, ${ORG}::uuid, 'Route Restaurant', 'route-rest', 'RTR', 'restaurant', 'restaurant', '4 Test Way', '08000000004', 'rest@example.test')
  `;
  await sql`
    insert into property_members (property_id, user_id, role, permissions)
    values
      (${PROP_A}::uuid, ${USER_A}::uuid, 'owner', '[]'::jsonb),
      (${PROP_B}::uuid, ${USER_B}::uuid, 'owner', '[]'::jsonb),
      (${PROP_OPS}::uuid, ${USER_A}::uuid, 'owner', '[]'::jsonb),
      (${PROP_REST}::uuid, ${USER_A}::uuid, 'owner', '[]'::jsonb),
      (${PROP_A}::uuid, ${USER_HK}::uuid, 'housekeeping', '[]'::jsonb)
  `;
  await sql`
    insert into room_types (id, property_id, name, bed_type, base_price_minor_units, total_inventory)
    values
      (${RT_A}::uuid, ${PROP_A}::uuid, 'Route Standard A', 'queen', 5000000, 10),
      (${RT_B}::uuid, ${PROP_B}::uuid, 'Route Standard B', 'queen', 5000000, 10),
      (${RT_OPS}::uuid, ${PROP_OPS}::uuid, 'Route Standard Ops', 'queen', 5000000, 10),
      (${RT_REST}::uuid, ${PROP_REST}::uuid, 'Route Standard Rest', 'queen', 5000000, 10)
  `;
  await sql`
    insert into guests (id, organization_id, property_id, full_name, email, phone, created_at)
    values
      (${GUEST_A}::uuid, ${ORG}::uuid, ${PROP_A}::uuid, 'Tenant A Guest', 'guest-a@example.test', '08010000001', '2026-01-02 00:00:00.111111+00'),
      (${GUEST_B}::uuid, ${ORG}::uuid, ${PROP_B}::uuid, 'Tenant B Guest', 'guest-b@example.test', '08010000002', '2026-01-02 00:00:00.111111+00'),
      (${GUEST_OPS}::uuid, ${ORG}::uuid, ${PROP_OPS}::uuid, 'Operational Guest', 'guest-ops@example.test', '08010000003', '2026-01-02 00:00:00.111111+00'),
      (${GUEST_REST}::uuid, ${ORG}::uuid, ${PROP_REST}::uuid, 'Restaurant Guest', 'guest-rest@example.test', '08010000004', '2026-01-02 00:00:00.111111+00')
  `;
  // Three guest-directory ties with the same microsecond timestamp.
  for (let i = 1; i <= 3; i += 1) {
    await sql`
      insert into guests (id, organization_id, property_id, full_name, email, phone, created_at)
      values (${uuid('22000000-0000-4000-8000', i)}::uuid, ${ORG}::uuid, ${PROP_A}::uuid,
              ${`Guest Tie ${i}`}, ${`tie-${i}@example.test`}, ${`0802000000${i}`},
              '2026-01-02 00:00:00.222222+00')
    `;
  }

  await sql`
    insert into reservations (id, reference, property_id, guest_id, room_type_id, check_in_date, check_out_date,
                              nights, total_amount_minor_units, paid_amount_minor_units, status, created_at)
    values
      (${RES_A}::uuid, 'ROUTE-A-1', ${PROP_A}::uuid, ${GUEST_A}::uuid, ${RT_A}::uuid, '2026-12-01', '2026-12-03', 2, 100000, 0, 'confirmed', '2026-03-01 00:00:00.111111+00'),
      (${RES_B}::uuid, 'ROUTE-B-1', ${PROP_B}::uuid, ${GUEST_B}::uuid, ${RT_B}::uuid, '2026-12-01', '2026-12-03', 2, 100000, 0, 'confirmed', '2026-03-01 00:00:00.111111+00')
  `;
  // Three reservation ties with the same microsecond timestamp.
  for (let i = 1; i <= 3; i += 1) {
    await sql`
      insert into reservations (id, reference, property_id, guest_id, room_type_id, check_in_date, check_out_date,
                                nights, total_amount_minor_units, paid_amount_minor_units, status, created_at)
      values (${uuid('23000000-0000-4000-8000', i)}::uuid, ${`ROUTE-TIE-${i}`}, ${PROP_A}::uuid,
              ${GUEST_A}::uuid, ${RT_A}::uuid, '2026-12-05', '2026-12-06', 1, 50000, 0, 'confirmed',
              '2026-01-01 00:00:00.123456+00')
    `;
  }
  for (let i = 1; i <= 3; i += 1) {
    await sql`
      insert into reservation_events (id, reservation_id, actor_name, event_type, description, created_at)
      values (${uuid('26000000-0000-4000-8000', i)}::uuid, ${RES_A}::uuid, 'Route Tester', 'note',
              ${`Timeline tie ${i}`}, '2026-02-02 00:00:00.654321+00')
    `;
  }

  await sql`
    insert into property_invoices (id, property_id, organization_id, invoice_number, status, recipient_name,
                                   issue_date, due_date, total_amount_minor_units, paid_amount_minor_units, created_at)
    values
      (${INV_A}::uuid, ${PROP_A}::uuid, ${ORG}::uuid, 'ROUTE-INV-A-1', 'issued', 'Tenant A Guest', '2026-03-01', '2026-03-10', 100000, 0, '2026-03-01 00:00:00.333333+00'),
      (${INV_B}::uuid, ${PROP_B}::uuid, ${ORG}::uuid, 'ROUTE-INV-B-1', 'issued', 'Tenant B Guest', '2026-03-01', '2026-03-10', 100000, 0, '2026-03-01 00:00:00.333333+00')
  `;
  for (let i = 1; i <= 2; i += 1) {
    await sql`
      insert into property_invoices (id, property_id, organization_id, invoice_number, status, recipient_name,
                                     issue_date, due_date, total_amount_minor_units, paid_amount_minor_units, created_at)
      values (${uuid('24000000-0000-4000-8000', 100 + i)}::uuid, ${PROP_A}::uuid, ${ORG}::uuid,
              ${`ROUTE-INV-TIE-${i}`}, 'issued', ${`Invoice Tie ${i}`}, '2026-01-03', '2026-01-10',
              1000, 0, '2026-01-03 00:00:00.444444+00')
    `;
  }

  await sql`
    insert into payments (id, property_id, reservation_id, amount_minor_units, currency, provider, provider_reference,
                          method, status, created_at)
    values
      (${PAY_A}::uuid, ${PROP_A}::uuid, ${RES_A}::uuid, 10000, 'NGN', 'manual', 'ROUTE-PAY-A-1', 'cash', 'successful', '2026-03-01 00:00:00.555555+00'),
      (${PAY_B}::uuid, ${PROP_B}::uuid, ${RES_B}::uuid, 10000, 'NGN', 'manual', 'ROUTE-PAY-B-1', 'cash', 'successful', '2026-03-01 00:00:00.555555+00')
  `;
  for (let i = 1; i <= 2; i += 1) {
    await sql`
      insert into payments (id, property_id, reservation_id, amount_minor_units, currency, provider, provider_reference,
                            method, status, created_at)
      values (${uuid('25000000-0000-4000-8000', 100 + i)}::uuid, ${PROP_A}::uuid, ${RES_A}::uuid, 1000, 'NGN',
              'manual', ${`ROUTE-PAY-TIE-${i}`}, 'cash', 'successful', '2026-01-04 00:00:00.666666+00')
    `;
  }

  // Operational boards: >500 rows per bucket on a clean property.
  await sql`
    insert into reservations (id, reference, property_id, guest_id, room_type_id, check_in_date, check_out_date,
                              nights, total_amount_minor_units, paid_amount_minor_units, status, created_at)
    select (${'c0000000-0000-4000-8000-'}::text || lpad(i::text, 12, '0'))::uuid, 'OPS-C-' || i,
           ${PROP_OPS}::uuid, ${GUEST_OPS}::uuid, ${RT_OPS}::uuid, '2026-11-20', '2026-11-21', 1, 100000, 0,
           'confirmed', '2026-01-01 00:00:00+00'::timestamptz + (i || ' seconds')::interval
    from generate_series(1, 600) as i
  `;
  await sql`
    insert into reservations (id, reference, property_id, guest_id, room_type_id, check_in_date, check_out_date,
                              nights, total_amount_minor_units, paid_amount_minor_units, status, created_at)
    select (${'d0000000-0000-4000-8000-'}::text || lpad(i::text, 12, '0'))::uuid, 'OPS-I-' || i,
           ${PROP_OPS}::uuid, ${GUEST_OPS}::uuid, ${RT_OPS}::uuid, '2026-11-01', '2026-11-19', 18, 100000, 0,
           'checked_in', '2026-01-01 00:00:00+00'::timestamptz + (i || ' seconds')::interval
    from generate_series(1, 600) as i
  `;
  await sql`
    insert into reservations (id, reference, property_id, guest_id, room_type_id, check_in_date, check_out_date,
                              nights, total_amount_minor_units, paid_amount_minor_units, status, created_at)
    select (${'f0000000-0000-4000-8000-'}::text || lpad(i::text, 12, '0'))::uuid, 'REST-I-' || i,
           ${PROP_REST}::uuid, ${GUEST_REST}::uuid, ${RT_REST}::uuid, '2026-11-01', '2026-11-19', 18, 100000, 0,
           'checked_in', '2026-01-01 00:00:00+00'::timestamptz + (i || ' seconds')::interval
    from generate_series(1, 600) as i
  `;
}

async function main() {
  await seed();

  const { setMerchantSessionForTests } = await import('../apps/dashboard/src/lib/merchant-route');
  const reservationsRoute = await import('../apps/dashboard/src/app/api/reservations/route');
  const reservationDetailRoute = await import('../apps/dashboard/src/app/api/reservations/[id]/route');
  const summaryRoute = await import('../apps/dashboard/src/app/api/reservations/summary/route');
  const invoicesRoute = await import('../apps/dashboard/src/app/api/invoices/route');
  const invoiceDetailRoute = await import('../apps/dashboard/src/app/api/invoices/[id]/route');
  const paymentsRoute = await import('../apps/dashboard/src/app/api/payments/route');
  const guestsRoute = await import('../apps/dashboard/src/app/api/guests/route');
  const guestDetailRoute = await import('../apps/dashboard/src/app/api/guests/[id]/route');
  const frontDeskRoute = await import('../apps/dashboard/src/app/api/front-desk/route');
  const assignableRoute = await import('../apps/dashboard/src/app/api/rooms/assignable-reservations/route');
  const inHouseRoute = await import('../apps/dashboard/src/app/api/restaurant/in-house/route');

  const sessionFor = (userId: string) => ({
    user: { id: userId, name: 'Route Tester', email: 'route@example.test' },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  /** Minimal NextRequest stand-in: the handlers only read url, method, headers and cookies. */
  function request(path: string, propertyId: string) {
    const url = new URL(`http://localhost${path}`);
    return {
      url: url.toString(),
      method: 'GET',
      nextUrl: url,
      headers: new Headers({ cookie: `sena_property_id=${propertyId}` }),
      cookies: { get: (name: string) => (name === 'sena_property_id' ? { value: propertyId } : undefined) },
      clone() {
        return this;
      },
      async json() {
        return {};
      },
    };
  }

  async function get(route: { GET: Function }, path: string, propertyId: string, context?: unknown) {
    const response = await route.GET(request(path, propertyId), context);
    return { status: response.status, body: await response.json() };
  }

  function tamperedCursor() {
    return Buffer.from(JSON.stringify({ createdAt: 'not-a-date', id: 'not-a-uuid' }), 'utf8').toString('base64url');
  }

  async function walk(
    label: string,
    fetchPage: (cursor?: string) => Promise<{ items: Array<{ id: string }>; nextCursor: string | null }>
  ) {
    const seen: string[] = [];
    const cursors: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 30; page += 1) {
      const data = await fetchPage(cursor);
      seen.push(...data.items.map((item) => item.id));
      if (!data.nextCursor) break;
      cursors.push(data.nextCursor);
      cursor = data.nextCursor;
    }
    assert.equal(new Set(seen).size, seen.length, `${label}: pages must not duplicate rows`);
    return { seen, cursors };
  }

  setMerchantSessionForTests(sessionFor(USER_A));

  // Unauthenticated requests are rejected before any tenant work.
  setMerchantSessionForTests(null);
  for (const [label, route, path, propertyId] of [
    ['reservations', reservationsRoute, '/api/reservations', PROP_A],
    ['invoices', invoicesRoute, '/api/invoices', PROP_A],
    ['payments', paymentsRoute, '/api/payments', PROP_A],
    ['guests', guestsRoute, '/api/guests', PROP_A],
    ['front desk', frontDeskRoute, '/api/front-desk', PROP_A],
    ['assignable', assignableRoute, `/api/rooms/assignable-reservations?roomTypeId=${RT_A}`, PROP_A],
    ['in-house', inHouseRoute, '/api/restaurant/in-house', PROP_REST],
  ] as const) {
    const result = await get(route as any, path, propertyId);
    assert.equal(result.status, 401, `${label} must reject an unauthenticated request`);
  }
  pass('unauthenticated requests are rejected on every list endpoint');

  // Permissions still come from the membership role.
  setMerchantSessionForTests(sessionFor(USER_HK));
  const housekeepingRead = await get(reservationsRoute as any, '/api/reservations', PROP_A);
  assert.equal(housekeepingRead.status, 403, 'housekeeping must not read reservations');
  pass('role permissions are enforced after tenant resolution');

  setMerchantSessionForTests(sessionFor(USER_A));

  // Malformed and tampered cursors are rejected, not treated as "first page".
  for (const [label, route, path] of [
    ['reservations', reservationsRoute, '/api/reservations?cursor=not-a-cursor'],
    ['reservations', reservationsRoute, `/api/reservations?cursor=${tamperedCursor()}`],
    ['invoices', invoicesRoute, `/api/invoices?cursor=${tamperedCursor()}`],
    ['payments', paymentsRoute, `/api/payments?cursor=${tamperedCursor()}`],
    ['payments', paymentsRoute, `/api/payments?receivablesCursor=${tamperedCursor()}`],
    ['payments', paymentsRoute, `/api/payments?proofsCursor=${tamperedCursor()}`],
    ['guests', guestsRoute, `/api/guests?cursor=${tamperedCursor()}`],
    ['reservation detail', reservationDetailRoute, `/api/reservations/${RES_A}?eventsCursor=${tamperedCursor()}`],
  ] as const) {
    const result = await get(
      route as any,
      path,
      PROP_A,
      label === 'reservation detail' ? { params: Promise.resolve({ id: RES_A }) } : undefined
    );
    assert.equal(result.status, 400, `${label} must reject a bad cursor`);
  }
  pass('malformed and tampered cursors return 400');

  // Limit bounds: over-max clamps to MAX_PAGE_LIMIT, nonsense falls back.
  const clamped = await get(reservationsRoute as any, '/api/reservations?limit=1000', PROP_A);
  assert.equal(clamped.status, 200);
  assert.ok(clamped.body.items.length <= 100, 'limit above the cap must be clamped');
  const nonsense = await get(reservationsRoute as any, '/api/reservations?limit=abc', PROP_A);
  assert.equal(nonsense.status, 200);
  assert.ok(nonsense.body.items.length <= 25, 'invalid limit must fall back to the default');
  pass('page limit bounds are enforced');

  // Cross-tenant reads: A cannot see B through lists, detail, or summary.
  const crossReservations = await get(reservationsRoute as any, '/api/reservations?search=ROUTE-B-1', PROP_A);
  assert.equal(crossReservations.body.items.length, 0, 'A must not list B reservations');
  const crossInvoices = await get(invoicesRoute as any, '/api/invoices?search=ROUTE-INV-B-1', PROP_A);
  assert.equal(crossInvoices.body.items.length, 0, 'A must not list B invoices');
  const crossPayments = await get(paymentsRoute as any, `/api/payments?reservationId=${RES_B}`, PROP_A);
  assert.equal(crossPayments.body.items.length, 0, 'A must not list B payments');
  const crossGuests = await get(guestsRoute as any, '/api/guests?search=Tenant B Guest', PROP_A);
  assert.equal(crossGuests.body.items.length, 0, 'A must not list B guests');
  const crossReservationDetail = await get(reservationDetailRoute as any, `/api/reservations/${RES_B}`, PROP_A, {
    params: Promise.resolve({ id: RES_B }),
  });
  assert.equal(crossReservationDetail.status, 404, 'A must not read B reservation detail');
  const crossGuestDetail = await get(guestDetailRoute as any, `/api/guests/${GUEST_B}`, PROP_A, {
    params: Promise.resolve({ id: GUEST_B }),
  });
  assert.equal(crossGuestDetail.status, 404, 'A must not read B guest detail');
  const crossInvoiceDetail = await get(invoiceDetailRoute as any, `/api/invoices/${INV_B}`, PROP_A, {
    params: Promise.resolve({ id: INV_B }),
  });
  assert.equal(crossInvoiceDetail.status, 404, 'A must not read B invoice detail');
  const summary = await get(summaryRoute as any, '/api/reservations/summary', PROP_A);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.summary.totalReservations, 4, 'summary must count only A reservations');
  pass('tenant A cannot read tenant B rows through list, detail or summary');

  // Microsecond precision and tie handling through the HTTP boundary.
  const reservationWalk = await walk('reservations', async (cursor) => {
    const suffix = cursor ? `&cursor=${cursor}` : '';
    const result = await get(reservationsRoute as any, `/api/reservations?limit=1${suffix}`, PROP_A);
    assert.equal(result.status, 200);
    return result.body;
  });
  assert.equal(reservationWalk.seen.length, 4, 'reservation walk must return every row');
  assert.equal(reservationWalk.seen[0], RES_A, 'newest reservation comes first');
  assert.ok(
    reservationWalk.cursors.some((cursor) => String(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')).createdAt).includes('.123456')),
    'reservation cursor must preserve microseconds'
  );
  const reservationTieOrder = reservationWalk.seen.slice(1);
  assert.deepEqual(
    reservationTieOrder,
    [uuid('23000000-0000-4000-8000', 3), uuid('23000000-0000-4000-8000', 2), uuid('23000000-0000-4000-8000', 1)],
    'ties must page by id desc without duplicates or gaps'
  );
  pass('reservations survive a microsecond tie through HTTP pagination');

  const guestWalk = await walk('guests', async (cursor) => {
    const suffix = cursor ? `&cursor=${cursor}` : '';
    const result = await get(guestsRoute as any, `/api/guests?limit=1${suffix}`, PROP_A);
    assert.equal(result.status, 200);
    return result.body;
  });
  assert.equal(guestWalk.seen.length, 4, 'guest walk must return every row');
  assert.ok(
    guestWalk.cursors.some((cursor) => String(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')).createdAt).includes('.222222')),
    'guest cursor must preserve microseconds'
  );
  const guestRows = await get(guestsRoute as any, '/api/guests?limit=100', PROP_A);
  assert.ok(
    guestRows.body.items.every((guest: any) => typeof guest.totalSpendMinorUnits === 'string'),
    'guest lifetime spend must stay a string so bigint sums are not narrowed'
  );
  pass('guests survive a microsecond tie through HTTP pagination');

  const invoiceWalk = await walk('invoices', async (cursor) => {
    const suffix = cursor ? `&cursor=${cursor}` : '';
    const result = await get(invoicesRoute as any, `/api/invoices?limit=1${suffix}`, PROP_A);
    assert.equal(result.status, 200);
    return result.body;
  });
  assert.equal(invoiceWalk.seen.length, 3, 'invoice walk must return every row');
  assert.ok(
    invoiceWalk.cursors.some((cursor) => String(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')).createdAt).includes('.444444')),
    'invoice cursor must preserve microseconds'
  );
  pass('invoices survive a microsecond tie through HTTP pagination');

  const paymentWalk = await walk('payments', async (cursor) => {
    const suffix = cursor ? `&cursor=${cursor}` : '';
    const result = await get(paymentsRoute as any, `/api/payments?limit=1${suffix}`, PROP_A);
    assert.equal(result.status, 200);
    return result.body;
  });
  assert.equal(paymentWalk.seen.length, 3, 'payment walk must return every row');
  assert.ok(
    paymentWalk.cursors.some((cursor) => String(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')).createdAt).includes('.666666')),
    'payment cursor must preserve microseconds'
  );
  pass('payments survive a microsecond tie through HTTP pagination');

  const timelineSeen: string[] = [];
  let timelineCursor: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const suffix = timelineCursor ? `&eventsCursor=${timelineCursor}` : '';
    const result = await get(reservationDetailRoute as any, `/api/reservations/${RES_A}?eventsLimit=1${suffix}`, PROP_A, {
      params: Promise.resolve({ id: RES_A }),
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.reservation.timeline.length, 1);
    timelineSeen.push(result.body.reservation.timeline[0].text);
    timelineCursor = result.body.reservation.timelineNextCursor;
    if (!timelineCursor) break;
  }
  assert.equal(timelineSeen.length, 3, 'timeline walk must return every event');
  assert.deepEqual(timelineSeen, ['Timeline tie 3', 'Timeline tie 2', 'Timeline tie 1']);
  pass('reservation timeline cursor keeps microsecond ties through HTTP');

  // Operational boards: every one of the 600 rows must be returned.
  const frontDesk = await get(frontDeskRoute as any, '/api/front-desk', PROP_OPS);
  assert.equal(frontDesk.status, 200);
  assert.equal(frontDesk.body.arrivals.all.total, 600);
  assert.equal(frontDesk.body.arrivals.all.truncated, false);
  assert.equal(frontDesk.body.arrivals.all.items.length, 600);
  assert.equal(new Set(frontDesk.body.arrivals.all.items.map((item: any) => item.id)).size, 600);
  assert.equal(frontDesk.body.inHouse.items.length, 600);
  assert.equal(frontDesk.body.departures.today.items.length, 600);
  pass('front desk returns all 600 arrivals, in-house stays and departures');

  const assignable = await get(assignableRoute as any, `/api/rooms/assignable-reservations?roomTypeId=${RT_OPS}`, PROP_OPS);
  assert.equal(assignable.status, 200);
  assert.equal(assignable.body.total, 600);
  assert.equal(assignable.body.truncated, false);
  assert.equal(new Set(assignable.body.items.map((item: any) => item.id)).size, 600);
  const assignableByName = await get(assignableRoute as any, '/api/rooms/assignable-reservations?roomType=Route%20Standard%20Ops', PROP_OPS);
  assert.equal(assignableByName.status, 200);
  assert.equal(assignableByName.body.total, 600);
  const badRoomType = await get(assignableRoute as any, '/api/rooms/assignable-reservations?roomTypeId=nope', PROP_OPS);
  assert.equal(badRoomType.status, 400);
  pass('room assignment returns all 600 unassigned arrivals');

  const inHouse = await get(inHouseRoute as any, '/api/restaurant/in-house', PROP_REST);
  assert.equal(inHouse.status, 200);
  assert.equal(inHouse.body.total, 600);
  assert.equal(inHouse.body.truncated, false);
  assert.equal(new Set(inHouse.body.items.map((item: any) => item.id)).size, 600);
  pass('POS in-house returns all 600 checked-in stays');

  console.log('\nAll route-level list tests passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await reset();
    } finally {
      await sql.end();
    }
  });
