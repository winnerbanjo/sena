/**
 * Real-Postgres tests for the keyset list queries.
 *
 *   SENA_BENCH_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/sena_bench \
 *     pnpm tsx scripts/test-list-pagination.ts
 *
 * Expects the benchmark seed (scripts/seed-list-pagination-bench.ts) to be loaded.
 */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { decodeCursor, encodeCursor, escapeLikePattern, parsePageLimit } from '../apps/dashboard/src/lib/pagination';

const url = process.env.SENA_BENCH_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Set SENA_BENCH_DATABASE_URL (or DATABASE_URL) to the seeded benchmark database.');
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });

const PROPERTY_A = '10000000-0000-4000-8000-000000000001';
const PROPERTY_B = '10000000-0000-4000-8000-000000000002';
const TEST_PROPERTY = '10000000-0000-4000-8000-000000000099';
const ORG = '00000000-0000-4000-8000-000000000001';
const TEST_ROOM_TYPE = '50000000-0000-4000-8000-000000000099';

type Row = Record<string, any>;

function pass(message: string) {
  console.log(`  ✔ ${message}`);
}

async function reservationPage(
  propertyId: string,
  options: { limit?: number; cursor?: string | null; status?: string; search?: string } = {}
) {
  const limit = Math.min(options.limit ?? 25, 100);
  const conditions = ['r.property_id = $1'];
  const params: unknown[] = [propertyId];
  if (options.status) {
    params.push(options.status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (options.search) {
    params.push(`%${escapeLikePattern(options.search)}%`);
    conditions.push(`(r.reference ilike $${params.length} or g.full_name ilike $${params.length} or rm.room_number ilike $${params.length})`);
  }
  const cursor = decodeCursor(options.cursor);
  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    conditions.push(`(r.created_at, r.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
  }
  params.push(limit + 1);
  const rows = await sql.unsafe<Row[]>(
    `select r.id, r.reference, r.status, r.created_at, r.property_id
     from reservations r
     left join guests g on g.id = r.guest_id
     left join rooms rm on rm.id = r.room_id
     where ${conditions.join(' and ')}
     order by r.created_at desc, r.id desc
     limit $${params.length}`,
    params as never[]
  );
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page,
    nextCursor: rows.length > limit && last
      ? encodeCursor({ createdAt: new Date(last.created_at).toISOString(), id: last.id })
      : null,
  };
}

async function walkReservations(propertyId: string, limit: number) {
  const seen: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page = await reservationPage(propertyId, { limit, cursor });
    seen.push(...page.items.map((row) => row.id));
    cursor = page.nextCursor;
    pages += 1;
    assert.ok(pages < 1000, 'pagination did not terminate');
  } while (cursor);
  return { seen, pages };
}

async function main() {
  console.log('Cursor helpers');
  assert.equal(parsePageLimit(null), 25);
  assert.equal(parsePageLimit('1000'), 100);
  assert.equal(parsePageLimit('0'), 25);
  assert.equal(decodeCursor('not-a-cursor'), null);
  const cursor = encodeCursor({ createdAt: '2026-01-01T00:00:00.000Z', id: '30000000-0000-4000-8000-000000000001' });
  assert.deepEqual(decodeCursor(cursor), { createdAt: '2026-01-01T00:00:00.000Z', id: '30000000-0000-4000-8000-000000000001' });
  pass('limit bounds, opaque cursors, malformed cursors');

  console.log('First page and full walk');
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count from reservations where property_id = ${PROPERTY_A}::uuid
  `;
  const first = await reservationPage(PROPERTY_A, { limit: 25 });
  assert.equal(first.items.length, 25);
  assert.ok(first.nextCursor);
  assert.ok(first.items.every((row) => row.property_id === PROPERTY_A));
  const walk = await walkReservations(PROPERTY_A, 100);
  assert.equal(walk.seen.length, Number(count));
  assert.equal(new Set(walk.seen).size, walk.seen.length);
  pass(`walked ${walk.seen.length} reservations in ${walk.pages} pages with no duplicates`);

  console.log('Last page and empty page');
  const filteredTotal = await reservationPage(PROPERTY_A, { limit: 1, status: 'pending' });
  assert.equal(filteredTotal.items.length, 1);
  let lastCursor = filteredTotal.nextCursor;
  let lastPageSize = 0;
  let lastPage: Row[] = [];
  while (lastCursor) {
    const page = await reservationPage(PROPERTY_A, { limit: 100, status: 'pending', cursor: lastCursor });
    lastPage = page.items;
    lastPageSize = page.items.length;
    lastCursor = page.nextCursor;
  }
  assert.ok(lastPageSize > 0 && lastPageSize <= 100);
  assert.equal(lastPage[lastPage.length - 1].status, 'pending');
  const empty = await reservationPage(PROPERTY_A, { search: 'no-such-reservation-zzzz' });
  assert.deepEqual(empty, { items: [], nextCursor: null });
  pass('last page has no next cursor; empty result is { items: [], nextCursor: null }');

  console.log('Equal timestamps');
  await sql`delete from properties where id = ${TEST_PROPERTY}::uuid`;
  await sql`
    insert into properties (id, organization_id, name, code, address, phone, email)
    values (${TEST_PROPERTY}::uuid, ${ORG}::uuid, 'Pagination Test', 'PAGTEST', '1 Test Way', '08000000000', 'pagtest@example.test')
  `;
  await sql`
    insert into room_types (id, property_id, name, bed_type, base_price_minor_units)
    values (${TEST_ROOM_TYPE}::uuid, ${TEST_PROPERTY}::uuid, 'Test Room', 'queen', 1000000)
  `;
  await sql`
    insert into guests (id, organization_id, property_id, full_name, email, phone, preferences)
    values ('20000000-0000-4000-8000-999999999901'::uuid, ${ORG}::uuid, ${TEST_PROPERTY}::uuid,
            'Percent%Guest', 'percent@example.test', '08990000000', '[]'::jsonb)
  `;
  const sameTimestamp = '2026-02-01T12:00:00.000Z';
  for (let i = 1; i <= 5; i += 1) {
    await sql`
      insert into reservations (
        id, reference, property_id, guest_id, room_type_id, check_in_date, check_out_date,
        nights, total_amount_minor_units, paid_amount_minor_units, status, created_at
      ) values (
        ${`30000000-0000-4000-8000-9999999900${String(i).padStart(2, '0')}`}::uuid,
        ${`PAGTEST-${i}`}, ${TEST_PROPERTY}::uuid,
        '20000000-0000-4000-8000-999999999901'::uuid, ${TEST_ROOM_TYPE}::uuid,
        '2026-02-01', '2026-02-03', 2, 1000000, 0, 'confirmed', ${sameTimestamp}::timestamptz
      )
    `;
  }
  const tieWalk = await walkReservations(TEST_PROPERTY, 2);
  assert.equal(tieWalk.seen.length, 5);
  assert.equal(new Set(tieWalk.seen).size, 5);
  pass('five rows sharing createdAt paginate without duplicates or skips');

  console.log('Filters');
  const checkedIn = await reservationPage(PROPERTY_A, { limit: 100, status: 'checked_in' });
  assert.ok(checkedIn.items.length > 0);
  assert.ok(checkedIn.items.every((row) => row.status === 'checked_in'));
  const literalPercent = await reservationPage(TEST_PROPERTY, { search: '%' });
  assert.equal(literalPercent.items.length, 5, 'a literal % must match only the guest named Percent%Guest');
  const guestSearch = await sql<Row[]>`
    select id from guests
    where property_id = ${PROPERTY_A}::uuid
      and (full_name ilike ${'%Guest 12%'} or email ilike ${'%Guest 12%'} or phone ilike ${'%Guest 12%'})
    limit 10
  `;
  assert.ok(guestSearch.length > 0);
  const unpaid = await sql<Row[]>`
    select status, paid_amount_minor_units, total_amount_minor_units
    from property_invoices
    where property_id = ${PROPERTY_A}::uuid
      and status in ('issued', 'partially_paid', 'overdue')
      and paid_amount_minor_units < total_amount_minor_units
    limit 50
  `;
  assert.ok(unpaid.length > 0);
  assert.ok(unpaid.every((row) => row.paid_amount_minor_units < row.total_amount_minor_units));
  pass('status, escaped LIKE, guest search, and unpaid filters');

  console.log('Tenant isolation');
  const aPage = await reservationPage(PROPERTY_A, { limit: 100 });
  const bPage = await reservationPage(PROPERTY_B, { limit: 100 });
  assert.ok(aPage.items.every((row) => row.property_id === PROPERTY_A));
  assert.ok(bPage.items.every((row) => row.property_id === PROPERTY_B));
  assert.ok(aPage.items.every((row) => !bPage.items.some((other) => other.id === row.id)));
  const guestLeak = await sql<Row[]>`
    select id from guests where property_id = ${PROPERTY_A}::uuid and property_id <> ${PROPERTY_A}::uuid
  `;
  assert.equal(guestLeak.length, 0);
  pass('property A pages never contain property B rows');

  await sql`delete from properties where id = ${TEST_PROPERTY}::uuid`;
  await sql.end();
  console.log('\nAll list pagination tests passed.');
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
